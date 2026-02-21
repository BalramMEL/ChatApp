"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  FileText,
  Loader2,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  Search,
  SendHorizontal,
  Sparkles,
  Trash2,
  UserPlus,
  Video,
  X,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";

import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { formatMessageTimestamp } from "@/lib/time";
import { cn } from "@/lib/utils";

import type { ConversationMessage, ConversationPreview, ReactionKey } from "./types";
import { UserAvatar } from "./user-avatar";

const REACTION_META: Array<{ key: ReactionKey; label: string }> = [
  { key: "thumbs_up", label: "\u{1F44D}" },
  { key: "heart", label: "\u{2764}\u{FE0F}" },
  { key: "joy", label: "\u{1F602}" },
  { key: "wow", label: "\u{1F62E}" },
  { key: "sad", label: "\u{1F622}" },
];
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

type ChatWindowProps = {
  conversationId: Id<"conversations"> | null;
  conversation: ConversationPreview | null;
  onBack: () => void;
};

type FailedSend =
  | { type: "text"; body: string; error: string }
  | { type: "image"; file: File; caption: string; error: string };

function isNearBottom(container: HTMLDivElement) {
  const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
  return distance < 80;
}

function formatTypingLabel(names: string[]) {
  if (names.length === 0) {
    return null;
  }
  if (names.length === 1) {
    return `${names[0]} is typing...`;
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are typing...`;
  }
  return `${names[0]} and ${names.length - 1} others are typing...`;
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function ChatWindow({ conversationId, conversation, onBack }: ChatWindowProps) {
  const fallbackConversation = useQuery(
    api.conversations.getConversationById,
    conversationId ? { conversationId } : "skip",
  );
  const messages = useQuery(
    api.messages.listForConversation,
    conversationId ? { conversationId } : "skip",
  );
  const typingState = useQuery(
    api.typing.getTypingForConversation,
    conversationId ? { conversationId } : "skip",
  );

  const sendMessage = useMutation(api.messages.send);
  const sendImage = useMutation(api.messages.sendImage);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const deleteOwnMessage = useMutation(api.messages.deleteOwn);
  const toggleReaction = useMutation(api.messages.toggleReaction);
  const markConversationRead = useMutation(api.messages.markConversationRead);
  const setTyping = useMutation(api.typing.setTyping);

  const activeConversation = conversation ?? fallbackConversation ?? null;

  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showNewMessagesButton, setShowNewMessagesButton] = useState(false);
  const [failedSend, setFailedSend] = useState<FailedSend | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDeleteMessageId, setPendingDeleteMessageId] = useState<Id<"messages"> | null>(null);
  const [pendingReactionKey, setPendingReactionKey] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const previousConversationIdRef = useRef<Id<"conversations"> | null>(null);
  const previousMessageIdRef = useRef<Id<"messages"> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTyping = useCallback(
    (targetConversationId: Id<"conversations"> | null) => {
      if (!targetConversationId) {
        return;
      }
      void setTyping({
        conversationId: targetConversationId,
        isTyping: false,
      });
    },
    [setTyping],
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const container = messageListRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
    nearBottomRef.current = true;
  }, []);

  const sendText = useCallback(
    async (body: string) => {
      if (!conversationId) {
        return false;
      }

      try {
        await sendMessage({ conversationId, body });
        await markConversationRead({ conversationId });
        return true;
      } catch (error) {
        setFailedSend({
          type: "text",
          body,
          error: toErrorMessage(error, "Failed to send message."),
        });
        return false;
      }
    },
    [conversationId, markConversationRead, sendMessage],
  );

  const sendImageFile = useCallback(
    async (file: File, caption: string) => {
      if (!conversationId) {
        return false;
      }

      try {
        const uploadUrl = await generateUploadUrl({});
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error("Image upload failed");
        }

        const uploadResult = (await uploadResponse.json()) as { storageId?: Id<"_storage"> };
        if (!uploadResult.storageId) {
          throw new Error("Upload did not return a storage id");
        }

        await sendImage({
          conversationId,
          storageId: uploadResult.storageId,
          caption: caption.trim() || undefined,
        });
        await markConversationRead({ conversationId });
        return true;
      } catch (error) {
        setFailedSend({
          type: "image",
          file,
          caption,
          error: toErrorMessage(error, "Failed to send image."),
        });
        return false;
      }
    },
    [conversationId, generateUploadUrl, markConversationRead, sendImage],
  );

  useEffect(() => {
    setDraft("");
    setShowNewMessagesButton(false);
    setFailedSend(null);
    setActionError(null);
    previousMessageIdRef.current = null;
    nearBottomRef.current = true;
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !messages) {
      return;
    }

    const container = messageListRef.current;
    if (!container) {
      return;
    }

    const latestMessageId = messages.length > 0 ? messages[messages.length - 1]._id : null;
    const conversationChanged = previousConversationIdRef.current !== conversationId;
    const newMessageArrived =
      latestMessageId !== null && previousMessageIdRef.current !== latestMessageId;

    if (conversationChanged) {
      requestAnimationFrame(() => scrollToBottom("auto"));
      setShowNewMessagesButton(false);
    } else if (newMessageArrived) {
      if (nearBottomRef.current || isNearBottom(container)) {
        requestAnimationFrame(() => scrollToBottom("smooth"));
        setShowNewMessagesButton(false);
      } else {
        setShowNewMessagesButton(true);
      }
    }

    previousConversationIdRef.current = conversationId;
    previousMessageIdRef.current = latestMessageId;
  }, [conversationId, messages, scrollToBottom]);

  useEffect(() => {
    if (!conversationId || !messages) {
      return;
    }
    void markConversationRead({ conversationId });
  }, [conversationId, messages, markConversationRead]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      stopTyping(conversationId);
    };
  }, [conversationId, stopTyping]);

  const handleScroll = () => {
    const container = messageListRef.current;
    if (!container) {
      return;
    }
    const nearBottom = isNearBottom(container);
    nearBottomRef.current = nearBottom;

    if (nearBottom) {
      setShowNewMessagesButton(false);
    }
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);

    if (!conversationId) {
      return;
    }

    if (!value.trim()) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      stopTyping(conversationId);
      return;
    }

    void setTyping({
      conversationId,
      isTyping: true,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => stopTyping(conversationId), 2_000);
  };

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!conversationId) {
      return;
    }

    const messageBody = draft.trim();
    if (!messageBody) {
      return;
    }

    setDraft("");
    setIsSending(true);
    setActionError(null);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    stopTyping(conversationId);

    try {
      await sendText(messageBody);
    } finally {
      setIsSending(false);
    }
  };

  const handleImageSelected = async (file: File) => {
    if (!conversationId) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setActionError("Only image files are supported.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setActionError("Image is too large. Please use an image under 8 MB.");
      return;
    }

    setIsUploadingImage(true);
    setActionError(null);
    const caption = draft;
    setDraft("");

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    stopTyping(conversationId);

    try {
      const sent = await sendImageFile(file, caption);
      if (!sent) {
        setDraft(caption);
      }
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRetryFailedSend = async () => {
    if (!failedSend) {
      return;
    }

    setIsSending(true);
    const retry = failedSend;
    setFailedSend(null);

    try {
      if (retry.type === "text") {
        const sent = await sendText(retry.body);
        if (!sent) {
          setDraft(retry.body);
        }
      } else {
        const sent = await sendImageFile(retry.file, retry.caption);
        if (!sent) {
          setDraft(retry.caption);
        }
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: Id<"messages">) => {
    setPendingDeleteMessageId(messageId);
    setActionError(null);

    try {
      await deleteOwnMessage({ messageId });
    } catch (error) {
      setActionError(toErrorMessage(error, "Failed to delete message."));
    } finally {
      setPendingDeleteMessageId(null);
    }
  };

  const handleToggleReaction = async (messageId: Id<"messages">, emoji: ReactionKey) => {
    const key = `${messageId}:${emoji}`;
    setPendingReactionKey(key);
    setActionError(null);

    try {
      await toggleReaction({ messageId, emoji });
    } catch (error) {
      setActionError(toErrorMessage(error, "Failed to update reaction."));
    } finally {
      setPendingReactionKey(null);
    }
  };

  if (!conversationId) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-[#0b141a]">
        <div className="flex flex-col items-center gap-4">
          <div className="grid grid-cols-3 gap-6">
            <QuickAction title="Send document" icon={<FileText className="h-6 w-6" />} />
            <QuickAction title="Add contact" icon={<UserPlus className="h-6 w-6" />} />
            <QuickAction title="Ask AI" icon={<Sparkles className="h-6 w-6" />} />
          </div>
          <p className="text-sm text-slate-500 dark:text-[#8696a0]">
            Select a chat to start messaging.
          </p>
        </div>
      </div>
    );
  }

  const typingLabel = formatTypingLabel(typingState?.names ?? []);

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-[#0b141a]">
      <header className="border-b border-slate-200 bg-white px-4 py-3 dark:border-[#2a3942] dark:bg-[#202c33]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-700 md:hidden dark:border-[#3b4a54] dark:text-slate-200"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            {activeConversation ? (
              <>
                <UserAvatar
                  name={activeConversation.name}
                  imageUrl={activeConversation.imageUrl}
                  isOnline={activeConversation.type === "direct" ? activeConversation.isOnline : false}
                />
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {activeConversation.name}
                  </h2>
                  {activeConversation.type === "group" ? (
                    <p className="text-xs text-slate-500 dark:text-[#8696a0]">
                      {activeConversation.memberCount} members
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-[#8696a0]">
                      {activeConversation.isOnline ? "Online" : "Offline"}
                    </p>
                  )}
                </div>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-1">
            <IconButton icon={<Video className="h-4 w-4" />} label="Video call" />
            <IconButton icon={<Phone className="h-4 w-4" />} label="Call" />
            <IconButton icon={<Search className="h-4 w-4" />} label="Search messages" />
            <IconButton icon={<MoreVertical className="h-4 w-4" />} label="More options" />
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={messageListRef}
          onScroll={handleScroll}
          className="chat-message-surface min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
        >
          {messages === undefined ? (
            <div className="space-y-3">
              <div className="h-16 animate-pulse rounded-2xl bg-slate-200 dark:bg-[#2a3942]" />
              <div className="h-16 animate-pulse rounded-2xl bg-slate-200 dark:bg-[#2a3942]" />
              <div className="h-16 animate-pulse rounded-2xl bg-slate-200 dark:bg-[#2a3942]" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center dark:border-[#3b4a54] dark:bg-[#202c33]">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  No messages yet
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-[#8696a0]">
                  Send the first message to start this conversation.
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message._id}
                message={message}
                isDeleting={pendingDeleteMessageId === message._id}
                pendingReactionKey={pendingReactionKey}
                onDelete={handleDeleteMessage}
                onToggleReaction={handleToggleReaction}
              />
            ))
          )}
        </div>

        {showNewMessagesButton ? (
          <button
            onClick={() => {
              scrollToBottom("smooth");
              setShowNewMessagesButton(false);
            }}
            className="absolute right-4 bottom-20 inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-lg dark:bg-[#25d366] dark:text-[#111b21]"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            New messages
          </button>
        ) : null}

        <div className="min-h-6 px-4 text-xs text-slate-500 dark:text-[#8696a0]">
          {typingLabel ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 dark:bg-[#202c33]">
              <span>{typingLabel}</span>
              <span className="inline-flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500 dark:bg-slate-300 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500 dark:bg-slate-300 [animation-delay:180ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500 dark:bg-slate-300 [animation-delay:360ms]" />
              </span>
            </div>
          ) : null}
        </div>

        {failedSend ? (
          <div className="mx-3 mb-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900 dark:border-rose-700/60 dark:bg-rose-900/30 dark:text-rose-200">
            <p>{failedSend.error}</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleRetryFailedSend}
                className="rounded-md border border-rose-300 px-2 py-1 font-medium dark:border-rose-700"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setFailedSend(null)}
                className="rounded-md border border-rose-300 px-2 py-1 dark:border-rose-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        {actionError ? (
          <div className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-200">
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="inline-flex h-5 w-5 items-center justify-center rounded border border-amber-300 dark:border-amber-700"
              aria-label="Dismiss warning"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}

        <form
          onSubmit={handleSend}
          className="border-t border-slate-200 bg-white px-3 py-2.5 dark:border-[#2a3942] dark:bg-[#202c33]"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-[#3b4a54] dark:text-slate-200 dark:hover:bg-[#2a3942]"
              aria-label="Send image"
            >
              {isUploadingImage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleImageSelected(file);
                }
                event.currentTarget.value = "";
              }}
            />

            <div className="flex h-11 flex-1 items-center rounded-full border border-slate-300 bg-white pr-1 dark:border-[#3b4a54] dark:bg-[#2a3942]">
              <input
                value={draft}
                onChange={(event) => handleDraftChange(event.target.value)}
                placeholder="Type a message"
                className="h-full flex-1 rounded-full bg-transparent px-4 text-sm text-slate-900 outline-none dark:text-slate-100"
              />
              {draft.trim() ? null : (
                <span className="mr-3 text-slate-400 dark:text-[#8696a0]">
                  <Mic className="h-4 w-4" />
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={isSending || !draft.trim()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white transition disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#25d366] dark:text-[#111b21]"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizontal className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuickAction({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-slate-200 text-slate-600 dark:bg-[#202c33] dark:text-[#8696a0]">
        {icon}
      </div>
      <p className="text-sm text-slate-500 dark:text-[#8696a0]">{title}</p>
    </div>
  );
}

function IconButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-[#3b4a54] dark:text-slate-300 dark:hover:bg-[#2a3942]"
    >
      {icon}
    </button>
  );
}

function MessageBubble({
  message,
  isDeleting,
  pendingReactionKey,
  onDelete,
  onToggleReaction,
}: {
  message: ConversationMessage;
  isDeleting: boolean;
  pendingReactionKey: string | null;
  onDelete: (messageId: Id<"messages">) => void;
  onToggleReaction: (messageId: Id<"messages">, emoji: ReactionKey) => void;
}) {
  return (
    <div className={cn("flex", message.isMine ? "justify-end" : "justify-start")}>
      <div className="max-w-[min(86%,42rem)]">
        <div
          className={cn(
            "rounded-2xl px-3 py-2",
            message.isMine
              ? "rounded-tr-sm bg-emerald-100 text-slate-900 dark:bg-[#005c4b] dark:text-[#e9edef]"
              : "rounded-tl-sm bg-white text-slate-900 shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]",
          )}
        >
          {!message.isMine ? (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[#8696a0]">
              {message.senderName}
            </p>
          ) : null}

          {message.isDeleted ? (
            <p className="text-sm italic text-slate-500 dark:text-[#aebac1]">This message was deleted</p>
          ) : message.messageType === "image" ? (
            <div className="space-y-2">
              {message.imageUrl ? (
                <>
                  {/* Convex storage URLs are already optimized and short-lived signed links. */}
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
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
              ) : null}
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
          )}

          <div className="mt-1 flex items-center justify-between gap-3">
            <p
              className={cn(
                "text-[11px]",
                message.isMine ? "text-slate-500 dark:text-[#aebac1]" : "text-slate-500 dark:text-[#8696a0]",
              )}
              suppressHydrationWarning
            >
              {formatMessageTimestamp(message.createdAt)}
            </p>

            {message.isMine && !message.isDeleted ? (
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => onDelete(message._id)}
                className="inline-flex items-center gap-1 text-[11px] text-rose-600 transition hover:text-rose-500 disabled:opacity-60 dark:text-rose-300 dark:hover:text-rose-200"
              >
                {isDeleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                Delete
              </button>
            ) : null}
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
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition",
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
