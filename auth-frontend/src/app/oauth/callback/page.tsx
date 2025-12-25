"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";

export default function OAuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    toast.success("Logged in successfully");
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-6 text-center bg-zinc-900/70 border border-zinc-800 rounded-2xl">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white border-t-transparent" />
        <h2 className="text-lg font-semibold text-white mt-4">
          Signing you in
        </h2>
        <p className="text-sm text-zinc-400">
          Please wait while we complete your login.
        </p>
      </Card>
    </div>
  );
}
