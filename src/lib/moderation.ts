/**
 * Lightweight auto-moderation used on every submit (posts, comments, messages).
 * Deliberately conservative: it blocks clear profanity, hate speech and violent
 * threats, and lets everything else through for human reporting.
 */
export type ModerationCategory = "profanity" | "hate" | "violence";

export type ModerationResult = {
  ok: boolean;
  categories: ModerationCategory[];
  message: string | null;
};

const PATTERNS: Record<ModerationCategory, RegExp[]> = {
  profanity: [
    /\bf+u+c+k+\w*/i,
    /\bs+h+i+t+\w*/i,
    /\bb+i+t+c+h+\w*/i,
    /\bc+u+n+t+\w*/i,
    /\ba+s+s+h+o+l+e+\w*/i,
    /\bd+i+c+k+h+e+a+d\w*/i,
    /\bw+h+o+r+e\b/i,
    /\bp+u+t+a+n+g+\w*/i,
    /\bg+a+g+o+\b/i,
    /\bt+a+n+g+i+n+a+\w*/i,
  ],
  hate: [
    /\bn+i+g+g+(a|e+r)\w*/i,
    /\bf+a+g+g*o*t*\b/i,
    /\bk+i+k+e\b/i,
    /\bt+r+a+n+n+y\b/i,
    /\bretard(ed)?\b/i,
    /\b(all|these)\s+\w+\s+should\s+(die|burn|be\s+killed)\b/i,
  ],
  violence: [
    /\bi('|’)?m?\s*(going to|gonna|will)\s+(kill|shoot|stab|hurt|beat)\s+(you|him|her|them)\b/i,
    /\b(kill|shoot|stab)\s+your ?self\b/i,
    /\bi\s+hope\s+you\s+die\b/i,
    /\bbomb\s+(the|your)\s+\w+/i,
  ],
};

const LABEL: Record<ModerationCategory, string> = {
  profanity: "strong language",
  hate: "hateful language",
  violence: "threats or violence",
};

export function moderate(text: string): ModerationResult {
  const value = (text ?? "").trim();
  if (!value) return { ok: true, categories: [], message: null };

  const categories = (Object.keys(PATTERNS) as ModerationCategory[]).filter((c) =>
    PATTERNS[c].some((re) => re.test(value)),
  );

  if (categories.length === 0) return { ok: true, categories: [], message: null };

  return {
    ok: false,
    categories,
    message: `This can't be posted — Lumen blocks ${categories
      .map((c) => LABEL[c])
      .join(" and ")}. Please rephrase with kindness.`,
  };
}