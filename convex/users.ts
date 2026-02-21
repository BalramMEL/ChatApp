import { v } from "convex/values";

import { query, mutation } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";

function normalizeSearch(search: string | undefined) {
  return search?.trim() ?? "";
}

export const upsertMe = mutation({
  args: {
    name: v.string(),
    imageUrl: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        imageUrl: args.imageUrl,
        email: args.email,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      name: args.name,
      imageUrl: args.imageUrl,
      email: args.email,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listDiscoverable = query({
  args: {
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getCurrentUser(ctx);
    if (!me) {
      return [];
    }

    const now = Date.now();
    const search = normalizeSearch(args.search);
    const candidates =
      search.length > 0
        ? await ctx.db
            .query("users")
            .withSearchIndex("search_name", (q) => q.search("name", search))
            .collect()
        : await ctx.db.query("users").withIndex("by_name").collect();

    const users = candidates.filter((user) => user._id !== me._id);

    return await Promise.all(
      users.map(async (user) => {
        const presence = await ctx.db
          .query("presence")
          .withIndex("by_user_id", (q) => q.eq("userId", user._id))
          .unique();

        return {
          id: user._id,
          name: user.name,
          imageUrl: user.imageUrl ?? null,
          isOnline: Boolean(presence && presence.expiresAt > now),
        };
      }),
    );
  },
});
