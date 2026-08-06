import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Admin access is enforced by database policies (only rows visible to an admin
 * role are returned). This hook only decides what UI to draw.
 */
export function useIsAdmin() {
  const [state, setState] = useState<{ loading: boolean; isAdmin: boolean; email: string | null; userId: string | null }>({
    loading: true,
    isAdmin: false,
    email: null,
    userId: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        if (!cancelled) setState({ loading: false, isAdmin: false, email: null, userId: null });
        return;
      }
      const { data: roles } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancelled)
        setState({ loading: false, isAdmin: Boolean(roles), email: user.email ?? null, userId: user.id });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** Every admin action is written to the audit log (insert is admin-gated in the database). */
export async function logAdminAction(
  adminId: string,
  adminEmail: string,
  actionType: string,
  targetId: string | null,
  notes?: string,
) {
  await (supabase as any).from("admin_actions").insert({
    admin_id: adminId,
    admin_email: adminEmail,
    action_type: actionType,
    target_id: targetId,
    notes: notes ?? null,
  });
}