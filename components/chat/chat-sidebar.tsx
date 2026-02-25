"use client";

import { useMemo, useRef, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Settings,
  Upload,
  UsersRound,
  X,
} from "lucide-react";

import type { Id } from "@/convex/_generated/dataModel";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatMessageTimestamp } from "@/lib/time";
import { cn } from "@/lib/utils";

import type { ConversationPreview, UserPreview } from "./types";
import { UserAvatar } from "./user-avatar";

type ChatSidebarProps = {
  currentUserName: string;
  currentUserImage: string | null;
  searchValue: string;
  onSearchChange: (value: string) => void;
  users: UserPreview[] | undefined;
  groupUsers: UserPreview[] | undefined;
  conversations: ConversationPreview[] | undefined;
  activeConversationId: Id<"conversations"> | null;
  onConversationSelect: (id: Id<"conversations">) => void;
  onStartConversation: (userId: Id<"users">) => void;
  onCreateGroup: (name: string, memberIds: Id<"users">[]) => Promise<void>;
  onProfileImageUpload: (file: File) => Promise<void>;
  isUploadingProfile: boolean;
  isCreatingGroup: boolean;
  startingConversationUserId: Id<"users"> | null;
};

type SidebarTab = "all" | "unread" | "groups";

function filterConversationsByTab(conversations: ConversationPreview[], tab: SidebarTab) {
  if (tab === "unread") {
    return conversations.filter((conversation) => conversation.unreadCount > 0);
  }
  if (tab === "groups") {
    return conversations.filter((conversation) => conversation.type === "group");
  }
  return conversations;
}

export function ChatSidebar({
  currentUserName,
  currentUserImage,
  searchValue,
  onSearchChange,
  users,
  groupUsers,
  conversations,
  activeConversationId,
  onConversationSelect,
  onStartConversation,
  onCreateGroup,
  onProfileImageUpload,
  isUploadingProfile,
  isCreatingGroup,
  startingConversationUserId,
}: ChatSidebarProps) {
  const profileUploadInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<SidebarTab>("all");
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Id<"users">[]>([]);
  const [groupError, setGroupError] = useState<string | null>(null);

  const filteredConversations = useMemo(() => {
    if (!conversations) {
      return conversations;
    }

    const byTab = filterConversationsByTab(conversations, activeTab);
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return byTab;
    }

    return byTab.filter((conversation) => {
      const name = conversation.name.toLowerCase();
      const lastMessage = (conversation.lastMessageText ?? "").toLowerCase();
      return name.includes(query) || lastMessage.includes(query);
    });
  }, [conversations, activeTab, searchValue]);

  const handleToggleMember = (userId: Id<"users">) => {
    setSelectedMemberIds((previous) => {
      if (previous.includes(userId)) {
        return previous.filter((id) => id !== userId);
      }
      return [...previous, userId];
    });
  };

  const handleCreateGroup = async () => {
    setGroupError(null);
    const name = groupName.trim();
    if (!name) {
      setGroupError("Please enter a group name.");
      return;
    }
    if (selectedMemberIds.length < 2) {
      setGroupError("Select at least 2 members.");
      return;
    }

    try {
      await onCreateGroup(name, selectedMemberIds);
      setIsGroupModalOpen(false);
      setGroupName("");
      setSelectedMemberIds([]);
    } catch (error) {
      if (error instanceof Error && error.message.trim()) {
        setGroupError(error.message);
      } else {
        setGroupError("Failed to create group.");
      }
    }
  };

  return (
    <>
      <div className="flex h-full bg-background">
        <div className="hidden w-[72px] flex-col items-center justify-between border-r border-border py-3 bg-background md:flex">
          <div className="flex w-full flex-col items-center gap-2">
            <button
              type="button"
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
              aria-label="Chats"
            >
              <MessageCircle className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-secondary-foreground transition-colors"
              aria-label="Communities"
            >
              <UsersRound className="h-5 w-5" />
            </button>
            <ThemeToggle className="h-10 w-10 rounded-xl" />
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-secondary-foreground transition-colors"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
            <div className="relative">
              <UserAvatar name={currentUserName} imageUrl={currentUserImage} />
              <button
                type="button"
                onClick={() => profileUploadInputRef.current?.click()}
                disabled={isUploadingProfile}
                className="absolute -right-1 -bottom-1 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-slate-900 text-white shadow disabled:opacity-70 dark:bg-slate-200 dark:text-slate-900"
                aria-label="Upload profile image"
              >
                {isUploadingProfile ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
              </button>
              <input
                ref={profileUploadInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void onProfileImageUpload(file);
                  }
                  event.currentTarget.value = "";
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col bg-background">
          <div className="border-b border-border px-4 py-3 bg-background">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                Messages
              </h1>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-foreground hover:bg-secondary transition-colors"
                  aria-label="New chat"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(true)}
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-foreground hover:bg-secondary transition-colors"
                  aria-label="New group"
                >
                  <UsersRound className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-foreground hover:bg-secondary transition-colors"
                  aria-label="Settings"
                >
                  <UserButton afterSignOutUrl="/sign-in" />

                </button>
              </div>
            </div>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search or start a new chat"
                className="h-11 w-full rounded-full border border-border bg-secondary pl-9 pr-4 text-sm text-foreground outline-none focus:border-ring transition-colors"
              />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <FilterTab
                label="All"
                active={activeTab === "all"}
                onClick={() => setActiveTab("all")}
              />
              <FilterTab
                label="Unread"
                active={activeTab === "unread"}
                onClick={() => setActiveTab("unread")}
              />
              <FilterTab
                label="Groups"
                active={activeTab === "groups"}
                onClick={() => setActiveTab("groups")}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-3">
            {filteredConversations === undefined ? (
              <SidebarSkeletonRows />
            ) : filteredConversations.length === 0 ? (
              <SidebarEmpty
                text={
                  searchValue.trim()
                    ? "No matching conversations."
                    : activeTab === "unread"
                      ? "No unread conversations."
                      : activeTab === "groups"
                        ? "No group conversations yet."
                        : "No conversations yet."
                }
              />
            ) : (
              filteredConversations.map((conversation) => (
                <button
                  key={conversation.conversationId}
                  onClick={() => onConversationSelect(conversation.conversationId)}
                  className={cn(
                    "chat-list-item-enter mx-2 mt-1 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-200",
                    String(activeConversationId ?? "") === String(conversation.conversationId)
                      ? "bg-secondary"
                      : "hover:bg-secondary/50",
                  )}
                >
                  <UserAvatar
                    name={conversation.name}
                    imageUrl={conversation.imageUrl}
                    isOnline={conversation.type === "direct" ? conversation.isOnline : false}
                    className="h-12 w-12"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[1.05rem] font-medium text-foreground">
                        {conversation.name}
                      </p>
                      {conversation.lastMessageAt ? (
                        <span
                          className={cn(
                            "shrink-0 text-xs",
                            conversation.unreadCount > 0
                              ? "text-emerald-600 dark:text-[#25d366]"
                              : "text-slate-500 dark:text-[#8696a0]",
                          )}
                          suppressHydrationWarning
                        >
                          {formatMessageTimestamp(conversation.lastMessageAt)}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-sm text-slate-600 dark:text-[#8696a0]">
                        {conversation.lastMessageText ??
                          (conversation.type === "group"
                            ? `${conversation.memberCount} members`
                            : "No messages yet")}
                      </p>
                      {conversation.unreadCount > 0 ? (
                        <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-[#25d366] dark:text-[#111b21]">
                          {conversation.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {isNewChatModalOpen ? (
        <UserSelectModal
          title="Start New Chat"
          users={users}
          loadingUserId={startingConversationUserId}
          onClose={() => setIsNewChatModalOpen(false)}
          onSelectUser={async (userId) => {
            await onStartConversation(userId);
            setIsNewChatModalOpen(false);
          }}
        />
      ) : null}

      {isGroupModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="chat-modal-enter w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl dark:bg-[#202c33]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Create Group Chat
              </h2>
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 dark:border-[#3b4a54] dark:text-slate-300"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-[#8696a0]">
                  Group Name
                </label>
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="group name"
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-[#3b4a54] dark:bg-[#111b21] dark:text-slate-100"
                />
              </div>

              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-[#8696a0]">
                  Members (pick at least 2)
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-[#3b4a54]">
                  {groupUsers === undefined ? (
                    <SidebarSkeletonRows />
                  ) : groupUsers.length === 0 ? (
                    <SidebarEmpty text="No users available." />
                  ) : (
                    groupUsers.map((user) => {
                      const isSelected = selectedMemberIds.includes(user.id);
                      return (
                        <label
                          key={user.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-100 dark:hover:bg-[#2a3942]"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleMember(user.id)}
                            className="h-4 w-4 rounded border-slate-300 dark:border-[#3b4a54]"
                          />
                          <UserAvatar
                            name={user.name}
                            imageUrl={user.imageUrl}
                            isOnline={user.isOnline}
                            className="h-8 w-8"
                          />
                          <span className="truncate text-sm text-slate-800 dark:text-slate-200">
                            {user.name}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {groupError ? (
                <p className="rounded-lg border border-rose-300 bg-rose-50 px-2 py-1.5 text-xs text-rose-800 dark:border-rose-700/60 dark:bg-rose-900/30 dark:text-rose-200">
                  {groupError}
                </p>
              ) : null}

              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={isCreatingGroup}
                className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-60 dark:bg-[#25d366] dark:text-[#111b21]"
              >
                {isCreatingGroup ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Group"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FilterTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-full border px-3 py-1 text-sm transition",
        active
          ? "border-emerald-500 bg-emerald-100 text-emerald-700 dark:border-[#25d366] dark:bg-[#103529] dark:text-[#d6fddc]"
          : "border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-[#3b4a54] dark:text-[#8696a0] dark:hover:bg-[#2a3942]",
      )}
    >
      {label}
    </button>
  );
}

function UserSelectModal({
  title,
  users,
  loadingUserId,
  onClose,
  onSelectUser,
}: {
  title: string;
  users: UserPreview[] | undefined;
  loadingUserId: Id<"users"> | null;
  onClose: () => void;
  onSelectUser: (userId: Id<"users">) => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="chat-modal-enter w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl dark:bg-[#202c33]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 dark:border-[#3b4a54] dark:text-slate-300"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 space-y-1 overflow-y-auto">
          {users === undefined ? (
            <SidebarSkeletonRows />
          ) : users.length === 0 ? (
            <SidebarEmpty text="No users available." />
          ) : (
            users.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => void onSelectUser(user.id)}
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
                {loadingUserId === user.id ? (
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

function SidebarSkeletonRows() {
  return (
    <div className="space-y-2 px-3 py-3">
      <div className="h-14 animate-pulse rounded-xl bg-slate-300 dark:bg-[#2a3942]" />
      <div className="h-14 animate-pulse rounded-xl bg-slate-300 dark:bg-[#2a3942]" />
      <div className="h-14 animate-pulse rounded-xl bg-slate-300 dark:bg-[#2a3942]" />
    </div>
  );
}

function SidebarEmpty({ text }: { text: string }) {
  return (
    <div className="mx-3 mt-3 rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500 dark:border-[#3b4a54] dark:text-[#8696a0]">
      {text}
    </div>
  );
}
