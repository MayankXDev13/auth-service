import { Guest } from "@/components/auth/Guest";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <Guest>
      <div className="min-h-screen flex items-center justify-center px-4">
        <LoginForm />
      </div>
    </Guest>
  );
}
