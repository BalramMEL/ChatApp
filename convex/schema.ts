import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_name", ["name"])
    .searchIndex("search_name", {
      searchField: "name",
    }),

  conversations: defineTable({
    participantKey: v.optional(v.string()),
    kind: v.optional(v.union(v.literal("direct"), v.literal("group"))),
    title: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    lastMessageText: v.optional(v.string()),
    lastMessageAt: v.optional(v.number()),
    lastMessageSenderId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_participant_key", ["participantKey"])
    .index("by_updated_at", ["updatedAt"]),

  conversationMembers: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    lastReadAt: v.number(),
    joinedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_conversation_id", ["conversationId"])
    .index("by_conversation_user", ["conversationId", "userId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    messageType: v.optional(v.union(v.literal("text"), v.literal("image"))),
    body: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
  }).index("by_conversation", ["conversationId", "createdAt"]),

  messageReactions: defineTable({
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.union(
      v.literal("thumbs_up"),
      v.literal("heart"),
      v.literal("joy"),
      v.literal("wow"),
      v.literal("sad"),
      v.literal("👍"),
      v.literal("❤️"),
      v.literal("😂"),
      v.literal("😮"),
      v.literal("😢"),
    ),
    createdAt: v.number(),
  })
    .index("by_conversation_id", ["conversationId"])
    .index("by_message_id", ["messageId"])
    .index("by_message_user_emoji", ["messageId", "userId", "emoji"]),

  presence: defineTable({
    userId: v.id("users"),
    lastSeenAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_expires_at", ["expiresAt"]),

  typingStates: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    updatedAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_conversation_id", ["conversationId"])
    .index("by_conversation_user", ["conversationId", "userId"]),
});
