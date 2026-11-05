import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
    public headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function badRequest(message: string, details?: unknown) {
  return new ApiError(400, "BAD_REQUEST", message, details);
}

export function unauthorized(message = "This resource is not available to this session.") {
  return new ApiError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "This action is not allowed.") {
  return new ApiError(403, "FORBIDDEN", message);
}

export function notFound(message = "The requested resource was not found.") {
  return new ApiError(404, "NOT_FOUND", message);
}

export function conflict(message: string) {
  return new ApiError(409, "CONFLICT", message);
}

export function tooManyRequests(message: string, retryAfter: number) {
  return new ApiError(429, "RATE_LIMITED", message, undefined, {
    "Retry-After": String(retryAfter),
  });
}

export function serviceUnavailable(message: string) {
  return new ApiError(503, "SERVICE_UNAVAILABLE", message);
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status, headers: { "Cache-Control": "no-store", ...error.headers } },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "The request did not match the expected shape.",
          details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (error instanceof Error && ["MediaValidationError", "UrlImportError"].includes(error.name)) {
    const code = "code" in error && typeof error.code === "string" ? error.code : "INVALID_MEDIA";
    const status = code === "FILE_TOO_LARGE" ? 413 : ["UNRECOGNIZED_SIGNATURE", "MIME_MISMATCH", "EXTENSION_MISMATCH", "UNSUPPORTED_CONTENT_TYPE", "INVALID_OUTPUT_SIGNATURE"].includes(code) ? 415 : 400;
    return NextResponse.json(
      { error: { code, message: error.message } },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (process.env.NODE_ENV !== "test") {
    console.error("[clearframe] Unhandled API error", error);
  }

  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred." } },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

export function apiErrorFromUnknown(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error;
  return new ApiError(500, "INTERNAL_ERROR", fallback);
}
