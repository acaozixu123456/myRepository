create table if not exists public.nihongo_article_cache (
  article_id text primary key,
  source_url text not null,
  parser_version text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  hit_count bigint not null default 0,
  last_hit_at timestamptz,
  constraint nihongo_article_cache_article_id_check check (article_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  constraint nihongo_article_cache_payload_object_check check (jsonb_typeof(payload) = 'object'),
  constraint nihongo_article_cache_expiry_check check (expires_at > fetched_at)
);

create index if not exists nihongo_article_cache_expiry_idx
  on public.nihongo_article_cache (expires_at);

alter table public.nihongo_article_cache enable row level security;
revoke all on public.nihongo_article_cache from anon, authenticated;

create or replace function public.get_nihongo_article_cache(
  p_article_id text,
  p_parser_version text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cached public.nihongo_article_cache%rowtype;
begin
  if p_article_id is null
    or p_article_id !~ '^[A-Za-z0-9_-]{1,100}$'
    or length(coalesce(p_parser_version, '')) < 1
    or length(p_parser_version) > 80 then
    return null;
  end if;

  select * into cached
  from public.nihongo_article_cache
  where article_id = p_article_id
    and parser_version = p_parser_version
    and expires_at > now();

  if not found then
    return null;
  end if;

  update public.nihongo_article_cache
  set hit_count = hit_count + 1,
      last_hit_at = now()
  where article_id = p_article_id;

  return cached.payload || jsonb_build_object(
    'cached', true,
    'cacheMeta', jsonb_build_object(
      'parserVersion', cached.parser_version,
      'fetchedAt', cached.fetched_at,
      'expiresAt', cached.expires_at,
      'ageSeconds', greatest(0, floor(extract(epoch from (now() - cached.fetched_at)))::bigint)
    )
  );
end;
$$;

create or replace function public.put_nihongo_article_cache(
  p_article_id text,
  p_source_url text,
  p_parser_version text,
  p_payload jsonb,
  p_ttl_hours integer default 720
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  sentence_count integer;
  canonical_url text;
  ttl_hours integer;
begin
  if p_article_id is null or p_article_id !~ '^[A-Za-z0-9_-]{1,100}$' then
    return false;
  end if;

  canonical_url := 'https://www.mojidict.com/article/' || p_article_id;
  if p_source_url is distinct from canonical_url then
    return false;
  end if;

  if length(coalesce(p_parser_version, '')) < 1 or length(p_parser_version) > 80 then
    return false;
  end if;

  if p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or p_payload ->> 'ok' <> 'true'
    or p_payload ->> 'access' <> 'matched-public'
    or length(coalesce(p_payload ->> 'title', '')) < 1
    or length(p_payload ->> 'title') > 180
    or jsonb_typeof(p_payload -> 'sentences') <> 'array'
    or octet_length(p_payload::text) > 60000 then
    return false;
  end if;

  sentence_count := jsonb_array_length(p_payload -> 'sentences');
  if sentence_count < 2 or sentence_count > 16 then
    return false;
  end if;

  ttl_hours := greatest(24, least(coalesce(p_ttl_hours, 720), 1440));

  insert into public.nihongo_article_cache (
    article_id,
    source_url,
    parser_version,
    payload,
    fetched_at,
    expires_at
  ) values (
    p_article_id,
    p_source_url,
    p_parser_version,
    p_payload,
    now(),
    now() + make_interval(hours => ttl_hours)
  )
  on conflict (article_id) do update set
    source_url = excluded.source_url,
    parser_version = excluded.parser_version,
    payload = excluded.payload,
    fetched_at = excluded.fetched_at,
    expires_at = excluded.expires_at;

  delete from public.nihongo_article_cache
  where expires_at <= now() - interval '7 days';

  return true;
end;
$$;

revoke all on function public.get_nihongo_article_cache(text, text) from public;
revoke all on function public.put_nihongo_article_cache(text, text, text, jsonb, integer) from public;
grant execute on function public.get_nihongo_article_cache(text, text) to anon, authenticated, service_role;
grant execute on function public.put_nihongo_article_cache(text, text, text, jsonb, integer) to anon, authenticated, service_role;
