import {
  Check,
  CheckCheck,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  Plus,
  PencilLine,
  Smile,
  Trash2,
} from "lucide-react";

import type { Id } from "@/convex/_generated/dataModel";
import { formatMessageTimestamp } from "@/lib/time";
import { cn } from "@/lib/utils";

import type {
  ConversationMessage,
  MessageDeliveryStatus,
  ReactionKey,
} from "../types";
import { REACTION_META } from "./constants";
import { formatFileSize, highlightText } from "./utils";

export function MessageBubble({
  message,
  isDeleting,
  isMenuOpen,
  isReactionPickerOpen,
  isEditing,
  isSavingEdit,
  editDraft,
  searchQuery,
  pendingReactionKey,
  onToggleMenu,
  onToggleReactionPicker,
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
  isReactionPickerOpen: boolean;
  isEditing: boolean;
  isSavingEdit: boolean;
  editDraft: string;
  searchQuery: string;
  pendingReactionKey: string | null;
  onToggleMenu: () => void;
  onToggleReactionPicker: () => void;
  onStartEdit: () => void;
  onEditDraftChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (messageId: Id<"messages">) => void;
  onToggleReaction: (messageId: Id<"messages">, emoji: ReactionKey) => void;
}) {
  const canManage = message.isMine && !message.isDeleted;
  const canEdit = canManage && message.messageType === "text";
  const canReact = !message.isDeleted;
  const activeReactions = REACTION_META.flatMap(({ key, label }) => {
    const reaction = message.reactions.find((item) => item.emoji === key);
    const count = reaction?.count ?? 0;
    if (count === 0) {
      return [];
    }

    return [
      {
        key,
        label,
        count,
        reactedByMe: reaction?.reactedByMe ?? false,
      },
    ];
  });
  const totalReactionCount = activeReactions.reduce((sum, reaction) => sum + reaction.count, 0);
  const reactionPreview = activeReactions.slice(0, 3);
  const reactedByMe = activeReactions.some((reaction) => reaction.reactedByMe);

  return (
    <div
      className={cn(
        "group flex chat-bubble-enter",
        message.isMine ? "justify-end" : "justify-start",
      )}
    >
      <div className={cn("relative max-w-[min(86%,42rem)]", activeReactions.length > 0 ? "pb-4" : "")}>
        <div
          className={cn(
            "relative rounded-2xl px-3 py-2 shadow-sm ring-1 ring-black/5 transition-transform duration-150 group-hover:-translate-y-[1px] dark:ring-white/5",
            message.isMine
              ? "rounded-tr-sm bg-emerald-100 text-slate-900 dark:bg-[#005c4b] dark:text-[#e9edef]"
              : "rounded-tl-sm bg-white text-slate-900 shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]",
          )}
        >
          {canReact ? (
            <div
              data-reaction-picker-root="true"
              className={cn(
                "absolute top-1/2 z-20 -translate-y-1/2",
                message.isMine ? "right-[calc(100%+0.3rem)]" : "left-[calc(100%+0.3rem)]",
              )}
            >
              <button
                type="button"
                onClick={onToggleReactionPicker}
                className={cn(
                  "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow-sm transition dark:border-[#3b4a54] dark:bg-[#202c33] dark:text-[#aebac1]",
                  isReactionPickerOpen
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-[#2a3942]",
                )}
                aria-label="Add reaction"
              >
                <Smile className="h-4 w-4" />
              </button>

              {isReactionPickerOpen ? (
                <div
                  className={cn(
                    "chat-reaction-picker-enter absolute top-1/2 z-30 flex -translate-y-1/2 items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-1 shadow-xl dark:border-[#3b4a54] dark:bg-[#202c33]",
                    message.isMine ? "right-[calc(100%+0.45rem)]" : "left-[calc(100%+0.45rem)]",
                  )}
                >
                  {REACTION_META.map(({ key, label }) => {
                    const reactionKey = `${message._id}:${key}`;
                    const isPending = pendingReactionKey === reactionKey;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={isPending}
                        onClick={() => onToggleReaction(message._id, key)}
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-xl transition hover:bg-slate-100 disabled:opacity-60 dark:hover:bg-[#2a3942]"
                        aria-label={`React with ${label}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-[#3b4a54] dark:text-[#aebac1] dark:hover:bg-[#2a3942]"
                    aria-label="More reactions"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

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
            {message.isMine && message.deliveryStatus ? (
              <MessageDeliveryIcon status={message.deliveryStatus} />
            ) : null}
          </div>
        </div>

        {activeReactions.length > 0 ? (
          <div
            data-reaction-picker-root="true"
            className={cn(
              "absolute -bottom-2 z-10",
              message.isMine ? "right-3" : "left-3",
            )}
          >
            <button
              type="button"
              onClick={onToggleReactionPicker}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] shadow-sm transition",
                reactedByMe
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-[#25d366]/60 dark:bg-[#103529] dark:text-[#d6fddc] dark:hover:bg-[#164b3c]"
                  : "border-slate-300 bg-white/95 text-slate-700 hover:bg-slate-100 dark:border-[#3b4a54] dark:bg-[#202c33]/95 dark:text-[#d1d7db] dark:hover:bg-[#2a3942]",
              )}
            >
              <div className="flex items-center gap-0.5">
                {reactionPreview.map((reaction) => (
                  <span key={reaction.key}>{reaction.label}</span>
                ))}
              </div>
              {totalReactionCount > 1 ? (
                <span className="text-[11px] font-semibold">{totalReactionCount}</span>
              ) : null}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MessageDeliveryIcon({ status }: { status: MessageDeliveryStatus }) {
  if (status === "read") {
    return <CheckCheck className="h-3.5 w-3.5 text-sky-500 dark:text-sky-300" aria-label="Read" />;
  }

  if (status === "delivered") {
    return (
      <CheckCheck
        className="h-3.5 w-3.5 text-slate-500 dark:text-[#aebac1]"
        aria-label="Delivered"
      />
    );
  }

  return <Check className="h-3.5 w-3.5 text-slate-500 dark:text-[#aebac1]" aria-label="Sent" />;
}
