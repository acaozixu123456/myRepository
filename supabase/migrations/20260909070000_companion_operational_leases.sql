-- User explicitly approved a separate v3 service and operational-only table.
-- No audio, transcripts, topics, learning profiles or existing study tables here.
create table if not exists public.nihongo_companion_leases (
  call_id text primary key check (call_id ~ '^rtc_[A-Za-z0-9_-]{4,200}$'),
  expires_at timestamptz not null,
  heartbeat_at timestamptz not null default now(),
  owner uuid,
  owner_until timestamptz not null default now(),
  generation_ids text[] not null default '{}',
  accounted_ids text[] not null default '{}',
  generations integer not null default 0,
  tokens bigint not null default 0,
  closed boolean not null default false
);
alter table public.nihongo_companion_leases enable row level security;
revoke all on public.nihongo_companion_leases from public, anon, authenticated;
grant all on public.nihongo_companion_leases to service_role;
comment on table public.nihongo_companion_leases is 'Short-lived operational voice leases only; no learner content. Expired rows pruned on service use.';

create or replace function public.nihongo_companion_lease(
  p_action text, p_call_id text, p_owner uuid default null,
  p_event_id text default null, p_tokens bigint default 0
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.nihongo_companion_leases; t timestamptz := clock_timestamp();
begin
  if p_call_id !~ '^rtc_[A-Za-z0-9_-]{4,200}$' then raise exception 'invalid call id'; end if;
  if p_action='create' then
    delete from public.nihongo_companion_leases where expires_at<t-interval '1 day';
    insert into public.nihongo_companion_leases(call_id,expires_at,heartbeat_at)
      values(p_call_id,t+interval '20 minutes',t) on conflict do nothing;
  end if;
  select * into r from public.nihongo_companion_leases where call_id=p_call_id for update;
  if not found then return null; end if;
  if p_action='stop' then r.closed:=true;
  elsif not r.closed and r.expires_at>t then
    if p_action='touch' then r.heartbeat_at:=t;
    elsif p_action='claim' and p_owner is not null and (r.owner is null or r.owner_until<t+interval '20 seconds') then
      r.owner:=p_owner; r.owner_until:=t+interval '90 seconds';
    elsif p_action in ('generation','account') and p_event_id is not null and length(p_event_id)<=180 then
      -- IDs make overlap during controller handoff idempotent. Never store content.
      if p_action='generation' and not(p_event_id=any(r.generation_ids)) then
        r.generation_ids:=array_append(r.generation_ids,p_event_id); r.generations:=r.generations+1;
      elsif p_action='account' and not(p_event_id=any(r.accounted_ids)) then
        r.accounted_ids:=array_append(r.accounted_ids,p_event_id); r.tokens:=r.tokens+greatest(0,least(p_tokens,1000000));
      end if;
    end if;
  end if;
  if r.expires_at<=t or r.heartbeat_at<t-interval '65 seconds' or r.generations>160 or r.tokens>800000 then r.closed:=true; end if;
  update public.nihongo_companion_leases set expires_at=r.expires_at,heartbeat_at=r.heartbeat_at,
    owner=r.owner,owner_until=r.owner_until,generation_ids=r.generation_ids,accounted_ids=r.accounted_ids,
    generations=r.generations,tokens=r.tokens,closed=r.closed where call_id=p_call_id;
  return jsonb_build_object('closed',r.closed,'owner',r.owner,'ownerUntil',extract(epoch from r.owner_until)*1000,
    'expiresAt',extract(epoch from r.expires_at)*1000,'generations',r.generations,'tokens',r.tokens);
end;
$$;
revoke all on function public.nihongo_companion_lease(text,text,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.nihongo_companion_lease(text,text,uuid,text,bigint) to service_role;
