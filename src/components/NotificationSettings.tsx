import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Prefs = { messages: boolean; reactions: boolean; follows: boolean };

export function NotificationSettings({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<Prefs>({ messages: true, reactions: true, follows: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("notification_prefs")
        .select("messages,reactions,follows")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) setPrefs(data as Prefs);
    })();
  }, [userId]);

  async function update(key: keyof Prefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(true);
    const { error } = await (supabase as any)
      .from("notification_prefs")
      .upsert({ user_id: userId, ...next }, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast.error(error.message);
  }

  const rows: Array<[keyof Prefs, string]> = [
    ["messages", "New messages"],
    ["reactions", "Reactions"],
    ["follows", "New followers"],
  ];

  return (
    <div className="w-full max-w-sm mt-2 rounded-2xl border border-border bg-card/70 backdrop-blur p-4 text-left space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full grid place-items-center bg-background/70 border border-border">
          <Bell size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Notifications</p>
          <p className="text-xs text-muted-foreground">Quiet hours 10PM–6AM are always respected.</p>
        </div>
      </div>
      {rows.map(([key, label]) => (
        <label key={key} className="flex items-center justify-between gap-3">
          <span className="text-sm">{label}</span>
          <span className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={prefs[key]}
              disabled={saving}
              onChange={(e) => update(key, e.target.checked)}
            />
            <span className="w-11 h-6 rounded-full bg-muted peer-checked:[background:var(--gradient-glow)] transition" />
            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
          </span>
        </label>
      ))}
      <Link to="/privacy" className="block text-xs text-primary underline underline-offset-4">
        Privacy Policy
      </Link>
    </div>
  );
}