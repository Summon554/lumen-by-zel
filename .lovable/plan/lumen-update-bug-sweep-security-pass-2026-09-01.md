# Lumen — Update, Bug Sweep & Security Pass

## 1. Security hardening (confirmed issues)

**Guardian verification can be self-approved by a minor.** Today, when a minor
enters a parent's email, the verification token is handed straight back to the
minor's own screen, and the database also lets them read the stored token row.
Either path lets them click their own verification link and mark themselves
parent-approved.

Fix:
- Stop returning the token to the person requesting it. The request only confirms
  "a link was sent to the parent".
- Remove the account owner's read access to the verification records — nothing in
  the app reads them from the browser, only trusted server code does.
- Keep the parent's click-through link working exactly as it does now.

Also verified and left as-is (they are safe, locked-down-by-default states):
role changes and verification writes have no browser path at all, and comments
have no edit rule because there is no edit feature.

Dependencies scanned: no high or critical vulnerabilities.

## 2. Full bug sweep

I'll drive the running app in a real browser as a signed-in test user and walk
every main flow, capturing console and network errors as I go:

- Sign up (including the under-18 parent-email path) and log in
- Landing page, onboarding, home feed: post text/photo/video, encourage, react,
  comment and reply, share
- Stories: create photo/text/music story, view, viewer list, archive
- Messages: list, chat, attachments, read receipts, typing, delete for everyone
- Profile and public profile: edit, cover, account type toggle, follow / request
- Search, notifications, hamburger menu, account page, admin dashboard

Every broken thing found gets fixed in the same pass, then re-verified in the
browser. If something is broken by design/incomplete rather than a bug, I'll list
it rather than silently expanding scope.

## 3. Polish and performance

- Loading skeletons anywhere a screen currently flashes blank
- Mobile layout glitches found during the sweep (overflow, cramped tap targets)
- Trim obviously wasteful data fetching on the feed and chat screens
- Keep the existing look: dark #121212 with #00BFFF glow accents; no redesign

## Technical notes

- Security fix ships as one database migration (drop the owner SELECT policy on
  `guardian_verifications`) plus a change to `src/lib/guardian.functions.ts` so
  the handler no longer returns `token`, and to `src/routes/account.tsx` where
  that token is surfaced.
- Bug sweep uses Playwright against `localhost:8080` with a minted test session.
- Re-run the database security scan and dependency scan at the end to confirm no
  new findings.
