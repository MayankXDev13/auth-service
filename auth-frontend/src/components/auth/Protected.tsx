"use client";

import { useAuthStore } from "@/stores/auth.store";
import { redirect } from "next/navigation";

export function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
 
  

  if (loading) return <p>Loading...</p>;
  if (!user) redirect("/login");

  return <>{children}</>;
}
