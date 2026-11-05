import { z } from "zod";
import {
  OUTPUT_FORMAT_VALUES,
  VIDEO_PRESET_VALUES,
  VIDEO_QUALITY_VALUES,
} from "@/lib/presets";

export const JOB_STATUS_VALUES = ["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELED"] as const;

export const urlImportSchema = z.object({
  url: z
    .string()
    .trim()
    .min(12, "Enter a direct media file URL.")
    .max(2048, "The URL is too long.")
    .url("Enter a valid http or https URL."),
  authorized: z.literal(true, {
    error: "Confirm that you own or are explicitly authorized to process this direct media file.",
  }),
});

export const createJobsSchema = z
  .object({
    items: z
      .array(
        z.object({
          mediaId: z.string().uuid("Each file must have a valid media ID."),
          targetFormat: z.enum(OUTPUT_FORMAT_VALUES),
          videoPreset: z.enum(VIDEO_PRESET_VALUES).optional().default("source"),
          videoQuality: z.enum(VIDEO_QUALITY_VALUES).optional().default("balanced"),
          audioBitrateKbps: z
            .union([z.literal(128), z.literal(192), z.literal(256), z.literal(320)])
            .nullable()
            .optional(),
        }),
      )
      .min(1, "Select at least one conversion.")
      .max(32, "Too many conversions in one batch."),
    authorized: z.literal(true, {
      error: "Confirm that you are authorized to process every selected file.",
    }),
  })
  .strict();

export const historyQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(JOB_STATUS_VALUES).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const idsQuerySchema = z
  .string()
  .transform((value) => value.split(",").map((item) => item.trim()).filter(Boolean))
  .pipe(z.array(z.string().uuid()).min(1).max(32));
