import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LumenAvatar } from "@/components/LumenAvatar";
import { StoryComposer } from "@/components/StoryComposer";
import { StoryViewer } from "@/components/StoryViewer";
import type { StoryPrivacy, StoryRow } from "@/lib/stories";

type Group = { userId: string; name: string | null; avatar: string | null; stories: StoryRow[]; unviewed: boolean };

/** "Light Moments" bar: circular avatars with an animated glow ring for unviewed stories. */
export function StoriesBar({ meId }: { meId: string | null }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [composing, setComposing] = useState(false);
  const [active, setActive] = useState<Group | null>(null);
  const [defaultPrivacy, setDefaultPrivacy] = useState<StoryPrivacy>("public");

  const load = useCallback(async () => {
    if (!meId) return;
    const sb = supabase as any;
    const [{ data: rows }, { data: seen }, { data: prof }] = await Promise.all([
      sb
        .from("stories")
        .select("*")
        .eq("archived", false)
        .gt("expires_at", new Date().toISOString())
        .neq("privacy", "onlyme")
        .order("created_at", { ascending: true }),
      sb.from("story_views").select("story_id").eq("viewer_id", meId),
      sb.from("profiles").select("default_story_privacy").eq("id", meId).maybeSingle(),
    ]);
    if (prof?.default_story_privacy) setDefaultPrivacy(prof.default_story_privacy as StoryPrivacy);
    const stories = ((rows ?? []) as StoryRow[]).map((s) => ({ ...s, stickers: (s.stickers ?? []) as StoryRow["stickers"] }));
    const viewed = new Set(((seen ?? []) as { story_id: string }[]).map((v) => v.story_id));
    const ids = Array.from(new Set(stories.map((s) => s.user_id)));
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id,name,avatar_url").in("id", ids)
      : { data: [] as any[] };
    const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
    const grouped: Group[] = ids.map((id) => {
      const mine = stories.filter((s) => s.user_id === id);
      return {
        userId: id,
        name: byId.get(id)?.name ?? null,
        avatar: byId.get(id)?.avatar_url ?? null,
        stories: mine,
        unviewed: id !== meId && mine.some((s) => !viewed.has(s.id)),
      };
    });
    grouped.sort((a, b) => Number(b.unviewed) - Number(a.unviewed));
    setGroups(grouped);
  }, [meId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!meId) return null;

  return (
    <>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        <button onClick={() => setComposing(true)} className="flex w-16 shrink-0 flex-col items-center gap-1">
          <span className="relative grid h-14 w-14 place-items-center rounded-full border border-dashed border-border bg-card">
            <Plus size={18} className="text-primary" />
          </span>
          <span className="truncate text-[11px] text-muted-foreground">Your moment</span>
        </button>
        {groups.map((g) => (
          <button key={g.userId} onClick={() => setActive(g)} className="flex w-16 shrink-0 flex-col items-center gap-1">
            <span className="relative grid h-14 w-14 place-items-center">
              {g.unviewed && (
                <>
                  <span
                    aria-hidden
                    className="absolute inset-0 animate-story-ring rounded-full"
                    style={{ background: "conic-gradient(from 0deg,#00BFFF,#FFD700,#00BFFF)" }}
                  />
                  <span aria-hidden className="animate-story-sparkle absolute -right-0.5 -top-0.5 text-[11px]">
                    ✨
                  </span>
                </>
              )}
              <span className="relative grid h-[52px] w-[52px] place-items-center rounded-full bg-background">
                <LumenAvatar name={g.name} url={g.avatar} size={46} />
              </span>
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              {g.userId === meId ? "You" : g.name || "Friend"}
            </span>
          </button>
        ))}
      </div>

      {composing && (
        <StoryComposer userId={meId} defaultPrivacy={defaultPrivacy} onClose={() => setComposing(false)} onCreated={load} />
      )}
      {active && (
        <StoryViewer
          stories={active.stories}
          authorName={active.name}
          authorAvatar={active.avatar}
          meId={meId}
          onClose={() => {
            setActive(null);
            void load();
          }}
        />
      )}
    </>
  );
}