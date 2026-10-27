-- RLS tests for supabase/migrations/0001_accounts.sql and 0002_sessions.sql.
--
-- Run in the Supabase SQL editor (or execute_sql). It makes throwaway users,
-- acts as each one the way the hub's pages would, checks every rule, and then
-- raises an exception so that everything it did is rolled back. The exception
-- message is the report: "RLS TESTS: ALL n PASSED", or the failures, listed.

do $$
declare
  host uuid := gen_random_uuid();
  friend uuid := gen_random_uuid();
  guest uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  extra1 uuid := gen_random_uuid();
  extra2 uuid := gen_random_uuid();
  sid uuid;
  scode text;
  r record;
  n integer;
  b boolean;
  passed integer := 0;
  failed integer := 0;
  report text := '';
begin
  insert into auth.users (id, email, is_anonymous) values
    (host, 'host@rls.test.invalid', false),
    (friend, 'friend@rls.test.invalid', false),
    (guest, null, true),
    (other, 'other@rls.test.invalid', false),
    (extra1, 'extra1@rls.test.invalid', false),
    (extra2, 'extra2@rls.test.invalid', false);
  execute 'set local role authenticated';

  -- ---- feedback --------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', host, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  begin
    insert into public.feedback (user_id, slug, vote) values (host, 'snake', 1);
    passed := passed + 1;
  exception when others then
    failed := failed + 1; report := report || E'\nFAIL: a user cannot vote: ' || sqlerrm;
  end;
  begin
    insert into public.feedback (user_id, slug, vote) values (friend, 'snake', -1);
    failed := failed + 1; report := report || E'\nFAIL: a user voted as someone else';
  exception when others then passed := passed + 1;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', friend, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  select count(*) into n from public.feedback;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || E'\nFAIL: a user can read another user''s votes'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', guest, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  begin
    insert into public.feedback (user_id, slug, vote) values (guest, 'snake', 1);
    failed := failed + 1; report := report || E'\nFAIL: a guest could vote';
  exception when others then passed := passed + 1;
  end;

  -- ---- plays -----------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', host, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  begin
    perform public.track_play(gen_random_uuid(), 'snake', null, 'wall', now() - interval '60 seconds', 99999, null);
    select max(active_seconds) into n from public.plays where user_id = host;
    if n between 55 and 70 then passed := passed + 1;
    else failed := failed + 1; report := report || E'\nFAIL: track_play kept ' || coalesce(n::text, 'nothing') || ' s of a 60 s play'; end if;
  exception when others then
    failed := failed + 1; report := report || E'\nFAIL: track_play refused a signed-in user: ' || sqlerrm;
  end;
  begin
    insert into public.plays (id, user_id, slug, started_at) values (gen_random_uuid(), host, 'snake', now());
    failed := failed + 1; report := report || E'\nFAIL: plays can be written directly, past track_play';
  exception when others then passed := passed + 1;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', guest, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  begin
    perform public.track_play(gen_random_uuid(), 'snake', null, 'wall', now(), 5, null);
    failed := failed + 1; report := report || E'\nFAIL: a guest could record a play';
  exception when others then passed := passed + 1;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  select count(*) into n from public.plays;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || E'\nFAIL: a user can read another user''s plays'; end if;
  select count(*) into n from public.my_play_totals();
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || E'\nFAIL: my_play_totals shows another user''s plays'; end if;

  -- ---- sessions: hosting and joining -------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', guest, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  begin
    perform public.create_session('Teal Otter');
    failed := failed + 1; report := report || E'\nFAIL: a guest could host a session';
  exception when others then passed := passed + 1;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', host, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  select * into r from public.create_session('Teal Otter');
  sid := r.session_id;
  scode := r.code;
  if r.slot = 0 and scode ~ '^[a-z2-9]{10}$' then passed := passed + 1;
  else failed := failed + 1; report := report || E'\nFAIL: create_session gave slot ' || r.slot || ', code ' || coalesce(scode, 'none'); end if;

  perform set_config('request.jwt.claims', json_build_object('sub', friend, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  select * into r from public.join_session(scode, 'Gold Lynx');
  if r.slot = 1 then passed := passed + 1; else failed := failed + 1; report := report || E'\nFAIL: the first friend got seat ' || r.slot; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', guest, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  select * into r from public.join_session(upper(scode), 'Misty Heron');
  if r.slot = 2 then passed := passed + 1; else failed := failed + 1; report := report || E'\nFAIL: a guest got seat ' || r.slot; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  begin
    perform public.join_session(scode, 'Gold Lynx');
    failed := failed + 1; report := report || E'\nFAIL: two players could take the same name';
  exception when others then passed := passed + 1;
  end;
  select count(*) into n from public.game_sessions;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || E'\nFAIL: an outsider can read the session'; end if;
  select count(*) into n from public.session_members;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || E'\nFAIL: an outsider can read the seats'; end if;
  if not public.may_use_session_topic('session:' || sid) then passed := passed + 1;
  else failed := failed + 1; report := report || E'\nFAIL: an outsider may use the session''s Realtime channel'; end if;
  if not public.may_use_session_topic('session:not-a-uuid') then passed := passed + 1;
  else failed := failed + 1; report := report || E'\nFAIL: a malformed topic was allowed'; end if;
  begin
    perform public.record_round(sid, 1, 'snake', 'race', 'played', 'finished', null, '[]'::jsonb);
    failed := failed + 1; report := report || E'\nFAIL: an outsider could record a round';
  exception when others then passed := passed + 1;
  end;
  select count(*) into n from public.profiles;
  if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || E'\nFAIL: a user can read another user''s profile'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', friend, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  select count(*) into n from public.session_members;
  if n = 3 then passed := passed + 1; else failed := failed + 1; report := report || E'\nFAIL: a member sees ' || n || ' seats, not 3'; end if;
  if public.may_use_session_topic('session:' || sid) then passed := passed + 1;
  else failed := failed + 1; report := report || E'\nFAIL: a member may not use the session''s Realtime channel'; end if;

  -- ---- removing a player ------------------------------------------------------
  begin
    perform public.kick_from_session(sid, guest);
    failed := failed + 1; report := report || E'\nFAIL: a non-host removed a player';
  exception when others then passed := passed + 1;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', host, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform public.kick_from_session(sid, guest);
  perform set_config('request.jwt.claims', json_build_object('sub', guest, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  begin
    perform public.join_session(scode, 'Misty Heron');
    failed := failed + 1; report := report || E'\nFAIL: a removed player came back';
  exception when others then passed := passed + 1;
  end;
  if not public.may_use_session_topic('session:' || sid) then passed := passed + 1;
  else failed := failed + 1; report := report || E'\nFAIL: a removed player may still use the Realtime channel'; end if;

  -- ---- four seats and no more ---------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  select * into r from public.join_session(scode, 'Rusty Badger');
  perform set_config('request.jwt.claims', json_build_object('sub', extra1, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  select * into r from public.join_session(scode, 'Sunny Koala');
  perform set_config('request.jwt.claims', json_build_object('sub', extra2, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  begin
    perform public.join_session(scode, 'Witty Yak');
    failed := failed + 1; report := report || E'\nFAIL: a fifth player got a seat';
  exception when others then passed := passed + 1;
  end;

  -- ---- recording rounds ---------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', friend, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  b := public.record_round(sid, 1, 'snake', 'race', 'played', 'finished', '{"0": 9000}'::jsonb,
    jsonb_build_array(jsonb_build_object('user_id', friend, 'place', 1, 'points', 1, 'won', true),
                      jsonb_build_object('user_id', host, 'place', 2, 'points', 0, 'won', false),
                      jsonb_build_object('user_id', extra2, 'place', 1, 'points', 3, 'won', true)));
  if b then passed := passed + 1; else failed := failed + 1; report := report || E'\nFAIL: a member could not record a round'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', host, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  b := public.record_round(sid, 1, 'other-game', 'versus', 'played', 'finished', null, '[]'::jsonb);
  if not b then passed := passed + 1; else failed := failed + 1; report := report || E'\nFAIL: a round was recorded twice'; end if;
  select count(*) into n from public.round_results where session_id = sid;
  if n = 2 then passed := passed + 1; else failed := failed + 1; report := report || E'\nFAIL: round results hold ' || n || ' rows, not the 2 seated players'; end if;

  -- ---- ending, and deleting an account -----------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', friend, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform public.end_session(sid);
  perform set_config('request.jwt.claims', json_build_object('sub', host, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  select count(*) into n from public.game_sessions where id = sid and status = 'open';
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || E'\nFAIL: a non-host ended the session'; end if;
  perform public.end_session(sid);
  select count(*) into n from public.game_sessions where id = sid and status = 'ended';
  if n = 1 then passed := passed + 1; else failed := failed + 1; report := report || E'\nFAIL: the host could not end the session'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', extra2, 'role', 'authenticated', 'is_anonymous', false,
    'amr', json_build_array(json_build_object('method', 'oauth', 'timestamp', extract(epoch from now() - interval '1 hour')::bigint)))::text, true);
  begin
    perform public.delete_my_account();
    failed := failed + 1; report := report || E'\nFAIL: an account was deleted without a recent sign-in';
  exception when others then passed := passed + 1;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', extra2, 'role', 'authenticated', 'is_anonymous', false,
    'amr', json_build_array(json_build_object('method', 'oauth', 'timestamp', extract(epoch from now())::bigint)))::text, true);
  begin
    perform public.delete_my_account();
    execute 'reset role';
    select count(*) into n from auth.users where id = extra2;
    execute 'set local role authenticated';
    if n = 0 then passed := passed + 1; else failed := failed + 1; report := report || E'\nFAIL: delete_my_account left the user'; end if;
  exception when others then
    failed := failed + 1; report := report || E'\nFAIL: delete_my_account refused a fresh sign-in: ' || sqlerrm;
  end;

  execute 'reset role';
  if failed = 0 then
    raise exception 'RLS TESTS: ALL % PASSED (everything rolled back)', passed;
  else
    raise exception 'RLS TESTS: % FAILED, % passed (everything rolled back)%', failed, passed, report;
  end if;
end;
$$;
