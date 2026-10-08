import { useRef, useState } from "react";
import { Copy, Download, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LumenAvatar } from "@/components/LumenAvatar";
import { FounderBadge } from "@/components/FounderBadge";

type Props = { id: string; name: string | null; username: string; bio: string | null; avatar: string | null; followers: number; founder: boolean };
export function GlowCard(props: Props) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const link = `https://lumen-by-zel.lovable.app/u/${encodeURIComponent(props.id)}`;
  async function show() {
    setOpen(true);
    try {
      const QRCode = await import("qrcode");
      const styles = getComputedStyle(document.documentElement);
      const color = (token: string) => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Image generation unavailable");
        ctx.fillStyle = styles.getPropertyValue(token).trim(); ctx.fillRect(0, 0, 1, 1);
        const pixel = ctx.getImageData(0, 0, 1, 1).data;
        return `#${Array.from(pixel).slice(0, 3).map(n => n.toString(16).padStart(2, "0")).join("")}`;
      };
      setQr(await QRCode.toDataURL(link, { width: 240, margin: 4, errorCorrectionLevel: "M", color: { dark: color("--qr-ink"), light: color("--qr-paper") } }));
    } catch { toast.error("Couldn't create your QR code. Try again."); }
  }
  async function copy() { try { await navigator.clipboard.writeText(link); toast.success("Profile link copied"); } catch { toast.error("Couldn't copy the link"); } }
  async function exportCard(share: boolean) {
    if (!card.current || !qr) return;
    setBusy(true);
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(card.current, { pixelRatio: 2, cacheBust: false });
      if (!blob) throw new Error("Couldn't create image");
      const file = new File([blob], "lumen-glow-card.png", { type: "image/png" });
      if (share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `${props.name || props.username} · Lumen` });
      else {
        const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        if (share) toast.success("Glow Card downloaded — ready to share");
      }
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) toast.error("Couldn't export your card. Try again."); }
    finally { setBusy(false); }
  }
  return <><Button variant="outline" size="sm" onClick={() => void show()}><Share2/> Share Glow Card</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-lg p-4">
      <DialogTitle className="pr-6">Your Glow Card</DialogTitle><DialogDescription className="sr-only">Share {props.name || props.username}'s Lumen profile</DialogDescription>
      <div ref={card} className="dark glow-card relative overflow-hidden rounded-lg border border-primary/50 bg-background px-5 py-6 text-center text-foreground">
        <div className="mb-5 flex items-center justify-between text-primary"><span className="flex items-center gap-1.5 text-sm font-bold"><Sparkles size={16}/> LUMEN</span><span className="text-[10px] uppercase">Glow Card</span></div>
        <LumenAvatar size={72} name={props.name} url={props.avatar}/>
        <h2 className="mt-4 break-words text-lg font-semibold">{props.name || "Lumen friend"}</h2>
        <p className="mt-1 break-all text-sm text-primary">@{props.username}</p>
        {props.founder && <div className="mt-2"><FounderBadge/></div>}
        {props.bio && <p className="mt-3 whitespace-pre-wrap break-words text-xs text-muted-foreground">{props.bio}</p>}
        <p className="mt-3 text-xs"><strong>{props.followers}</strong> <span className="text-muted-foreground">followers</span></p>
        <div className="mx-auto mt-4 grid h-36 w-36 place-items-center rounded-md bg-qr-paper">{qr ? <img src={qr} alt={`QR code linking to ${props.username}'s profile`} className="h-36 w-36"/> : <span className="text-xs text-qr-ink">Creating QR…</span>}</div>
        <p className="mt-3 text-[10px] text-muted-foreground">lumen-by-zel.lovable.app</p>
      </div>
      <Button variant="outline" onClick={() => void copy()}><Copy/> Copy Profile Link</Button>
      <div className="grid grid-cols-2 gap-2"><Button disabled={busy || !qr} onClick={() => void exportCard(false)}><Download/> {busy ? "Preparing…" : "Download"}</Button><Button variant="secondary" disabled={busy || !qr} onClick={() => void exportCard(true)}><Share2/> Share</Button></div>
    </DialogContent></Dialog></>;
}
