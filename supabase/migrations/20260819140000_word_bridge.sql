-- Word Bridge joins the boards.
--
-- The last starter, and the one that hands over to Wordfall. Each word is a
-- plank and each letter a step across it: the letter you need is lit on the
-- plank and on the keyboard, nothing has to be remembered, and a wrong key
-- never sends the child back to the start of the word.
--
-- Its countable is planks, meaning words finished, which is the first time any
-- starter counts words rather than keys. Accuracy is the tiebreak and carries
-- real weight here, because a word typed with no wrong keys at all is the thing
-- this game exists to produce. Still no speed term: Wordfall is where the clock
-- starts, and the whole point of this one is to arrive there ready.
insert into arena_games (id, name, value_label, sort) values
  ('bridge', 'Word Bridge', 'planks', 9)
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
    when 'bridge'      then round(p_value * 50 + p_acc * 5)
    -- A game that reaches here has skipped step 1 of the checklist in
    -- docs/arena-leaderboards.md §10. It ranks on raw typing rather than
    -- erroring, so a missing branch is visible instead of a broken game.
    else round(p_wpm * 10 + p_acc)
  end)::integer;
$$;

revoke execute on function arena_score(text, real, real, real) from public;
grant  execute on function arena_score(text, real, real, real) to authenticated;
