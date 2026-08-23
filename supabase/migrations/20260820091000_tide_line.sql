-- Tide Line joins the boards.
--
-- A shore of word tiles, you against one rival, and the tide coming in a row at
-- a time from the bottom. Type any tile's word and your light is planted on it;
-- a tile claimed next to one you already hold is worth two lights rather than
-- one. Whatever the tide reaches unclaimed is gone for both of you.
--
-- The countable is lights, not tiles, and the difference is the entire game.
-- Ranking tiles would make the right move "always type the shortest word left",
-- which is a reaction test with a grid drawn around it. Ranking lights means the
-- cheap word in the far corner can be the wrong one, and it gives the game the
-- thing no other Arena board has: a decision between each word and the next.
--
-- Lights are weighted heavily and wpm is the tiebreak, in that order, because a
-- player who reads the board well should beat a faster one who does not. Two
-- players who held the same shore are then separated by how cleanly they took
-- it.
--
-- Same §3 rule as Quill Duel and the Lightstream: one rival pace posts and every
-- other pace is practice. The reason here is the Lightstream's rather than the
-- duel's. A slower rival does not merely hand out free rounds, it leaves more of
-- the shore standing for you to take, so the lights a run is worth depend on who
-- you played. Ranked pace is per age division, matching the duel: Steady for
-- kids, Sharp for teens and adults.
insert into arena_games (id, name, value_label, sort) values
  ('tideline', 'Tide Line', 'lights', 25)
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
    when 'pearl'       then round(p_value * 30 + p_acc * 6)
    when 'tideline'    then round(p_value * 60 + p_wpm * 5)
    -- A game that reaches here has skipped step 1 of the checklist in
    -- docs/arena-leaderboards.md §10. It ranks on raw typing rather than
    -- erroring, so a missing branch is visible instead of a broken game.
    else round(p_wpm * 10 + p_acc)
  end)::integer;
$$;

revoke execute on function arena_score(text, real, real, real) from public;
grant  execute on function arena_score(text, real, real, real) to authenticated;
