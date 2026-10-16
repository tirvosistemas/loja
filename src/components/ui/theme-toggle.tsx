"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);
  useEffect(() => setTheme((document.documentElement.dataset.theme as "dark" | "light") ?? "dark"), []);
  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "light" ? "#fafafa" : "#09090b");
    setTheme(next);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "light" ? "Usar tema escuro" : "Usar tema claro"}
      className={cn("grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground", className)}
    >
      {theme === "light" ? <Moon className="size-5" /> : <Sun className="size-5" />}
    </button>
  );
}
