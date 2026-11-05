import type { Metadata } from "next";
import { HistoryClient } from "@/components/history/history-client";

export const metadata: Metadata = { title: "Conversion history" };
export const dynamic = "force-dynamic";

export default function HistoryPage() {
  return <HistoryClient />;
}
