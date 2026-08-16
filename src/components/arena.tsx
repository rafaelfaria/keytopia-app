import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { Btn, Chip, Seg } from './ui';
import { Ic } from './icons';
import { Avatar } from './avatars';
import { useData } from '../lib/store';
import { listBoards, type BoardGroup } from '../lib/leaderboard';
import {
  ARENA_PERIODS, arenaGame, globalBoardsAllowed,
  type ArenaGame, type ArenaGameId, type ArenaPeriod,
} from '../lib/arena';
import {
  arenaLive, fetchArenaBoard, submitArena,
  type ArenaBoardResult, type ArenaRow, type ArenaScope, type ArenaSubmitResult,
} from '../lib/arenaBoard';
import { mergeLiveScore, watchArenaBoard, type ArenaScoreEvent } from '../lib/arenaLive';

/**
 * The Arena board kit — one leaderboard system for every mini game.
 *
 * Design: docs/arena-leaderboards.md. Three surfaces are built here, and steps
 * 3 and 5 of the §10 checklist are "render these two components":
 *
 *   <ArenaBoard>   the board itself, live, used by both surfaces and the hub
 *   <ArenaIntro>   the pre-game panel: how to play, beside where you stand
 *   <ArenaResult>  the finish screen, where your row climbs past the rows you beat
 *
 * Four rules run through all of it, and they are worth stating because each one
 * costs something and is worth it:
 *
 *   1. The board never blocks play. Every layout puts the play button above the
 *      board, the board reserves its height so landing data cannot shove the
 *      button, and a board that fails to load leaves the game entirely playable.
 *   2. You are always on screen. Outside the top N your row is pinned below an
 *      explicit gap. A board that drops you reads as "you did not count".
 *   3. Rank is never carried by colour alone. Podium tints decorate a numeral,
 *      movement is an arrow AND a number AND a screen-reader sentence.
 *   4. Motion carries delight, never information. Under reduced motion every
 *      surface renders its final state immediately and nothing is lost.
 */

const DIVISIONS = {
  kid: 'Young Explorers',
  teen: 'Rising Stars',
  adult: 'Open division',
} as const;

const SCOPE_KEY = 'keytopia-arena-scope';
const PERIOD_KEY = 'keytopia-arena-period';

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

/**
 * A rank, always as a numeral. The podium tints are decoration on top of the
 * number, never instead of it, so the board still reads correctly in the
 * high-contrast theme and to anyone who cannot separate gold from bronze.
 */
export function RankBadge({ rank, size = 'md' }: { rank: number | null; size?: 'sm' | 'md' | 'lg' }) {
  if (!rank) return <span className={`arena-rank arena-rank-${size} arena-rank-none`} aria-hidden>·</span>;
  const podium = rank <= 3 ? ` arena-rank-p${rank}` : '';
  return <span className={`arena-rank arena-rank-${size}${podium}`}>{rank}</span>;
}

/**
 * Movement between two ranks. Lower is better, so a smaller number is a climb.
 * The arrow is decorative; the sentence beside it is what actually says so.
 */
export function Movement({ from, to, className = '' }: { from: number | null; to: number | null; className?: string }) {
  if (!to || !from || from === to) return null;
  const up = to < from;
  const n = Math.abs(from - to);
  return (
    <span className={`arena-move ${up ? 'arena-move-up' : 'arena-move-down'} ${className}`}>
      <span aria-hidden>{up ? '▲' : '▼'}{n}</span>
      <span className="sr-only">{up ? `up ${n} places` : `down ${n} places`}</span>
    </span>
  );
}

/** One row. `unit` phrases the game's own count, so a board never says "1 blocks". */
function BoardRow({ r, unit, rowRef }: {
  r: ArenaRow; unit: ((v: number) => string) | null; rowRef?: (el: HTMLLIElement | null) => void;
}) {
  return (
    <li
      ref={rowRef}
      data-alias={r.name}
      className={`arena-row${r.you ? ' arena-row-you' : ''}${r.neighbour ? ' arena-row-near' : ''}${r.rank <= 3 ? ' arena-row-podium' : ''}`}
    >
      <RankBadge rank={r.rank} size="sm" />
      <Avatar v={r.avatar} size={26} className="arena-av" />
      <span className="arena-name">
        {r.name}
        {r.you && <span className="arena-you-tag"> (you)</span>}
      </span>
      <span className="arena-metrics small">
        {r.wpm > 0 && <span>{r.wpm} wpm</span>}
        {r.acc > 0 && <span>{r.acc}%</span>}
        {unit && r.value > 0 && <span>{unit(Math.round(r.value))}</span>}
      </span>
      <span className="arena-score">{r.score}</span>
    </li>
  );
}

/** Reserve the board's height while it loads, so nothing below it jumps. */
function BoardSkeleton({ n = 6 }: { n?: number }) {
  return (
    <ul className="arena-rows arena-rows-skel arena-rows-grow" aria-hidden>
      {Array.from({ length: n }).map((_, i) => <li key={i} className="arena-row arena-skel" />)}
    </ul>
  );
}

/**
 * The places on a board that nobody holds yet.
 *
 * The Lightstream's standings preview established this shape and it is the right
 * one everywhere: numbered rows sit there visibly empty, waiting. A board that
 * simply stops after its two real entries reads as broken, and one that says
 * "nobody has posted a score yet" reads as dead. Empty numbered seats read as an
 * invitation, and they are also what keeps a board the same height whether it
 * holds one learner or fifty.
 *
 * aria-hidden: a screen reader should hear the one sentence underneath, not
 * five empty list items.
 */
function OpenSeats({ from, count }: { from: number; count: number }) {
  if (count <= 0) return null;
  return (
    <ol className="arena-rows arena-seats" start={from} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="arena-row arena-row-open" style={{ ['--i' as string]: i }}>
          <RankBadge rank={from + i} size="sm" />
          <span className="arena-open-av" />
          <span className="arena-open-name" />
          <span className="arena-open-score" />
        </li>
      ))}
    </ol>
  );
}

/** A board nobody has posted to at all: every seat open, and yours already drawn. */
function UnclaimedBoard({ n, me }: { n: number; me: { name: string; avatar: string } }) {
  return (
    <div className="arena-unclaimed arena-rows-grow">
      <OpenSeats from={1} count={n} />
      <ol className="arena-rows">
        <li className="arena-row arena-row-you arena-row-waiting">
          <span className="arena-rank arena-rank-sm arena-rank-none" aria-hidden><Ic n="lock" size={12} /></span>
          <Avatar v={me.avatar} size={26} className="arena-av" />
          <span className="arena-name">{me.name}<span className="arena-you-tag"> (you)</span></span>
          <span className="arena-metrics small">no runs yet</span>
        </li>
      </ol>
      <p className="arena-unclaimed-note">
        <strong>Every place here is unclaimed.</strong> Post the first score and the board opens with you at the top of it.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The board
// ---------------------------------------------------------------------------

export interface ArenaBoardProps {
  game: ArenaGameId;
  /** Hide the period/scope switchers when the surface picks for you. */
  compact?: boolean;
  limit?: number;
  /** Stretch to the height of the column, with the target line at the bottom. */
  fill?: boolean;
  /** Pause the live subscription. Nothing re-renders behind someone typing. */
  paused?: boolean;
  /** Fires whenever the board settles, so a parent can read the standing. */
  onResult?: (r: ArenaBoardResult) => void;
}

export function ArenaBoard({ game, compact, limit = 10, fill, paused, onResult }: ArenaBoardProps) {
  const data = useData();
  const spec = arenaGame(game);

  const [period, setPeriod] = useState<ArenaPeriod>(
    () => (localStorage.getItem(PERIOD_KEY) as ArenaPeriod) || 'today',
  );
  const [groups, setGroups] = useState<BoardGroup[]>([]);
  const [scope, setScope] = useState<ArenaScope>({ kind: 'global' });
  const [result, setResult] = useState<ArenaBoardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchers, setWatchers] = useState(0);
  /**
   * How many rows are on screen. Grows by `limit` on "Show more" and resets
   * whenever the board being asked for changes, because page 3 of yesterday's
   * board is not a position that means anything on today's.
   */
  const [shown, setShown] = useState(limit);

  const profileId = data?.profile.id ?? '';

  // Restore the saved scope only once the groups are known: a saved board the
  // account no longer belongs to has to fall back to global rather than sitting
  // there returning nothing.
  useEffect(() => {
    if (!arenaLive() || !profileId) return;
    let live = true;
    void listBoards(profileId).then((gs) => {
      if (!live) return;
      setGroups(gs);
      const saved = localStorage.getItem(`${SCOPE_KEY}-${profileId}`);
      const found = saved && gs.find((g) => g.id === saved);
      if (found) setScope({ kind: 'board', id: found.id, name: found.name });
    });
    return () => { live = false; };
  }, [profileId]);

  const load = useCallback(async () => {
    if (!data) return;
    const r = await fetchArenaBoard(game, period, scope, data, shown);
    setResult(r);
    setLoading(false);
    onResult?.(r);
    // `data` is deliberately not a dependency: the board depends on which board
    // is being asked for, not on every unrelated store write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, period, scope.kind, scope.kind === 'board' ? scope.id : '', profileId, shown]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  // ----- live -----
  useEffect(() => {
    if (!data || paused || !arenaLive()) return;
    if (scope.kind === 'global' && !globalBoardsAllowed(data)) return;

    const watch = watchArenaBoard(game, period, data.profile.ageGroup, { id: data.profile.id, name: data.profile.name }, {
      onScore: (e) => setResult((cur) => (cur && !cur.simulated ? liveMerge(cur, e) : cur)),
      onSettle: () => { void load(); },
      onWatchers: setWatchers,
    });
    return () => watch.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, period, paused, profileId, load]);

  if (!data || !spec) return null;
  // "Hide leaderboards" means no board, not a board of invented rivals. The
  // fallback path in arenaBoard.ts exists for being offline; honouring the
  // setting by showing a simulated board with a target line was exactly the
  // comparison the learner switched off.
  if (data.settings.hideLeaderboards) return null;

  const pickScope = (v: string) => {
    const next: ArenaScope = v === 'global'
      ? { kind: 'global' }
      : { kind: 'board', id: v, name: groups.find((g) => g.id === v)?.name ?? 'Board' };
    setScope(next);
    setShown(limit);
    localStorage.setItem(`${SCOPE_KEY}-${profileId}`, v === 'global' ? '' : v);
  };

  const pickPeriod = (v: ArenaPeriod) => {
    setPeriod(v);
    setShown(limit);
    localStorage.setItem(PERIOD_KEY, v);
  };

  const rows = result?.rows ?? [];
  const visible = rows.filter((r) => r.rank <= shown);
  // Your row after a gap, when the server appended it from outside the top N.
  const detached = rows.filter((r) => r.rank > shown && (r.you || r.neighbour));
  const more = Math.max(0, (result?.total ?? 0) - shown);
  const scopeValue = scope.kind === 'global' ? 'global' : scope.id;

  return (
    <section className={`arena-board${fill ? ' arena-board-fill' : ''}`} aria-labelledby={`ab-${game}`}>
      <header className="arena-board-head">
        <h3 id={`ab-${game}`}>
          <Ic n="medal" size={16} />{' '}
          {scope.kind === 'global' ? DIVISIONS[data.profile.ageGroup] : scope.name}
        </h3>
        {watchers > 1 && !result?.simulated && (
          <span className="arena-watchers" role="status">
            <i className="arena-pulse" aria-hidden /> {watchers} here now
          </span>
        )}
      </header>

      {!compact && (
        <div className="arena-switches">
          <Seg<ArenaPeriod>
            options={ARENA_PERIODS.map((p) => ({ v: p.v, label: p.label }))}
            value={period} onChange={pickPeriod} ariaLabel="Board period"
          />
          {groups.length > 0 && (
            <Seg
              options={[
                { v: 'global', label: <><Ic n="compass" size={13} /> Global</> },
                ...groups.map((g) => ({ v: g.id, label: <><Ic n="users" size={13} /> {g.name}</> })),
              ]}
              value={scopeValue} onChange={pickScope} ariaLabel="Which board to show"
            />
          )}
        </div>
      )}

      {loading && !result ? (
        <BoardSkeleton n={Math.min(limit, 6)} />
      ) : rows.length === 0 ? (
        <UnclaimedBoard n={Math.min(limit, 5)} me={{ name: data.profile.name, avatar: data.profile.avatar }} />
      ) : (
        // The rows scroll inside the column; the header, the pager and the
        // target line do not. On a short window a ten-row board would otherwise
        // push the play button off screen, and rule 1 says the board never
        // moves the game.
        <div className="arena-scroll">
          <ol className="arena-rows arena-rows-grow">
            {visible.map((r) => <BoardRow key={`${r.name}-${r.rank}`} r={r} unit={spec.valueLabel ? spec.unit : null} />)}
          </ol>
          {/* Pad to the full height with open places. A board that stops after
              two real entries reads as broken; the same board with its
              remaining seats drawn reads as one waiting to be filled. */}
          <OpenSeats from={visible.length + 1} count={shown - visible.length} />
          {detached.length > 0 && (
            <>
              <div className="arena-gap" aria-hidden>···</div>
              <ol className="arena-rows">
                {detached.map((r) => <BoardRow key={`${r.name}-${r.rank}`} r={r} unit={spec.valueLabel ? spec.unit : null} />)}
              </ol>
            </>
          )}
        </div>
      )}

      {more > 0 && (
        <button type="button" className="arena-more" onClick={() => setShown((n) => n + limit)}>
          Show {Math.min(limit, more)} more
          <span className="muted"> · {more} below you</span>
        </button>
      )}

      <TargetLine result={result} />

      <p className="arena-note small muted">
        {result?.simulated ? (
          <><Ic n="bot" size={13} /> Practice rivals, generated on this device. Your score is real and saved.</>
        ) : scope.kind === 'global' && data.profile.ageGroup === 'kid' ? (
          <><Ic n="shield" size={13} /> Young Explorers appear under nicknames. Your real name is never shown to people outside your family and class boards.</>
        ) : scope.kind === 'global' ? (
          <><Ic n="compass" size={13} /> Everyone in your division, worldwide.</>
        ) : (
          <><Ic n="users" size={13} /> Everyone here joined with this board's code.</>
        )}
      </p>
    </section>
  );
}

/**
 * The next rung and what it costs. This line is the centre of gravity of the
 * whole design: a rank with no target is a scoreboard, a rank with a target is
 * a game. It is rendered even when the learner is first, because "nobody is
 * ahead of you" is also an answer.
 */
function TargetLine({ result }: { result: ArenaBoardResult | null }) {
  if (!result || result.rows.length === 0) return null;
  if (result.yourRank === null) {
    return <p className="arena-target arena-target-quiet"><Ic n="target" size={14} /> Post a run to take your place on this board.</p>;
  }
  if (result.yourRank === 1) {
    return <p className="arena-target arena-target-lead"><Ic n="crown" size={14} /> You are first. Everyone else is chasing you.</p>;
  }
  if (!result.target) return null;
  return (
    <p className="arena-target">
      <Ic n="target" size={14} />{' '}
      <strong>{result.target.gap}</strong> {result.target.gap === 1 ? 'point' : 'points'} to pass {result.target.name} at #{result.target.rank}.
    </p>
  );
}

/** Optimistic re-rank from a live message, reusing the board's own row shape. */
function liveMerge(cur: ArenaBoardResult, e: ArenaScoreEvent): ArenaBoardResult {
  const rows = mergeLiveScore<ArenaRow>(cur.rows, e, (ev) => ({
    rank: 0, name: ev.alias, avatar: ev.avatar || 'bk:4',
    wpm: ev.wpm, acc: ev.acc, value: ev.value, score: ev.score,
    you: false, neighbour: false,
  }));
  if (rows === cur.rows) return cur;
  const me = rows.find((r) => r.you) ?? null;
  const withNear = rows.map((r) => ({ ...r, neighbour: me ? Math.abs(r.rank - me.rank) === 1 : false }));
  const above = me ? withNear.find((r) => r.rank === me.rank - 1) : null;
  return {
    ...cur,
    rows: withNear,
    yourRank: me?.rank ?? null,
    target: above && me ? { rank: above.rank, gap: Math.max(1, above.score - me.score + 1), name: above.name } : null,
  };
}

// ---------------------------------------------------------------------------
// The stage — one layout for all three phases
// ---------------------------------------------------------------------------

export interface ArenaStageProps {
  game: ArenaGameId;
  /** Left column: what this screen is about. */
  main: ReactNode;
  /** Right column: where you stand, or the game world. Omitted = single column. */
  side?: ReactNode;
  /** A strip above both columns. The running game's score and clock live here. */
  hud?: ReactNode;
  backTo?: string;
  /**
   * Freeze the backdrop. During play the field keeps its last frame as scenery
   * and stops asking for new ones: nothing should animate, or spend a frame
   * budget, behind someone who is typing.
   */
  quiet?: boolean;
}

/**
 * Every phase of a mini game, in one shell.
 *
 * A game used to change shape three times: a hero page to start, a bordered
 * card to play in, a centred column to finish on. Three layouts for one
 * activity meant the screen reorganised itself twice while you were still in
 * it. The stage fixes the frame and lets only the contents change:
 *
 *   intro   what this is + play      |  the board
 *   run     what to type             |  the game world
 *   over    what you scored          |  the board, and where you landed
 *
 * The backdrop, the way out and the two-column rhythm are constant throughout,
 * so finishing a run feels like the same place you started it.
 */
export function ArenaStage({ game, main, side, hud, backTo = '/app/games', quiet }: ArenaStageProps) {
  const spec = arenaGame(game);
  if (!spec) return null;
  return (
    <div className={`arena-stage${side ? '' : ' arena-stage-solo'}${quiet ? ' arena-stage-quiet' : ''}`}>
      <ArenaHero spec={spec} quiet={quiet} />
      <div className="arena-stage-top">
        <Link to={backTo} className="arena-back">
          <Ic n="chevron-right" size={15} /> Arena
        </Link>
        {hud && <div className="arena-hud">{hud}</div>}
      </div>
      <div className="arena-stage-grid">
        <div className="arena-stage-main">{main}</div>
        {side && <div className="arena-stage-side">{side}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Surface two — the pre-game panel
// ---------------------------------------------------------------------------

export interface ArenaIntroProps {
  game: ArenaGameId;
  /**
   * The invitation, not the game's name. The name is the kicker above it; this
   * line says what to go and do.
   */
  title: string;
  backTo?: string;
  /** The game's own "how to play", in its own voice. */
  children: ReactNode;
  onPlay: () => void;
  /** The game's own call to action. "Lay the first block", not "Start". */
  cta: string;
  /**
   * The learner's own record, as labelled figures rather than a sentence. A
   * personal best is the second thing this screen is for, and a number under a
   * word is read at a glance where "Your tallest: 2 blocks, 220 points" is read
   * as prose or not at all.
   */
  stats?: { label: string; value: ReactNode }[];
}

/**
 * Rules beside standings. The play button sits in the left column above the
 * fold on every breakpoint, and the board is a sibling rather than a gate: on
 * mobile the columns stack with the board BELOW the button, so the first thing
 * a thumb reaches is still the game.
 */
export function ArenaIntro({ game, title, children, onPlay, cta, stats, backTo }: ArenaIntroProps) {
  const data = useData();
  const spec = arenaGame(game);
  if (!spec) return null;
  // With boards switched off the second column has nothing to hold, so the
  // front door becomes a single centred hero rather than a hero beside a gap.
  const boards = !data?.settings.hideLeaderboards;
  return (
    <ArenaStage
      game={game}
      backTo={backTo}
      main={(
        <div className="arena-intro-play">
          <span className="arena-stage-kicker"><Ic n={spec.icon} size={15} /> {spec.name}</span>
          <h2>{title}</h2>
          <div className="arena-intro-body">{children}</div>
          <Chip tone="accent">Trains: {spec.trains}</Chip>
          {stats && stats.length > 0 && (
            <dl className="arena-figures">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <Btn big onClick={onPlay} className="arena-intro-cta">{cta}</Btn>
        </div>
      )}
      side={boards ? (
        /* Ten, so the board is a top ten and the open places below it are a
           top ten waiting to be filled. Anything beyond that is one click away
           rather than scrolled past. */
        <ArenaBoard game={game} limit={10} fill />
      ) : undefined}
    />
  );
}

/**
 * The stage's backdrop: the same keycap field as the landing and the public
 * pages, in this game's formation and hue.
 *
 * Three things make it safe to put WebGL behind a typing game:
 *   - it is imported dynamically, so three.js is not in the bundle any learner
 *     downloads before they open a game;
 *   - it is one InstancedMesh and therefore one draw call, whatever the field
 *     is doing;
 *   - it stops animating while the game is running (`quiet`) and is disposed
 *     when the stage unmounts.
 * Under reduced motion the scene draws a single static frame and never asks for
 * another, so the game still has a front door rather than a blank panel.
 */
function ArenaHero({ spec, quiet }: { spec: ArenaGame; quiet?: boolean }) {
  const data = useData();
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = data?.settings.theme;
  const reduced = data?.settings.reducedMotion ?? false;
  const [hue, setHue] = useState<string | null>(null);
  const handleRef = useRef<{ start(): void; stop(): void; dispose(): void } | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let dead = false;

    void import('../pages/public/heroScene').then(({ createHeroScene }) => {
      if (dead) return;
      const cs = getComputedStyle(document.documentElement);
      const token = (n: string, fallback: string) => cs.getPropertyValue(n).trim() || fallback;
      const [tA, tB, mix] = spec.hero.tone;
      // The game's identity, expressed in the learner's palette. See ArenaGame.hero.
      const resolved = mixHex(token(`--${tA}`, '#14d8c4'), token(`--${tB}`, '#8b7cff'), mix);
      // Hand it to CSS too, so the veil's glow is the same colour as the field
      // rather than a second guess at the game's identity.
      setHue(resolved);
      const h = createHeroScene(canvas, {
        formation: spec.hero.formation,
        hue: resolved,
        hue2: token('--accent2', '#8b7cff'),
        // Live theme tokens, so the field belongs to whichever of the twelve
        // themes the learner is on rather than to the dark one it was born in.
        // Fog is the page floor and the caps are lifted off it, so these have to
        // be the two tokens furthest apart: --bg2 and --surface2 are neighbours
        // in every theme and the field came out as a dark smudge on a dark
        // panel. --bg against --surface2/--border is the separation that makes
        // the keycaps read as objects.
        fog: token('--bg', '#0b1020'),
        surfaceA: token('--surface2', '#1a2244'),
        surfaceB: token('--border', '#242e59'),
        tint: 0.5,
      }, reduced || matchMedia('(prefers-reduced-motion: reduce)').matches);
      handleRef.current = h;
      if (!quiet) h.start();
    }).catch(() => {
      // WebGL refused, three.js failed to load, or the device has no GPU to
      // spare. The panel keeps its flat gradient and nothing else notices.
    });

    return () => { dead = true; handleRef.current?.dispose(); handleRef.current = null; };
    // `quiet` is read on creation and handled by the effect below, so a phase
    // change starts and stops the field rather than rebuilding the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.id, spec.hero.formation, theme, reduced]);

  useEffect(() => {
    const h = handleRef.current;
    if (!h) return;
    if (quiet) h.stop(); else h.start();
  }, [quiet]);

  return (
    <div className="arena-hero" aria-hidden style={hue ? { ['--game-hue' as string]: hue } : undefined}>
      <canvas ref={ref} className="arena-hero-canvas" />
      <span className="arena-hero-veil" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Surface three — the rank reveal
// ---------------------------------------------------------------------------

export interface ArenaResultProps {
  game: ArenaGameId;
  /** What the run produced. `value` is the game's own headline count. */
  run: { wpm: number; acc: number; value?: number };
  /** The game's own score and headline, so its identity survives the shared panel. */
  score: number;
  title: string;
  newBest?: boolean;
  /** Rewards banner, coaching line, anything the game wants under the stats. */
  children?: ReactNode;
  onAgain: () => void;
}

interface Reveal {
  submit: ArenaSubmitResult | null;
  board: ArenaBoardResult | null;
}

/**
 * The finish screen, and the reason arena_submit() returns a ranking rather than
 * an acknowledgement: rank, previous rank, who was overtaken and the gap to the
 * next rung all arrive in the same round trip the score was posted in. Nothing
 * here polls, and nothing flickers between a rank-less state and a ranked one.
 *
 * The sequence is a courtesy, not a gate. Clicking, pressing a key, or having
 * reduced motion on all land immediately on the final state with every piece of
 * information present.
 */
export function ArenaResult({ game, run, score, title, newBest, children, onAgain }: ArenaResultProps) {
  const data = useData();
  const spec = arenaGame(game);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [settled, setSettled] = useState(false);

  const reduced = data?.settings.reducedMotion
    ?? (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const listRef = useRef<HTMLOListElement>(null);
  const rowEls = useRef(new Map<string, HTMLLIElement>());
  const scoreRef = useRef<HTMLSpanElement>(null);

  // Post the run once, then read the board it landed on.
  useEffect(() => {
    if (!data) return;
    let live = true;
    if (data.settings.hideLeaderboards) return;
    void (async () => {
      const submit = await submitArena(data, game, run, 'today');
      if (!live) return;
      const board = await fetchArenaBoard(game, 'today', { kind: 'global' }, data, 8);
      if (live) setReveal({ submit, board });
    })();
    return () => { live = false; };
    // One submission per finished run. Re-running this on a store write would
    // post the same score twice and trip the server's own rate limit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- the count-up -----
  useEffect(() => {
    const el = scoreRef.current;
    if (!el) return;
    if (reduced) { el.textContent = String(score); return; }
    const box = { v: 0 };
    const tw = gsap.to(box, {
      v: score, duration: 0.7, ease: 'expo.out',
      onUpdate: () => { el.textContent = String(Math.round(box.v)); },
    });
    return () => { tw.kill(); };
  }, [score, reduced]);

  /**
   * The row travel. The board arrives in final order, so the reveal renders it
   * with the learner's row placed back at its PREVIOUS rank, measures, swaps to
   * the real order and animates the difference away. Transform only, so the
   * whole thing stays on the compositor.
   */
  const ordered = useMemo(() => {
    const rows = reveal?.board?.rows ?? [];
    if (!rows.length) return { start: [] as ArenaRow[], final: [] as ArenaRow[] };
    const prev = reveal?.submit?.prevRank ?? null;
    const meAt = rows.findIndex((r) => r.you);
    if (meAt < 0 || prev === null || !reveal?.submit || prev === reveal.submit.rank) {
      return { start: rows, final: rows };
    }
    const start = [...rows];
    const [me] = start.splice(meAt, 1);
    start.splice(Math.min(start.length, Math.max(0, prev - 1)), 0, me);
    return { start, final: rows };
  }, [reveal]);

  const [showFinal, setShowFinal] = useState(false);
  const positions = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    if (!ordered.start.length) return;
    if (reduced || ordered.start === ordered.final) { setShowFinal(true); setSettled(true); return; }
    // Measure the starting layout, then flip to the real one on the next frame.
    positions.current.clear();
    rowEls.current.forEach((el, key) => positions.current.set(key, el.offsetTop));
    const t = window.setTimeout(() => setShowFinal(true), 300);
    return () => window.clearTimeout(t);
  }, [ordered, reduced]);

  useLayoutEffect(() => {
    if (!showFinal || reduced || positions.current.size === 0) return;
    const tweens: gsap.core.Tween[] = [];
    rowEls.current.forEach((el, key) => {
      const was = positions.current.get(key);
      if (was === undefined) return;
      const delta = was - el.offsetTop;
      if (!delta) return;
      tweens.push(gsap.fromTo(el, { y: delta }, {
        y: 0, duration: 0.55, ease: 'power3.inOut',
        // The learner's own row leads; the rows it passes settle just behind it.
        delay: el.classList.contains('arena-row-you') ? 0 : 0.09,
      }));
    });
    positions.current.clear();
    const done = window.setTimeout(() => setSettled(true), 700);
    return () => { tweens.forEach((t) => t.kill()); window.clearTimeout(done); };
  }, [showFinal, reduced]);

  // Skipping is a click or a key, and it lands on the same final state.
  useEffect(() => {
    if (settled) return;
    const skip = () => { setShowFinal(true); setSettled(true); };
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [settled]);

  if (!data || !spec) return null;

  const s = reveal?.submit ?? null;
  const board = reveal?.board ?? null;
  const rows = showFinal ? ordered.final : ordered.start;
  const pct = s && s.total > 0 ? Math.max(1, Math.round((s.rank / s.total) * 100)) : null;

  const standing = board && board.rows.length > 0 && !data.settings.hideLeaderboards ? (
    <div className="arena-result-board">
      <h3 className="arena-stage-kicker"><Ic n="medal" size={15} /> Where that puts you</h3>
      <div className="arena-result-standing">
        {s ? (
          <>
            <RankBadge rank={s.rank} size="lg" />
            <span className="arena-result-standing-txt">
              <strong>{ordinal(s.rank)}</strong>
              <span className="muted">of {s.total} today</span>
              {s.prevRank !== null && <Movement from={s.prevRank} to={s.rank} />}
            </span>
          </>
        ) : (
          <span className="arena-result-standing-txt small muted">
            <Ic n="cloud-off" size={14} /> Saved on this device. It joins the board next time you are online.
          </span>
        )}
      </div>

      <ol className="arena-rows arena-rows-reveal" ref={listRef}>
        {rows.map((r) => (
          <BoardRow
            key={r.name}
            r={r}
            unit={spec.valueLabel ? spec.unit : null}
            rowRef={(el) => { if (el) rowEls.current.set(r.name, el); else rowEls.current.delete(r.name); }}
          />
        ))}
      </ol>

      <div className="arena-result-lines">
        {s && s.passed > 0 && (
          <p className="arena-line arena-line-good">
            <Ic n="sparkles" size={14} /> You passed {s.passedName ? <strong>{s.passedName}</strong> : 'somebody'}
            {s.passed > 1 && <> and {s.passed - 1} {s.passed - 1 === 1 ? 'other' : 'others'}</>}.
          </p>
        )}
        {s && s.prevRank !== null && s.rank > s.prevRank && (
          <p className="arena-line">
            {ordinal(s.rank)}, down {s.rank - s.prevRank}. Your best today is still {s.best} points.
          </p>
        )}
        {pct !== null && pct <= 50 && (
          <p className="arena-line arena-line-ribbon">
            <Ic n="medal" size={14} /> Top {pct}% of {DIVISIONS[data.profile.ageGroup]} today
          </p>
        )}
        {/* The next rung, from the server when there is one and from the board
            itself when there is not. Rule 2 does not get suspended because the
            learner is offline: a rank with no target is a scoreboard, and that
            is as true against practice rivals. */}
        {s?.nextRank && s.nextGap ? (
          <p className="arena-line arena-line-target">
            <Ic n="target" size={14} /> <strong>{s.nextGap}</strong> more {s.nextGap === 1 ? 'point' : 'points'} to reach #{s.nextRank}.
          </p>
        ) : !s && board.target ? (
          <p className="arena-line arena-line-target">
            <Ic n="target" size={14} /> <strong>{board.target.gap}</strong> more {board.target.gap === 1 ? 'point' : 'points'} to pass {board.target.name} at #{board.target.rank}.
          </p>
        ) : null}
        {board.simulated && (
          <p className="arena-line small muted"><Ic n="bot" size={13} /> Practice rivals. Your score is real and saved.</p>
        )}
      </div>
    </div>
  ) : undefined;

  // The same two columns as the intro: what this screen is about on the left,
  // where you stand on the right. The finish screen used to be one long centred
  // stack, which is why it read as a different page from the one you pressed
  // play on.
  return (
    <ArenaStage
      game={game}
      quiet={false}
      side={standing}
      main={(
        <div className={`arena-result${settled ? ' arena-result-settled' : ''}`}>
          <span className="arena-stage-kicker"><Ic n={spec.icon} size={15} /> {spec.name}</span>
          <h2>
            <span className="arena-result-ic"><Ic n={newBest ? 'trophy' : spec.icon} size={26} /></span>
            {title}
          </h2>
          {newBest && <Chip tone="gold"><Ic n="trophy" size={12} /> New personal best</Chip>}

          <div className="arena-result-score">
            <span className="arena-result-num" ref={scoreRef}>0</span>
            <span className="arena-result-num-l">points</span>
          </div>

          <dl className="arena-figures">
            <div><dt>words / min</dt><dd>{Math.round(run.wpm)}</dd></div>
            <div><dt>accuracy</dt><dd>{Math.round(run.acc)}%</dd></div>
            {spec.valueLabel && run.value !== undefined && (
              <div><dt>{spec.valueLabel}</dt><dd>{Math.round(run.value)}</dd></div>
            )}
          </dl>

          {children && <div className="arena-result-extras">{children}</div>}

          {/* One sentence, once, when everything has landed. Announcing each
              beat would narrate an animation instead of reporting a result. */}
          <p className="sr-only" role="status">
            {settled && s ? `${ordinal(s.rank)} of ${s.total} today, ${score} points.` : ''}
          </p>

          <div className="row gap arena-result-cta">
            <Btn big onClick={onAgain}>↻ Play again</Btn>
            <Btn kind="soft" to="/app/games">All games</Btn>
          </div>
        </div>
      )}
    />
  );

}

/**
 * Blend two CSS colours in sRGB. Deliberately tiny and hex-only: the theme
 * tokens in base.css are all `#rrggbb`, three.js wants a concrete colour, and
 * `color-mix()` cannot be read back out of getComputedStyle as one.
 */
function mixHex(a: string, b: string, t: number): string {
  const parse = (h: string) => {
    const v = h.replace('#', '').trim();
    const full = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
    const n = parseInt(full.slice(0, 6), 16);
    return Number.isNaN(n) ? [20, 216, 196] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const k = Math.max(0, Math.min(1, t));
  const to = (x: number, y: number) => Math.round(x + (y - x) * k).toString(16).padStart(2, '0');
  return `#${to(r1, r2)}${to(g1, g2)}${to(b1, b2)}`;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
