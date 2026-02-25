import { useEffect, useState } from "react";
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
import { UserAvatar } from "../user-avatar";
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
  const [isReactionDetailsOpen, setIsReactionDetailsOpen] = useState(false);
  const [selectedReactionTab, setSelectedReactionTab] = useState<"all" | ReactionKey>("all");

  const reactionLabelByKey = new Map(
    REACTION_META.map((reactionMeta) => [reactionMeta.key, reactionMeta.label]),
  );
  const reactionTabs = [
    { key: "all" as const, label: "All", count: totalReactionCount },
    ...activeReactions.map((reaction) => ({
      key: reaction.key,
      label: reaction.label,
      count: reaction.count,
    })),
  ];
  const effectiveReactionTab =
    selectedReactionTab === "all" ||
      activeReactions.some((reaction) => reaction.key === selectedReactionTab)
      ? selectedReactionTab
      : "all";
  const filteredReactionDetails =
    effectiveReactionTab === "all"
      ? message.reactionDetails
      : message.reactionDetails.filter((detail) => detail.emoji === effectiveReactionTab);
  const isReactionDetailsVisible = isReactionDetailsOpen && activeReactions.length > 0;

  useEffect(() => {
    if (!isReactionDetailsOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(`[data-reaction-details-root='${message._id}']`)) {
        return;
      }
      setIsReactionDetailsOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [isReactionDetailsOpen, message._id]);

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
            "relative rounded-[22px] px-3.5 py-2 text-[15px]",
            message.isMine
              ? "rounded-br-[6px] ig-message-gradient"
              : "rounded-bl-[6px] bg-secondary text-secondary-foreground",
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
                  "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors",
                  isReactionPickerOpen
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100 hover:bg-secondary",
                )}
                aria-label="Add reaction"
              >
                <Smile className="h-4 w-4" />
              </button>

              {isReactionPickerOpen ? (
                <div
                  className={cn(
                    "chat-reaction-picker-enter absolute top-1/2 z-30 flex -translate-y-1/2 items-center gap-1 rounded-full border border-border bg-background px-2 py-1 shadow-xl",
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
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-xl transition hover:bg-secondary disabled:opacity-60"
                        aria-label={`React with ${label}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-secondary"
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
                  "inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-transparent text-muted-foreground transition hover:border-border hover:bg-secondary",
                  isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
                aria-label="Message options"
              >
                <ChevronDown className="h-4 w-4" />
              </button>

              {isMenuOpen ? (
                <div className="absolute top-7 right-0 w-36 rounded-xl border border-border bg-background py-1 shadow-lg">
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={onStartEdit}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-secondary"
                    >
                      <PencilLine className="h-4 w-4" />
                      Edit
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => onDelete(message._id)}
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60"
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
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                className="w-full resize-none rounded-lg border border-border bg-secondary px-2.5 py-2 text-sm text-foreground outline-none focus:border-ring transition-colors"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="h-8 cursor-pointer rounded-md border border-border px-2.5 text-xs text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="inline-flex h-8 cursor-pointer items-center rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground disabled:opacity-60 transition"
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
            <p className="text-sm italic text-muted-foreground">This message was deleted</p>
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
                <div className="flex h-40 w-[260px] items-center justify-center rounded-lg bg-secondary text-muted-foreground">
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
            <div className="min-w-[220px] max-w-[360px] rounded-xl border border-border bg-background/40 p-3">
              <div className="flex items-center gap-2">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {highlightText(message.fileName ?? "Document", searchQuery)}
                  </p>
                  {message.fileSize ? (
                    <p className="text-[11px] opacity-75">
                      {formatFileSize(message.fileSize)}
                    </p>
                  ) : null}
                </div>
                {message.fileUrl ? (
                  <a
                    href={message.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border hover:bg-black/5 dark:hover:bg-white/5"
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
                message.isMine ? "text-white/70" : "text-muted-foreground",
              )}
              suppressHydrationWarning
            >
              {formatMessageTimestamp(message.createdAt)}
            </p>
            {message.isMine && message.deliveryStatus ? (
              <MessageDeliveryIcon status={message.deliveryStatus} isMine={message.isMine} />
            ) : null}
          </div>
        </div>

        {activeReactions.length > 0 ? (
          <div
            data-reaction-details-root={message._id}
            className={cn(
              "absolute -bottom-2 z-10",
              message.isMine ? "right-3" : "left-3",
            )}
          >
            <button
              type="button"
              onClick={() => setIsReactionDetailsOpen((previous) => !previous)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] shadow-sm transition",
                reactedByMe
                  ? "border-primary bg-primary/20 text-foreground hover:bg-primary/30"
                  : "border-border bg-secondary/95 text-foreground hover:bg-secondary",
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

            {isReactionDetailsVisible ? (
              <div
                className={cn(
                  "chat-reaction-picker-enter absolute bottom-[calc(100%+0.45rem)] z-20 w-72 overflow-hidden rounded-xl border border-border bg-background shadow-xl",
                  message.isMine ? "right-0" : "left-0",
                )}
              >
                <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
                  {reactionTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setSelectedReactionTab(tab.key)}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-xs transition",
                        effectiveReactionTab === tab.key
                          ? "bg-primary/20 font-semibold text-foreground"
                          : "text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      <span>{tab.label}</span>
                      <span>{tab.count}</span>
                    </button>
                  ))}
                </div>

                <div className="max-h-48 overflow-y-auto py-1">
                  {filteredReactionDetails.map((detail) => {
                    const reactionKey = `${message._id}:${detail.emoji}`;
                    const isPending = pendingReactionKey === reactionKey;
                    const emojiLabel = reactionLabelByKey.get(detail.emoji) ?? detail.emoji;
                    return (
                      <button
                        key={`${detail.userId}-${detail.emoji}`}
                        type="button"
                        disabled={!detail.isMe || isPending}
                        onClick={() => {
                          void onToggleReaction(message._id, detail.emoji);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left transition",
                          detail.isMe
                            ? "cursor-pointer hover:bg-secondary"
                            : "cursor-default",
                        )}
                      >
                        <UserAvatar
                          name={detail.userName}
                          imageUrl={detail.userImageUrl}
                          className="h-8 w-8"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {detail.userName}
                          </p>
                          {detail.isMe ? (
                            <p className="text-xs text-muted-foreground">Click to remove</p>
                          ) : null}
                        </div>
                        <span className="text-lg leading-none">{emojiLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MessageDeliveryIcon({ status, isMine }: { status: MessageDeliveryStatus; isMine?: boolean }) {
  const textColorClass = isMine ? "text-white/80" : "text-muted-foreground";
  const readColorClass = isMine ? "text-white" : "text-sky-500";

  if (status === "read") {
    return <CheckCheck className={cn("h-3.5 w-3.5", readColorClass)} aria-label="Read" />;
  }

  if (status === "delivered") {
    return (
      <CheckCheck
        className={cn("h-3.5 w-3.5", textColorClass)}
        aria-label="Delivered"
      />
    );
  }

  return <Check className={cn("h-3.5 w-3.5", textColorClass)} aria-label="Sent" />;
}
