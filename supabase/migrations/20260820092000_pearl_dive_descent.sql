-- Pearl Dive becomes one descent.
--
-- The first build asked the player to choose a depth before each of six dives:
-- shallow for one pearl, deep for four, the trench for ten. The intent was six
-- honest bets about what you could type clean. The arithmetic disagreed. At any
-- per-word accuracy above roughly 85% the trench has the best expected value
-- every single time, so the choice was not a bet, it was a formality with three
-- buttons, repeated six times. And because two runs could be six trench dives
-- or six shallow ones, the board was comparing efforts that had nothing in
-- common beyond a name.
--
-- So the choice goes, and the run becomes one path. Dive one is four words,
-- every dive after it is longer than the last, and landing one takes you
-- deeper. One wrong key or one empty breath ends the run where it stands. Every
-- word you bring up clean is a pearl, so the countable and the formula are both
-- unchanged: what changes is that `pearls` now means one thing.
--
-- The formula is untouched, which is exactly why the existing rows cannot stay.
-- `pearls * 30 + acc * 6` scored a number that used to come from a route the
-- player picked and now comes from a depth they reached, and the two are not
-- the same measurement. Old rows on the same board would be a different game
-- wearing this one's name. Nothing here has left the `arena-boards` branch, so
-- what is being cleared is developer runs.
delete from arena_scores where game = 'pearl';

update arena_games set name = 'Pearl Dive', value_label = 'pearls' where id = 'pearl';
