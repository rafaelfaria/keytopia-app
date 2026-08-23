-- Key Safari joins the boards.
--
-- The second starter game: a pal hides behind a key, the key rustles, pressing
-- it lets them out into the meadow. Twelve finds to an expedition, no clock and
-- no fail state, so every run posts the same count and the ranking has to come
-- from somewhere else.
--
-- It comes from accuracy, which here means "the first key I pressed was the
-- right one". That is exactly the skill the game trains and the only thing that
-- separates two children who both finished, and it stays honest without adding
-- a single second of time pressure to a game whose whole promise is that there
-- is none. Speed is absent for the same reason it is absent from Letter Fall.
insert into arena_games (id, name, value_label, sort) values
  ('keysafari', 'Key Safari', 'pals', 4)
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
    -- A game that reaches here has skipped step 1 of the checklist in
    -- docs/arena-leaderboards.md §10. It ranks on raw typing rather than
    -- erroring, so a missing branch is visible instead of a broken game.
    else round(p_wpm * 10 + p_acc)
  end)::integer;
$$;

revoke execute on function arena_score(text, real, real, real) from public;
grant  execute on function arena_score(text, real, real, real) to authenticated;
