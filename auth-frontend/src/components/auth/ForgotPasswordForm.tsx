"use client";

import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { z } from "zod";
import { useForgotPassword } from "@/hooks/auth/useAccount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().email(),
});

export default function ForgotPasswordForm() {
  const forgotPassword = useForgotPassword();

  const form = useForm({
    defaultValues: { email: "" },
    validatorAdapter: zodValidator(),
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      await forgotPassword.mutateAsync(value.email);
      toast.success("Password reset email sent");
    },
  });

  return (
    <Card className="p-6 w-full max-w-md space-y-4">
      <h2 className="text-xl font-semibold">Forgot Password</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="email">
          {(field) => (
            <Input
              placeholder="Email"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          )}
        </form.Field>

        <Button className="w-full" type="submit">
          Send Reset Link
        </Button>
      </form>
    </Card>
  );
}
