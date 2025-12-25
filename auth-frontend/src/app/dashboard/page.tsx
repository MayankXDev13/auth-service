import { Protected } from "@/components/auth/Protected";

export default function DashboardPage() {
  return (
    <Protected>
      <div className="min-h-screen p-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
      </div>
    </Protected>
  );
}
