import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import Busboy from "busboy";
import type { NextRequest } from "next/server";
import { badRequest } from "@/lib/errors";
import { env } from "@/lib/env";
import { MediaValidationError } from "@/lib/signatures";
import { sanitizeFilename } from "@/lib/security";

export interface ParsedUpload {
  filePath: string;
  filename: string;
  declaredMime: string;
  sizeBytes: number;
  sha256: string;
}

export interface MultipartUploadResult {
  files: ParsedUpload[];
  cleanup: () => Promise<void>;
}

export async function parseMultipartUpload(request: NextRequest): Promise<MultipartUploadResult> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw badRequest("Uploads must use multipart/form-data.");
  }
  if (!request.body) throw badRequest("The upload body was empty.");

  const directory = await mkdtemp(path.join(os.tmpdir(), "clearframe-upload-"));
  const cleanup = () => rm(directory, { recursive: true, force: true });
  const filePromises: Array<Promise<ParsedUpload>> = [];
  let parserError: Error | null = null;

  const busboy = Busboy({
    headers: { "content-type": contentType },
    limits: {
      fileSize: env.maxUploadBytes,
      files: env.maxBatchFiles,
      parts: env.maxBatchFiles + 8,
      fields: 8,
      fieldSize: 2048,
    },
  });

  busboy.on("filesLimit", () => {
    parserError = new MediaValidationError(`A batch may contain at most ${env.maxBatchFiles} files.`, "TOO_MANY_FILES");
  });
  busboy.on("partsLimit", () => {
    parserError = new MediaValidationError("The upload contains too many parts.", "TOO_MANY_PARTS");
  });

  busboy.on("file", (fieldName, stream, info) => {
    if (fieldName !== "files") {
      stream.resume();
      return;
    }
    const filename = sanitizeFilename(info.filename || "uploaded-media");
    const declaredMime = (info.mimeType || "application/octet-stream").split(";")[0].trim().toLowerCase();
    const filePath = path.join(directory, `${randomUUID()}.upload`);
    const hash = createHash("sha256");
    let bytes = 0;
    let tooLarge = false;

    const counter = new Transform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > env.maxUploadBytes) {
          tooLarge = true;
          callback(new MediaValidationError("The uploaded file exceeds the configured size limit.", "FILE_TOO_LARGE"));
          return;
        }
        hash.update(chunk);
        callback(null, chunk);
      },
    });

    stream.on("limit", () => {
      tooLarge = true;
      counter.destroy(new MediaValidationError("The uploaded file exceeds the configured size limit.", "FILE_TOO_LARGE"));
    });

    filePromises.push(
      pipeline(stream, counter, createWriteStream(filePath, { flags: "w" })).then(() => {
        if (tooLarge) throw new MediaValidationError("The uploaded file exceeds the configured size limit.", "FILE_TOO_LARGE");
        if (bytes === 0) throw new MediaValidationError("The uploaded file was empty.", "EMPTY_FILE");
        return { filePath, filename, declaredMime, sizeBytes: bytes, sha256: hash.digest("hex") };
      }),
    );
  });

  const parsed = new Promise<void>((resolve, reject) => {
    busboy.on("error", reject);
    busboy.on("finish", resolve);
  });

  try {
    await pipeline(Readable.fromWeb(request.body as any), busboy);
    await parsed;
    if (parserError) throw parserError;
    const files = await Promise.all(filePromises);
    if (!files.length) throw badRequest("Attach at least one media file.");
    return { files, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
