import { cn } from "@/lib/utils";

export function MessageListSkeleton() {
  return (
    <div className="space-y-3">
      <SkeletonDateDivider />

      <SkeletonBubble side="left" widthClass="w-64" />
      <SkeletonBubble side="right" widthClass="w-80" />
      <SkeletonBubble side="left" widthClass="w-52" />

      <SkeletonDateDivider />

      <SkeletonBubble side="right" widthClass="w-72" />
      <SkeletonBubble side="left" widthClass="w-60" />
      <SkeletonBubble side="right" widthClass="w-44" />
    </div>
  );
}

function SkeletonDateDivider() {
  return (
    <div className="my-2 flex items-center justify-center">
      <div className="h-6 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-[#1f2c34]" />
    </div>
  );
}

function SkeletonBubble({
  side,
  widthClass,
}: {
  side: "left" | "right";
  widthClass: string;
}) {
  return (
    <div className={cn("flex", side === "right" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "rounded-2xl px-3 py-2 shadow-sm",
          widthClass,
          side === "right" ? "bg-emerald-100 dark:bg-[#005c4b]" : "bg-white dark:bg-[#202c33]",
        )}
      >
        <div className="mb-2 h-3 w-3/5 animate-pulse rounded bg-slate-300/70 dark:bg-slate-500/60" />
        <div className="mb-1.5 h-3 w-full animate-pulse rounded bg-slate-300/70 dark:bg-slate-500/60" />
        <div className="h-3 w-4/6 animate-pulse rounded bg-slate-300/70 dark:bg-slate-500/60" />
        <div className="mt-2 ml-auto h-2.5 w-12 animate-pulse rounded bg-slate-300/70 dark:bg-slate-500/60" />
      </div>
    </div>
  );
}
