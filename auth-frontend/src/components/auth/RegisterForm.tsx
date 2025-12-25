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

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterInput) => {
      const res = await registerUserApi(data);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Account created. Please verify your email.");
      router.replace("/login");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Registration failed");
    },
  });

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

  return (
    <Card className="w-full max-w-md p-6 space-y-4">
      <h1 className="text-2xl font-semibold flex items-center gap-2">
        <FaUserPlus /> Create Account
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        {/* Name */}
        <form.Field name="name">
          {(field) => (
            <div>
              <Input
                placeholder="Full name"
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
          disabled={!form.state.canSubmit || registerMutation.isPending}
        >
          {registerMutation.isPending
            ? "Creating account..."
            : "Register"}
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
