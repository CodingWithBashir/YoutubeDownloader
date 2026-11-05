import type { Metadata } from "next";
import { AdminClient } from "@/components/admin/admin-client";

export const metadata: Metadata = {
  title: "Admin overview",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default function AdminPage() {
  return <AdminClient />;
}
