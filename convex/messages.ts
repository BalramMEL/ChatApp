import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";

import { requireConversationMember, requireUser } from "./lib/auth";

const REACTION_KEYS = ["thumbs_up", "heart", "joy", "wow", "sad"] as const;
type ReactionKey = (typeof REACTION_KEYS)[number];
const LEGACY_REACTION_KEY_MAP = {
  "\u{1F44D}": "thumbs_up",
  "\u{2764}\u{FE0F}": "heart",
  "\u{1F602}": "joy",
  "\u{1F62E}": "wow",
  "\u{1F622}": "sad",
} as const;

function isValidReactionKey(emoji: string): emoji is ReactionKey {
  return (REACTION_KEYS as readonly string[]).includes(emoji);
}

function normalizeReactionKey(value: string): ReactionKey | null {
  if (isValidReactionKey(value)) {
    return value;
  }

  return LEGACY_REACTION_KEY_MAP[value as keyof typeof LEGACY_REACTION_KEY_MAP] ?? null;
}

function deletedMessageText() {
  return "This message was deleted";
}

function formatLastMessageText(message: Doc<"messages">) {
  if (message.deletedAt) {
    return deletedMessageText();
  }
  if (message.messageType === "image") {
    const caption = message.body.trim();
    return caption ? `Photo: ${caption}` : "Photo";
  }
  if (message.messageType === "file") {
    const fileName = message.fileName?.trim();
    return fileName ? `Document: ${fileName}` : "Document";
  }
  return message.body;
}

async function updateConversationPreviewFromLatestMessage(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
) {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation) {
    return;
  }

  const messages = await ctx.db
    .query("messages")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .collect();
  const latest = messages.length > 0 ? messages[messages.length - 1] : null;

  if (!latest) {
    await ctx.db.patch(conversationId, { updatedAt: Date.now() });
    return;
  }

  await ctx.db.patch(conversationId, {
    lastMessageText: formatLastMessageText(latest),
    lastMessageAt: latest.createdAt,
    lastMessageSenderId: latest.senderId,
    updatedAt: Date.now(),
  });
}

async function clearTypingState(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
) {
  const existingTyping = await ctx.db
    .query("typingStates")
    .withIndex("by_conversation_user", (q) =>
      q.eq("conversationId", conversationId).eq("userId", userId),
    )
    .unique();
  if (existingTyping) {
    await ctx.db.delete(existingTyping._id);
  }
}

async function onOutgoingMessageCreated(
  ctx: MutationCtx,
  membershipId: Id<"conversationMembers">,
  conversationId: Id<"conversations">,
  senderId: Id<"users">,
  lastMessageText: string,
  createdAt: number,
) {
  await ctx.db.patch(membershipId, {
    lastReadAt: createdAt,
  });

  await ctx.db.patch(conversationId, {
    lastMessageText,
    lastMessageAt: createdAt,
    lastMessageSenderId: senderId,
    updatedAt: createdAt,
  });

  await clearTypingState(ctx, conversationId, senderId);
}

function summarizeReactionsForMessage(
  messageId: Id<"messages">,
  reactions: Doc<"messageReactions">[],
  currentUserId: Id<"users">,
) {
  const byKey = new Map<
    ReactionKey,
    {
      count: number;
      reactedByMe: boolean;
    }
  >();

  for (const reaction of reactions) {
    if (reaction.messageId !== messageId) {
      continue;
    }
    const key = normalizeReactionKey(reaction.emoji);
    if (!key) {
      continue;
    }
    const existing = byKey.get(key) ?? { count: 0, reactedByMe: false };
    existing.count += 1;
    if (reaction.userId === currentUserId) {
      existing.reactedByMe = true;
    }
    byKey.set(key, existing);
  }

  return REACTION_KEYS.map((emoji) => ({
    emoji,
    count: byKey.get(emoji)?.count ?? 0,
    reactedByMe: byKey.get(emoji)?.reactedByMe ?? false,
  }));
}

async function buildSenderMap(ctx: QueryCtx, messageSenderIds: Id<"users">[]) {
  const uniqueSenderIds = [...new Set(messageSenderIds)];
  const senderEntries = await Promise.all(
    uniqueSenderIds.map(async (senderId) => {
      const sender = await ctx.db.get(senderId);
      return [senderId, sender] as const;
    }),
  );

  return new Map(
    senderEntries.filter(
      (entry): entry is readonly [Id<"users">, NonNullable<(typeof entry)[1]>] => entry[1] !== null,
    ),
  );
}

export const listForConversation = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    await requireConversationMember(ctx, args.conversationId, me._id);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();
    const senderMap = await buildSenderMap(
      ctx,
      messages.map((message) => message.senderId),
    );
    const reactions = await ctx.db
      .query("messageReactions")
      .withIndex("by_conversation_id", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    return await Promise.all(
      messages.map(async (message) => {
        const sender = senderMap.get(message.senderId) ?? null;
        const isDeleted = Boolean(message.deletedAt);
        const imageUrl =
          message.imageStorageId && !isDeleted
            ? await ctx.storage.getUrl(message.imageStorageId)
            : null;
        const fileUrl =
          message.fileStorageId && !isDeleted
            ? await ctx.storage.getUrl(message.fileStorageId)
            : null;

        return {
          _id: message._id,
          senderId: message.senderId,
          senderName: sender?.name ?? "Unknown user",
          senderImageUrl: sender?.imageUrl ?? null,
          messageType: message.messageType ?? "text",
          body: message.body,
          imageUrl,
          fileUrl,
          fileName: message.fileName ?? null,
          fileMimeType: message.fileMimeType ?? null,
          fileSize: message.fileSize ?? null,
          createdAt: message.createdAt,
          deletedAt: message.deletedAt ?? null,
          isDeleted,
          isMine: message.senderId === me._id,
          reactions: summarizeReactionsForMessage(message._id, reactions, me._id),
        };
      }),
    );
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const membership = await requireConversationMember(ctx, args.conversationId, me._id);

    const body = args.body.trim();
    if (!body) {
      throw new Error("Message body cannot be empty");
    }

    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: me._id,
      messageType: "text",
      body,
      createdAt: now,
    });

    await onOutgoingMessageCreated(
      ctx,
      membership._id,
      args.conversationId,
      me._id,
      body,
      now,
    );

    return messageId;
  },
});

export const sendImage = mutation({
  args: {
    conversationId: v.id("conversations"),
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const membership = await requireConversationMember(ctx, args.conversationId, me._id);

    const caption = args.caption?.trim() ?? "";
    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: me._id,
      messageType: "image",
      body: caption,
      imageStorageId: args.storageId,
      createdAt: now,
    });

    await onOutgoingMessageCreated(
      ctx,
      membership._id,
      args.conversationId,
      me._id,
      caption ? `Photo: ${caption}` : "Photo",
      now,
    );

    return messageId;
  },
});

export const sendFile = mutation({
  args: {
    conversationId: v.id("conversations"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.optional(v.string()),
    fileSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const membership = await requireConversationMember(ctx, args.conversationId, me._id);

    const fileName = args.fileName.trim();
    if (!fileName) {
      throw new Error("File name is required");
    }

    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: me._id,
      messageType: "file",
      body: "",
      fileStorageId: args.storageId,
      fileName,
      fileMimeType: args.mimeType,
      fileSize: args.fileSize,
      createdAt: now,
    });

    await onOutgoingMessageCreated(
      ctx,
      membership._id,
      args.conversationId,
      me._id,
      `Document: ${fileName}`,
      now,
    );

    return messageId;
  },
});

export const deleteOwn = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    await requireConversationMember(ctx, message.conversationId, me._id);
    if (message.senderId !== me._id) {
      throw new Error("You can only delete your own messages");
    }

    if (!message.deletedAt) {
      await ctx.db.patch(message._id, {
        deletedAt: Date.now(),
        deletedBy: me._id,
      });
      await updateConversationPreviewFromLatestMessage(ctx, message.conversationId);
    }
  },
});

export const editOwn = mutation({
  args: {
    messageId: v.id("messages"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    await requireConversationMember(ctx, message.conversationId, me._id);
    if (message.senderId !== me._id) {
      throw new Error("You can only edit your own messages");
    }
    if (message.deletedAt) {
      throw new Error("Cannot edit a deleted message");
    }
    if ((message.messageType ?? "text") !== "text") {
      throw new Error("Only text messages can be edited");
    }

    const body = args.body.trim();
    if (!body) {
      throw new Error("Message body cannot be empty");
    }

    await ctx.db.patch(message._id, {
      body,
    });
    await updateConversationPreviewFromLatestMessage(ctx, message.conversationId);
  },
});

export const toggleReaction = mutation({
  args: {
    messageId: v.id("messages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (!isValidReactionKey(args.emoji)) {
      throw new Error("Invalid reaction");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    await requireConversationMember(ctx, message.conversationId, me._id);

    const existing = await ctx.db
      .query("messageReactions")
      .withIndex("by_message_id", (q) => q.eq("messageId", message._id))
      .collect();
    const existingForSameReaction = existing.filter(
      (reaction) =>
        reaction.userId === me._id && normalizeReactionKey(reaction.emoji) === args.emoji,
    );

    if (existingForSameReaction.length > 0) {
      for (const reaction of existingForSameReaction) {
        await ctx.db.delete(reaction._id);
      }
      return { active: false };
    }

    await ctx.db.insert("messageReactions", {
      conversationId: message.conversationId,
      messageId: message._id,
      userId: me._id,
      emoji: args.emoji as ReactionKey,
      createdAt: Date.now(),
    });
    return { active: true };
  },
});

export const markConversationRead = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const membership = await requireConversationMember(ctx, args.conversationId, me._id);

    await ctx.db.patch(membership._id, {
      lastReadAt: Date.now(),
    });
  },
});
