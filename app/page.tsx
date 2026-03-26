/* eslint-disable react-hooks/set-state-in-effect -- simple timeout reset for hidden admin trigger */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const router = useRouter();
  const [titleClicks, setTitleClicks] = useState(0);

  useEffect(() => {
    if (titleClicks === 0) return;
    const t = setTimeout(() => setTitleClicks(0), 3500);
    return () => clearTimeout(t);
  }, [titleClicks]);

  function onTitleClick() {
    const next = titleClicks + 1;
    if (next >= 5) {
      setTitleClicks(0);
      router.push("/admin");
      return;
    }
    setTitleClicks(next);
  }

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-[#c8102e]/30 bg-white p-8 text-center shadow-sm dark:bg-zinc-950">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#c8102e]">
          Northwestern Oklahoma State University
        </p>
        <h1
          className="mt-2 text-3xl font-semibold tracking-tight text-[#c8102e]"
          onClick={onTitleClick}
        >
          Scheduling for Dr. Christopher Neu
        </h1>
        <p className="mt-3 text-zinc-700 dark:text-zinc-300">
          Book a meeting from available times.
        </p>
        <Link
          href="/book"
          className="mx-auto mt-8 inline-flex items-center justify-center rounded-lg bg-[#c8102e] px-6 py-3 text-sm font-medium text-white hover:bg-[#a30f27]"
        >
          Book a time
        </Link>
      </div>
    </div>
  );
}
