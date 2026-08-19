-- Alphabet Rocket joins the boards.
--
-- The third starter game: press a to z in order and the rocket climbs one
-- letter at a time to the moon. No clock, no fall, nothing lost for a wrong
-- key, and a destination rather than an ending.
--
-- Its countable is "solo letters": the ones found before the game gave in and
-- lit the key. Every finished flight is the same twenty six presses, so the
-- count that separates two children is how many of them they did not need help
-- with, which is exactly what learning the keyboard looks like from outside.
-- Accuracy is the tiebreak, speed is absent, same as the other two starters.
insert into arena_games (id, name, value_label, sort) values
  ('rocket', 'Alphabet Rocket', 'solo letters', 6)
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
    -- A game that reaches here has skipped step 1 of the checklist in
    -- docs/arena-leaderboards.md §10. It ranks on raw typing rather than
    -- erroring, so a missing branch is visible instead of a broken game.
    else round(p_wpm * 10 + p_acc)
  end)::integer;
$$;

revoke execute on function arena_score(text, real, real, real) from public;
grant  execute on function arena_score(text, real, real, real) to authenticated;
