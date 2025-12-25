"use client";

import { useVerifyEmail } from "@/hooks/auth/useAccount";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const verifyEmail = useVerifyEmail();

  useEffect(() => {
    verifyEmail.mutate(token, {
      onSuccess: () => {
        toast.success("Email verified successfully");
        router.replace("/login");
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || "Invalid or expired token");
      },
    });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      Verifying email...
    </div>
  );
}
