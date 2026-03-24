import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Scheduling
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Book a session from your available times. Host tools live in admin.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/book"
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Book a time
        </Link>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-900"
        >
          Admin
        </Link>
      </div>
    </div>
  );
}
