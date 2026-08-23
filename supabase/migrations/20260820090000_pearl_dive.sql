-- Pearl Dive joins the boards.
--
-- The Arena's three competitive games all rank the same axis in three costumes:
-- the Lightstream ranks sustained pace, Quill Duel ranks a burst of it, and
-- Survivor Sprint ranks holding it steady. Whatever the copy on each front door
-- says, the fastest hands win all three, and a careful 30 wpm typist has no
-- competitive game at all.
--
-- This is that game. Six dives, and before each one you choose how deep to go
-- without seeing the phrase: shallow is worth one pearl, deep four, the trench
-- ten. One wrong key and you surface with nothing from that dive. So the whole
-- run is a series of honest bets about what you can type clean, which is a
-- judgement a fast sloppy typist is *worse* at than a slow accurate one.
--
-- The formula is the only one in this function with no speed term whatsoever,
-- and that is deliberate rather than an oversight. Pearls already carry the
-- pressure, because the breath meter on a deep dive is what stops a run from
-- becoming sixteen words typed at leisure; adding wpm on top would hand the
-- board straight back to the same hands that hold the other three. Accuracy is
-- the tiebreak because between two divers who landed the same pearls, the one
-- who never fumbled a dive at all is the better diver.
insert into arena_games (id, name, value_label, sort) values
  ('pearl', 'Pearl Dive', 'pearls', 35)
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
    -- A game that reaches here has skipped step 1 of the checklist in
    -- docs/arena-leaderboards.md §10. It ranks on raw typing rather than
    -- erroring, so a missing branch is visible instead of a broken game.
    else round(p_wpm * 10 + p_acc)
  end)::integer;
$$;

revoke execute on function arena_score(text, real, real, real) from public;
grant  execute on function arena_score(text, real, real, real) to authenticated;
