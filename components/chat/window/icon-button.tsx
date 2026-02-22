import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function IconButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-[#3b4a54] dark:text-slate-300 dark:hover:bg-[#2a3942]",
        active ? "bg-slate-100 dark:bg-[#2a3942]" : "",
      )}
    >
      {icon}
    </button>
  );
}
