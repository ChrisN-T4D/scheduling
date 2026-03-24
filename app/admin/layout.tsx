import { Suspense } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">Loading…</div>}>
      {children}
    </Suspense>
  );
}
