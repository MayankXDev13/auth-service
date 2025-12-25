"use client";

import { Protected } from "@/components/auth/Protected";
import { useLogout } from "@/hooks/auth/useAuth";
import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { user, loading } = useAuthStore();
  const router = useRouter();
  const { mutateAsync: logout, isPending } = useLogout();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <Protected>
      <div className="min-h-screen bg-zinc-900 text-white">
        {/* Navbar */}
        <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h1 className="text-xl font-bold tracking-wide">Auth Service</h1>

          {user && (
            <div className="flex items-center gap-4">
              {/* User info */}
              <div className="text-right">
                <p className="text-sm font-medium">{user.username ?? "User"}</p>
                <p className="text-xs text-zinc-400">{user.email}</p>
              </div>

              {/* Role badge */}
              <span className="px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-300">
                {user.role.toUpperCase()}
              </span>

              {/* Logout */}
              <button
                onClick={handleLogout}
                disabled={isPending}
                className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 disabled:opacity-60 rounded"
              >
                {isPending ? "Logging out..." : "Logout"}
              </button>

              <button
                onClick={() => router.push("/profile")}
                className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded"
              >
                Profile
              </button>
            </div>
          )}
        </nav>

        {/* Main content */}
        <main className="p-6">
          {loading ? (
            <p className="text-zinc-400">Loading dashboard...</p>
          ) : (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">
                Welcome back, {user?.username ?? "User"} 👋
              </h2>

              {/* User details card */}
              <div className="max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <h3 className="mb-2 text-sm font-semibold text-zinc-400">
                  User Details
                </h3>

                <ul className="space-y-1 text-sm">
                  <li>
                    <span className="text-zinc-400">ID:</span>{" "}
                    <span className="break-all">{user?.id}</span>
                  </li>
                  <li>
                    <span className="text-zinc-400">Email:</span> {user?.email}
                  </li>
                  <li>
                    <span className="text-zinc-400">Username:</span>{" "}
                    {user?.username ?? "—"}
                  </li>
                  <li>
                    <span className="text-zinc-400">Role:</span> {user?.role}
                  </li>
                </ul>
              </div>
            </div>
          )}
        </main>
      </div>
    </Protected>
  );
}
