"use client";

import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { z } from "zod";
import { useResetPassword } from "@/hooks/auth/useAccount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { FaKey } from "react-icons/fa";

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),
});

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordForm() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const resetPassword = useResetPassword();

  const isLoading = resetPassword.isPending;

  /* ------------------------------- FORM ------------------------------- */
  const form = useForm<ResetPasswordInput>({
    defaultValues: {
      password: "",
    },

    validatorAdapter: zodValidator(),

    validators: {
      onSubmit: resetPasswordSchema,
    },

    onSubmit: async ({ value }) => {
      try {
        await resetPassword.mutateAsync({
          token,
          password: value.password,
        });

        toast.success("Password reset successfully");
        router.replace("/login");
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to reset password"
        );
      }
    },
  });

  /* ------------------------------- UI -------------------------------- */
  return (
    <Card
      className="
        w-full max-w-md p-6 space-y-5
        bg-zinc-900/70 backdrop-blur
        border border-zinc-800
        shadow-xl shadow-black/40
        rounded-2xl
        animate-in fade-in zoom-in duration-300
      "
    >
      {/* Title */}
      <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
        <FaKey /> Reset Password
      </h2>

      <p className="text-sm text-zinc-400">
        Enter a new password for your account.
      </p>

      {/* Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-4"
        noValidate
      >
        {/* Password */}
        <form.Field name="password">
          {(field) => (
            <div className="space-y-1">
              <Input
                type="password"
                placeholder="New password"
                autoComplete="new-password"
                disabled={isLoading}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className="
                  bg-zinc-800 border-zinc-700 text-white
                  focus:border-white focus:ring-1 focus:ring-white
                "
              />

              {field.state.meta.errors?.[0] && (
                <p className="text-sm text-red-500">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        {/* Submit */}
        <Button
          type="submit"
          disabled={!form.state.canSubmit || isLoading}
          className="
            w-full font-medium
            bg-white text-black
            hover:bg-zinc-200
            transition
            hover:scale-[1.01] active:scale-[0.99]
          "
        >
          {isLoading ? "Resetting password..." : "Reset Password"}
        </Button>
      </form>

      {/* Back to login */}
      <div className="text-center text-sm text-zinc-400">
        Remembered your password?{" "}
        <button
          type="button"
          className="text-white hover:underline transition"
          onClick={() => router.push("/login")}
        >
          Login
        </button>
      </div>
    </Card>
  );
}
