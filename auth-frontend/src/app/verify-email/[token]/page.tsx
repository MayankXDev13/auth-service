"use client";

import { useVerifyEmail } from "@/hooks/auth/useAccount";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const verifyEmail = useVerifyEmail();

  // Prevent double execution (VERY IMPORTANT)
  const hasRun = useRef(false);

  useEffect(() => {
    if (!token || hasRun.current) return;

    hasRun.current = true;

    verifyEmail.mutate(token, {
      onSuccess: () => {
        toast.success("Email verified successfully");
        setTimeout(() => {
          router.replace("/login");
        }, 1500);
      },
      onError: (err: any) => {
        toast.error(
          err?.response?.data?.message || "Invalid or expired verification link"
        );
      },
    });
  }, [token, verifyEmail, router]);

  const isLoading = verifyEmail.isPending;
  const isError = verifyEmail.isError;

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
        {/* Loading */}
        {isLoading && (
          <>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <h2 className="text-lg font-semibold text-white">
              Verifying your email
            </h2>
            <p className="text-sm text-zinc-400">
              Please wait while we verify your email address.
            </p>
          </>
        )}

        {/* Error */}
        {isError && (
          <>
            <FaTimesCircle className="mx-auto text-red-500 text-4xl" />
            <h2 className="text-lg font-semibold text-white">
              Verification failed
            </h2>
            <p className="text-sm text-zinc-400">
              This verification link may be invalid or expired.
            </p>

            <button
              onClick={() => router.replace("/login")}
              className="mt-2 text-white underline underline-offset-4"
            >
              Go to login
            </button>
          </>
        )}

        {/* Success handled by toast + redirect */}
        {!isLoading && !isError && verifyEmail.isSuccess && (
          <>
            <FaCheckCircle className="mx-auto text-green-500 text-4xl" />
            <h2 className="text-lg font-semibold text-white">
              Email verified
            </h2>
            <p className="text-sm text-zinc-400">
              Redirecting you to login…
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
