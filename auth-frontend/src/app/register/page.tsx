import { Guest } from "@/components/auth/Guest";
import RegisterForm from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <Guest>
      <div className="min-h-screen flex items-center justify-center px-4">
        <RegisterForm />
      </div>
    </Guest>
  );
}
