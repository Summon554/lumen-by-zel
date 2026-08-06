/** Versioned legal documents. Bump a version to force re-consent. */
export const LEGAL_VERSIONS = {
  terms: "2026-08-05",
  privacy: "2026-08-05",
  data_privacy_act: "2026-08-05",
} as const;

export type DocKind = keyof typeof LEGAL_VERSIONS;

export const INDEPENDENCE_DISCLAIMER =
  "Lumen is a standalone, independent platform and is not affiliated with or representing any organization.";

export const LEGAL_CONTACT = "hello@lumen.app";

export function isAdult(birthdate: string | null | undefined): boolean {
  return ageFrom(birthdate) >= 18;
}

export function ageFrom(birthdate: string | null | undefined): number {
  if (!birthdate) return -1;
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return -1;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}