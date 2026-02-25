
"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  FileText,
  Loader2,
  Mic,
  Paperclip,
  Search,
  SendHorizontal,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";

import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import EmojiPicker from "emoji-picker-react";

import { ContactPickerModal } from "./window/contact-picker-modal";
import { DOCUMENT_ACCEPT, MAX_DOCUMENT_SIZE_BYTES, MAX_IMAGE_SIZE_BYTES } from "./window/constants";
import { DateDivider } from "./window/date-divider";
import { DocumentRecipientModal } from "./window/document-recipient-modal";
import { IconButton } from "./window/icon-button";
import { Smile } from "lucide-react";
import { MessageBubble } from "./window/message-bubble";
import { MessageListSkeleton } from "./window/message-list-skeleton";
import { QuickAction } from "./window/quick-action";
import {
  buildTimelineItems,
  countSearchMatches,
  formatTypingLabel,
  isNearBottom,
  isSupportedDocument,
  toErrorMessage,
} from "./window/utils";
import type { ConversationMessage, ConversationPreview, ReactionKey } from "./types";
import { UserAvatar } from "./user-avatar";

type ChatWindowProps = {
  conversationId: Id<"conversations"> | null;
  conversation: ConversationPreview | null;
  onBack: () => void;
  onConversationOpen: (conversationId: Id<"conversations">) => void;
};

type FailedSend =
  | { type: "text"; body: string; error: string }
  | { type: "image"; file: File; caption: string; error: string };

type AiTurn = {
  role: "user" | "assistant";
  text: string;
};

export function ChatWindow({
  conversationId,
  conversation,
  onBack,
  onConversationOpen,
}: ChatWindowProps) {
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
  const discoverableUsers = useQuery(api.users.listDiscoverable, { search: "" });
  const allConversations = useQuery(api.conversations.listForCurrentUser);

  const sendMessage = useMutation(api.messages.send);
  const sendImage = useMutation(api.messages.sendImage);
  const sendFile = useMutation(api.messages.sendFile);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const deleteOwnMessage = useMutation(api.messages.deleteOwn);
  const editOwnMessage = useMutation(api.messages.editOwn);
  const toggleReaction = useMutation(api.messages.toggleReaction);
  const markConversationRead = useMutation(api.messages.markConversationRead);
  const setTyping = useMutation(api.typing.setTyping);
  const getOrCreateDirectConversation = useMutation(
    api.conversations.getOrCreateDirectConversation,
  );

  const activeConversation = conversation ?? fallbackConversation ?? null;

  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showNewMessagesButton, setShowNewMessagesButton] = useState(false);
  const [failedSend, setFailedSend] = useState<FailedSend | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [pendingDeleteMessageId, setPendingDeleteMessageId] = useState<Id<"messages"> | null>(null);
  const [openMenuMessageId, setOpenMenuMessageId] = useState<Id<"messages"> | null>(null);
  const [openReactionPickerMessageId, setOpenReactionPickerMessageId] = useState<
    Id<"messages"> | null
  >(null);
  const [editingMessageId, setEditingMessageId] = useState<Id<"messages"> | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [pendingReactionKey, setPendingReactionKey] = useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTurns, setAiTurns] = useState<AiTurn[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [isContactPickerOpen, setIsContactPickerOpen] = useState(false);
  const [contactSearchValue, setContactSearchValue] = useState("");
  const [pendingContactStartId, setPendingContactStartId] = useState<Id<"users"> | null>(null);

  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(null);
  const [isDocumentRecipientModalOpen, setIsDocumentRecipientModalOpen] = useState(false);
  const [documentRecipientSearch, setDocumentRecipientSearch] = useState("");
  const [selectedRecipientConversationIds, setSelectedRecipientConversationIds] = useState<
    Id<"conversations">[]
  >([]);
  const [selectedRecipientUserIds, setSelectedRecipientUserIds] = useState<Id<"users">[]>([]);
  const [isSendingDocument, setIsSendingDocument] = useState(false);
  const [documentActionError, setDocumentActionError] = useState<string | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const quickDocumentInputRef = useRef<HTMLInputElement | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const previousConversationIdRef = useRef<Id<"conversations"> | null>(null);
  const previousMessageIdRef = useRef<Id<"messages"> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredContactUsers = useMemo(() => {
    if (!discoverableUsers) return [];
    const term = contactSearchValue.trim().toLowerCase();
    if (!term) return discoverableUsers;
    return discoverableUsers.filter((user) => user.name.toLowerCase().includes(term));
  }, [contactSearchValue, discoverableUsers]);

  const filteredRecipientConversations = useMemo(() => {
    if (!allConversations) return [];
    const term = documentRecipientSearch.trim().toLowerCase();
    if (!term) return allConversations;
    return allConversations.filter((item) => item.name.toLowerCase().includes(term));
  }, [allConversations, documentRecipientSearch]);

  const filteredRecipientUsers = useMemo(() => {
    if (!discoverableUsers) return [];
    const term = documentRecipientSearch.trim().toLowerCase();
    if (!term) return discoverableUsers;
    return discoverableUsers.filter((user) => user.name.toLowerCase().includes(term));
  }, [discoverableUsers, documentRecipientSearch]);

  const stopTyping = useCallback(
    (targetConversationId: Id<"conversations"> | null) => {
      if (!targetConversationId) return;
      void setTyping({ conversationId: targetConversationId, isTyping: false });
    },
    [setTyping],
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const container = messageListRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
    nearBottomRef.current = true;
  }, []);

  const sendText = useCallback(
    async (body: string) => {
      if (!conversationId) return false;
      try {
        await sendMessage({ conversationId, body });
        await markConversationRead({ conversationId });
        return true;
      } catch (error) {
        setFailedSend({ type: "text", body, error: toErrorMessage(error, "Failed to send message.") });
        return false;
      }
    },
    [conversationId, markConversationRead, sendMessage],
  );

  const sendImageFile = useCallback(
    async (file: File, caption: string) => {
      if (!conversationId) return false;

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

  const resetDocumentRecipientModalState = () => {
    setSelectedDocumentFile(null);
    setDocumentRecipientSearch("");
    setSelectedRecipientConversationIds([]);
    setSelectedRecipientUserIds([]);
    setDocumentActionError(null);
    setIsDocumentRecipientModalOpen(false);
  };

  const handleDocumentFileSelected = (file: File) => {
    if (!isSupportedDocument(file)) {
      setDocumentActionError("Unsupported document type.");
      return;
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      setDocumentActionError("Document is too large. Please use a file under 15 MB.");
      return;
    }

    setSelectedDocumentFile(file);
    setDocumentRecipientSearch("");
    setSelectedRecipientConversationIds([]);
    setSelectedRecipientUserIds([]);
    setDocumentActionError(null);
    setIsDocumentRecipientModalOpen(true);
  };

  const handleSendDocumentToRecipients = async () => {
    if (!selectedDocumentFile) {
      setDocumentActionError("Select a document first.");
      return;
    }

    if (selectedRecipientConversationIds.length === 0 && selectedRecipientUserIds.length === 0) {
      setDocumentActionError("Select at least one recipient.");
      return;
    }

    setIsSendingDocument(true);
    setDocumentActionError(null);

    try {
      const uploadUrl = await generateUploadUrl({});
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": selectedDocumentFile.type || "application/octet-stream",
        },
        body: selectedDocumentFile,
      });
      if (!uploadResponse.ok) {
        throw new Error("Document upload failed");
      }

      const uploadResult = (await uploadResponse.json()) as { storageId?: Id<"_storage"> };
      if (!uploadResult.storageId) {
        throw new Error("Upload did not return a storage id");
      }

      const recipientConversationIds = new Set<Id<"conversations">>(selectedRecipientConversationIds);
      for (const userId of selectedRecipientUserIds) {
        const conversationForUser = await getOrCreateDirectConversation({ otherUserId: userId });
        recipientConversationIds.add(conversationForUser);
      }

      const targetConversationIds = [...recipientConversationIds];
      await Promise.all(
        targetConversationIds.map((targetConversationId) =>
          sendFile({
            conversationId: targetConversationId,
            storageId: uploadResult.storageId!,
            fileName: selectedDocumentFile.name,
            mimeType: selectedDocumentFile.type || undefined,
            fileSize: selectedDocumentFile.size,
          }),
        ),
      );

      if (targetConversationIds.length > 0) {
        onConversationOpen(targetConversationIds[0]);
      }

      resetDocumentRecipientModalState();
    } catch (error) {
      setDocumentActionError(toErrorMessage(error, "Failed to send document."));
    } finally {
      setIsSendingDocument(false);
    }
  };

  const handleStartConversationFromContact = async (userId: Id<"users">) => {
    setPendingContactStartId(userId);
    setActionError(null);
    try {
      const openedConversationId = await getOrCreateDirectConversation({ otherUserId: userId });
      setIsContactPickerOpen(false);
      setContactSearchValue("");
      onConversationOpen(openedConversationId);
    } catch (error) {
      setActionError(toErrorMessage(error, "Failed to start conversation."));
    } finally {
      setPendingContactStartId(null);
    }
  };

  useEffect(() => {
    setDraft("");
    setShowNewMessagesButton(false);
    setFailedSend(null);
    setActionError(null);
    setIsSearchOpen(false);
    setMessageSearchQuery("");
    setOpenMenuMessageId(null);
    setOpenReactionPickerMessageId(null);
    setEditingMessageId(null);
    setEditDraft("");
    previousMessageIdRef.current = null;
    nearBottomRef.current = true;
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !messages) return;

    const container = messageListRef.current;
    if (!container) return;

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
    if (!conversationId || !messages) return;
    void markConversationRead({ conversationId });
  }, [conversationId, messages, markConversationRead]);

  useEffect(() => {
    if (!openMenuMessageId && !openReactionPickerMessageId) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("[data-message-menu-root='true']") ||
        target?.closest("[data-reaction-picker-root='true']")
      ) {
        return;
      }
      setOpenMenuMessageId(null);
      setOpenReactionPickerMessageId(null);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [openMenuMessageId, openReactionPickerMessageId]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      stopTyping(conversationId);
    };
  }, [conversationId, stopTyping]);

  const handleScroll = () => {
    const container = messageListRef.current;
    if (!container) return;
    const nearBottom = isNearBottom(container);
    nearBottomRef.current = nearBottom;
    if (nearBottom) setShowNewMessagesButton(false);
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);

    if (!conversationId) return;

    if (!value.trim()) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      stopTyping(conversationId);
      return;
    }

    void setTyping({ conversationId, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => stopTyping(conversationId), 2_000);
  };

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!conversationId) return;

    const messageBody = draft.trim();
    if (!messageBody) return;

    setDraft("");
    setIsSending(true);
    setActionError(null);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    stopTyping(conversationId);

    try {
      await sendText(messageBody);
    } finally {
      setIsSending(false);
    }
  };

  const handleImageSelected = async (file: File) => {
    if (!conversationId) return;
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

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    stopTyping(conversationId);

    try {
      const sent = await sendImageFile(file, caption);
      if (!sent) setDraft(caption);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRetryFailedSend = async () => {
    if (!failedSend) return;

    setIsSending(true);
    const retry = failedSend;
    setFailedSend(null);

    try {
      if (retry.type === "text") {
        const sent = await sendText(retry.body);
        if (!sent) setDraft(retry.body);
      } else {
        const sent = await sendImageFile(retry.file, retry.caption);
        if (!sent) setDraft(retry.caption);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: Id<"messages">) => {
    setPendingDeleteMessageId(messageId);
    setOpenMenuMessageId(null);
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
    setOpenReactionPickerMessageId(null);
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

  const handleStartEdit = (message: ConversationMessage) => {
    if (!message.isMine || message.isDeleted || message.messageType !== "text") {
      return;
    }
    setOpenMenuMessageId(null);
    setEditingMessageId(message._id);
    setEditDraft(message.body);
    setActionError(null);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditDraft("");
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId) {
      return;
    }

    const nextBody = editDraft.trim();
    if (!nextBody) {
      setActionError("Message body cannot be empty.");
      return;
    }

    setIsSavingEdit(true);
    setActionError(null);
    try {
      await editOwnMessage({
        messageId: editingMessageId,
        body: nextBody,
      });
      setEditingMessageId(null);
      setEditDraft("");
    } catch (error) {
      setActionError(toErrorMessage(error, "Failed to edit message."));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleAskAi = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt || isAiLoading) {
      return;
    }

    setAiPrompt("");
    setAiError(null);
    setIsAiLoading(true);
    setAiTurns((previous) => [...previous, { role: "user", text: prompt }]);

    try {
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          conversationName: activeConversation?.name ?? null,
        }),
      });

      const payload = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "AI request failed");
      }

      setAiTurns((previous) => [
        ...previous,
        { role: "assistant", text: payload.reply ?? "No response from AI." },
      ]);
    } catch (error) {
      setAiError(toErrorMessage(error, "AI request failed."));
    } finally {
      setIsAiLoading(false);
    }
  };

  if (!conversationId) {
    return (
      <>
        <div className="glass-panel flex h-full items-center justify-center bg-slate-100 dark:bg-[#0b141a]">
          <div className="flex flex-col items-center gap-4">
            <div className="grid grid-cols-2 gap-6">
              <QuickAction
                title="Send document"
                icon={<FileText className="h-6 w-6" />}
                onClick={() => quickDocumentInputRef.current?.click()}
              />
              <QuickAction
                title="Add contact"
                icon={<UserPlus className="h-6 w-6" />}
                onClick={() => setIsContactPickerOpen(true)}
              />
            </div>
            <input
              ref={quickDocumentInputRef}
              type="file"
              accept={DOCUMENT_ACCEPT}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleDocumentFileSelected(file);
                event.currentTarget.value = "";
              }}
            />
            {documentActionError ? (
              <p className="text-xs text-rose-600 dark:text-rose-300">{documentActionError}</p>
            ) : null}
            <p className="text-sm text-slate-500 dark:text-[#8696a0]">
              Select a chat to start messaging.
            </p>
          </div>
        </div>

        {isContactPickerOpen ? (
          <ContactPickerModal
            users={filteredContactUsers}
            searchValue={contactSearchValue}
            pendingUserId={pendingContactStartId}
            onSearchChange={setContactSearchValue}
            onClose={() => {
              setIsContactPickerOpen(false);
              setContactSearchValue("");
            }}
            onSelectUser={(userId) => void handleStartConversationFromContact(userId)}
          />
        ) : null}

        {isDocumentRecipientModalOpen ? (
          <DocumentRecipientModal
            selectedFile={selectedDocumentFile}
            searchValue={documentRecipientSearch}
            conversations={filteredRecipientConversations}
            users={filteredRecipientUsers}
            selectedConversationIds={selectedRecipientConversationIds}
            selectedUserIds={selectedRecipientUserIds}
            isSending={isSendingDocument}
            error={documentActionError}
            onSearchChange={setDocumentRecipientSearch}
            onToggleConversation={(targetConversationId) =>
              setSelectedRecipientConversationIds((previous) =>
                previous.includes(targetConversationId)
                  ? previous.filter((id) => id !== targetConversationId)
                  : [...previous, targetConversationId],
              )
            }
            onToggleUser={(targetUserId) =>
              setSelectedRecipientUserIds((previous) =>
                previous.includes(targetUserId)
                  ? previous.filter((id) => id !== targetUserId)
                  : [...previous, targetUserId],
              )
            }
            onClose={resetDocumentRecipientModalState}
            onSend={() => void handleSendDocumentToRecipients()}
          />
        ) : null}
      </>
    );
  }

  const typingLabel = formatTypingLabel(typingState?.names ?? []);
  const trimmedSearchQuery = messageSearchQuery.trim();

  const timelineItems = buildTimelineItems(messages);
  const searchMatchCount = countSearchMatches(messages, trimmedSearchQuery);

  return (
    <div className="flex h-full flex-col bg-background relative">
      <header className="z-10 px-5 py-4 bg-background/80 backdrop-blur-md border-b border-border/50 shadow-sm transition-all">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border text-foreground md:hidden hover:bg-secondary transition-colors"
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
                  <h2 className="truncate text-sm font-semibold text-foreground">
                    {activeConversation.name}
                  </h2>
                  {activeConversation.type === "group" ? (
                    <p className="text-xs text-muted-foreground">
                      {activeConversation.memberCount} members
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {activeConversation.isOnline ? "Online" : "Offline"}
                    </p>
                  )}
                </div>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-1">
            <IconButton
              icon={<Search className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 group-active:scale-95" />}
              label={isSearchOpen ? "Close search" : "Search messages"}
              active={isSearchOpen}
              onClick={() => setIsSearchOpen((previous) => !previous)}
            />
            <IconButton
              icon={<Sparkles className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 text-sky-500 group-active:scale-95" />}
              label={isAiModalOpen ? "Close AI assistant" : "Open AI assistant"}
              active={isAiModalOpen}
              onClick={() => setIsAiModalOpen((previous) => !previous)}
            />
          </div>
        </div>
      </header>

      {isSearchOpen ? (
        <div className="z-10 px-5 py-3 bg-background border-b border-border/50 shadow-sm animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <input
              value={messageSearchQuery}
              onChange={(event) => setMessageSearchQuery(event.target.value)}
              placeholder="Search in chat..."
              className="h-10 flex-1 rounded-2xl border border-transparent bg-secondary shadow-inner px-4 text-sm font-medium text-foreground outline-none focus:bg-background focus:border-primary/30 focus:ring-4 focus:ring-primary/10 transition-all duration-300"
            />
            <button
              type="button"
              onClick={() => {
                setMessageSearchQuery("");
                setIsSearchOpen(false);
              }}
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border text-foreground hover:bg-secondary transition-colors"
              aria-label="Close message search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-[#8696a0]">
            {trimmedSearchQuery
              ? `${searchMatchCount} match${searchMatchCount === 1 ? "" : "es"}`
              : "Type to highlight matching text in messages"}
          </p>
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={messageListRef}
          onScroll={handleScroll}
          className="chat-message-surface min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
        >
          {messages === undefined ? (
            <MessageListSkeleton />
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center bg-background">
                <p className="text-base font-semibold text-foreground">It's quiet in here... 🌬️</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Send a message or a sticker to get the conversation going!
                </p>
              </div>
            </div>
          ) : (
            timelineItems.map((item) =>
              item.type === "divider" ? (
                <DateDivider key={item.key} label={item.label} />
              ) : (
                <MessageBubble
                  key={item.key}
                  message={item.message}
                  isDeleting={pendingDeleteMessageId === item.message._id}
                  isMenuOpen={openMenuMessageId === item.message._id}
                  isReactionPickerOpen={openReactionPickerMessageId === item.message._id}
                  isEditing={editingMessageId === item.message._id}
                  isSavingEdit={isSavingEdit}
                  editDraft={editDraft}
                  searchQuery={trimmedSearchQuery}
                  pendingReactionKey={pendingReactionKey}
                  onToggleMenu={() => {
                    setOpenReactionPickerMessageId(null);
                    setOpenMenuMessageId((previous) =>
                      previous === item.message._id ? null : item.message._id,
                    );
                  }}
                  onToggleReactionPicker={() => {
                    setOpenMenuMessageId(null);
                    setOpenReactionPickerMessageId((previous) =>
                      previous === item.message._id ? null : item.message._id,
                    );
                  }}
                  onStartEdit={() => handleStartEdit(item.message)}
                  onEditDraftChange={setEditDraft}
                  onSaveEdit={() => void handleSaveEdit()}
                  onCancelEdit={handleCancelEdit}
                  onDelete={handleDeleteMessage}
                  onToggleReaction={handleToggleReaction}
                />
              ),
            )
          )}
        </div>

        {showNewMessagesButton ? (
          <button
            onClick={() => {
              scrollToBottom("smooth");
              setShowNewMessagesButton(false);
            }}
            className="chat-new-messages-pulse absolute right-4 bottom-20 inline-flex cursor-pointer items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-lg dark:bg-[#25d366] dark:text-[#111b21]"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            New messages
          </button>
        ) : null}

        <div className="min-h-6 px-4 text-xs text-muted-foreground">
          {typingLabel ? (
            <div className="mb-1 inline-flex items-center gap-2 rounded-full px-2.5 py-1 bg-secondary text-secondary-foreground">
              <span>{typingLabel}</span>
              <div className="chat-typing-dots" aria-hidden="true">
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
              </div>
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
                className="cursor-pointer rounded-md border border-rose-300 px-2 py-1 font-medium dark:border-rose-700"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setFailedSend(null)}
                className="cursor-pointer rounded-md border border-rose-300 px-2 py-1 dark:border-rose-700"
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
              className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-amber-300 dark:border-amber-700"
              aria-label="Dismiss warning"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}
        <div className="mt-auto relative z-10 bg-background border-t border-border px-4 py-3">
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 relative bg-background"
          >
            {isEmojiPickerOpen ? (
              <div className="absolute bottom-16 left-0 z-50 chat-reaction-picker-enter shadow-2xl rounded-2xl overflow-hidden border border-border/50">
                <EmojiPicker
                  onEmojiClick={(emojiData) => {
                    handleDraftChange(draft + emojiData.emoji);
                  }}
                  theme={"auto" as any}
                  searchDisabled={true}
                  skinTonesDisabled={true}
                />
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
              className={cn(
                "group inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground hover:bg-secondary transition-colors",
                isEmojiPickerOpen && "bg-secondary text-primary"
              )}
              aria-label="Pick emoji"
            >
              <Smile className="h-[22px] w-[22px] transition-transform duration-200 group-hover:scale-110 group-active:scale-95" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
              className="group inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground hover:bg-secondary disabled:opacity-60 transition-colors"
              aria-label="Send image"
            >
              {isUploadingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-[22px] w-[22px] transition-transform duration-200 group-hover:scale-110 group-active:scale-95 text-sky-500" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImageSelected(file);
                event.currentTarget.value = "";
              }}
            />
            <div className="flex h-10 flex-1 items-center bg-secondary rounded-xl pr-1 min-w-0 border border-transparent focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
              <input
                value={draft}
                onChange={(event) => handleDraftChange(event.target.value)}
                placeholder="Message..."
                className="h-full w-full bg-transparent px-4 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/80"
              />
              {draft.trim() ? null : (
                <span className="group mr-3 text-muted-foreground/60 cursor-pointer">
                  <Mic className="h-5 w-5 transition-transform duration-200 group-hover:scale-110 group-active:scale-95" />
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSending || !draft.trim()}
              className="group inline-flex h-10 px-5 font-semibold cursor-pointer items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="transition-transform duration-200 group-hover:scale-105 group-active:scale-95">Send</span>}
            </button>
          </form>
        </div>
      </div>

      {isAiModalOpen ? (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-end justify-end p-4">
          <div className="chat-modal-enter pointer-events-auto h-[min(32rem,78vh)] w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-background shadow-2xl backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-foreground">AI Assistant</p>
                <p className="text-[11px] text-muted-foreground">Quick help inside chat</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-transparent text-muted-foreground hover:bg-secondary transition-colors"
                aria-label="Close AI assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex h-[calc(100%-3.1rem)] flex-col">
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
                {aiTurns.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    Ask anything. Example: &quot;Summarize this conversation.&quot; or
                    &nbsp;&quot;Draft a polite reply.&quot;
                  </p>
                ) : (
                  aiTurns.map((turn, index) => (
                    <div
                      key={`${turn.role}-${index}`}
                      className={cn(
                        "max-w-[92%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                        turn.role === "assistant"
                          ? "bg-secondary text-secondary-foreground"
                          : "ml-auto ig-message-gradient shadow-sm",
                      )}
                    >
                      {turn.text}
                    </div>
                  ))
                )}
                {isAiLoading ? (
                  <div className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Thinking...
                  </div>
                ) : null}
              </div>

              {aiError ? (
                <div className="mx-3 mb-2 rounded-lg bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                  {aiError}
                </div>
              ) : null}

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleAskAi();
                }}
                className="border-t border-border p-2.5 bg-background"
              >
                <div className="flex items-center gap-2">
                  <input
                    value={aiPrompt}
                    onChange={(event) => setAiPrompt(event.target.value)}
                    placeholder="Ask AI..."
                    className="h-9 flex-1 rounded-full border border-border bg-secondary px-3 text-sm text-foreground outline-none focus:border-ring transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={isAiLoading || !aiPrompt.trim()}
                    className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50 transition"
                  >
                    {isAiLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SendHorizontal className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null
      }
    </div >
  );
}
