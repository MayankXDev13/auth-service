"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setAccessToken } from "@/lib/token";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { FaLock, FaTimesCircle } from "react-icons/fa";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();

  // Prevent multiple executions
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const token = params.get("accessToken");

    if (!token) {
      toast.error("OAuth login failed");
      router.replace("/login");
      return;
    }

    // Store token
    setAccessToken(token);

    toast.success("Logged in successfully");

    // Redirect to dashboard
    router.replace("/dashboard");
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card
        className="
          w-full max-w-md p-6 space-y-4 text-center
          bg-zinc-900/70 backdrop-blur
          border border-zinc-800
          shadow-xl shadow-black/40
          rounded-2xl
          animate-in fade-in zoom-in duration-300
        "
      >
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white border-t-transparent" />

        <h2 className="text-lg font-semibold text-white">
          Signing you in
        </h2>

        <p className="text-sm text-zinc-400">
          Please wait while we complete your login.
        </p>
      </Card>
    </div>
  );
}
