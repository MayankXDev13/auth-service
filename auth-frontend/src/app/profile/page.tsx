"use client";

import { Protected } from "@/components/auth/Protected";
import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";


export default function Profile() {
  const { user, loading } = useAuthStore();
  const router = useRouter();


  return (
    <Protected>
      <div className="min-h-screen bg-zinc-900 text-white p-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Profile</h1>
            <p className="text-sm text-zinc-400">
              Manage your account information
            </p>
          </div>

          {loading ? (
            <p className="text-zinc-400">Loading profile...</p>
          ) : (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
                <div className="flex items-center gap-4 mb-6">
                  {/* Avatar */}
                  <div className="h-14 w-14 rounded-full bg-zinc-800 flex items-center justify-center text-lg font-bold">
                    {user?.username?.[0]?.toUpperCase() ?? "U"}
                  </div>

                  <div>
                    <p className="text-lg font-semibold">
                      {user?.username ?? "User"}
                    </p>
                    <p className="text-sm text-zinc-400">{user?.email}</p>
                  </div>

                  <span className="ml-auto px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-300">
                    {user?.role.toUpperCase()}
                  </span>
                </div>

                {/* Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-zinc-400">User ID</p>
                    <p className="break-all">{user?.id}</p>
                  </div>

                  <div>
                    <p className="text-zinc-400">Email Verified</p>
                    <p>
                      {user?.isEmailVerified ? (
                        <span className="text-green-400">Verified</span>
                      ) : (
                        <span className="text-red-400">Not Verified</span>
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-zinc-400">Login Type</p>
                    <p className="capitalize">{user?.loginType}</p>
                  </div>

                  <div>
                    <p className="text-zinc-400">Account Status</p>
                    <p>
                      {user?.isActive ? (
                        <span className="text-green-400">Active</span>
                      ) : (
                        <span className="text-red-400">Disabled</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions (future ready) */}
              <div className="flex gap-3">
                <button
                  disabled
                  className="px-4 py-2 text-sm rounded bg-zinc-800 text-zinc-400 cursor-not-allowed"
                >
                  Edit Profile (coming soon)
                </button>

                <button
                  onClick={() => router.push("/profile/change-password")}
                  className="px-4 py-2 text-sm rounded bg-zinc-800 hover:bg-zinc-700"
                >
                  Change Password
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Protected>
  );
}
