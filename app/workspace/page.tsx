import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceClient } from "@/components/workspace/workspace-client";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Conversion workspace" };
export const dynamic = "force-dynamic";

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="container-shell py-16"><Skeleton className="h-96 rounded-3xl" /></div>}>
      <WorkspaceClient />
    </Suspense>
  );
}
