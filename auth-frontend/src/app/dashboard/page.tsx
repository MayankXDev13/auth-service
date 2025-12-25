import { Protected } from "@/components/auth/Protected";

export default function Dashboard() {
  return (
    <Protected>
      <h1 className="text-2xl font-bold">Dashboard</h1>
    </Protected>
  );
}
