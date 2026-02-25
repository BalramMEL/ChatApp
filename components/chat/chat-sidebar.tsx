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
      <div className="flex h-full bg-transparent">
        <div className="hidden w-[72px] flex-col items-center justify-between py-4 bg-transparent md:flex">
          <div className="flex w-full flex-col items-center gap-3">
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

        <div className="flex min-w-0 flex-1 flex-col bg-transparent md:border-l border-border/50 shadow-[-10px_0_30px_rgba(0,0,0,0.02)] z-10">
          <div className="px-5 py-5 pb-4 bg-transparent">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-3xl">
                Chats
              </h1>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="group inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-secondary/80 text-foreground hover:bg-secondary transition-colors"
                  aria-label="New chat"
                >
                  <Plus className="h-5 w-5 transition-transform duration-200 group-hover:scale-110 group-active:scale-95" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(true)}
                  className="group inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-secondary/80 text-foreground hover:bg-secondary transition-colors"
                  aria-label="New group"
                >
                  <UsersRound className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 group-active:scale-95" />
                </button>
                <div className="flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95 hover:ring-2 hover:ring-primary/20">
                  <UserButton afterSignOutUrl="/sign-in" />
                </div>
              </div>
            </div>

            <div className="relative mt-5">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search messages..."
                className="h-10 w-full rounded-xl border border-border bg-secondary px-9 text-sm font-medium text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200"
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
                    ? "No chats found matching your search."
                    : activeTab === "unread"
                      ? "You're all caught up! No unread chats."
                      : activeTab === "groups"
                        ? "You aren't in any groups yet."
                        : "No chats yet. Start a conversation!"
                }
              />
            ) : (
              filteredConversations.map((conversation, index) => (
                <button
                  key={conversation.conversationId}
                  onClick={() => onConversationSelect(conversation.conversationId)}
                  className={cn(
                    "mx-2 my-0.5 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors duration-150 group",
                    String(activeConversationId ?? "") === String(conversation.conversationId)
                      ? "bg-secondary font-semibold"
                      : "hover:bg-secondary/60",
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
                            "shrink-0 text-xs font-medium tracking-tight",
                            String(activeConversationId ?? "") === String(conversation.conversationId) || conversation.unreadCount > 0
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                          suppressHydrationWarning
                        >
                          {formatMessageTimestamp(conversation.lastMessageAt)}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-[13px] font-medium text-muted-foreground group-hover:text-foreground/80 transition-colors">
                        {conversation.lastMessageText ??
                          (conversation.type === "group"
                            ? `${conversation.memberCount} members`
                            : "No messages yet.")}
                      </p>
                      {conversation.unreadCount > 0 ? (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground shadow-sm">
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
