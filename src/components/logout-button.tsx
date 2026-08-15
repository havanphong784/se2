"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={buttonVariants({
        variant: "danger",
        size: "sm",
        className: "w-full justify-center gap-1.5",
      })}
    >
      <LogOut className="size-4" /> {loading ? "Đang đăng xuất…" : "Đăng xuất (về Demo)"}
    </button>
  );
}
