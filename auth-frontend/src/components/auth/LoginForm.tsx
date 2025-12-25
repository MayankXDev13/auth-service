"use client";

import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { useMutation } from "@tanstack/react-query";
import { loginSchema, LoginInput } from "@/schemas/auth.schema";
import { loginUserApi } from "@/lib/auth.api";
import { setAccessToken } from "@/lib/token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { FaSignInAlt, FaGithub, FaGoogle } from "react-icons/fa";
import { loginWithGoogle, loginWithGithub } from "@/lib/oauth";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();

  const loginMutation = useMutation({
    mutationFn: (data: LoginInput) =>
      loginUserApi(data).then((res) => res.data),

    onSuccess: (data) => {
      if (data?.accessToken) {
        setAccessToken(data.accessToken);
      }

      toast.success("Logged in successfully");
      router.replace("/dashboard");
    },

    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Invalid email or password"
      );
    },
  });

  const form = useForm<LoginInput>({
    defaultValues: {
      email: "",
      password: "",
    },

    validatorAdapter: zodValidator(),

    validators: {
      onSubmit: loginSchema,
    },

    onSubmit: async ({ value }) => {
      await loginMutation.mutateAsync(value);
    },
  });

  const isLoading = loginMutation.isPending;

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
        <FaSignInAlt /> Login
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

        {/* Password */}
        <form.Field name="password">
          {(field) => (
            <div className="space-y-1">
              <Input
                type="password"
                placeholder="Password"
                autoComplete="current-password"
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

        {/* Forgot password */}
        <div className="text-right">
          <button
            type="button"
            className="text-sm text-zinc-400 hover:text-white transition"
            onClick={() => router.push("/forgot-password")}
          >
            Forgot password?
          </button>
        </div>

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
          {isLoading ? "Logging in..." : "Login"}
        </Button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-700" />
        <span className="text-xs text-zinc-400">OR</span>
        <div className="h-px flex-1 bg-zinc-700" />
      </div>

      {/* Sign up redirect */}
      <div className="text-center text-sm text-zinc-400">
        Don’t have an account?{" "}
        <button
          type="button"
          className="text-white hover:underline transition"
          onClick={() => router.push("/register")}
        >
          Sign up
        </button>
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
    </Card>
  );
}
