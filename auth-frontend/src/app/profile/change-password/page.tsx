"use client";

import { useState } from "react";
import { Protected } from "@/components/auth/Protected";

import { toast } from "sonner";
import { useChangePassword } from "@/hooks/auth/useAccount";

export default function ChangePasswordPage() {
  const { mutateAsync: changePassword, isPending } = useChangePassword();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    try {
      await changePassword({
        oldPassword,
        newPassword,
      });

      toast.success("Password changed successfully");

      // reset form
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to change password");
    }
  };

  return (
    <Protected>
      <div className="min-h-screen bg-zinc-900 text-white p-6">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-1">Change Password</h1>
          <p className="text-sm text-zinc-400 mb-6">
            Update your account password
          </p>

          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-6"
          >
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                className="w-full rounded bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-700"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full rounded bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-700"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-700"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2 text-sm font-medium rounded bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60"
            >
              {isPending ? "Updating..." : "Change Password"}
            </button>
          </form>
        </div>
      </div>
    </Protected>
  );
}
