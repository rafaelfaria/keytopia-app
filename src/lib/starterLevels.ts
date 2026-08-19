/**
 * The starter ladders — eight levels each, for the six games with no board.
 *
 * The problem these solve: a starter run lasts about ninety seconds and then
 * hands back a number of points. With no board to put that number on, it means
 * nothing, and a child who plays four times has done the same thing four times.
 * What a five year old actually wants from a game is to be further along than
 * they were yesterday, and to be able to see it.
 *
 * So each game has a fixed ladder that is cleared in order and kept forever
 * (`ProfileData.starters`). A level is not just "more of it": every one changes
 * what the game asks, and the four steps are always the same four, because six
 * different difficulty vocabularies would be six games again rather than one
 * family:
 *
 *   1. the letters widen      four home keys, then the row, then the alphabet
 *   2. the goal grows         six pals, then twenty
 *   3. the crutch goes        the printed word, the letters on the planks
 *   4. the labels go          a blank keyboard, played from memory
 *
 * The last level of every ladder is deliberately the hardest thing that game
 * can be, and for Word Bridge that is a whole word typed on an unlabelled
 * keyboard, which is Wordfall with the clock removed. That is the handover.
 *
 * Nothing here is timed and nothing can be lost. Failing to reach a goal leaves
 * the level exactly where it was, which is why "cleared" is a count and not a
 * score.
 */

export type StarterGameId = 'keysafari' | 'paint' | 'rocket' | 'letterfall' | 'firstletter' | 'bridge';

export interface StarterLevel {
  /** Shown on the node, in the HUD and on the play button. Kept to a few words. */
  name: string;
  /** How many of the game's own countable this level asks for. */
  goal: number;
  /** The letter pool, for the games that draw letters. */
  chars?: string;
  /** Keyboard drawn with blank keycaps: the graduation step of every ladder. */
  dark?: boolean;

  // --- per game ---
  /** Letter Fall: fall speed multiplier, and how many may fall at once. */
  speed?: number;
  room?: number;
  /** Paint Reveal: the grid. */
  cols?: number;
  rows?: number;
  /** Alphabet Rocket: the slice of the alphabet, and which way through it. */
  from?: number;
  to?: number;
  reverse?: boolean;
  /** Word Bridge: word length, and planks with no letters printed on them. */
  len?: 3 | 4;
  bare?: boolean;
}

const HOME4 = 'fjdk';
const HOME = 'fjdksla';
const VOWELS = 'fjdkslaeiou';
const TOP = 'fjdkslaeiouqwrtyp';
const MOST = 'fjdkslaeiouqwrtypzxcvbnm';
const ALL = 'abcdefghijklmnopqrstuvwxyz';

export const STARTER_LADDERS: Record<StarterGameId, StarterLevel[]> = {
  /** Key Safari: the pool widens and the meadow fills up. */
  keysafari: [
    { name: 'Four keys', chars: HOME4, goal: 6 },
    { name: 'The home row', chars: HOME, goal: 8 },
    { name: 'A bigger meadow', chars: HOME, goal: 12 },
    { name: 'Vowels join in', chars: VOWELS, goal: 12 },
    { name: 'Up to the top row', chars: TOP, goal: 16 },
    { name: 'Down to the bottom', chars: MOST, goal: 16 },
    { name: 'Every letter there is', chars: ALL, goal: 20 },
    { name: 'Blank keys', chars: ALL, goal: 20, dark: true },
  ],

  /** Paint Reveal: the canvas grows and the letters spread out. */
  paint: [
    { name: 'Six patches', chars: HOME, goal: 6, cols: 3, rows: 2 },
    { name: 'Eight patches', chars: HOME, goal: 8, cols: 4, rows: 2 },
    { name: 'Vowels join in', chars: VOWELS, goal: 10, cols: 5, rows: 2 },
    { name: 'Twelve patches', chars: TOP, goal: 12, cols: 4, rows: 3 },
    { name: 'Sixteen patches', chars: TOP, goal: 16, cols: 4, rows: 4 },
    { name: 'Twenty patches', chars: MOST, goal: 20, cols: 5, rows: 4 },
    { name: 'The whole canvas', chars: ALL, goal: 24, cols: 6, rows: 4 },
    { name: 'Blank keys', chars: ALL, goal: 24, cols: 6, rows: 4, dark: true },
  ],

  /** Alphabet Rocket: further up the alphabet, then through it the hard ways. */
  rocket: [
    { name: 'A to F', from: 0, to: 6, goal: 6 },
    { name: 'A to L', from: 0, to: 12, goal: 12 },
    { name: 'A to R', from: 0, to: 18, goal: 18 },
    { name: 'All the way to Z', from: 0, to: 26, goal: 26 },
    { name: 'The second half', from: 13, to: 26, goal: 13 },
    { name: 'Backwards', from: 0, to: 26, goal: 26, reverse: true },
    { name: 'Blank keys', from: 0, to: 26, goal: 26, dark: true },
    { name: 'Backwards, blank keys', from: 0, to: 26, goal: 26, reverse: true, dark: true },
  ],

  /** Letter Fall: more letters in the sky, falling faster. */
  letterfall: [
    { name: 'Four keys', chars: HOME4, goal: 8, speed: 0.8, room: 1 },
    { name: 'The home row', chars: HOME, goal: 10, speed: 0.9, room: 1 },
    { name: 'Two at a time', chars: HOME, goal: 12, speed: 0.95, room: 2 },
    { name: 'Vowels join in', chars: VOWELS, goal: 14, speed: 1, room: 2 },
    { name: 'Up to the top row', chars: TOP, goal: 16, speed: 1.1, room: 2 },
    { name: 'Down to the bottom', chars: MOST, goal: 18, speed: 1.15, room: 3 },
    { name: 'Every letter there is', chars: ALL, goal: 20, speed: 1.25, room: 3 },
    { name: 'Blank keys', chars: ALL, goal: 20, speed: 1.2, room: 3, dark: true },
  ],

  /** First Letter: more pictures, then the word goes, then the labels. */
  firstletter: [
    { name: 'Six pictures', goal: 6 },
    { name: 'Eight pictures', goal: 8 },
    { name: 'Ten pictures', goal: 10 },
    { name: 'Twelve pictures', goal: 12 },
    { name: 'No word underneath', goal: 8, bare: true },
    { name: 'No word, twelve', goal: 12, bare: true },
    { name: 'Blank keys', goal: 8, dark: true },
    { name: 'No word, blank keys', goal: 12, bare: true, dark: true },
  ],

  /** Word Bridge: longer words, then bare planks, then a blank keyboard. */
  bridge: [
    { name: 'Four short planks', goal: 4, len: 3 },
    { name: 'Six short planks', goal: 6, len: 3 },
    { name: 'Longer words', goal: 6, len: 4 },
    { name: 'Eight planks', goal: 8, len: 4 },
    { name: 'Blank planks', goal: 6, len: 3, bare: true },
    { name: 'Blank planks, longer', goal: 8, len: 4, bare: true },
    { name: 'Blank keys', goal: 6, len: 3, dark: true },
    { name: 'Off to the Arena', goal: 8, len: 4, bare: true, dark: true },
  ],
};

export const isStarter = (id: string): id is StarterGameId => id in STARTER_LADDERS;

export function ladder(game: StarterGameId): StarterLevel[] {
  return STARTER_LADDERS[game];
}

/** Levels cleared so far. Everything up to and including this number is done. */
export function clearedCount(starters: Record<string, number> | undefined, game: StarterGameId): number {
  return Math.min(STARTER_LADDERS[game].length, Math.max(0, starters?.[game] ?? 0));
}

/** The level a child arrives on: the first one they have not cleared. */
export function nextLevel(starters: Record<string, number> | undefined, game: StarterGameId): number {
  const done = clearedCount(starters, game);
  return Math.min(STARTER_LADDERS[game].length, done + 1);
}

/** One line for the intro, in the app's voice rather than a progress readout. */
export function ladderNote(done: number, total: number): string {
  if (done === 0) return `${total} levels, and nobody has to rush any of them.`;
  if (done >= total) return 'Every level done. Play any of them again whenever you like.';
  if (done === total - 1) return 'One level left. Look at you.';
  return `${done} of ${total} levels done. Pick any one you have already opened.`;
}
