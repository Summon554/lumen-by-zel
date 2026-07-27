export const FOUNDER_EMAIL = "winzelestorninos4@gmail.com";

export function isFounder(email?: string | null) {
  return !!email && email.toLowerCase() === FOUNDER_EMAIL;
}