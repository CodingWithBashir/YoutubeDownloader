import { NextResponse } from "next/server";
import type { z } from "zod";
import { badRequest } from "@/lib/errors";

export async function parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  try {
    return schema.parse(await request.json());
  } catch (error) {
    if (error instanceof SyntaxError || (error instanceof Error && error.message.includes("JSON"))) {
      throw badRequest("The request body must be valid JSON.");
    }
    throw error;
  }
}

export function jsonResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
