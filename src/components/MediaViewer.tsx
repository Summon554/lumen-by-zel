import { useEffect } from "react";
import { Download, X } from "lucide-react";

export type ViewerMedia = { url: string; type: "image" | "video"; name?: string | null };

/** Shared full-screen media viewer with a download action. Used by feed posts and chat. */
export function MediaViewer({ media, onClose }: { media: ViewerMedia | null; onClose: () => void }) {
  useEffect(() => {
    if (!media) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [media, onClose]);

  if (!media) return null;

  async function download() {
    if (!media) return;
    try {
      const res = await fetch(media.url);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = media.name || (media.type === "video" ? "lumen-video.mp4" : "lumen-photo.jpg");
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch {
      window.open(media.url, "_blank", "noreferrer");
    }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-foreground/90 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-end gap-2 p-3">
        <button
          onClick={download}
          className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-sm font-medium hover:bg-background transition"
        >
          <Download size={15} /> Download
        </button>
        <button
          onClick={onClose}
          className="h-9 w-9 grid place-items-center rounded-full bg-background/90 hover:bg-background transition"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
      <button
        type="button"
        aria-label="Close viewer"
        onClick={onClose}
        className="flex-1 grid place-items-center p-4 cursor-zoom-out"
      >
        {media.type === "video" ? (
          <video
            src={media.url}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <img
            src={media.url}
            alt={media.name ?? ""}
            className="max-h-full max-w-full object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </button>
    </div>
  );
}
