import { supabase } from "@/integrations/supabase/client";
import { LEGAL_VERSIONS, type DocKind } from "./legal";

/** Returns the doc kinds this user still needs to accept (or re-accept after a version bump). */
export async function pendingConsents(userId: string): Promise<DocKind[]> {
  const kinds = Object.keys(LEGAL_VERSIONS) as DocKind[];
  const { data } = await (supabase as any)
    .from("user_consents")
    .select("doc_kind,version")
    .eq("user_id", userId);
  const accepted = new Set(
    ((data ?? []) as { doc_kind: string; version: string }[]).map((r) => `${r.doc_kind}:${r.version}`),
  );
  return kinds.filter((k) => !accepted.has(`${k}:${LEGAL_VERSIONS[k]}`));
}

export async function recordConsents(userId: string, kinds: DocKind[]) {
  if (kinds.length === 0) return { error: null };
  const rows = kinds.map((k) => ({ user_id: userId, doc_kind: k, version: LEGAL_VERSIONS[k] }));
  return await (supabase as any)
    .from("user_consents")
    .upsert(rows, { onConflict: "user_id,doc_kind,version" });
}