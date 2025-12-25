"use client";

import { useSession } from "@/hooks/auth/useSession";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RootPage() {
  const { data: user, isLoading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}
