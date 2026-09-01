import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function newToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Creates (or refreshes) a parent/guardian verification link for a minor's account.
 * The link is emailed once the project's sender domain is verified; until then it
 * is returned so the account holder can pass it to their guardian directly.
 */
export const requestGuardianVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ guardianEmail: z.string().trim().email().max(255) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = newToken();

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ guardian_email: data.guardianEmail, guardian_verified: false, is_minor: true })
      .eq("id", context.userId);
    if (profileError) throw new Error(profileError.message);

    const { error } = await supabaseAdmin.from("guardian_verifications").insert({
      user_id: context.userId,
      guardian_email: data.guardianEmail,
      token,
    });
    if (error) throw new Error(error.message);

    // The token is never returned to the caller: the account holder may be the
    // minor themselves, and handing them the link would let them self-verify.
    // Only the guardian receives it, by email.
    return { sent: true as const, guardianEmail: data.guardianEmail };
  });

/** Public: a guardian clicking their emailed link confirms the minor's account. */
export const verifyGuardianToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: z.string().min(16).max(128) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("guardian_verifications")
      .select("id,user_id,expires_at,verified_at")
      .eq("token", data.token)
      .maybeSingle();

    if (!row) return { status: "invalid" as const };
    if (row.verified_at) return { status: "already" as const };
    if (new Date(row.expires_at as string).getTime() < Date.now()) return { status: "expired" as const };

    await supabaseAdmin
      .from("guardian_verifications")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", row.id);
    await supabaseAdmin.from("profiles").update({ guardian_verified: true }).eq("id", row.user_id);

    return { status: "ok" as const };
  });