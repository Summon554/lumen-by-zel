import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LUMEN_LIBRARY, MAX_CLIP_SECONDS } from "./music";

/**
 * Server-side hard cap for music clips. Only tracks from the Lumen Library are
 * accepted, and any requested clip is clamped to 15 seconds before it is stored —
 * the client cannot widen the window. Uploaded audio is rejected outright, which
 * is how full-song matches are kept off the platform.
 */
export const prepareMusicClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        trackId: z.string().min(1).max(64),
        startSec: z.number().min(0).max(3600),
        endSec: z.number().min(0).max(3600),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const track = LUMEN_LIBRARY.find((t) => t.id === data.trackId);
    if (!track) {
      throw new Error("Only tracks from the Lumen Library can be used.");
    }
    const start = Math.min(Math.max(0, data.startSec), Math.max(0, track.durationSec - 1));
    const end = Math.min(start + MAX_CLIP_SECONDS, data.endSec > start ? data.endSec : start + MAX_CLIP_SECONDS, track.durationSec);
    return {
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      license: track.license,
      startSec: start,
      endSec: end,
      durationSec: Math.round((end - start) * 100) / 100,
    };
  });