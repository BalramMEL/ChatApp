import { mutation } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";

const PRESENCE_TTL_MS = 45_000;

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getCurrentUser(ctx);
    if (!me) {
      return;
    }
    const now = Date.now();

    const existing = await ctx.db
      .query("presence")
      .withIndex("by_user_id", (q) => q.eq("userId", me._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSeenAt: now,
        expiresAt: now + PRESENCE_TTL_MS,
      });
      return;
    }

    await ctx.db.insert("presence", {
      userId: me._id,
      lastSeenAt: now,
      expiresAt: now + PRESENCE_TTL_MS,
    });
  },
});
