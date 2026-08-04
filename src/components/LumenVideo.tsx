import { useRef, useState } from "react";
import { Maximize2, Pause, Play } from "lucide-react";

/** Lumen video player — #00BFFF progress bar. Shared by feed posts and chat. */
export function LumenVideo({
  src,
  poster,
  className = "",
  onExpand,
}: {
  src: string;
  poster?: string;
  className?: string;
  onExpand?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const v = ref.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration;
  }

  return (
    <div className={`relative overflow-hidden rounded-xl bg-black/80 ${className}`}>
      <video
        ref={ref}
        src={src}
        poster={poster}
        preload="metadata"
        playsInline
        className="w-full max-h-[420px] object-contain"
        onClick={toggle}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0);
        }}
      />
      {!playing && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Play video"
          className="absolute inset-0 grid place-items-center"
        >
          <span
            className="h-14 w-14 rounded-full grid place-items-center text-white"
            style={{ background: "#00BFFF", boxShadow: "0 0 24px rgba(0,191,255,.65)" }}
          >
            <Play size={22} className="ml-0.5" />
          </span>
        </button>
      )}
      <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 bg-black/45 px-2 py-1.5">
        <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="text-white">
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <div onClick={seek} className="flex-1 h-1.5 rounded-full bg-white/25 cursor-pointer">
          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "#00BFFF" }} />
        </div>
        {onExpand && (
          <button type="button" onClick={onExpand} aria-label="Full screen" className="text-white">
            <Maximize2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
