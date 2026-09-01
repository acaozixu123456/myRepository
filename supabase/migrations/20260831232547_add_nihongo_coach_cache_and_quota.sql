create table if not exists public.nihongo_coach_cache (
  cache_key text primary key,
  payload jsonb not null,
  model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nihongo_coach_cache_updated_at_idx
  on public.nihongo_coach_cache (updated_at desc);

create table if not exists public.nihongo_coach_rate_limit (
  bucket text primary key,
  request_count integer not null default 0,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists nihongo_coach_rate_limit_expires_at_idx
  on public.nihongo_coach_rate_limit (expires_at);

alter table public.nihongo_coach_cache enable row level security;
alter table public.nihongo_coach_rate_limit enable row level security;

revoke all on table public.nihongo_coach_cache from anon, authenticated;
revoke all on table public.nihongo_coach_rate_limit from anon, authenticated;
grant all on table public.nihongo_coach_cache to service_role;
grant all on table public.nihongo_coach_rate_limit to service_role;

create or replace function public.consume_nihongo_coach_quota(
  p_bucket text,
  p_limit integer,
  p_window_minutes integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_now timestamptz := now();
  v_count integer;
begin
  if p_bucket is null or length(p_bucket) < 3 or p_limit < 1 or p_window_minutes < 1 then
    return false;
  end if;

  insert into public.nihongo_coach_rate_limit(bucket, request_count, expires_at, updated_at)
  values (p_bucket, 1, v_now + make_interval(mins => p_window_minutes), v_now)
  on conflict (bucket) do update
  set request_count = case
        when public.nihongo_coach_rate_limit.expires_at <= v_now then 1
        else public.nihongo_coach_rate_limit.request_count + 1
      end,
      expires_at = case
        when public.nihongo_coach_rate_limit.expires_at <= v_now
          then v_now + make_interval(mins => p_window_minutes)
        else public.nihongo_coach_rate_limit.expires_at
      end,
      updated_at = v_now
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$function$;

revoke all on function public.consume_nihongo_coach_quota(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_nihongo_coach_quota(text, integer, integer) to service_role;
