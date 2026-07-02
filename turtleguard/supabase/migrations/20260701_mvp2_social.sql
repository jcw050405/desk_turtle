create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(trim(nickname)) between 1 and 32),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 48),
  invite_code text not null unique,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  constraint group_members_group_profile_unique unique (group_id, profile_id),
  constraint group_members_one_group_per_profile_mvp2 unique (profile_id)
);

create table if not exists public.study_sessions (
  id uuid primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  good_posture_seconds integer not null check (good_posture_seconds >= 0),
  bad_posture_seconds integer not null check (bad_posture_seconds >= 0),
  away_seconds integer not null check (away_seconds >= 0),
  warning_count integer not null check (warning_count >= 0),
  ended_reason text,
  ranking_mode boolean not null default false,
  posture_standard text not null check (
    posture_standard in ('very_sensitive', 'sensitive', 'default', 'relaxed', 'very_relaxed')
  ),
  sync_status text not null default 'synced',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_sessions_time_order check (ended_at >= started_at),
  constraint ranking_sessions_use_default_standard check (
    ranking_mode = false or posture_standard = 'default'
  ),
  constraint ranking_sessions_have_group check (
    ranking_mode = false or group_id is not null
  )
);

create index if not exists study_sessions_group_period_idx
on public.study_sessions (group_id, ranking_mode, started_at desc);

create or replace function public.create_profile(nickname text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text := trim(nickname);
  created public.profiles;
begin
  if char_length(cleaned) < 1 or char_length(cleaned) > 32 then
    raise exception 'Nickname must be 1 to 32 characters.';
  end if;

  insert into public.profiles (nickname, last_seen_at)
  values (cleaned, now())
  returning * into created;

  return created;
end;
$$;

create or replace function public.create_group_with_invite_code(profile_id uuid, group_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_name text := trim(group_name);
  code text;
  created public.groups;
  attempt integer := 0;
begin
  if char_length(cleaned_name) < 1 or char_length(cleaned_name) > 48 then
    raise exception 'Group name must be 1 to 48 characters.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = create_group_with_invite_code.profile_id) then
    raise exception 'Profile not found.';
  end if;

  if exists (
    select 1
    from public.group_members gm
    where gm.profile_id = create_group_with_invite_code.profile_id
  ) then
    raise exception 'MVP-2 supports one group per user.';
  end if;

  loop
    attempt := attempt + 1;
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    begin
      insert into public.groups (name, invite_code, owner_profile_id)
      values (cleaned_name, code, profile_id)
      returning * into created;

      exit;
    exception
      when unique_violation then
        if attempt >= 5 then
          raise exception 'Invite code generation failed.';
        end if;
    end;
  end loop;

  insert into public.group_members (group_id, profile_id, role)
  values (created.id, profile_id, 'owner');

  return created;
end;
$$;

create or replace function public.join_group_by_invite_code(profile_id uuid, invite_code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := upper(trim(invite_code));
  target_group public.groups;
begin
  if not exists (select 1 from public.profiles p where p.id = join_group_by_invite_code.profile_id) then
    raise exception 'Profile not found.';
  end if;

  if exists (
    select 1
    from public.group_members gm
    where gm.profile_id = join_group_by_invite_code.profile_id
  ) then
    raise exception 'MVP-2 supports one group per user.';
  end if;

  select *
  into target_group
  from public.groups g
  where g.invite_code = normalized_code;

  if target_group.id is null then
    raise exception 'Invite code not found.';
  end if;

  insert into public.group_members (group_id, profile_id, role)
  values (target_group.id, profile_id, 'member');

  return target_group;
end;
$$;

create or replace function public.upload_study_session(payload jsonb)
returns public.study_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted public.study_sessions;
  payload_profile_id uuid := (payload->>'profile_id')::uuid;
  payload_group_id uuid := nullif(payload->>'group_id', '')::uuid;
  payload_ranking_mode boolean := coalesce((payload->>'ranking_mode')::boolean, false);
  payload_posture_standard text := payload->>'posture_standard';
begin
  if not exists (select 1 from public.profiles p where p.id = payload_profile_id) then
    raise exception 'Profile not found.';
  end if;

  if payload_ranking_mode and payload_group_id is null then
    raise exception 'Ranking sessions require group_id.';
  end if;

  if payload_ranking_mode and payload_posture_standard <> 'default' then
    raise exception 'Ranking sessions must use default posture standard.';
  end if;

  if payload_group_id is not null and not exists (
    select 1
    from public.group_members gm
    where gm.group_id = payload_group_id and gm.profile_id = payload_profile_id
  ) then
    raise exception 'Profile is not a member of this group.';
  end if;

  insert into public.study_sessions (
    id,
    profile_id,
    group_id,
    started_at,
    ended_at,
    good_posture_seconds,
    bad_posture_seconds,
    away_seconds,
    warning_count,
    ended_reason,
    ranking_mode,
    posture_standard,
    sync_status
  )
  values (
    (payload->>'id')::uuid,
    payload_profile_id,
    payload_group_id,
    (payload->>'started_at')::timestamptz,
    (payload->>'ended_at')::timestamptz,
    (payload->>'good_posture_seconds')::integer,
    (payload->>'bad_posture_seconds')::integer,
    (payload->>'away_seconds')::integer,
    (payload->>'warning_count')::integer,
    nullif(payload->>'ended_reason', ''),
    payload_ranking_mode,
    payload_posture_standard,
    'synced'
  )
  on conflict (id) do update set
    started_at = excluded.started_at,
    group_id = excluded.group_id,
    ended_at = excluded.ended_at,
    good_posture_seconds = excluded.good_posture_seconds,
    bad_posture_seconds = excluded.bad_posture_seconds,
    away_seconds = excluded.away_seconds,
    warning_count = excluded.warning_count,
    ended_reason = excluded.ended_reason,
    ranking_mode = excluded.ranking_mode,
    posture_standard = excluded.posture_standard,
    sync_status = excluded.sync_status,
    updated_at = now()
  where public.study_sessions.profile_id = excluded.profile_id
  returning * into inserted;

  if inserted.id is null then
    raise exception 'Session id already exists for another profile.';
  end if;

  return inserted;
end;
$$;

create or replace function public.get_group_rankings(group_id uuid, period text)
returns table (
  profile_id uuid,
  nickname text,
  total_good_posture_seconds bigint,
  total_bad_posture_seconds bigint,
  total_away_seconds bigint,
  rank bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if period not in ('daily', 'weekly') then
    raise exception 'Ranking period must be daily or weekly.';
  end if;

  return query
  with period_sessions as (
    select ss.*
    from public.study_sessions ss
    where ss.group_id = get_group_rankings.group_id
      and ss.ranking_mode = true
      and (
        (period = 'daily' and ss.started_at >= date_trunc('day', now()))
        or
        (period = 'weekly' and ss.started_at >= date_trunc('week', now()))
      )
  ),
  totals as (
    select
      p.id as profile_id,
      p.nickname,
      coalesce(sum(ps.good_posture_seconds), 0)::bigint as total_good_posture_seconds,
      coalesce(sum(ps.bad_posture_seconds), 0)::bigint as total_bad_posture_seconds,
      coalesce(sum(ps.away_seconds), 0)::bigint as total_away_seconds
    from public.group_members gm
    join public.profiles p on p.id = gm.profile_id
    left join period_sessions ps on ps.profile_id = p.id
    where gm.group_id = get_group_rankings.group_id
    group by p.id, p.nickname
  )
  select
    totals.profile_id,
    totals.nickname,
    totals.total_good_posture_seconds,
    totals.total_bad_posture_seconds,
    totals.total_away_seconds,
    dense_rank() over (order by totals.total_good_posture_seconds desc) as rank
  from totals
  order by rank, nickname;
end;
$$;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.study_sessions enable row level security;

drop policy if exists "profiles are readable by group peers" on public.profiles;
create policy "profiles are readable by group peers"
on public.profiles for select
using (
  exists (
    select 1
    from public.group_members mine
    join public.group_members peer on peer.group_id = mine.group_id
    where mine.profile_id = auth.uid()
      and peer.profile_id = profiles.id
  )
  or id = auth.uid()
);

drop policy if exists "groups are readable by members" on public.groups;
create policy "groups are readable by members"
on public.groups for select
using (
  exists (
    select 1
    from public.group_members gm
    where gm.group_id = groups.id and gm.profile_id = auth.uid()
  )
);

drop policy if exists "group members are readable by group members" on public.group_members;
create policy "group members are readable by group members"
on public.group_members for select
using (
  exists (
    select 1
    from public.group_members mine
    where mine.group_id = group_members.group_id and mine.profile_id = auth.uid()
  )
);

drop policy if exists "sessions are readable by group members" on public.study_sessions;
create policy "sessions are readable by group members"
on public.study_sessions for select
using (
  profile_id = auth.uid()
  or exists (
    select 1
    from public.group_members gm
    where gm.group_id = study_sessions.group_id and gm.profile_id = auth.uid()
  )
);

comment on table public.profiles is
  'MVP-2 draft uses app-created profile UUIDs. If production uses Supabase Auth, align profiles.id with auth.users.id before relying on auth.uid() RLS policies.';
