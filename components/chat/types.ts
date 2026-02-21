import type { Id } from "@/convex/_generated/dataModel";

export type UserPreview = {
  id: Id<"users">;
  name: string;
  imageUrl: string | null;
  isOnline: boolean;
};

export type ConversationPreview = {
  conversationId: Id<"conversations">;
  type: "direct" | "group";
  name: string;
  imageUrl: string | null;
  isOnline: boolean;
  memberCount: number;
  lastMessageText: string | null;
  lastMessageAt: number | null;
  updatedAt: number;
  unreadCount: number;
};

export type ReactionKey = "thumbs_up" | "heart" | "joy" | "wow" | "sad";

export type ReactionSummary = {
  emoji: ReactionKey;
  count: number;
  reactedByMe: boolean;
};

export type ConversationMessage = {
  _id: Id<"messages">;
  senderId: Id<"users">;
  senderName: string;
  senderImageUrl: string | null;
  messageType: "text" | "image";
  body: string;
  imageUrl: string | null;
  createdAt: number;
  deletedAt: number | null;
  isDeleted: boolean;
  isMine: boolean;
  reactions: ReactionSummary[];
};
