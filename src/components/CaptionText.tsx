import { Link } from "@tanstack/react-router";

/** Renders caption text with #hashtags turned into search links. */
export function CaptionText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(#[\p{L}0-9_]+)/gu);
  return (
    <p className={className}>
      {parts.map((part, i) =>
        part.startsWith("#") && part.length > 1 ? (
          <Link
            key={i}
            to="/search"
            search={{ q: part }}
            className="text-primary hover:underline"
          >
            {part}
          </Link>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}
