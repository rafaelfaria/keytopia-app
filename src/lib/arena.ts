import type { ProfileData } from './types';

/**
 * The Arena registry — the one place a mini game declares itself rankable.
 *
 * Design: docs/arena-leaderboards.md. Step 2 of the checklist in §10 is "add
 * your entry here", and this file exists so that step is the only client-side
 * work a new game has to do: the hub, both board surfaces and the submit path
 * all read from ARENA_GAMES rather than each holding their own list.
 *
 * The database holds the matching list in `arena_games` and the scoring formula
 * in `arena_score()`. They are deliberately two lists rather than one: the
 * client must not be told how scores are computed, or "the client never states
 * its own score" becomes a formality. What keeps them honest is step 1 of the
 * checklist in docs/arena-leaderboards.md §10: a game added here but not there
 * is visibly absent from every board rather than silently unranked.
 */

/** Theme tokens a game may tint toward. All twelve themes define every one. */
export type ArenaToken = 'accent' | 'accent2' | 'good' | 'warn' | 'gold' | 'bad';

export type ArenaGameId =
  | 'lightstream' | 'duel' | 'survivor' | 'wordfall'
  | 'stack' | 'cipher' | 'keyforge' | 'wordflight';

export interface ArenaGame {
  id: ArenaGameId;
  name: string;
  icon: string;
  to: string;
  /** The real skill the run trains. Shown on the card and the intro panel. */
  trains: string;
  /** One line of what the game is, in the app's voice. */
  desc: string;
  /**
   * Label for the game's own headline count on a board. Null means the game has
   * no third metric worth a column, and the board shows wpm and accuracy only.
   */
  valueLabel: string | null;
  /** How the finish screen says the count out loud. 21 => '21 blocks'. */
  unit: (v: number) => string;
  /** Competitive games lead the hub; quests follow. */
  tier: 'competitive' | 'quest';
  /**
   * The intro screen's 3D backdrop, drawn by the same keycap field the landing
   * and the public pages use (src/pages/public/heroScene.ts). Reusing that scene
   * rather than writing a new one per game keeps a game's front door in the same
   * world as the rest of the product; the formation and tone make it *that*
   * game's front door rather than a generic one.
   *
   * `tone` is deliberately not a hex. Fixed colours gave every game one identity
   * and twelve wrong themes: a violet field is right on midnight and fights
   * meadow's greens and paper's browns. Naming two theme TOKENS and a blend
   * between them means each game still reads as itself, in whatever palette the
   * learner chose, in every theme including the ones added after this file.
   */
  hero: {
    formation: 'wave' | 'terrace' | 'scatter' | 'stream' | 'calm';
    tone: [ArenaToken, ArenaToken, number];
  };
}

const plural = (one: string, many = `${one}s`) => (v: number) => `${v} ${v === 1 ? one : many}`;

export const ARENA_GAMES: Record<ArenaGameId, ArenaGame> = {
  lightstream: {
    id: 'lightstream', name: 'The Lightstream', icon: 'rocket', to: '/app/race',
    trains: 'Sustained speed under pressure',
    desc: 'Full typing races, the Arena’s main event. CPU rivals matched to your pace, your own ghost, private rooms with friends.',
    // The board ranks pace, so the count column would only repeat the wpm.
    valueLabel: null, unit: (v) => `${v} wpm`, tier: 'competitive',
    hero: { formation: 'stream', tone: ['accent', 'accent2', 0] },
  },
  duel: {
    id: 'duel', name: 'Quill Duel', icon: 'swords', to: '/app/games/duel',
    trains: 'Burst speed under pressure',
    desc: 'Best-of-seven phrase duel against a rival matched to your pace. First to finish each phrase takes the round.',
    valueLabel: 'rounds', unit: plural('round'), tier: 'competitive',
    hero: { formation: 'wave', tone: ['bad', 'accent2', 0.35] },
  },
  survivor: {
    id: 'survivor', name: 'Survivor Sprint', icon: 'crown', to: '/app/games/survivor',
    trains: 'Consistency under pressure',
    desc: 'Eight typists, four rapid heats, the slowest move to the cheer bench each round. Outlast everyone for the crown.',
    valueLabel: 'heats', unit: plural('heat'), tier: 'competitive',
    hero: { formation: 'stream', tone: ['warn', 'gold', 0.4] },
  },
  wordfall: {
    id: 'wordfall', name: 'Wordfall Defence', icon: 'shield', to: '/app/games/wordfall',
    trains: 'Accuracy under pressure',
    desc: 'Words drift toward your light-shield. Careless speed weakens it; calm accuracy saves the city.',
    valueLabel: 'waves', unit: plural('wave'), tier: 'quest',
    hero: { formation: 'scatter', tone: ['accent2', 'accent', 0.55] },
  },
  stack: {
    id: 'stack', name: 'Block Stack', icon: 'blocks', to: '/app/games/stack',
    trains: 'Keeping up your pace',
    desc: 'Beat the pace bar and the tower widens. Fall behind and it narrows until the spire snaps.',
    valueLabel: 'storeys', unit: plural('storey'), tier: 'quest',
    hero: { formation: 'terrace', tone: ['accent2', 'accent', 0.15] },
  },
  cipher: {
    id: 'cipher', name: 'Cipher Run', icon: 'puzzle', to: '/app/games/cipher',
    trains: 'Spelling recall & mapping',
    desc: 'Unscramble rune-words against the clock. Decoding builds the deep letter-map fast typing sits on.',
    valueLabel: 'runes', unit: plural('rune'), tier: 'quest',
    hero: { formation: 'scatter', tone: ['good', 'accent', 0.3] },
  },
  keyforge: {
    id: 'keyforge', name: 'Keyforge', icon: 'hammer', to: '/app/games/keyforge',
    trains: 'Fast, flawless words',
    desc: 'The fire only burns while you type. Misses vent heat, every treasure makes it hungrier. Forge before it goes cold.',
    valueLabel: 'treasures', unit: plural('treasure'), tier: 'quest',
    hero: { formation: 'wave', tone: ['warn', 'bad', 0.45] },
  },
  wordflight: {
    id: 'wordflight', name: 'Wordflight', icon: 'send', to: '/app/games/wordflight',
    trains: 'Rhythm & flow',
    desc: 'A glider that climbs when your rhythm is even and wobbles when you rush. Thread the golden gates.',
    valueLabel: 'gates', unit: plural('gate'), tier: 'quest',
    hero: { formation: 'calm', tone: ['accent2', 'good', 0.5] },
  },
};

export const ARENA_LIST: ArenaGame[] = Object.values(ARENA_GAMES);

/** A game the registry does not know is not rankable, and must not throw. */
export function arenaGame(id: string): ArenaGame | null {
  return (ARENA_GAMES as Record<string, ArenaGame>)[id] ?? null;
}

// ---------------------------------------------------------------------------
// Period buckets
// ---------------------------------------------------------------------------
// Computed from the LEARNER's local calendar rather than the server's, because
// "today's board" is defined by their own midnight. The database only ever sees
// the finished key, and its CHECK constraint is the shape guard.

export type ArenaPeriod = 'today' | 'week' | 'all';

export const ARENA_PERIODS: { v: ArenaPeriod; label: string }[] = [
  { v: 'today', label: 'Today' },
  { v: 'week', label: 'This week' },
  { v: 'all', label: 'All time' },
];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * ISO 8601 week, so the board resets Monday and agrees with what Postgres would
 * compute from the same date. The Thursday trick is the standard definition: the
 * week containing a year's first Thursday is week 1, which is why a January 1st
 * can legitimately belong to week 52 of the previous year.
 */
function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;             // Monday 1 … Sunday 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);     // move to this week's Thursday
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function periodKey(p: ArenaPeriod, now = new Date()): string {
  if (p === 'all') return 'all';
  if (p === 'week') return `w:${isoWeekKey(now)}`;
  return `d:${dayKey(now)}`;
}

/**
 * The bucket before this one, which is what the hub compares against to show
 * movement. All-time has no previous, and saying so beats inventing one.
 */
export function prevPeriodKey(p: ArenaPeriod, now = new Date()): string | null {
  if (p === 'all') return null;
  const back = new Date(now);
  back.setDate(back.getDate() - (p === 'week' ? 7 : 1));
  return periodKey(p, back);
}

/** The two calendar keys every submission writes, whatever period is on screen. */
export function submitKeys(now = new Date()): { day: string; week: string } {
  return { day: dayKey(now), week: isoWeekKey(now) };
}

// ---------------------------------------------------------------------------
// Arena points
// ---------------------------------------------------------------------------
/**
 * The only number that spans games: 100 points for first place, one fewer for
 * each rung below, nothing below 101st. It rewards breadth without pretending a
 * Cipher Run point equals a Lightstream point, and it means the fastest way to
 * move the hub's headline stat is to go and play the game you are worst at.
 */
export function arenaPoints(rank: number | null): number {
  if (!rank || rank < 1) return 0;
  return Math.max(0, 101 - rank);
}

/** Whether this learner may appear on a board of strangers at all. */
export function globalBoardsAllowed(data: ProfileData): boolean {
  return !data.settings.hideLeaderboards && !data.settings.hideGlobalBoards;
}
