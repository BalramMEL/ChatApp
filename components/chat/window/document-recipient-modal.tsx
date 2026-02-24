import { Loader2, Search, X } from "lucide-react";

import type { Id } from "@/convex/_generated/dataModel";

import type { ConversationPreview, UserPreview } from "../types";
import { UserAvatar } from "../user-avatar";

type DocumentRecipientModalProps = {
  selectedFile: File | null;
  searchValue: string;
  conversations: ConversationPreview[];
  users: UserPreview[];
  selectedConversationIds: Id<"conversations">[];
  selectedUserIds: Id<"users">[];
  isSending: boolean;
  error: string | null;
  onSearchChange: (value: string) => void;
  onToggleConversation: (conversationId: Id<"conversations">) => void;
  onToggleUser: (userId: Id<"users">) => void;
  onClose: () => void;
  onSend: () => void;
};

export function DocumentRecipientModal({
  selectedFile,
  searchValue,
  conversations,
  users,
  selectedConversationIds,
  selectedUserIds,
  isSending,
  error,
  onSearchChange,
  onToggleConversation,
  onToggleUser,
  onClose,
  onSend,
}: DocumentRecipientModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="chat-modal-enter w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl dark:bg-[#202c33]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Select chats
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

        {selectedFile ? (
          <div className="mb-3 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-[#3b4a54] dark:bg-[#111b21] dark:text-[#d1d7db]">
            Selected document: <span className="font-medium">{selectedFile.name}</span>
          </div>
        ) : null}

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search name or group"
            className="h-11 w-full rounded-full border border-slate-300 bg-white pl-9 pr-4 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-[#3b4a54] dark:bg-[#111b21] dark:text-slate-100"
          />
        </div>

        <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-[#8696a0]">
              Recent chats
            </p>
            {conversations.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500 dark:border-[#3b4a54] dark:text-[#8696a0]">
                No matching chats.
              </p>
            ) : (
              <div className="space-y-1">
                {conversations.map((conversation) => {
                  const checked = selectedConversationIds.includes(conversation.conversationId);
                  return (
                    <label
                      key={conversation.conversationId}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-100 dark:hover:bg-[#2a3942]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleConversation(conversation.conversationId)}
                        className="h-4 w-4 rounded border-slate-300 dark:border-[#3b4a54]"
                      />
                      <UserAvatar
                        name={conversation.name}
                        imageUrl={conversation.imageUrl}
                        isOnline={
                          conversation.type === "direct" ? conversation.isOnline : false
                        }
                        className="h-9 w-9"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {conversation.name}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-[#8696a0]">
                          {conversation.type === "group"
                            ? `${conversation.memberCount} members`
                            : conversation.lastMessageText ?? "Direct chat"}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-[#8696a0]">
              Contacts
            </p>
            {users.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500 dark:border-[#3b4a54] dark:text-[#8696a0]">
                No matching contacts.
              </p>
            ) : (
              <div className="space-y-1">
                {users.map((user) => {
                  const checked = selectedUserIds.includes(user.id);
                  return (
                    <label
                      key={user.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-100 dark:hover:bg-[#2a3942]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleUser(user.id)}
                        className="h-4 w-4 rounded border-slate-300 dark:border-[#3b4a54]"
                      />
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
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-2 py-1.5 text-xs text-rose-800 dark:border-rose-700/60 dark:bg-rose-900/30 dark:text-rose-200">
            {error}
          </p>
        ) : null}

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 cursor-pointer rounded-lg border border-slate-300 px-3 text-sm text-slate-700 dark:border-[#3b4a54] dark:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={isSending}
            className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-60 dark:bg-[#25d366] dark:text-[#111b21]"
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send document"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
