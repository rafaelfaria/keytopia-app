-- Letter Fall joins the boards.
--
-- The first game for a player who cannot type yet: one letter falls at a time,
-- the key is lit on an on-screen keyboard, wrong keys cost nothing, and the run
-- ends after three letters have landed. Its countable is letters caught.
--
-- The formula weights the count heavily and uses accuracy only as a gentle
-- tiebreak. Speed is deliberately absent: a seven year old hunting for a key
-- types at 3 wpm, and a board that ranked pace would rank the adults who
-- wandered in. Accuracy here is "how often the first key I pressed was the
-- right one", which is exactly the skill the game trains, so it earns its 3.
--
-- Boards stay divided by age group, so this game's board is Young Explorers
-- competing with each other.
insert into arena_games (id, name, value_label, sort) values
  ('letterfall', 'Letter Fall', 'letters', 5)
on conflict (id) do update
  set name = excluded.name, value_label = excluded.value_label, sort = excluded.sort;

create or replace function arena_score(p_game text, p_wpm real, p_acc real, p_value real)
returns integer
language sql
immutable
as $$
  select (case p_game
    when 'lightstream' then round(p_wpm * 10 + p_acc * 2)
    when 'duel'        then round(p_value * 200 + p_wpm * 5)
    when 'survivor'    then round(p_value * 150 + p_wpm * 5)
    when 'wordfall'    then round(p_value * 60 + p_acc * 6)
    when 'stack'       then round(p_value * 40 + p_acc * 4)
    when 'cipher'      then round(p_value * 50 + p_wpm * 3)
    when 'keyforge'    then round(p_value * 45 + p_wpm * 4)
    when 'wordflight'  then round(p_value * 55 + p_acc * 5)
    when 'letterfall'  then round(p_value * 25 + p_acc * 3)
    -- A game that reaches here has skipped step 1 of the checklist in
    -- docs/arena-leaderboards.md §10. It ranks on raw typing rather than
    -- erroring, so a missing branch is visible instead of a broken game.
    else round(p_wpm * 10 + p_acc)
  end)::integer;
$$;

-- CREATE OR REPLACE keeps the existing ACL, but the whole trap in the original
-- migration was that the default ACL on a function is "PUBLIC may execute", and
-- a wrong ACL here is silent: signed-out reads work, or every submission fails
-- with "permission denied for function arena_score". Re-asserting both halves
-- costs nothing and makes the intended state readable in this file.
revoke execute on function arena_score(text, real, real, real) from public;
grant  execute on function arena_score(text, real, real, real) to authenticated;
