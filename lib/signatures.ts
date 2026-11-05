import { safeExtension } from "@/lib/security";
import type { OutputFormat } from "@/lib/presets";

export type MediaContainer =
  | "mp4"
  | "webm"
  | "mp3"
  | "wav"
  | "flac"
  | "aac"
  | "ogg"
  | "avi"
  | "mpegts";

export class MediaValidationError extends Error {
  constructor(
    message: string,
    public code = "INVALID_MEDIA",
  ) {
    super(message);
    this.name = "MediaValidationError";
  }
}

interface ContainerDefinition {
  extensions: string[];
  mimeTypes: string[];
  canonicalMime: string;
  canonicalExtension: string;
  detect: (head: Buffer) => boolean;
}

const ascii = (buffer: Buffer, start: number, end: number) => buffer.toString("ascii", start, end);
const latin1 = (buffer: Buffer, start: number, end: number) => buffer.toString("latin1", start, end);

function isMp3Frame(head: Buffer) {
  return head.length >= 2 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
}

function isAacAdts(head: Buffer) {
  return (
    head.length >= 2 &&
    head[0] === 0xff &&
    (head[1] === 0xf1 || head[1] === 0xf9 || (head[1] & 0xf6) === 0xf0)
  );
}

export const CONTAINER_DEFINITIONS: Record<MediaContainer, ContainerDefinition> = {
  mp4: {
    extensions: ["mp4", "m4v", "mov", "m4a", "m4b", "3gp", "3g2"],
    mimeTypes: [
      "video/mp4",
      "audio/mp4",
      "video/quicktime",
      "audio/x-m4a",
      "audio/aac",
      "video/3gpp",
      "application/mp4",
      "application/octet-stream",
    ],
    canonicalMime: "video/mp4",
    canonicalExtension: "mp4",
    detect: (head) => head.length >= 12 && ascii(head, 4, 8) === "ftyp",
  },
  webm: {
    extensions: ["webm", "mkv", "mka"],
    mimeTypes: ["video/webm", "audio/webm", "video/x-matroska", "audio/x-matroska", "application/octet-stream"],
    canonicalMime: "video/webm",
    canonicalExtension: "webm",
    detect: (head) =>
      head.length >= 4 &&
      head[0] === 0x1a &&
      head[1] === 0x45 &&
      head[2] === 0xdf &&
      head[3] === 0xa3 &&
      /webm|matroska/i.test(latin1(head, 0, Math.min(head.length, 160))),
  },
  mp3: {
    extensions: ["mp3", "mpeg"],
    mimeTypes: ["audio/mpeg", "audio/mp3", "audio/x-mpeg", "application/octet-stream"],
    canonicalMime: "audio/mpeg",
    canonicalExtension: "mp3",
    detect: (head) => (head.length >= 3 && ascii(head, 0, 3) === "ID3") || isMp3Frame(head),
  },
  wav: {
    extensions: ["wav", "wave"],
    mimeTypes: ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave", "application/octet-stream"],
    canonicalMime: "audio/wav",
    canonicalExtension: "wav",
    detect: (head) => head.length >= 12 && ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 12) === "WAVE",
  },
  flac: {
    extensions: ["flac"],
    mimeTypes: ["audio/flac", "audio/x-flac", "application/octet-stream"],
    canonicalMime: "audio/flac",
    canonicalExtension: "flac",
    detect: (head) => head.length >= 4 && ascii(head, 0, 4) === "fLaC",
  },
  aac: {
    extensions: ["aac", "adts"],
    mimeTypes: ["audio/aac", "audio/aacp", "audio/x-aac", "application/octet-stream"],
    canonicalMime: "audio/aac",
    canonicalExtension: "aac",
    detect: isAacAdts,
  },
  ogg: {
    extensions: ["ogg", "oga", "opus", "ogv"],
    mimeTypes: ["audio/ogg", "video/ogg", "application/ogg", "audio/opus", "application/octet-stream"],
    canonicalMime: "audio/ogg",
    canonicalExtension: "ogg",
    detect: (head) => head.length >= 4 && ascii(head, 0, 4) === "OggS",
  },
  avi: {
    extensions: ["avi"],
    mimeTypes: ["video/avi", "video/x-msvideo", "video/msvideo", "application/octet-stream"],
    canonicalMime: "video/x-msvideo",
    canonicalExtension: "avi",
    detect: (head) => head.length >= 12 && ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 12).startsWith("AVI"),
  },
  mpegts: {
    extensions: ["ts", "m2ts", "mts"],
    mimeTypes: ["video/mp2t", "video/mpeg", "application/octet-stream"],
    canonicalMime: "video/mp2t",
    canonicalExtension: "ts",
    detect: (head) => head.length >= 377 && head[0] === 0x47 && head[188] === 0x47 && head[376] === 0x47,
  },
};

export function detectContainer(head: Buffer): MediaContainer | null {
  for (const [name, definition] of Object.entries(CONTAINER_DEFINITIONS) as Array<[MediaContainer, ContainerDefinition]>) {
    if (definition.detect(head)) return name;
  }
  return null;
}

function normalizeMime(value?: string | null) {
  return (value || "").split(";")[0].trim().toLowerCase();
}

export interface ValidatedMediaSignature {
  container: MediaContainer;
  extension: string;
  mimeType: string;
  filename: string;
}

export function validateMediaSignature(options: {
  head: Buffer;
  filename: string;
  declaredMime?: string | null;
  allowUnknownExtension?: boolean;
}): ValidatedMediaSignature {
  const { head, filename, declaredMime, allowUnknownExtension = false } = options;
  const container = detectContainer(head);
  if (!container) {
    throw new MediaValidationError(
      "The file signature is not a recognized video or audio container. HTML, scripts, archives and renamed files are rejected.",
      "UNRECOGNIZED_SIGNATURE",
    );
  }

  const definition = CONTAINER_DEFINITIONS[container];
  const extension = safeExtension(filename);
  const declared = normalizeMime(declaredMime);

  if (declared && !definition.mimeTypes.includes(declared)) {
    throw new MediaValidationError(
      `The declared MIME type (${declared}) does not match the detected ${container.toUpperCase()} signature.`,
      "MIME_MISMATCH",
    );
  }

  if (!extension) {
    if (!allowUnknownExtension) {
      throw new MediaValidationError("A recognized media file extension is required for uploads.", "MISSING_EXTENSION");
    }
  } else if (!definition.extensions.includes(extension)) {
    throw new MediaValidationError(
      `The .${extension} extension does not match the detected ${container.toUpperCase()} signature.`,
      "EXTENSION_MISMATCH",
    );
  }

  const canonicalMime = declared && declared !== "application/octet-stream" ? declared : definition.canonicalMime;
  return {
    container,
    extension: extension || definition.canonicalExtension,
    mimeType: canonicalMime,
    filename,
  };
}

const OUTPUT_EXPECTED: Record<OutputFormat, MediaContainer[]> = {
  MP4: ["mp4"],
  WEBM: ["webm"],
  MP3: ["mp3"],
  WAV: ["wav"],
  AAC: ["aac", "mp4"],
  FLAC: ["flac"],
};

export function validateOutputSignature(format: OutputFormat, head: Buffer) {
  const detected = detectContainer(head);
  if (!detected || !OUTPUT_EXPECTED[format].includes(detected)) {
    throw new MediaValidationError(
      `The FFmpeg result did not have a valid ${format} file signature.`,
      "INVALID_OUTPUT_SIGNATURE",
    );
  }
  return detected;
}

export function containerExtension(container: MediaContainer) {
  return CONTAINER_DEFINITIONS[container].canonicalExtension;
}
