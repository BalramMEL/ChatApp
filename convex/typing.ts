import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { requireConversationMember, requireUser } from "./lib/auth";

const TYPING_TTL_MS = 2_000;

export const setTyping = mutation({
  args: {
    conversationId: v.id("conversations"),
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    await requireConversationMember(ctx, args.conversationId, me._id);

    const existing = await ctx.db
      .query("typingStates")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", me._id),
      )
      .unique();

    if (!args.isTyping) {
      if (existing) {
        await ctx.db.delete(existing._id);
      }
      return;
    }

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        updatedAt: now,
        expiresAt: now + TYPING_TTL_MS,
      });
      return;
    }

    await ctx.db.insert("typingStates", {
      conversationId: args.conversationId,
      userId: me._id,
      updatedAt: now,
      expiresAt: now + TYPING_TTL_MS,
    });
  },
});

export const getTypingForConversation = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    await requireConversationMember(ctx, args.conversationId, me._id);

    const now = Date.now();
    const states = await ctx.db
      .query("typingStates")
      .withIndex("by_conversation_id", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    const activeStates = states.filter((state) => state.userId !== me._id && state.expiresAt > now);
    if (activeStates.length === 0) {
      return null;
    }

    const names: string[] = [];
    for (const state of activeStates) {
      const typingUser = await ctx.db.get(state.userId);
      if (typingUser) {
        names.push(typingUser.name);
      }
    }

    if (names.length === 0) {
      return null;
    }

    names.sort((a, b) => a.localeCompare(b));

    return {
      names,
    };
  },
});
