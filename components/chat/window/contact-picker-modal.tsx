import { Loader2, Search, X } from "lucide-react";

import type { Id } from "@/convex/_generated/dataModel";

import type { UserPreview } from "../types";
import { UserAvatar } from "../user-avatar";

type ContactPickerModalProps = {
  users: UserPreview[];
  searchValue: string;
  pendingUserId: Id<"users"> | null;
  onSearchChange: (value: string) => void;
  onClose: () => void;
  onSelectUser: (userId: Id<"users">) => void;
};

export function ContactPickerModal({
  users,
  searchValue,
  pendingUserId,
  onSearchChange,
  onClose,
  onSelectUser,
}: ContactPickerModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl dark:bg-[#202c33]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Add contact
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-300 text-slate-600 dark:border-[#3b4a54] dark:text-slate-300"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search contact"
            className="h-10 w-full rounded-full border border-slate-300 bg-white pl-9 pr-4 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-[#3b4a54] dark:bg-[#111b21] dark:text-slate-100"
          />
        </div>

        <div className="max-h-80 space-y-1 overflow-y-auto">
          {users.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500 dark:border-[#3b4a54] dark:text-[#8696a0]">
              No contacts found.
            </p>
          ) : (
            users.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => onSelectUser(user.id)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-100 dark:hover:bg-[#2a3942]"
              >
                <UserAvatar
                  name={user.name}
                  imageUrl={user.imageUrl}
                  isOnline={user.isOnline}
                  className="h-9 w-9"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {user.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-[#8696a0]">
                    {user.isOnline ? "Online" : "Offline"}
                  </p>
                </div>
                {pendingUserId === user.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500 dark:text-[#8696a0]" />
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
