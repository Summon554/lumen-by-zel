import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls, isVideoPath } from "@/lib/storage";
import { MediaViewer, type ViewerMedia } from "@/components/MediaViewer";

type Tile = { id: string; image_url: string };

/** 3x3 grid of recent photos and videos visible to the viewer. Tap to open full-screen. */
export function ExploreGrid() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<ViewerMedia | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("posts")
        .select("id,image_url")
        .not("image_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(30);
      const list = ((data ?? []) as Tile[]).filter((t) => t.image_url);
      setTiles(list);
      setUrls(await getSignedUrls(list.map((t) => t.image_url)));
      setLoading(false);
    })();
  }, []);

  if (loading)
    return (
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    );
  if (tiles.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">Nothing to explore yet.</p>;

  return (
    <>
      <div className="grid grid-cols-3 gap-1">
        {tiles.map((t) => {
          const url = urls[t.image_url];
          const video = isVideoPath(t.image_url);
          return (
            <button
              key={t.id}
              type="button"
              disabled={!url}
              onClick={() => url && setViewer({ url, type: video ? "video" : "image" })}
              className="relative aspect-square overflow-hidden rounded-md bg-muted"
            >
              {url &&
                (video ? (
                  <video src={`${url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                ) : (
                  <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ))}
              {video && (
                <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-background/80">
                  <Play size={10} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <MediaViewer media={viewer} onClose={() => setViewer(null)} />
    </>
  );
}
