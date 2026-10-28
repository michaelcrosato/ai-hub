-- A round's highlights (lib/hub/README.md §10): each player's stats and the
-- awards the game gave them, kept with their result. The hub trims both to
-- the protocol's limits before saving; anything larger is dropped here.

alter table public.round_results
  add column stats jsonb check (stats is null or (jsonb_typeof(stats) = 'object' and length(stats::text) <= 1000)),
  add column awards jsonb check (awards is null or (jsonb_typeof(awards) = 'array' and jsonb_array_length(awards) <= 3 and length(awards::text) <= 1000));

create or replace function public.record_round(
  p_session uuid,
  p_round integer,
  p_slug text,
  p_mode text,
  p_status text,
  p_reason text,
  p_scores jsonb,
  p_results jsonb
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  if not public.is_session_member(p_session, true) then
    raise exception 'not seated in this session' using errcode = '42501';
  end if;
  insert into public.session_rounds (session_id, round_no, slug, mode, status, reason, scores, recorded_by)
  values (p_session, p_round, p_slug, p_mode, p_status, left(p_reason, 40), p_scores, auth.uid())
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return false;
  end if;
  if p_status = 'played' and jsonb_typeof(p_results) = 'array' then
    insert into public.round_results (session_id, round_no, user_id, place, points, won, stats, awards)
    select p_session, p_round, (r ->> 'user_id')::uuid, (r ->> 'place')::smallint, (r ->> 'points')::smallint,
           coalesce((r ->> 'won')::boolean, false),
           case when jsonb_typeof(r -> 'stats') = 'object' and length((r -> 'stats')::text) <= 1000 then r -> 'stats' end,
           case when jsonb_typeof(r -> 'awards') = 'array' and jsonb_array_length(r -> 'awards') <= 3
                     and length((r -> 'awards')::text) <= 1000 then r -> 'awards' end
    from jsonb_array_elements(p_results) r
    where exists (select 1 from public.session_members m
                  where m.session_id = p_session and m.user_id = (r ->> 'user_id')::uuid);
  end if;
  return true;
end;
$$;
