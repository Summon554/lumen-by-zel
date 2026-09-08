# Lumen — Messenger Upgrade: Reactions, Replies, Voice & Video Calls

## 1. Message reactions

- Long-press (or hover on desktop) a message bubble to open the same six-emoji popup used on posts.
- The chosen reaction sits on the corner of the bubble; tapping it again removes it.
- Both people see reactions appear live without refreshing.

## 2. Reply to a message

- Long-press or swipe a message to reply to it.
- The message you are answering shows as a small quoted strip above the input, with an X to cancel.
- Sent replies show the quoted original above the new message; tapping it scrolls up to that message.

## 3. Voice & video calls

- Call buttons (phone and camera) in the chat header.
- Calling screen: the other person's photo and name, ringing state, and Cancel.
- Incoming call appears as a full-screen banner anywhere in the app with Accept / Decline, plus a ring tone.
- In-call screen: your small self-view over the other person's video, with mute, camera on/off, and hang up. Voice calls show photos instead of video.
- After the call, a short "Voice call · 2m 14s" or "Missed call" entry appears in the chat history.
- Calls are peer-to-peer between the two phones/browsers; nothing is recorded or stored.

## 4. Limits to know

- Calls work when both people have the app open (browser/PWA). Ringing someone whose app is closed shows as missed — real background ringing needs native apps.
- Some strict mobile networks can block a direct connection; those calls will fail to connect and show an error. A relay service can be added later if that happens often.

## Technical notes

- Reactions use the existing `message_reactions` table; replies use the existing `messages.reply_to_id` / `quote_kind` / `quote_text` columns — no schema change needed for sections 1 and 2.
- New table `calls` (caller_id, callee_id, kind `audio|video`, status `ringing|accepted|declined|missed|ended`, started_at, ended_at) with GRANTs and RLS scoped to the two participants; used for ringing state and the call log entry in chat. Blocks are respected the same way messages are.
- WebRTC peer connection with signalling over a Supabase realtime broadcast channel keyed to the two user IDs (offer/answer/ICE). Google STUN servers only; no TURN relay initially.
- New `src/lib/calls.ts` (peer connection helpers), `src/components/CallOverlay.tsx` (incoming banner + in-call UI, mounted once in the root layout so a call can arrive on any page), and reaction/reply UI inside `src/routes/messages.$id.tsx` reusing `ReactionBar`.
- Media permissions requested only when a call starts; tracks stopped on hangup.
