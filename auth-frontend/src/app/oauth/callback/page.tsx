"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setAccessToken } from "@/lib/token";
import { toast } from "sonner";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get("accessToken");

    if (!token) {
      toast.error("OAuth login failed");
      router.replace("/login");
      return;
    }

    setAccessToken(token);
    toast.success("Logged in successfully");
    router.replace("/dashboard");
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      Logging you in...
    </div>
  );
}
