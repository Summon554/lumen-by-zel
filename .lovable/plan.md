# Fix the hamburger menu drawer

## What's wrong now

The drawer already has no accordions or caret arrows, but its content is roughly 1,100px tall while a phone screen is about 735px. The drawer is inside a fixed full-screen overlay with no scrolling, so everything below the fold (Content section, Admin, Music Takedown, Your data & account, Privacy, Terms, Log out) is simply cut off and unreachable.

## The fix: make everything fit on one screen

Rebuild the drawer body as a compact, single-screen settings panel:

- **Denser rows** — 40px row height instead of 48px, tighter section headers (no extra vertical padding), 15px icons.
- **Drop the space wasters** — remove the three explanatory helper paragraphs (quiet hours, story audience, notes) and fold the quiet-hours note into a single small line at the bottom.
- **Blocked Users becomes a row, not a list** — show "Blocked Users · N" as a tappable row that expands the list inline only when tapped (it collapses again, so the closed state costs one row). Nothing else expands.
- **Group compact controls** — Account Type and Theme keep their pill toggles on the right of their row; Private Account and the three notification toggles keep their switches.
- **Legal links share one row** — Privacy Policy and Terms of Service become two half-width links on a single row.
- **Log out** stays pinned as the last compact row.

Estimated result: header 42px + ~13 rows at 40px + 5 slim section headers ≈ 700px, which fits a 735px phone screen with no scrolling. On very short screens the drawer still won't clip content — it will fall back to allowing the page to scroll rather than hiding items, since losing access to Log out is worse than a scroll.

## Item order (all visible at once)

```text
Settings                                    [x]
ACCOUNT      Account Type        [Personal|Pro]
PRIVACY      Private Account            [toggle]
             Blocked Users · 0
NOTIFICATIONS  New messages             [toggle]
             Reactions                  [toggle]
             New followers              [toggle]
APPEARANCE   Theme              [Light|Dark]
CONTENT      Archived Stories
             Story Settings
             Note Settings
             Music Takedown
             Your data & account
             Admin dashboard        (admins only)
             Privacy · Terms
             Log out
```

## Technical notes

- Single file: `src/components/HamburgerMenu.tsx`. No database, auth, or route changes; all existing handlers (account type, privacy, notification prefs, theme, unblock, logout) are reused as-is.
- Row/SectionHeader/Segmented/Toggle helpers get tightened sizing; `BlockedUsers` renders behind a local `showBlocked` state.
- Drawer container switches to `max-h-screen` with `overflow-y-auto` only as a safety net for unusually short screens.
