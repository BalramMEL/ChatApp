import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";

import { getCurrentUser, requireConversationMember, requireUser } from "./lib/auth";

function buildParticipantKey(userA: Id<"users">, userB: Id<"users">) {
  return [userA, userB].sort().join("|");
}

function dedupeUserIds(userIds: Id<"users">[]) {
  return [...new Set(userIds)];
}

async function countUnreadMessages(
  ctx: QueryCtx,
  conversationId: Id<"conversations">,
  currentUserId: Id<"users">,
  lastReadAt: number,
) {
  const unreadCandidates = await ctx.db
    .query("messages")
    .withIndex("by_conversation", (q) =>
      q.eq("conversationId", conversationId).gt("createdAt", lastReadAt),
    )
    .collect();

  return unreadCandidates.reduce((count, message) => {
    if (message.senderId !== currentUserId) {
      return count + 1;
    }
    return count;
  }, 0);
}

async function getMembers(
  ctx: QueryCtx,
  conversationId: Id<"conversations">,
): Promise<Array<Doc<"conversationMembers"> & { user: Doc<"users"> | null }>> {
  const members = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation_id", (q) => q.eq("conversationId", conversationId))
    .collect();

  return await Promise.all(
    members.map(async (member) => ({
      ...member,
      user: await ctx.db.get(member.userId),
    })),
  );
}

async function buildConversationItem(
  ctx: QueryCtx,
  conversationId: Id<"conversations">,
  currentUserId: Id<"users">,
  currentUserLastReadAt: number,
) {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation) {
    return null;
  }

  const members = await getMembers(ctx, conversation._id);
  const now = Date.now();
  const unreadCount = await countUnreadMessages(
    ctx,
    conversation._id,
    currentUserId,
    currentUserLastReadAt,
  );

  const kind = conversation.kind ?? "direct";

  if (kind === "group") {
    return {
      conversationId: conversation._id,
      type: "group" as const,
      name: conversation.title?.trim() || "Untitled Group",
      imageUrl: null,
      isOnline: false,
      memberCount: members.length,
      lastMessageText: conversation.lastMessageText ?? null,
      lastMessageAt: conversation.lastMessageAt ?? null,
      updatedAt: conversation.updatedAt,
      unreadCount,
    };
  }

  const otherMember = members.find((member) => member.userId !== currentUserId);
  if (!otherMember || !otherMember.user) {
    return null;
  }

  const presence = await ctx.db
    .query("presence")
    .withIndex("by_user_id", (q) => q.eq("userId", otherMember.userId))
    .unique();

  return {
    conversationId: conversation._id,
    type: "direct" as const,
    name: otherMember.user.name,
    imageUrl: otherMember.user.imageUrl ?? null,
    isOnline: Boolean(presence && presence.expiresAt > now),
    memberCount: members.length,
    lastMessageText: conversation.lastMessageText ?? null,
    lastMessageAt: conversation.lastMessageAt ?? null,
    updatedAt: conversation.updatedAt,
    unreadCount,
  };
}

export const getOrCreateDirectConversation = mutation({
  args: {
    otherUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    if (me._id === args.otherUserId) {
      throw new Error("Cannot create a conversation with yourself");
    }

    const otherUser = await ctx.db.get(args.otherUserId);
    if (!otherUser) {
      throw new Error("User not found");
    }

    const now = Date.now();
    const participantKey = buildParticipantKey(me._id, args.otherUserId);
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_participant_key", (q) => q.eq("participantKey", participantKey))
      .unique();

    if (existing) {
      return existing._id;
    }

    const conversationId = await ctx.db.insert("conversations", {
      participantKey,
      kind: "direct",
      createdBy: me._id,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("conversationMembers", {
      conversationId,
      userId: me._id,
      joinedAt: now,
      lastReadAt: now,
    });
    await ctx.db.insert("conversationMembers", {
      conversationId,
      userId: args.otherUserId,
      joinedAt: now,
      lastReadAt: now,
    });

    return conversationId;
  },
});

export const createGroupConversation = mutation({
  args: {
    name: v.string(),
    memberIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const groupName = args.name.trim();
    if (!groupName) {
      throw new Error("Group name is required");
    }
    if (groupName.length > 64) {
      throw new Error("Group name must be 64 characters or fewer");
    }

    const uniqueOthers = dedupeUserIds(args.memberIds).filter((id) => id !== me._id);
    if (uniqueOthers.length < 2) {
      throw new Error("Select at least 2 members to create a group");
    }

    for (const memberId of uniqueOthers) {
      const user = await ctx.db.get(memberId);
      if (!user) {
        throw new Error("One or more selected users were not found");
      }
    }

    const now = Date.now();
    const conversationId = await ctx.db.insert("conversations", {
      kind: "group",
      title: groupName,
      createdBy: me._id,
      createdAt: now,
      updatedAt: now,
    });

    const allMemberIds = [me._id, ...uniqueOthers];
    for (const memberId of allMemberIds) {
      await ctx.db.insert("conversationMembers", {
        conversationId,
        userId: memberId,
        joinedAt: now,
        lastReadAt: now,
      });
    }

    return conversationId;
  },
});

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) {
      return [];
    }

    const memberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_user_id", (q) => q.eq("userId", me._id))
      .collect();

    const items = await Promise.all(
      memberships.map((membership) =>
        buildConversationItem(ctx, membership.conversationId, me._id, membership.lastReadAt),
      ),
    );

    return items
      .filter((item) => item !== null)
      .sort((a, b) => {
        const aRank = a.lastMessageAt ?? a.updatedAt;
        const bRank = b.lastMessageAt ?? b.updatedAt;
        return bRank - aRank;
      });
  },
});

export const getConversationById = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) {
      return null;
    }

    const membership = await requireConversationMember(ctx, args.conversationId, me._id);
    return await buildConversationItem(ctx, args.conversationId, me._id, membership.lastReadAt);
  },
});
