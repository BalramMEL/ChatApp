import { cn } from "@/lib/utils";

function getInitial(name: string) {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : "?";
}

export function UserAvatar({
  name,
  imageUrl,
  isOnline,
  className,
}: {
  name: string;
  imageUrl?: string | null;
  isOnline?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative h-10 w-10 shrink-0 overflow-visible", className)}>
      <div className="h-full w-full overflow-hidden rounded-full ring-1 ring-black/5 dark:ring-white/10">
        {imageUrl ? (
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-200 text-sm font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            {getInitial(name)}
          </div>
        )}
      </div>
      {isOnline ? (
        <span
          aria-hidden
          className="absolute -right-1 -bottom-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm dark:border-[#111b21]"
        />
      ) : null}
    </div>
  );
}
