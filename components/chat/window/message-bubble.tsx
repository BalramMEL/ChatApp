import { ChevronDown, Download, FileText, Loader2, PencilLine, Trash2 } from "lucide-react";

import type { Id } from "@/convex/_generated/dataModel";
import { formatMessageTimestamp } from "@/lib/time";
import { cn } from "@/lib/utils";

import type { ConversationMessage, ReactionKey } from "../types";
import { REACTION_META } from "./constants";
import { formatFileSize, highlightText } from "./utils";

export function MessageBubble({
  message,
  isDeleting,
  isMenuOpen,
  isEditing,
  isSavingEdit,
  editDraft,
  searchQuery,
  pendingReactionKey,
  onToggleMenu,
  onStartEdit,
  onEditDraftChange,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onToggleReaction,
}: {
  message: ConversationMessage;
  isDeleting: boolean;
  isMenuOpen: boolean;
  isEditing: boolean;
  isSavingEdit: boolean;
  editDraft: string;
  searchQuery: string;
  pendingReactionKey: string | null;
  onToggleMenu: () => void;
  onStartEdit: () => void;
  onEditDraftChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (messageId: Id<"messages">) => void;
  onToggleReaction: (messageId: Id<"messages">, emoji: ReactionKey) => void;
}) {
  const canManage = message.isMine && !message.isDeleted;
  const canEdit = canManage && message.messageType === "text";

  return (
    <div className={cn("group flex", message.isMine ? "justify-end" : "justify-start")}>
      <div className="max-w-[min(86%,42rem)]">
        <div
          className={cn(
            "relative rounded-2xl px-3 py-2",
            message.isMine
              ? "rounded-tr-sm bg-emerald-100 text-slate-900 dark:bg-[#005c4b] dark:text-[#e9edef]"
              : "rounded-tl-sm bg-white text-slate-900 shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]",
          )}
        >
          {canManage ? (
            <div data-message-menu-root="true" className="absolute top-1 right-1 z-20">
              <button
                type="button"
                onClick={onToggleMenu}
                className={cn(
                  "inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-transparent text-slate-600 transition hover:border-slate-300 hover:bg-slate-200 dark:text-[#aebac1] dark:hover:border-[#3b4a54] dark:hover:bg-[#2a3942]",
                  isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
                aria-label="Message options"
              >
                <ChevronDown className="h-4 w-4" />
              </button>

              {isMenuOpen ? (
                <div className="absolute top-7 right-0 w-36 rounded-xl border border-slate-300 bg-white py-1 shadow-lg dark:border-[#3b4a54] dark:bg-[#202c33]">
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={onStartEdit}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#2a3942]"
                    >
                      <PencilLine className="h-4 w-4" />
                      Edit
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => onDelete(message._id)}
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-900/30"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {!message.isMine ? (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[#8696a0]">
              {message.senderName}
            </p>
          ) : null}

          {isEditing && canEdit ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onSaveEdit();
              }}
              className="space-y-2"
            >
              <textarea
                value={editDraft}
                onChange={(event) => onEditDraftChange(event.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-[#3b4a54] dark:bg-[#111b21] dark:text-slate-100"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="h-8 cursor-pointer rounded-md border border-slate-300 px-2.5 text-xs text-slate-700 dark:border-[#3b4a54] dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="inline-flex h-8 cursor-pointer items-center rounded-md bg-slate-900 px-2.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-[#25d366] dark:text-[#111b21]"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Saving
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </form>
          ) : message.isDeleted ? (
            <p className="text-sm italic text-slate-500 dark:text-[#aebac1]">This message was deleted</p>
          ) : message.messageType === "image" ? (
            <div className="space-y-2">
              {message.imageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={message.imageUrl}
                    alt="Shared media"
                    className="max-h-96 w-full max-w-[420px] rounded-lg object-cover"
                  />
                </>
              ) : (
                <div className="flex h-40 w-[260px] items-center justify-center rounded-lg bg-slate-200 text-slate-500 dark:bg-[#2a3942] dark:text-[#8696a0]">
                  Image unavailable
                </div>
              )}
              {message.body.trim() ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {highlightText(message.body, searchQuery)}
                </p>
              ) : null}
            </div>
          ) : message.messageType === "file" ? (
            <div className="min-w-[220px] max-w-[360px] rounded-xl border border-slate-300 bg-white/70 p-3 dark:border-[#3b4a54] dark:bg-[#111b21]/40">
              <div className="flex items-center gap-2">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200 text-slate-600 dark:bg-[#2a3942] dark:text-[#aebac1]">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {highlightText(message.fileName ?? "Document", searchQuery)}
                  </p>
                  {message.fileSize ? (
                    <p className="text-[11px] text-slate-500 dark:text-[#8696a0]">
                      {formatFileSize(message.fileSize)}
                    </p>
                  ) : null}
                </div>
                {message.fileUrl ? (
                  <a
                    href={message.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-[#3b4a54] dark:text-slate-200 dark:hover:bg-[#2a3942]"
                    aria-label="Open document"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {highlightText(message.body, searchQuery)}
            </p>
          )}

          <div className="mt-1 flex items-center justify-end gap-2">
            <p
              className={cn(
                "text-[11px]",
                message.isMine ? "text-slate-500 dark:text-[#aebac1]" : "text-slate-500 dark:text-[#8696a0]",
              )}
              suppressHydrationWarning
            >
              {formatMessageTimestamp(message.createdAt)}
            </p>
          </div>
        </div>

        <div className={cn("mt-1 flex flex-wrap gap-1", message.isMine ? "justify-end" : "justify-start")}>
          {REACTION_META.map(({ key, label }) => {
            const reaction = message.reactions.find((item) => item.emoji === key);
            const count = reaction?.count ?? 0;
            const isActive = reaction?.reactedByMe ?? false;
            const reactionKey = `${message._id}:${key}`;
            const isPending = pendingReactionKey === reactionKey;

            return (
              <button
                key={key}
                type="button"
                disabled={isPending}
                onClick={() => onToggleReaction(message._id, key)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition",
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white dark:border-[#25d366] dark:bg-[#25d366] dark:text-[#111b21]"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-[#3b4a54] dark:bg-[#202c33] dark:text-[#d1d7db] dark:hover:bg-[#2a3942]",
                )}
              >
                <span>{label}</span>
                {count > 0 ? <span>{count}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
