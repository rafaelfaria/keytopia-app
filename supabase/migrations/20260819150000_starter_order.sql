-- The starter games, in the order a child meets them.
--
-- Each one was added in its own migration and took the next sort number, which
-- is the order they were built rather than the order they should be played.
-- The hub now lists them easiest first: spot the wiggling key, then press any
-- letter you can find, then the alphabet in order, then one named letter at a
-- time, then work the letter out of a picture, then whole words. The board
-- surfaces read `sort`, so they say the same thing.
update arena_games set sort = 1 where id = 'keysafari';
update arena_games set sort = 2 where id = 'paint';
update arena_games set sort = 3 where id = 'rocket';
update arena_games set sort = 4 where id = 'letterfall';
update arena_games set sort = 5 where id = 'firstletter';
update arena_games set sort = 6 where id = 'bridge';
