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
    mutationFn: async (data: LoginInput) => {
      const res = await loginUserApi(data);
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.accessToken) {
        setAccessToken(data.accessToken);
      }

      toast.success("Logged in successfully");
      router.replace("/dashboard");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Login failed");
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

  return (
    <Card className="w-full max-w-md p-6 space-y-4">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <FaSignInAlt /> Login
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        {/* Email */}
        <form.Field name="email">
          {(field) => (
            <div>
              <Input
                placeholder="Email"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors?.length > 0 && (
                <p className="text-sm text-red-500 mt-1">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        {/* Password */}
        <form.Field name="password">
          {(field) => (
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors?.length > 0 && (
                <p className="text-sm text-red-500 mt-1">
                  {field.state.meta.errors[0]}
                </p>
              )}
            </div>
          )}
        </form.Field>

        <Button
          type="submit"
          className="w-full"
          disabled={!form.state.canSubmit || loginMutation.isPending}
        >
          {loginMutation.isPending ? "Logging in..." : "Login"}
        </Button>
      </form>

      {/* OAuth */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="w-full flex gap-2"
          onClick={loginWithGoogle}
        >
          <FaGoogle /> Google
        </Button>

        <Button
          variant="outline"
          className="w-full flex gap-2"
          onClick={loginWithGithub}
        >
          <FaGithub /> GitHub
        </Button>
      </div>
    </Card>
  );
}
