"use client";

import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { z } from "zod";
import { useForgotPassword } from "@/hooks/auth/useAccount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { FaEnvelope } from "react-icons/fa";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordForm() {
  const forgotPassword = useForgotPassword();
  const router = useRouter();

  const isLoading = forgotPassword.isPending;

  /* ------------------------------- FORM ------------------------------- */
  const form = useForm<ForgotPasswordInput>({
    defaultValues: {
      email: "",
    },

    validatorAdapter: zodValidator(),

    validators: {
      onSubmit: forgotPasswordSchema,
    },

    onSubmit: async ({ value }) => {
      try {
        await forgotPassword.mutateAsync(value.email);
        toast.success("Password reset email sent");
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to send reset email"
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
        <FaEnvelope /> Forgot Password
      </h2>

      <p className="text-sm text-zinc-400">
        Enter your email address and we’ll send you a reset link.
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
        {/* Email */}
        <form.Field name="email">
          {(field) => (
            <div className="space-y-1">
              <Input
                type="email"
                placeholder="Email address"
                autoComplete="email"
                autoFocus
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
          {isLoading ? "Sending email..." : "Send Reset Link"}
        </Button>
      </form>

      {/* Back to login */}
      <div className="text-center text-sm text-zinc-400">
        Remember your password?{" "}
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
