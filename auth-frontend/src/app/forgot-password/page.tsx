import { Guest } from "@/components/auth/Guest";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <Guest>
      <div className="min-h-screen flex items-center justify-center px-4">
        <ForgotPasswordForm />
      </div>
    </Guest>
  );
}
