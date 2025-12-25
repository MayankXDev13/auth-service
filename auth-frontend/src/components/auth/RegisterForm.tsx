"use client";

import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { useMutation } from "@tanstack/react-query";
import { registerSchema, RegisterInput } from "@/schemas/auth.schema";
import { registerUserApi } from "@/lib/auth.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { FaUserPlus, FaGithub, FaGoogle } from "react-icons/fa";
import { loginWithGoogle, loginWithGithub } from "@/lib/oauth";
import { useRouter } from "next/navigation";

export default function RegisterForm() {
  const router = useRouter();

  /* ----------------------------- MUTATION ----------------------------- */
  const registerMutation = useMutation({
    mutationFn: (data: RegisterInput) =>
      registerUserApi(data).then((res) => res.data),

    onSuccess: () => {
      toast.success("Account created. Please verify your email.");
      router.replace("/login");
    },

    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || err?.message || "Registration failed"
      );
    },
  });

  /* ------------------------------- FORM ------------------------------- */
  const form = useForm<RegisterInput>({
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },

    validatorAdapter: zodValidator(),

    validators: {
      onSubmit: registerSchema,
    },

    onSubmit: async ({ value }) => {
      await registerMutation.mutateAsync(value);
    },
  });

  const isLoading = registerMutation.isPending;

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
      <h1 className="text-2xl font-semibold flex items-center gap-2 text-white">
        <FaUserPlus /> Create Account
      </h1>

      {/* Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-4"
        noValidate
      >
        {/* Name */}
        <form.Field name="name">
          {(field) => (
            <div className="space-y-1">
              <Input
                placeholder="Full name"
                autoComplete="name"
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

        {/* Email */}
        <form.Field name="email">
          {(field) => (
            <div className="space-y-1">
              <Input
                type="email"
                placeholder="Email address"
                autoComplete="email"
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

        {/* Password */}
        <form.Field name="password">
          {(field) => (
            <div className="space-y-1">
              <Input
                type="password"
                placeholder="Password"
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
          {isLoading ? "Creating account..." : "Register"}
        </Button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-700" />
        <span className="text-xs text-zinc-400">OR</span>
        <div className="h-px flex-1 bg-zinc-700" />
      </div>

      {/* OAuth */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          onClick={() => !isLoading && loginWithGoogle()}
          className="
            flex-1 gap-2
            border-zinc-700 text-white
            hover:bg-zinc-800
          "
        >
          <FaGoogle /> Google
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          onClick={() => !isLoading && loginWithGithub()}
          className="
            flex-1 gap-2
            border-zinc-700 text-white
            hover:bg-zinc-800
          "
        >
          <FaGithub /> GitHub
        </Button>
      </div>

      {/* Login redirect */}
      <div className="text-center text-sm text-zinc-400">
        Already have an account?{" "}
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
