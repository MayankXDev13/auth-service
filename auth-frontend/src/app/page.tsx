"use client";

import { useSession } from "@/hooks/auth/useSession";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { data: user, isLoading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    router.replace(user ? "/dashboard" : "/login");
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        {/* Spinner */}
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
        <p className="text-sm text-zinc-400">Checking session…</p>
      </div>
    </div>
  );
}
