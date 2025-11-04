import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { vSessionId } from "convex-helpers/server/sessions";

export const listNumbers = query({
  args: {
    sessionId: vSessionId,
    count: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    const userId = user?.subject ?? `anon:${args.sessionId}`;

    const numbers = await ctx.db
      .query("numbers")
      // Ordered by _creationTime, return most recent
      .order("desc")
      .take(args.count);
    return {
      viewer: userId,
      numbers: numbers.reverse().map((number) => ({
        id: number._id,
        value: number.value,
      })),
    };
  },
});

export const addNumber = mutation({
  args: {
    value: v.number(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("numbers", { value: args.value });
    console.log("Added new document with id:", id);
    let i = 0;
    while (i < 1e7) {
      Math.sin(i) + Math.cos(i);
      i++;
    }
    console.log("Finished expensive operation");
  },
});
