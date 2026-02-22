"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, WifiOff, X } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useConvexConnectionState, useMutation, useQuery } from "convex/react";

import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

import { ChatSidebar } from "./chat-sidebar";
import { ChatWindow } from "./chat-window";

const HEARTBEAT_INTERVAL_MS = 20_000;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function ChatApp() {
  const { user, isLoaded, isSignedIn } = useUser();
  const connectionState = useConvexConnectionState();

  const [hasMounted, setHasMounted] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [activeConversationId, setActiveConversationId] = useState<Id<"conversations"> | null>(
    null,
  );
  const [startingConversationUserId, setStartingConversationUserId] = useState<Id<"users"> | null>(
    null,
  );
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);

  const upsertMe = useMutation(api.users.upsertMe);
  const heartbeat = useMutation(api.presence.heartbeat);
  const getOrCreateDirectConversation = useMutation(
    api.conversations.getOrCreateDirectConversation,
  );
  const createGroupConversation = useMutation(api.conversations.createGroupConversation);

  const users = useQuery(api.users.listDiscoverable, { search: searchValue });
  const allUsers = useQuery(api.users.listDiscoverable, { search: "" });
  const conversations = useQuery(api.conversations.listForCurrentUser);

  const currentUserName = useMemo(() => {
    if (!user) {
      return "You";
    }
    return user.fullName ?? user.username ?? user.primaryEmailAddress?.emailAddress ?? "You";
  }, [user]);

  const currentUserEmail = user?.primaryEmailAddress?.emailAddress;
  const currentUserImage = user?.imageUrl ?? null;
  const currentUserId = user?.id;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !currentUserId) {
      return;
    }

    void upsertMe({
      name: currentUserName,
      imageUrl: currentUserImage ?? undefined,
      email: currentUserEmail,
    });
  }, [isLoaded, isSignedIn, currentUserId, currentUserName, currentUserImage, currentUserEmail, upsertMe]);

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    const runHeartbeat = () => {
      void heartbeat();
    };

    runHeartbeat();
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        runHeartbeat();
      }
    }, HEARTBEAT_INTERVAL_MS);
    const onVisibleOrFocus = () => {
      if (document.visibilityState === "visible") {
        runHeartbeat();
      }
    };

    window.addEventListener("visibilitychange", onVisibleOrFocus);
    window.addEventListener("focus", onVisibleOrFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("visibilitychange", onVisibleOrFocus);
      window.removeEventListener("focus", onVisibleOrFocus);
    };
  }, [isSignedIn, heartbeat]);

  useEffect(() => {
    if (!conversations || !activeConversationId) {
      return;
    }

    const stillExists = conversations.some(
      (conversation) => conversation.conversationId === activeConversationId,
    );
    if (!stillExists) {
      setActiveConversationId(null);
    }
  }, [conversations, activeConversationId]);

  const activeConversation =
    conversations?.find((conversation) => conversation.conversationId === activeConversationId) ??
    null;

  const handleStartConversation = async (userId: Id<"users">) => {
    setStartingConversationUserId(userId);
    setAppError(null);

    try {
      const conversationId = await getOrCreateDirectConversation({
        otherUserId: userId,
      });
      setActiveConversationId(conversationId);
    } catch (error) {
      setAppError(getErrorMessage(error, "Failed to start conversation."));
    } finally {
      setStartingConversationUserId(null);
    }
  };

  const handleCreateGroup = async (name: string, memberIds: Id<"users">[]) => {
    setCreatingGroup(true);
    setAppError(null);

    try {
      const conversationId = await createGroupConversation({
        name,
        memberIds,
      });
      setActiveConversationId(conversationId);
    } catch (error) {
      setAppError(getErrorMessage(error, "Failed to create group."));
      throw error;
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleProfileImageUpload = async (file: File) => {
    if (!user) {
      return;
    }

    setUploadingProfile(true);
    setAppError(null);

    try {
      const uploadedImage = await user.setProfileImage({ file });
      await upsertMe({
        name: currentUserName,
        imageUrl: uploadedImage.publicUrl ?? currentUserImage ?? undefined,
        email: currentUserEmail,
      });
      await user.reload();
    } catch (error) {
      setAppError(getErrorMessage(error, "Failed to update profile image."));
    } finally {
      setUploadingProfile(false);
    }
  };

  const mobileChatOpen = activeConversationId !== null;
  const showConnectionWarning =
    connectionState.hasEverConnected && !connectionState.isWebSocketConnected;

  if (!hasMounted) {
    return (
      <main
        suppressHydrationWarning
        className="h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-white dark:bg-[#0b141a]"
      />
    );
  }

  return (
    <main className="h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-white dark:bg-[#0b141a]">
      <div className="h-full w-full">
        <div className="h-full overflow-hidden bg-white ring-1 ring-slate-200 dark:bg-[#111b21] dark:ring-[#1f2c34]">
          {showConnectionWarning ? (
            <div className="flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-200">
              <WifiOff className="h-4 w-4" />
              <span>Connection lost. Reconnecting...</span>
            </div>
          ) : null}

          {appError ? (
            <div className="flex items-center justify-between gap-3 border-b border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900 dark:border-rose-700/60 dark:bg-rose-900/30 dark:text-rose-200">
              <div className="flex min-w-0 items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="truncate">{appError}</span>
              </div>
              <button
                onClick={() => setAppError(null)}
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-rose-300 dark:border-rose-700"
                aria-label="Dismiss error"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          <div className="flex h-full">
            <aside
              className={cn(
                "h-full w-full md:w-[470px] md:border-r md:border-slate-200 md:dark:border-[#2a3942]",
                mobileChatOpen ? "hidden md:block" : "block",
              )}
            >
              <ChatSidebar
                currentUserName={currentUserName}
                currentUserImage={currentUserImage}
                searchValue={searchValue}
                onSearchChange={setSearchValue}
                users={users}
                groupUsers={allUsers ?? users}
                conversations={conversations}
                activeConversationId={activeConversationId}
                onConversationSelect={setActiveConversationId}
                onStartConversation={handleStartConversation}
                onCreateGroup={handleCreateGroup}
                onProfileImageUpload={handleProfileImageUpload}
                isUploadingProfile={uploadingProfile}
                isCreatingGroup={creatingGroup}
                startingConversationUserId={startingConversationUserId}
              />
            </aside>

            <section className={cn("h-full flex-1", mobileChatOpen ? "block" : "hidden md:block")}>
              <ChatWindow
                conversationId={activeConversationId}
                conversation={activeConversation}
                onBack={() => setActiveConversationId(null)}
                onConversationOpen={setActiveConversationId}
              />
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
