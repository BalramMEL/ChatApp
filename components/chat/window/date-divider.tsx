export function DateDivider({ label }: { label: string }) {
  return (
    <div className="my-2 flex items-center justify-center">
      <div className="rounded-full bg-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 dark:bg-[#1f2c34] dark:text-[#d1d7db]">
        {label}
      </div>
    </div>
  );
}
