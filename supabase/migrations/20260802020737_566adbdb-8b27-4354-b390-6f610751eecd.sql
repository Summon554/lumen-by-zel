
-- BLOCKS
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);
grant select, insert, delete on public.blocks to authenticated;
grant all on public.blocks to service_role;
alter table public.blocks enable row level security;
create policy "users view own blocks" on public.blocks for select to authenticated
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);
create policy "users create own blocks" on public.blocks for insert to authenticated
  with check (auth.uid() = blocker_id and blocker_id <> blocked_id);
create policy "users remove own blocks" on public.blocks for delete to authenticated
  using (auth.uid() = blocker_id);

-- helpers
create or replace function private.is_blocked(_a uuid, _b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = _a and b.blocked_id = _b)
       or (b.blocker_id = _b and b.blocked_id = _a)
  )
$$;
revoke all on function private.is_blocked(uuid, uuid) from public;
grant execute on function private.is_blocked(uuid, uuid) to authenticated, service_role;

-- REPORTS
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz not null default now()
);
grant select, insert on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "users view own reports" on public.reports for select to authenticated
  using (auth.uid() = reporter_id);
create policy "users file own reports" on public.reports for insert to authenticated
  with check (auth.uid() = reporter_id and reporter_id is distinct from reported_user_id);

-- SHARES
alter table public.posts add column if not exists shared_post_id uuid references public.posts(id) on delete set null;
create index if not exists posts_shared_post_id_idx on public.posts(shared_post_id);

-- REACTIONS
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  type text not null check (type in ('like','love','laugh','wow','sad','pray')),
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);
grant select, insert, update, delete on public.reactions to authenticated;
grant all on public.reactions to service_role;
alter table public.reactions enable row level security;
create policy "reactions viewable when post visible" on public.reactions for select to authenticated
  using (exists (select 1 from public.posts p where p.id = reactions.post_id and private.can_view_user(p.user_id)));
create policy "users insert own reactions" on public.reactions for insert to authenticated
  with check (auth.uid() = user_id);
create policy "users update own reactions" on public.reactions for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own reactions" on public.reactions for delete to authenticated
  using (auth.uid() = user_id);

create table if not exists public.comment_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  type text not null check (type in ('like','love','laugh','wow','sad','pray')),
  created_at timestamptz not null default now(),
  unique (user_id, comment_id)
);
grant select, insert, update, delete on public.comment_reactions to authenticated;
grant all on public.comment_reactions to service_role;
alter table public.comment_reactions enable row level security;
create policy "comment reactions viewable when post visible" on public.comment_reactions for select to authenticated
  using (exists (select 1 from public.comments c join public.posts p on p.id = c.post_id
                 where c.id = comment_reactions.comment_id and private.can_view_user(p.user_id)));
create policy "users insert own comment reactions" on public.comment_reactions for insert to authenticated
  with check (auth.uid() = user_id);
create policy "users update own comment reactions" on public.comment_reactions for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own comment reactions" on public.comment_reactions for delete to authenticated
  using (auth.uid() = user_id);

-- MESSAGES upgrades
alter table public.messages add column if not exists attachment_url text;
alter table public.messages add column if not exists attachment_type text;
alter table public.messages add column if not exists attachment_name text;
alter table public.messages add column if not exists read_at timestamptz;
alter table public.messages add column if not exists deleted_for_everyone boolean not null default false;

drop policy if exists "users send own messages" on public.messages;
create policy "users send own messages" on public.messages for insert to authenticated
  with check (auth.uid() = sender_id and sender_id <> receiver_id and not private.is_blocked(sender_id, receiver_id));
create policy "participants update messages" on public.messages for update to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id)
  with check (auth.uid() = sender_id or auth.uid() = receiver_id);

create table if not exists public.message_deletes (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);
grant select, insert on public.message_deletes to authenticated;
grant all on public.message_deletes to service_role;
alter table public.message_deletes enable row level security;
create policy "users view own message deletes" on public.message_deletes for select to authenticated
  using (auth.uid() = user_id);
create policy "users insert own message deletes" on public.message_deletes for insert to authenticated
  with check (auth.uid() = user_id);

-- BLOCK enforcement on comments and follows
drop policy if exists "Users insert own comments" on public.comments;
create policy "Users insert own comments" on public.comments for insert to authenticated
  with check (auth.uid() = user_id and exists (
    select 1 from public.posts p where p.id = comments.post_id
      and private.can_view_user(p.user_id) and not private.is_blocked(auth.uid(), p.user_id)));

drop policy if exists "users insert own follows" on public.follows;
create policy "users insert own follows" on public.follows for insert to authenticated
  with check (auth.uid() = follower_id and not private.is_blocked(follower_id, following_id));

-- PRESENCE
alter table public.profiles add column if not exists last_seen_at timestamptz;

-- PUSH TOKENS
create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null default 'web',
  created_at timestamptz not null default now(),
  unique (user_id, token)
);
grant select, insert, delete on public.device_tokens to authenticated;
grant all on public.device_tokens to service_role;
alter table public.device_tokens enable row level security;
create policy "users manage own device tokens select" on public.device_tokens for select to authenticated
  using (auth.uid() = user_id);
create policy "users manage own device tokens insert" on public.device_tokens for insert to authenticated
  with check (auth.uid() = user_id);
create policy "users manage own device tokens delete" on public.device_tokens for delete to authenticated
  using (auth.uid() = user_id);

-- NOTIFICATION PREFS
create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  messages boolean not null default true,
  reactions boolean not null default true,
  follows boolean not null default true,
  quiet_hours boolean not null default true,
  permission_asked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.notification_prefs to authenticated;
grant all on public.notification_prefs to service_role;
alter table public.notification_prefs enable row level security;
create policy "users view own prefs" on public.notification_prefs for select to authenticated
  using (auth.uid() = user_id);
create policy "users insert own prefs" on public.notification_prefs for insert to authenticated
  with check (auth.uid() = user_id);
create policy "users update own prefs" on public.notification_prefs for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists update_notification_prefs_updated_at on public.notification_prefs;
create trigger update_notification_prefs_updated_at before update on public.notification_prefs
  for each row execute function public.update_updated_at_column();

-- NOTIFICATIONS: allow reaction / share / message types
drop policy if exists "notifications require real action" on public.notifications;
create policy "notifications require real action" on public.notifications for insert to authenticated
with check (
  auth.uid() = actor_id and user_id <> actor_id and not private.is_blocked(actor_id, user_id) and (
    (type = 'follow' and exists (select 1 from public.follows f where f.follower_id = notifications.actor_id and f.following_id = notifications.user_id))
    or (type = 'follow_request' and exists (select 1 from public.follow_requests r where r.requester_id = notifications.actor_id and r.target_id = notifications.user_id))
    or (type = 'like' and exists (select 1 from public.likes l join public.posts p on p.id = l.post_id where l.user_id = notifications.actor_id and l.post_id = notifications.post_id and p.user_id = notifications.user_id))
    or (type = 'reaction' and exists (select 1 from public.reactions r join public.posts p on p.id = r.post_id where r.user_id = notifications.actor_id and r.post_id = notifications.post_id and p.user_id = notifications.user_id))
    or (type = 'share' and exists (select 1 from public.posts s join public.posts p on p.id = s.shared_post_id where s.user_id = notifications.actor_id and p.id = notifications.post_id and p.user_id = notifications.user_id))
    or (type = 'message' and exists (select 1 from public.messages m where m.sender_id = notifications.actor_id and m.receiver_id = notifications.user_id))
    or (type = 'comment' and exists (select 1 from public.comments c join public.posts p on p.id = c.post_id where c.user_id = notifications.actor_id and c.post_id = notifications.post_id and p.user_id = notifications.user_id))
    or (type = 'comment_reply' and exists (select 1 from public.comments c join public.comments parent on parent.id = c.parent_id where c.user_id = notifications.actor_id and c.post_id = notifications.post_id and parent.user_id = notifications.user_id))
    or (type = 'comment_like' and exists (select 1 from public.comment_likes cl join public.comments c on c.id = cl.comment_id where cl.user_id = notifications.actor_id and c.post_id = notifications.post_id and c.user_id = notifications.user_id))
  )
);

-- realtime
alter table public.messages replica identity full;
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.messages'; exception when duplicate_object then null; end;
end $$;
