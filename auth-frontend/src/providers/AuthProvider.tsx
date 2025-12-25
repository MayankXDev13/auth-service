"use client";

import { useEffect } from "react";
import { api } from "@/lib/axios";
import { useAuthStore } from "@/stores/auth.store";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const clearUser = useAuthStore((s) => s.clearUser);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await api.get("/users/current-user");


        setUser(res.data.data);
      } catch {
        clearUser();
      }
    }

    loadUser();
  }, [setUser, clearUser]);

  return <>{children}</>;
}
