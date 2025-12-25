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

const schema = z.object({
  password: z.string().min(6),
});

export default function ResetPasswordForm() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const resetPassword = useResetPassword();

  const form = useForm({
    defaultValues: { password: "" },
    validatorAdapter: zodValidator(),
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      await resetPassword.mutateAsync({
        token,
        password: value.password,
      });
      toast.success("Password reset successfully");
      router.replace("/login");
    },
  });

  return (
    <Card className="p-6 w-full max-w-md space-y-4">
      <h2 className="text-xl font-semibold">Reset Password</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="password">
          {(field) => (
            <Input
              type="password"
              placeholder="New password"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          )}
        </form.Field>

        <Button className="w-full" type="submit">
          Reset Password
        </Button>
      </form>
    </Card>
  );
}
