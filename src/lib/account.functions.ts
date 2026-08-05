import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UNDO_DAYS = 7;

/** Schedules a hard delete of the signed-in account, leaving a 7-day undo window. */
export const requestAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ deletion_requested_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    const purgeAt = new Date(Date.now() + UNDO_DAYS * 86400000).toISOString();
    return { purgeAt };
  });

/** Cancels a pending deletion inside the undo window. */
export const cancelAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ deletion_requested_at: null })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Files an appeal against a strike or suspension. */
export const submitAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ message: z.string().trim().min(20).max(2000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("appeals")
      .insert({ user_id: context.userId, message: data.message });
    if (error) throw new Error(error.message);
    return { ok: true };
  });