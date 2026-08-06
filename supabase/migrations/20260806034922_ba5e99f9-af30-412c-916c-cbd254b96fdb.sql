-- ============ ROLES ============
do $$ begin
  create type public.app_role as enum ('admin','moderator','user');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create policy "users read own roles" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

revoke all on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin'::public.app_role)
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role from auth.users
where lower(email) = 'winzelestorninos4@gmail.com'
on conflict do nothing;

-- ============ AUDIT LOG ============
create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  admin_email text not null,
  action_type text not null,
  target_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

grant select, insert on public.admin_actions to authenticated;
grant all on public.admin_actions to service_role;
alter table public.admin_actions enable row level security;

create policy "admins read audit log" on public.admin_actions
  for select to authenticated using (public.is_admin());
create policy "admins write audit log" on public.admin_actions
  for insert to authenticated with check (public.is_admin() and admin_id = auth.uid());

-- ============ ADMIN ACCESS TO MODERATION TABLES ============
create policy "admins view all reports" on public.reports
  for select to authenticated using (public.is_admin());
create policy "admins update reports" on public.reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins view appeals" on public.appeals
  for select to authenticated using (public.is_admin());
create policy "admins update appeals" on public.appeals
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins view takedowns" on public.takedown_requests
  for select to authenticated using (public.is_admin());
create policy "admins update takedowns" on public.takedown_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins view strikes" on public.strikes
  for select to authenticated using (public.is_admin());
create policy "admins add strikes" on public.strikes
  for insert to authenticated with check (public.is_admin());

create policy "admins view all profiles" on public.profiles
  for select to authenticated using (public.is_admin());
create policy "admins update profiles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins view all posts" on public.posts
  for select to authenticated using (public.is_admin());
create policy "admins delete posts" on public.posts
  for delete to authenticated using (public.is_admin());

create policy "admins view moderation flags" on public.moderation_flags
  for select to authenticated using (public.is_admin());

-- ============ STORIES ============
alter table public.profiles
  add column if not exists default_story_privacy text not null default 'public';

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'photo',
  media_url text,
  text_content text,
  background text,
  music jsonb,
  stickers jsonb not null default '[]'::jsonb,
  privacy text not null default 'public',
  custom_audience uuid[] not null default '{}',
  held_for_moderation boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists stories_user_idx on public.stories (user_id, created_at desc);
create index if not exists stories_active_idx on public.stories (expires_at);

grant select, insert, update, delete on public.stories to authenticated;
grant all on public.stories to service_role;
alter table public.stories enable row level security;

create policy "owners manage own stories" on public.stories
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "audience views active stories" on public.stories
  for select to authenticated using (
    archived = false
    and expires_at > now()
    and user_id <> auth.uid()
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = stories.user_id and b.blocked_id = auth.uid())
         or (b.blocker_id = auth.uid() and b.blocked_id = stories.user_id)
    )
    and (
      privacy = 'public'
      or (privacy = 'custom' and auth.uid() = any (custom_audience))
      or (privacy = 'friends' and exists (
        select 1 from public.follows f1
        join public.follows f2
          on f2.follower_id = stories.user_id and f2.following_id = auth.uid()
        where f1.follower_id = auth.uid() and f1.following_id = stories.user_id
      ))
      or (privacy = 'fof' and exists (
        select 1 from public.follows a
        join public.follows b2 on b2.follower_id = a.following_id
        where a.follower_id = auth.uid() and b2.following_id = stories.user_id
      ))
    )
  );

create policy "admins view stories" on public.stories
  for select to authenticated using (public.is_admin());

create table if not exists public.story_views (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (story_id, viewer_id)
);

grant select, insert on public.story_views to authenticated;
grant all on public.story_views to service_role;
alter table public.story_views enable row level security;

create policy "viewers record own view" on public.story_views
  for insert to authenticated with check (viewer_id = auth.uid());

create policy "story owner reads views" on public.story_views
  for select to authenticated using (
    exists (select 1 from public.stories s where s.id = story_views.story_id and s.user_id = auth.uid())
  );

-- archive expired stories instead of losing them
create or replace function public.archive_expired_stories()
returns void language sql security definer set search_path = public as $$
  update public.stories
     set archived = true
   where archived = false and expires_at <= now() and held_for_moderation = false;
$$;

revoke all on function public.archive_expired_stories() from public;
grant execute on function public.archive_expired_stories() to authenticated, service_role;