import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Clapperboard, Home, ImagePlus, Plus, Search, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/storage";
import { LumenAvatar } from "@/components/LumenAvatar";

const HIDDEN = ["/", "/login", "/signup", "/clips", "/privacy", "/terms", "/takedown"];

/** Mobile-only glowing bottom bar. Hidden on full-screen surfaces and public pages. */
export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [me, setMe] = useState<{ name: string | null; avatar: string | null } | null>(null);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return alive && setMe(null);
      const { data: p } = await supabase.from("profiles").select("name,avatar_url").eq("id", data.user.id).maybeSingle();
      const avatar = p?.avatar_url ? await getSignedUrl(p.avatar_url) : null;
      if (alive) setMe({ name: p?.name ?? null, avatar });
    })();
    return () => { alive = false; };
  }, [pathname]);

  if (!me || HIDDEN.includes(pathname) || pathname.startsWith("/messages/") || pathname.startsWith("/guardian")) return null;

  async function go(intent: "post" | "moment") {
    setSheet(false);
    if (pathname !== "/home") await navigate({ to: "/home" });
    setTimeout(() => {
      if (intent === "moment") window.dispatchEvent(new Event("lumen:new-moment"));
      else {
        document.getElementById("spark-composer")?.scrollIntoView({ behavior: "smooth", block: "center" });
        document.getElementById("spark-caption")?.focus();
      }
    }, pathname === "/home" ? 0 : 600);
  }

  const item = (active: boolean) =>
    `grid h-11 w-11 place-items-center rounded-full transition ${active ? "text-primary drop-shadow-[0_0_8px_var(--primary)]" : "text-muted-foreground"}`;

  return (
    <>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/20 bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden" style={{ boxShadow: "0 -6px 24px -12px var(--primary)" }}>
        <div className="mx-auto flex h-14 max-w-lg items-center justify-around">
          <Link to="/home" aria-label="Home" className={item(pathname === "/home")}><Home size={22} /></Link>
          <Link to="/clips" aria-label="Clips" className={item(false)}><Clapperboard size={22} /></Link>
          <button onClick={() => setSheet(true)} aria-label="Create" className="grid h-11 w-11 place-items-center rounded-full text-primary-foreground" style={{ background: "var(--gradient-glow)", boxShadow: "var(--shadow-glow)" }}><Plus size={22} /></button>
          <Link to="/search" search={{ q: undefined }} aria-label="Search and Explore" className={item(pathname === "/search")}><Search size={22} /></Link>
          <Link to="/profile" aria-label="Profile" className={`rounded-full p-0.5 ${pathname === "/profile" ? "ring-2 ring-primary" : ""}`}><LumenAvatar name={me.name} url={me.avatar} size={30} /></Link>
        </div>
      </nav>
      {sheet && (
        <div className="fixed inset-0 z-[60] flex items-end bg-foreground/40 md:hidden" onClick={() => setSheet(false)} role="dialog" aria-modal="true" aria-label="Create">
          <div className="w-full rounded-t-2xl border-t border-primary/30 bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-1"><h2 className="font-semibold">Create</h2><button onClick={() => setSheet(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-accent"><X size={18} /></button></div>
            <button onClick={() => go("post")} className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left hover:bg-accent"><ImagePlus size={20} className="text-primary" /><span><span className="block text-sm font-medium">New Post</span><span className="text-xs text-muted-foreground">Share photos, video or text</span></span></button>
            <button onClick={() => go("moment")} className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left hover:bg-accent"><Sparkles size={20} className="text-primary" /><span><span className="block text-sm font-medium">New Moment</span><span className="text-xs text-muted-foreground">A story that glows for 24 hours</span></span></button>
          </div>
        </div>
      )}
    </>
  );
}
