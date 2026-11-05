import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ProgressClient } from "@/components/progress/progress-client";

export const metadata: Metadata = { title: "Conversion progress" };
export const dynamic = "force-dynamic";

export default async function ProgressPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  if (!z.string().uuid().safeParse(batchId).success) notFound();
  return <ProgressClient batchId={batchId} />;
}
