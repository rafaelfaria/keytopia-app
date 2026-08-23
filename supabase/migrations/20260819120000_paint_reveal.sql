-- Paint Reveal joins the boards.
--
-- Twenty four painted tiles over one of the pals, each tile a different letter,
-- and any of them opens a patch. The other starters name one key and wait; this
-- one puts twenty four right answers on screen at once, so a child who cannot
-- find b can find o instead and the game keeps moving.
--
-- Its countable is patches uncovered, which is the whole board for a finished
-- painting and however far they got for one that stopped early. Accuracy is the
-- tiebreak: with two dozen live letters, pressing a dead one means the child was
-- reading the tiles rather than the keyboard, and that is worth a little. No
-- speed term, same as the other starters.
insert into arena_games (id, name, value_label, sort) values
  ('paint', 'Paint Reveal', 'patches', 7)
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
    -- A game that reaches here has skipped step 1 of the checklist in
    -- docs/arena-leaderboards.md §10. It ranks on raw typing rather than
    -- erroring, so a missing branch is visible instead of a broken game.
    else round(p_wpm * 10 + p_acc)
  end)::integer;
$$;

revoke execute on function arena_score(text, real, real, real) from public;
grant  execute on function arena_score(text, real, real, real) to authenticated;
