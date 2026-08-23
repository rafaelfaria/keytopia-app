-- First Letter joins the boards.
--
-- A picture appears and the child presses the letter its name starts with.
-- Apple wants an a. It is the same hunt as the other starters with a different
-- question in front of it: instead of being handed a letter, the child has to
-- get the letter out of the picture themselves.
--
-- Its countable is solo pictures: the ones answered with no wrong keys and
-- without the game lighting the key. Twelve pictures a round, so what varies
-- between two children is how many they worked out unaided, which is exactly
-- what the game teaches. Accuracy is the tiebreak. No speed term: a child
-- sounding out "a-a-apple" under their breath is doing the work, and a board
-- that counted seconds would be ranking them for it.
insert into arena_games (id, name, value_label, sort) values
  ('firstletter', 'First Letter', 'solo pictures', 8)
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
    when 'keysafari'   then round(p_acc * 30 + p_value * 8)
    when 'rocket'      then round(p_value * 20 + p_acc * 4)
    when 'paint'       then round(p_value * 22 + p_acc * 3)
    when 'firstletter' then round(p_value * 40 + p_acc * 3)
    -- A game that reaches here has skipped step 1 of the checklist in
    -- docs/arena-leaderboards.md §10. It ranks on raw typing rather than
    -- erroring, so a missing branch is visible instead of a broken game.
    else round(p_wpm * 10 + p_acc)
  end)::integer;
$$;

revoke execute on function arena_score(text, real, real, real) from public;
grant  execute on function arena_score(text, real, real, real) to authenticated;
