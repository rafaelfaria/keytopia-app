-- The starter games leave the boards.
--
-- Six migrations added them, one each, and each one argued for a formula that
-- avoided speed: letters caught, first-press accuracy, letters found before the
-- hint fired. The argument was answered from the wrong end. A board is a claim
-- that two runs can be compared, and what these games measure is how much help
-- a particular child needed today. That is theirs. Ranking it also quietly
-- reintroduces the thing the whole tier exists to remove, because the way to
-- climb any board is to hurry, and every one of these games promises a child
-- that hurrying is not part of it.
--
-- So they come out. They still record sessions, still earn XP and badges, and
-- still keep a personal best, which is the only comparison a five year old
-- needs and the only one their finish screen now shows.
--
-- Safe to delete rather than deactivate: no scores were ever posted for these
-- ids. Every submit failed the `arena_games` existence check until now, which
-- is the failure mode §10 of docs/arena-leaderboards.md designed for, and the
-- reason there is nothing here to orphan.
delete from arena_scores where game in
  ('letterfall', 'keysafari', 'rocket', 'paint', 'firstletter', 'bridge');
delete from arena_games  where id   in
  ('letterfall', 'keysafari', 'rocket', 'paint', 'firstletter', 'bridge');

-- And the branches go with them. A formula for a game that cannot post is dead
-- code in a function that is deliberately hard to read from the client, which
-- is the worst place to leave any.
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
    -- A game that reaches here has skipped step 1 of the checklist in
    -- docs/arena-leaderboards.md §10. It ranks on raw typing rather than
    -- erroring, so a missing branch is visible instead of a broken game.
    else round(p_wpm * 10 + p_acc)
  end)::integer;
$$;

revoke execute on function arena_score(text, real, real, real) from public;
grant  execute on function arena_score(text, real, real, real) to authenticated;
