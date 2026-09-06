# Lumen — Sprint 6: Saves, Message Reactions, Story/Note Polish + Check-up

## 1. Feed & posts

- **Saved posts**: a bookmark button on every post. Saved items live in a new private list only you can see, reachable from the menu as "Saved".
- **Post editing**: you can fix the caption of your own post within an "Edited" label; the photo/video stays as posted.
- **Hashtags**: tapping a hashtag in a caption opens search results for it.

## 2. Messaging

- **Message reactions**: long-press a message to react with the same six emojis used on posts; the reaction shows on the bubble.
- **Reply to a message**: swipe or long-press to quote a specific message in your answer.
- **Reply to a story**: a text box inside the story viewer that sends the reply straight into the chat with that person, showing the story it refers to.

## 3. Stories & Notes polish

- Story viewer list gets avatars and time viewed, still owner-only.
- Notes strip: your own note shows a "tap to edit" hint, notes refresh when you come back to the page, and expired notes disappear without a reload.
- Notes get a quick reply: tapping someone's note opens the chat with their note quoted.

## 4. Full check-up and fixes

- Sweep every page for errors, slow loading and broken images; add loading placeholders where a page currently flashes empty.
- Re-run the security check on the database and fix anything the sweep raises that belongs to the new tables.
- Check the app on a phone-sized screen and fix any cramped or cut-off layout found.

## Technical notes

- New tables: `saved_posts` (user_id, post_id, unique pair) and `message_reactions` (message_id, user_id, type), plus `messages.reply_to_id` and `posts.edited_at`. Each with GRANTs, RLS scoped to the owner/conversation participants, and the existing block checks reused.
- Story/note replies reuse the existing `messages` insert path with a quoted-context column rather than a new table.
- Notes refresh via a Supabase realtime subscription on `notes`, matching the pattern already used in chat.
- Saved list, reactions and edits all go through the browser Supabase client under RLS; no new server functions needed.
- Check-up: run the database linter, review build and runtime logs, and drive the main flows in a headless browser for console errors.
