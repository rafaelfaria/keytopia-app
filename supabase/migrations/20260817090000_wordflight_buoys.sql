-- Wordflight stopped having gates.
--
-- The game was rebuilt as a flight over open sea: the bird sinks the moment
-- you stop typing, the water is the only hazard, and the countable a run
-- accumulates is buoys passed rather than pillar gaps threaded. Pillars turned
-- out to be a precision game about position when the thing being taught is not
-- stopping, and a missed gap could not be recovered from.
--
-- Only the label moves. `p_value` still counts one thing per stretch of
-- distance survived, and buoys arrive at much the same rate gates used to, so
-- `p_value * 55 + p_acc * 5` still ranks the same shape of run and existing
-- rows stay comparable. Changing the multiplier would have meant re-ranking
-- every posted `all`-period row to keep the board honest, for no gain.

update arena_games
   set value_label = 'buoys'
 where id = 'wordflight';
