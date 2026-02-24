import type { ReactNode } from "react";

export function QuickAction({
  title,
  icon,
  onClick,
}: {
  title: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer flex-col items-center gap-2 transition-transform duration-200 hover:-translate-y-0.5"
    >
      <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-slate-200 text-slate-600 transition-colors hover:bg-slate-300 dark:bg-[#202c33] dark:text-[#8696a0] dark:hover:bg-[#2a3942]">
        {icon}
      </div>
      <p className="text-sm text-slate-500 dark:text-[#8696a0]">{title}</p>
    </button>
  );
}
