-- The Arena Boards — RLS and integrity verification.
-- Covers supabase/migrations/20260816120000_arena_boards.sql, and the claims
-- docs/arena-leaderboards.md §2 makes about what a client can and cannot do.
--
-- Run against the LOCAL stack (never production):
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54422/postgres" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/arena_rls.sql
--
-- Everything runs inside one transaction and rolls back, so the database is
-- untouched afterwards and this can run while other work is in flight.
-- Identities are simulated the way PostgREST does it: `set local role` plus the
-- request.jwt.claims GUC that auth.uid() and auth.jwt() read.
--
-- Cast: A and B (two households, adult division, rivals on the same board) ·
-- K (a kid, so the avatar-withholding rule can be checked) · N (an anonymous
-- school seat, which may read a board and never appear on one).

begin;

create function pg_temp.assert(cond boolean, msg text) returns void
language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FAIL: %', msg; end if;
end $$;

-- The submit path refuses a second run inside three seconds, which is correct
-- in production and unusable in a test that posts six runs in a row. Ageing the
-- rows is the honest way past it: it exercises the real function rather than
-- disabling the guard.
create function pg_temp.age_rows() returns void
language sql as $$
  update arena_scores
     set updated_at = updated_at - interval '1 minute',
         last_at    = last_at    - interval '1 minute';
$$;

create function pg_temp.be(p_user text, p_anon boolean default false) returns void
language plpgsql as $$
begin
  execute format('set local role authenticated');
  execute format(
    'set local request.jwt.claims = %L',
    json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', p_anon)::text
  );
end $$;

-- ---------------------------------------------------------------------------
-- Seed (as postgres)
-- ---------------------------------------------------------------------------
-- Boards are global per division, so any row a developer left behind by
-- actually playing the game lands in the same population the assertions below
-- count. Clearing the table makes the test hermetic; the enclosing transaction
-- rolls back, so nothing is really deleted and this stays safe to run against a
-- local stack with work in progress on it.
delete from arena_scores;

insert into auth.users (id, aud, role, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'a@arena.test'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'b@arena.test'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'authenticated', 'authenticated', 'k@arena.test'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'authenticated', 'authenticated', null);

insert into profiles (id, owner, profile) values
  ('a-p', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"name":"Ada"}'),
  ('b-p', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '{"name":"Bo"}'),
  ('k-p', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '{"name":"Kit"}'),
  ('n-p', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '{"name":"Nia"}');

-- ---------------------------------------------------------------------------
-- 1. A posts a run and is ranked first on an empty board
-- ---------------------------------------------------------------------------
select pg_temp.be('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

create temp table r1 as
  select * from arena_submit('stack', 'a-p', 'adult', 40, 95, 20, 'Ada', 'bk:1', '2026-08-16', '2026-W34');

select pg_temp.assert((select count(*) from r1) = 3,
  'a submit writes exactly three buckets (day, week, all)');
select pg_temp.assert(
  (select array_agg(period order by period) from r1) = array['all', 'd:2026-08-16', 'w:2026-W34'],
  'the three buckets are the day, the week and all time');
select pg_temp.assert((select rank from r1 where period = 'all') = 1,
  'first poster on an empty board ranks 1');
select pg_temp.assert((select prev_rank from r1 where period = 'all') is null,
  'a first run has no previous rank');
select pg_temp.assert((select improved from r1 where period = 'all'),
  'a first run is an improvement');
select pg_temp.assert((select next_rank from r1 where period = 'all') is null,
  'rank 1 has no rung above it');
select pg_temp.assert(
  (select score from r1 where period = 'all') = arena_score('stack', 40, 95, 20),
  'the returned score is the one the formula produces');

-- ---------------------------------------------------------------------------
-- 2. The client cannot state its own score
-- ---------------------------------------------------------------------------
do $$
begin
  insert into arena_scores (game, period, profile_id, age_group, wpm, acc, value, score, display_name, avatar)
  values ('stack', 'all', 'a-p', 'adult', 40, 95, 20, 999999, 'Ada', 'bk:1');
  raise exception 'FAIL: a client was able to write the score column directly';
exception
  when generated_always then null;  -- the expected refusal
end $$;

-- Out-of-range inputs are refused rather than clamped at the table, so a forged
-- row cannot sit permanently at rank 1.
do $$
begin
  insert into arena_scores (game, period, profile_id, age_group, wpm, acc, value, display_name, avatar)
  values ('stack', 'd:2026-01-01', 'a-p', 'adult', 900, 95, 20, 'Ada', 'bk:1');
  raise exception 'FAIL: a superhuman wpm was accepted';
exception
  when check_violation then null;
end $$;

-- ---------------------------------------------------------------------------
-- 3. B cannot read A's row directly. Cross-learner reads go through the
--    definer functions or they do not happen.
-- ---------------------------------------------------------------------------
select pg_temp.be('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select pg_temp.assert(
  (select count(*) from arena_scores where profile_id = 'a-p') = 0,
  'a raw select of another household''s scores returns nothing');

-- B also cannot post under A's profile.
do $$
begin
  perform arena_submit('stack', 'a-p', 'adult', 99, 99, 99, 'Bo', 'bk:2', '2026-08-16', '2026-W34');
  raise exception 'FAIL: b posted a score under a profile it does not own';
exception
  when others then
    if sqlerrm not like '%does not belong%' then raise; end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. B overtakes A, then A takes the lead back and is told exactly that
-- ---------------------------------------------------------------------------
create temp table r2 as
  select * from arena_submit('stack', 'b-p', 'adult', 55, 97, 26, 'Bo', 'bk:2', '2026-08-16', '2026-W34');

select pg_temp.assert((select rank from r2 where period = 'all') = 1,
  'a better score takes rank 1');
select pg_temp.assert((select total from r2 where period = 'all') = 2,
  'the board now holds two learners');

reset role;
select pg_temp.age_rows();
select pg_temp.be('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

create temp table r3 as
  select * from arena_submit('stack', 'a-p', 'adult', 70, 98, 30, 'Ada', 'bk:1', '2026-08-16', '2026-W34');

select pg_temp.assert((select rank from r3 where period = 'all') = 1,
  'a takes the lead back');
select pg_temp.assert((select prev_rank from r3 where period = 'all') = 2,
  'the previous rank is the one held before this run');
select pg_temp.assert((select passed from r3 where period = 'all') = 1,
  'overtaking one learner reports one passed');
select pg_temp.assert(
  (select passed_name from r3 where period = 'all') = 'Bo',
  'the learner overtaken is named the same way the board names them');

-- A run that does not beat your own best leaves the board alone and says so.
reset role;
select pg_temp.age_rows();
select pg_temp.be('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

create temp table r4 as
  select * from arena_submit('stack', 'a-p', 'adult', 12, 80, 3, 'Ada', 'bk:1', '2026-08-16', '2026-W34');

select pg_temp.assert((select improved from r4 where period = 'all') = false,
  'a worse run is not an improvement');
select pg_temp.assert(
  (select best from r4 where period = 'all') = arena_score('stack', 70, 98, 30),
  'a worse run does not lower the bucket best');
select pg_temp.assert((select rank from r4 where period = 'all') = 1,
  'a worse run does not cost you your rank');

-- ---------------------------------------------------------------------------
-- 5. The rate limit
-- ---------------------------------------------------------------------------
-- No ageing this time: the run immediately above was seconds ago.
select pg_temp.assert(
  (select count(*) from arena_submit('stack', 'a-p', 'adult', 90, 99, 40, 'Ada', 'bk:1', '2026-08-16', '2026-W34')) = 0,
  'a second submission inside three seconds is refused silently');

-- ---------------------------------------------------------------------------
-- 6. The board read: aliases, your row, and the rung above
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.age_rows();
select pg_temp.be('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

create temp table b1 as
  select * from arena_board('stack', 'all', 'global', null, 'adult', 'b-p', 10);

select pg_temp.assert((select count(*) from b1) = 2, 'both learners are on the board');
-- Adults own their accounts and their boards say so.
select pg_temp.assert(
  (select bool_and(name in ('Ada', 'Bo')) from b1),
  'an adult global board shows the name on the account');
select pg_temp.assert((select you from b1 where rank = 2), 'the caller''s own row is flagged');
select pg_temp.assert((select neighbour from b1 where rank = 1),
  'the row immediately above the caller is flagged as the next target');
select pg_temp.assert(
  (select rank from b1 order by score desc limit 1) = 1,
  'the board is ordered best first');

-- ---------------------------------------------------------------------------
-- 7. A kid's avatar is withheld from strangers, their alias is not
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.be('cccccccc-cccc-cccc-cccc-cccccccccccc');
select arena_submit('cipher', 'k-p', 'kid', 18, 96, 7, 'Kit', 'bk:9', '2026-08-16', '2026-W34');

select pg_temp.assert(
  (select avatar from arena_board('cipher', 'all', 'global', null, 'kid', 'k-p', 10) limit 1) = '',
  'the kid division board withholds the chosen avatar');
select pg_temp.assert(
  (select name from arena_board('cipher', 'all', 'global', null, 'kid', 'k-p', 10) limit 1) = keytopia_alias('k-p'),
  'the kid division board shows the generated alias, never the real name');
select pg_temp.assert(
  (select count(*) from arena_board('cipher', 'all', 'global', null, 'kid', 'k-p', 10) where name = 'Kit') = 0,
  'a kid''s real name is nowhere on a board of strangers');

-- ---------------------------------------------------------------------------
-- 8. Anonymous school seats read boards and never appear on them
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.be('dddddddd-dddd-dddd-dddd-dddddddddddd', true);

select pg_temp.assert(
  (select count(*) from arena_board('stack', 'all', 'global', null, 'adult', null, 10)) = 2,
  'an anonymous session can still watch a board');

do $$
begin
  perform arena_submit('stack', 'n-p', 'adult', 50, 95, 20, 'Nia', 'bk:3', '2026-08-16', '2026-W34');
  raise exception 'FAIL: an anonymous session posted a score';
exception
  when others then
    if sqlerrm not like '%anonymous%' then raise; end if;
end $$;

-- The restrictive policy has to hold on the table too, not only in the function.
do $$
begin
  insert into arena_scores (game, period, profile_id, age_group, wpm, acc, value, display_name, avatar)
  values ('stack', 'all', 'n-p', 'adult', 50, 95, 20, 'Nia', 'bk:3');
  raise exception 'FAIL: an anonymous session wrote directly to arena_scores';
exception
  when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------------------
-- 9. hideGlobalBoards hides AND stops posting, without breaking board scope
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.age_rows();
select pg_temp.be('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

select arena_submit('wordfall', 'b-p', 'adult', 60, 96, 9, 'Bo', 'bk:2', '2026-08-16', '2026-W34', false);

select pg_temp.assert(
  (select count(*) from arena_board('wordfall', 'all', 'global', null, 'adult', 'b-p', 10)) = 0,
  'a hidden learner is absent from the global board');
select pg_temp.assert(
  (select count(*) from arena_scores where profile_id = 'b-p' and game = 'wordfall') = 3,
  'a hidden learner''s rows still exist, so invited boards keep working');

-- ---------------------------------------------------------------------------
-- 10. The Lightstream accuracy floor
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.age_rows();
select pg_temp.be('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

select pg_temp.assert(
  (select count(*) from arena_submit('lightstream', 'a-p', 'adult', 120, 82, 0, 'Ada', 'bk:1', '2026-08-16', '2026-W34')) = 0,
  'a fast sloppy race does not post to the Lightstream board');
select pg_temp.assert(
  (select count(*) from arena_submit('lightstream', 'a-p', 'adult', 64, 94, 0, 'Ada', 'bk:1', '2026-08-16', '2026-W34')) = 3,
  'a clean race does post');

-- ---------------------------------------------------------------------------
-- 11. Signed-out visitors reach nothing
-- ---------------------------------------------------------------------------
reset role;
set local role anon;

do $$
begin
  perform arena_board('stack', 'all', 'global', null, 'adult', null, 10);
  raise exception 'FAIL: anon read a leaderboard';
exception
  when insufficient_privilege then null;
end $$;

do $$
begin
  perform arena_home('a-p', 'adult', 'all');
  raise exception 'FAIL: anon read the arena hub';
exception
  when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------------------
-- 12. The hub read agrees with the board read
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.be('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

create temp table h1 as select * from arena_home('b-p', 'adult', 'all');

select pg_temp.assert((select count(*) from h1) = 8,
  'the hub returns one row per active game');
select pg_temp.assert(
  (select your_rank from h1 where game = 'stack')
  = (select rank from arena_board('stack', 'all', 'global', null, 'adult', 'b-p', 10) where you),
  'the hub and the board agree on the caller''s rank');
select pg_temp.assert(
  (select leader_name from h1 where game = 'stack') = 'Ada',
  'the hub names the leader the same way the board does');

-- ---------------------------------------------------------------------------
-- 13. A chosen board name replaces the default, for any age
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.age_rows();
select pg_temp.be('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

select arena_submit('cipher', 'b-p', 'adult', 40, 95, 9, 'Bo', 'bk:2', '2026-08-16', '2026-W34', true, 'NightOwl_7');
select pg_temp.assert(
  (select name from arena_board('cipher', 'all', 'global', null, 'adult', 'b-p', 10) where you) = 'NightOwl_7',
  'a chosen name is what a board of strangers shows');

-- A kid may choose one too. The default stays the generated handle, so the safe
-- option is what happens when nobody does anything.
reset role;
select pg_temp.age_rows();
select pg_temp.be('cccccccc-cccc-cccc-cccc-cccccccccccc');
select arena_submit('wordfall', 'k-p', 'kid', 16, 94, 4, 'Kit', 'bk:9', '2026-08-16', '2026-W34', true, 'RocketFox');
select pg_temp.assert(
  (select name from arena_board('wordfall', 'all', 'global', null, 'kid', 'k-p', 10) where you) = 'RocketFox',
  'a kid''s chosen nickname is used');
select pg_temp.assert(
  (select count(*) from arena_board('cipher', 'all', 'global', null, 'kid', 'k-p', 10) where name = 'Kit') = 0,
  'a kid who chose nothing still gets the generated handle, never their name');

-- Anything that could carry contact details is dropped rather than shown.
reset role;
select pg_temp.age_rows();
select pg_temp.be('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select arena_submit('keyforge', 'b-p', 'adult', 40, 95, 9, 'Bo', 'bk:2', '2026-08-16', '2026-W34', true, 'me@example.com');
select pg_temp.assert(
  (select name from arena_board('keyforge', 'all', 'global', null, 'adult', 'b-p', 10) where you) = 'Bo',
  'a board name outside the charset is dropped, falling back to the default');

-- ---------------------------------------------------------------------------
-- 14. Paging
-- ---------------------------------------------------------------------------
select pg_temp.assert(
  (select distinct total from arena_board('stack', 'all', 'global', null, 'adult', 'b-p', 1, 0)) = 2,
  'every row carries the size of the whole board, not of the page');
select pg_temp.assert(
  (select rank from arena_board('stack', 'all', 'global', null, 'adult', null, 1, 0)) = 1,
  'the first page starts at rank 1');
select pg_temp.assert(
  (select rank from arena_board('stack', 'all', 'global', null, 'adult', null, 1, 1)) = 2,
  'an offset moves the page down the board');
-- Your own row and your neighbours survive paging: rule 2 does not switch off
-- because somebody pressed "show more".
select pg_temp.assert(
  (select count(*) from arena_board('stack', 'all', 'global', null, 'adult', 'b-p', 1, 0) where you) = 1,
  'the caller is on every page of their own board');
select pg_temp.assert(
  (select your_rank from h1 where game = 'duel') is null,
  'a game never played reports no rank rather than a fake one');

-- ---------------------------------------------------------------------------
-- 15. A built explorer survives the round trip whole
-- ---------------------------------------------------------------------------
-- An avatar used to be "bk:12" and the column was bounded for that. A built
-- explorer encodes to ~98 characters, and truncating one does not shorten a
-- picture: it cuts a field in half, so "oc=11" becomes "oc=1" and the explorer
-- comes back in the wrong colour.
reset role;
select pg_temp.age_rows();
select pg_temp.be('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

select pg_temp.assert(
  (select count(*) from arena_submit(
     'stack', 'a-p', 'adult', 40, 95, 12, 'Ada',
     'ch1:k=knight,f=square,h=antenna,e=sleepy,m=whiskers,g=wizardhat,o=backpack,a=dots,s=12,hc=11,oc=11',
     '2026-08-16', '2026-W34')) = 3,
  'a fully built explorer posts rather than breaking the length check');
select pg_temp.assert(
  (select avatar from arena_board('stack', 'all', 'global', null, 'adult', 'a-p', 10) where you)
    = 'ch1:k=knight,f=square,h=antenna,e=sleepy,m=whiskers,g=wizardhat,o=backpack,a=dots,s=12,hc=11,oc=11',
  'the board returns the explorer exactly as it was posted, to the last field');

-- The other half of that write: identity refreshed, the result did not. The run
-- above was a weaker one, and a rebuilt explorer must not hand someone a score
-- they did not earn.
select pg_temp.assert(
  (select value from arena_scores where game = 'stack' and period = 'all' and profile_id = 'a-p') > 12,
  'a weaker run refreshes who you are without taking the row''s best');

reset role;
select 'arena_rls.sql: all assertions held' as result;

rollback;
