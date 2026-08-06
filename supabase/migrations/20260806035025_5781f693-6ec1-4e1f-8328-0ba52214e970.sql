create schema if not exists private;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'::public.app_role)
$$;

create or replace function private.archive_expired_stories()
returns void language sql security definer set search_path = public as $$
  update public.stories
     set archived = true
   where archived = false and expires_at <= now() and held_for_moderation = false;
$$;

revoke all on function private.has_role(uuid, public.app_role) from public;
revoke all on function private.is_admin() from public;
revoke all on function private.archive_expired_stories() from public;
grant execute on function private.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.archive_expired_stories() to authenticated, service_role;

drop policy if exists "admins read audit log" on public.admin_actions;
drop policy if exists "admins write audit log" on public.admin_actions;
drop policy if exists "admins view all reports" on public.reports;
drop policy if exists "admins update reports" on public.reports;
drop policy if exists "admins view appeals" on public.appeals;
drop policy if exists "admins update appeals" on public.appeals;
drop policy if exists "admins view takedowns" on public.takedown_requests;
drop policy if exists "admins update takedowns" on public.takedown_requests;
drop policy if exists "admins view strikes" on public.strikes;
drop policy if exists "admins add strikes" on public.strikes;
drop policy if exists "admins view all profiles" on public.profiles;
drop policy if exists "admins update profiles" on public.profiles;
drop policy if exists "admins view all posts" on public.posts;
drop policy if exists "admins delete posts" on public.posts;
drop policy if exists "admins view moderation flags" on public.moderation_flags;
drop policy if exists "admins view stories" on public.stories;

create policy "admins read audit log" on public.admin_actions
  for select to authenticated using (private.is_admin());
create policy "admins write audit log" on public.admin_actions
  for insert to authenticated with check (private.is_admin() and admin_id = auth.uid());
create policy "admins view all reports" on public.reports
  for select to authenticated using (private.is_admin());
create policy "admins update reports" on public.reports
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins view appeals" on public.appeals
  for select to authenticated using (private.is_admin());
create policy "admins update appeals" on public.appeals
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins view takedowns" on public.takedown_requests
  for select to authenticated using (private.is_admin());
create policy "admins update takedowns" on public.takedown_requests
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins view strikes" on public.strikes
  for select to authenticated using (private.is_admin());
create policy "admins add strikes" on public.strikes
  for insert to authenticated with check (private.is_admin());
create policy "admins view all profiles" on public.profiles
  for select to authenticated using (private.is_admin());
create policy "admins update profiles" on public.profiles
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins view all posts" on public.posts
  for select to authenticated using (private.is_admin());
create policy "admins delete posts" on public.posts
  for delete to authenticated using (private.is_admin());
create policy "admins view moderation flags" on public.moderation_flags
  for select to authenticated using (private.is_admin());
create policy "admins view stories" on public.stories
  for select to authenticated using (private.is_admin());

drop function if exists public.is_admin();
drop function if exists public.has_role(uuid, public.app_role);
drop function if exists public.archive_expired_stories();