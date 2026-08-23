import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useData, useStore, useUi } from '../lib/store';
import { COMMON_WORDS, KID_WORDS, RACER_NAMES } from '../lib/words';
import { mulberry32, pick, shuffle, avatarIndexFor } from '../lib/rng';
import { Btn } from '../components/ui';
import { resultFromStrokes, type GameStroke } from '../components/typing';
import { snd } from '../lib/sound';
import { RewardsBanner } from '../components/ResultsPanel';
import { ArenaIntro, ArenaResult, ArenaStage } from '../components/arena';
import { arenaRunFigures } from '../lib/arenaBoard';
import { Ic } from '../components/icons';
import { Avatar, BlockAvatar } from '../components/avatars';
import { MobileKeys, useGameKeys } from '../components/gamekit';
import type { Rewards } from '../lib/types';

/**
 * Tide Line — the Arena's first competitive game with a decision in it.
 *
 * A shore of word tiles, you against one rival, and the tide coming in from the
 * bottom a row at a time. Type any tile's word and your light is planted there.
 * A tile taken next to one you already hold is worth two lights instead of one,
 * so the cheap three-letter word in the far corner is often the wrong move, and
 * every board state asks a question that raw speed cannot answer.
 *
 * There is no cursor and nothing to click. You type into the whole shore at
 * once: every unclaimed word starting with what you have typed stays lit, and
 * the moment one matches exactly it is yours. Typing a letter no lit tile wants
 * is a miss, and the run of letters you had going is lost with it. Committing to
 * a word before you start it is the skill this trains.
 */

/**
 * How long a row of shore lasts.
 *
 * The tide has to be a force in the game rather than a backstop that fires
 * after it is decided. Two players working at a few seconds a tile clear a
 * shore in roughly `tiles × 3` seconds between them, so the water is set to
 * arrive a little after that: it reliably takes the last row or two, and it
 * takes more than that from anyone who spent the early game in a corner.
 */
const TIDE_MS = { kid: 9000, other: 11000 };

/**
 * A beat to choose, before every tile.
 *
 * Without it the rival is the only player here with no cost for deciding: it
 * reads the whole shore instantly and starts the next word in the frame it
 * finished the last, while a human is still looking. An idle board went to the
 * rival 23-0 inside forty seconds. Together with its wpm this is what the
 * ranked pace actually paces, and it is deliberately close to what a person
 * spends: roughly a second and a half, which is why a 20 wpm human still takes
 * a real share of the shore off a 30 wpm rival.
 */
const RIVAL_THINK = { base: 1400, spread: 800 };

/**
 * The board's own formula, mirrored so the number counting up on the finish
 * screen is the number that lands on the row underneath it. Must stay in step
 * with the `tideline` branch of `arena_score()`
 * (supabase/migrations/20260820091000_tide_line.sql).
 */
const tideScore = (lights: number, wpm: number) => {
  const f = arenaRunFigures({ wpm, acc: 100, value: lights });
  return Math.round(f.value * 60 + f.wpm * 5);
};

type Diff = 'gentle' | 'steady' | 'sharp' | 'fierce';

const DIFFS: { id: Diff; name: string; wpm: number; icon: string; desc: string }[] = [
  { id: 'gentle', name: 'Gentle', wpm: 18, icon: 'sprout', desc: 'Learning the shore' },
  { id: 'steady', name: 'Steady', wpm: 30, icon: 'moon', desc: 'Everyday typist' },
  { id: 'sharp', name: 'Sharp', wpm: 48, icon: 'sparkles', desc: 'Takes the good tiles first' },
  { id: 'fierce', name: 'Fierce', wpm: 70, icon: 'flame', desc: 'You will be fighting for scraps' },
];

/**
 * The one pace that posts. Every other pace is practice.
 *
 * The reason is the Lightstream's rather than the duel's. A slow rival here does
 * not simply hand over rounds, it leaves most of the shore standing, and lights
 * you took because nobody was competing for them are not the same lights. Same
 * per-division split as Quill Duel, for the same reason: boards already divide
 * on age, and a kid's shore is smaller.
 */
const RANKED_PACE: Record<'kid' | 'teen' | 'adult', Diff> = {
  kid: 'steady',
  teen: 'sharp',
  adult: 'sharp',
};

type Owner = null | 'you' | 'rival' | 'tide';

interface Tile {
  word: string;
  owner: Owner;
  /** Whether the claim chained off a tile the same player already held. */
  chained: boolean;
}

/**
 * A shore no word on which is a prefix of another.
 *
 * Without this rule a grid holding both "in" and "into" has a tile that can
 * never be claimed: the exact match fires on the shorter word every time. It is
 * the one constraint the typing model needs, and it is cheap to satisfy.
 */
function buildShore(rng: () => number, size: number, kid: boolean): Tile[] {
  const pool = shuffle(rng, (kid ? KID_WORDS : COMMON_WORDS).filter((w) => w.length >= 3 && w.length <= (kid ? 5 : 7)));
  const words: string[] = [];
  for (const w of pool) {
    if (words.length >= size * size) break;
    if (words.some((x) => x.startsWith(w) || w.startsWith(x))) continue;
    words.push(w);
  }
  return words.map((word) => ({ word, owner: null as Owner, chained: false }));
}

export default function TideLineGame() {
  const data = useData();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const kid = data?.profile.ageGroup === 'kid';
  const size = kid ? 4 : 5;
  const tideMs = kid ? TIDE_MS.kid : TIDE_MS.other;
  const tideSecs = Math.round(tideMs / 1000);
  const rng = useRef(mulberry32(Date.now() % 1e9));

  const rival = useMemo(() => {
    const name = pick(mulberry32(Date.now() % 1e6), RACER_NAMES);
    return { name, avatar: avatarIndexFor(name) };
  }, [data?.profile.id]);

  const rankedId = RANKED_PACE[data?.profile.ageGroup ?? 'adult'];
  const rankedDiff = DIFFS.find((d) => d.id === rankedId)!;
  const practiceDiffs = DIFFS.filter((d) => d.id !== rankedId);
  const [diff, setDiff] = useState<Diff>(rankedId);
  const isRanked = diff === rankedId;
  const rivalWpm = DIFFS.find((d) => d.id === diff)!.wpm;

  const [phase, setPhase] = useState<'intro' | 'live' | 'over'>('intro');
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [buffer, setBuffer] = useState('');
  const [lights, setLights] = useState({ you: 0, rival: 0 });
  const [waterRow, setWaterRow] = useState(size);
  /**
   * How far the water has climbed, in rows, as a fraction.
   *
   * Separate from `waterRow` on purpose. This one is what the eye reads and it
   * moves continuously; `waterRow` is how many rows are still *playable*, and it
   * only changes when the water has completely covered one. A tile stays yours
   * to take while the water is lapping over it, which is the tension the
   * row-at-a-time version threw away by taking four tiles in a single frame.
   */
  const [waterLevel, setWaterLevel] = useState(0);
  const [miss, setMiss] = useState(0);
  const [overInfo, setOverInfo] = useState<{
    won: boolean; lights: number; rivalLights: number; acc: number; wpm: number; rewards: Rewards | null; ranked: boolean;
  } | null>(null);

  // Refs carry everything the key handler and the two timers touch. Both run
  // outside React's render, and a stale tile grid would let a claimed tile be
  // claimed twice.
  const tilesRef = useRef<Tile[]>([]);
  const bufferRef = useRef('');
  const phaseRef = useRef<typeof phase>('intro');
  const lightsRef = useRef({ you: 0, rival: 0 });
  const waterRef = useRef(size);
  const tideFrom = useRef(0);
  const rivalWpmRef = useRef(rivalWpm);
  const diffRef = useRef(diff);
  const strokes = useRef<GameStroke[]>([]);
  const startedAt = useRef(0);
  const rivalTarget = useRef<{ index: number; typed: number } | null>(null);
  const gameTimer = useRef(0);
  const tideTimer = useRef(0);
  const done = useRef(false);

  rivalWpmRef.current = rivalWpm;
  diffRef.current = diff;
  const setPhaseBoth = (p: typeof phase) => { phaseRef.current = p; setPhase(p); };

  const clearTimers = () => {
    window.clearInterval(gameTimer.current);
    window.clearInterval(tideTimer.current);
  };
  useEffect(() => clearTimers, []);

  const neighbours = useCallback((i: number) => {
    const r = Math.floor(i / size);
    const c = i % size;
    const out: number[] = [];
    if (r > 0) out.push(i - size);
    if (r < size - 1) out.push(i + size);
    if (c > 0) out.push(i - 1);
    if (c < size - 1) out.push(i + 1);
    return out;
  }, [size]);

  /** One claim path for both players, so the chain rule cannot drift apart. */
  const claim = useCallback((index: number, who: 'you' | 'rival') => {
    const t = tilesRef.current[index];
    if (!t || t.owner) return;
    const chained = neighbours(index).some((n) => tilesRef.current[n].owner === who);
    tilesRef.current = tilesRef.current.map((x, i) => (i === index ? { ...x, owner: who, chained } : x));
    setTiles(tilesRef.current);
    const worth = chained ? 2 : 1;
    lightsRef.current = { ...lightsRef.current, [who]: lightsRef.current[who] + worth };
    setLights(lightsRef.current);
    if (who === 'you' && data?.settings.soundOn) (chained ? snd.step() : snd.pop());
  }, [neighbours, data?.settings.soundOn]);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    clearTimers();
    const you = lightsRef.current.you;
    const foe = lightsRef.current.rival;
    const won = you > foe;
    const pace = diffRef.current;
    const ranked = pace === rankedId;
    const result = resultFromStrokes(
      'game', 'Tide Line', strokes.current, startedAt.current, performance.now(),
      { game: 'tideline', won, lights: you, difficulty: pace },
    );
    const rewards = strokes.current.length > 10 ? recordSession(result) : null;
    // The personal best tracks the ranked shore only. A Gentle rival leaves
    // nearly every tile standing, so a practice run would set a best the real
    // game could never reach.
    if (ranked) {
      patch((s) => {
        const cur = s.gameBests['tideline'];
        const score = tideScore(you, result.wpm);
        if (!cur || score > cur.score) s.gameBests['tideline'] = { score, level: you };
      });
    }
    if (won) pushToast({ kind: 'record', icon: 'waves', title: 'Shore held!', body: `${you} ${you === 1 ? 'light' : 'lights'} to ${foe} against ${rival.name}` });
    if (data?.settings.soundOn) (won ? snd.badge() : snd.done());
    setOverInfo({ won, lights: you, rivalLights: foe, acc: result.acc, wpm: result.wpm, rewards, ranked });
    setPhaseBoth('over');
  }, [rankedId, rival.name, data?.settings.soundOn, recordSession, patch, pushToast]);

  /**
   * The water climbing, and the row it locks behind it.
   *
   * Two jobs that used to be one. The level rises every tick so the shore is
   * visibly going under; a row is only taken at the moment the water covers it
   * completely, which is what makes "I can still get that one" a real thought
   * for the nine seconds beforehand.
   */
  const tideTick = useCallback(() => {
    const rowsUnder = (performance.now() - tideFrom.current) / tideMs;
    setWaterLevel(Math.min(size, rowsUnder));
    const dry = size - Math.floor(rowsUnder);
    if (dry >= waterRef.current) return;      // still lapping at the same row
    waterRef.current = dry;
    setWaterRow(dry);
    if (dry < 0) { finish(); return; }
    tilesRef.current = tilesRef.current.map((t, i) => (
      Math.floor(i / size) >= dry && !t.owner ? { ...t, owner: 'tide' as Owner } : t
    ));
    setTiles(tilesRef.current);
    if (tilesRef.current.every((t) => t.owner)) finish();
  }, [size, tideMs, finish]);

  const start = () => {
    clearTimers();
    done.current = false;
    strokes.current = [];
    startedAt.current = performance.now();
    tilesRef.current = buildShore(rng.current, size, kid);
    bufferRef.current = '';
    lightsRef.current = { you: 0, rival: 0 };
    waterRef.current = size;
    tideFrom.current = performance.now();
    rivalTarget.current = null;
    setTiles(tilesRef.current);
    setBuffer('');
    setLights({ you: 0, rival: 0 });
    setWaterRow(size);
    setWaterLevel(0);
    setOverInfo(null);
    setPhaseBoth('live');

    // 80ms, not the tide's own period: the water is drawn from the clock every
    // tick so it creeps, and the lock is a threshold crossing inside that.
    tideTimer.current = window.setInterval(tideTick, 80);

    // The rival types on a wall-clock accumulator, so its pace does not change
    // with the frame rate or with how loaded the tab is.
    let lastTick = performance.now();
    let stunnedUntil = 0;
    gameTimer.current = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - lastTick) / 1000;
      lastTick = now;
      if (phaseRef.current !== 'live' || now < stunnedUntil) return;

      const free = tilesRef.current
        .map((t, i) => ({ t, i }))
        .filter((x) => !x.t.owner && Math.floor(x.i / size) < waterRef.current);
      if (!free.length) { finish(); return; }

      let target = rivalTarget.current;
      if (!target || tilesRef.current[target.index].owner) {
        stunnedUntil = now + RIVAL_THINK.base + rng.current() * RIVAL_THINK.spread;
        // Chains first, exactly as a good human would: a tile beside one it
        // already holds is worth double, so a longer word there beats a short
        // one alone in a corner.
        const chaining = free.filter((x) => neighbours(x.i).some((n) => tilesRef.current[n].owner === 'rival'));
        const from = chaining.length ? chaining : free;
        const best = from.reduce((a, b) => (b.t.word.length < a.t.word.length ? b : a));
        target = { index: best.i, typed: 0 };
        rivalTarget.current = target;
        return;
      }

      // An occasional stumble, so a rival is never a metronome.
      if (rng.current() < 0.03) { stunnedUntil = now + 250 + rng.current() * 800; return; }
      const cps = (rivalWpmRef.current * 5) / 60;
      target.typed += cps * dt * (0.85 + rng.current() * 0.3);
      if (target.typed >= tilesRef.current[target.index].word.length) {
        claim(target.index, 'rival');
        rivalTarget.current = null;
        if (tilesRef.current.every((t) => t.owner)) finish();
      }
    }, 70);
  };

  const handleKey = (key: string) => {
    if (phaseRef.current !== 'live' || key.length !== 1) return;
    const ch = key.toLowerCase();
    const live = tilesRef.current
      .map((t, i) => ({ t, i }))
      .filter((x) => !x.t.owner && Math.floor(x.i / size) < waterRef.current);
    const next = bufferRef.current + ch;
    const hits = live.filter((x) => x.t.word.startsWith(next));

    if (!hits.length) {
      // The expected key is whatever the word they were most plausibly typing
      // wanted next, so the miss lands on a real key in their own analytics
      // rather than on whichever wrong one they hit.
      const inProgress = live.filter((x) => x.t.word.startsWith(bufferRef.current));
      const exp = inProgress.length ? inProgress[0].t.word[bufferRef.current.length] : ch;
      strokes.current.push({ t: performance.now(), exp, ok: false });
      bufferRef.current = '';
      setBuffer('');
      setMiss((m) => m + 1);
      if (data?.settings.soundOn) snd.err();
      return;
    }

    strokes.current.push({ t: performance.now(), exp: ch, ok: true });
    bufferRef.current = next;
    setBuffer(next);
    if (data?.settings.soundOn) snd.key();

    const exact = hits.find((x) => x.t.word === next);
    if (exact) {
      claim(exact.i, 'you');
      bufferRef.current = '';
      setBuffer('');
      if (tilesRef.current.every((t) => t.owner)) finish();
    }
  };

  useGameKeys(phase === 'live', handleKey, {
    onEscape: finish,
    onBackspace: () => { bufferRef.current = ''; setBuffer(''); },
  });

  if (!data) return null;

  if (phase === 'intro') {
    const best = data.gameBests['tideline'];
    return (
      <ArenaIntro
        game="tideline"
        title="Take the shore before the tide does"
        onPlay={start}
        cta="Wade in →"
        stats={[
          { label: 'Shore', value: `${size * size} tiles` },
          { label: 'Tide rises', value: `every ${tideSecs}s` },
          ...(best ? [{ label: 'Best ranked shore', value: `${best.level} ${best.level === 1 ? 'light' : 'lights'}` }] : []),
        ]}
      >
        <p>
          Every tile holds a word. Type one and your light is planted there, and a tile
          touching one you already hold is worth <strong>two lights instead of one</strong>.
        </p>
        <p>
          Just start typing. Every word that begins that way stays lit, and a letter none
          of them wants costs you the ones you had going. The tide never stops climbing, and a row it
          covers is gone for both of you. That is about {tideSecs} seconds a row.
          Today's rival is <strong>{rival.name}</strong>.
        </p>

        <p className="pace-group-label"><Ic n="medal" size={13} /> The ranked shore</p>
        <div className="duel-diffs duel-diffs-ranked" role="radiogroup" aria-label="The ranked rival">
          <button
            type="button"
            className={`opt-tile duel-diff opt-tile-ranked ${isRanked ? 'on' : ''}`}
            onClick={() => setDiff(rankedId)}
            aria-pressed={isRanked}
            title={rankedDiff.desc}
          >
            <span className="opt-ic"><Ic n={rankedDiff.icon} size={17} /></span>
            <span>
              <strong>{rankedDiff.name} · {rankedDiff.wpm} wpm</strong>
              <small>This is the one that reaches the board</small>
            </span>
          </button>
        </div>

        <p className="pace-group-label"><Ic n="sliders" size={13} /> Practice, nothing posted</p>
        <div className="duel-diffs" role="radiogroup" aria-label="Practice rival pace">
          {practiceDiffs.map((d) => (
            <button
              key={d.id} type="button"
              className={`opt-tile duel-diff ${diff === d.id ? 'on' : ''}`}
              onClick={() => setDiff(d.id)}
              aria-pressed={diff === d.id}
              title={d.desc}
            >
              <span className="opt-ic"><Ic n={d.icon} size={17} /></span>
              <span>
                <strong>{d.name} · {d.wpm} wpm</strong>
                <small>{d.desc}</small>
              </span>
            </button>
          ))}
        </div>
      </ArenaIntro>
    );
  }

  if (phase === 'over' && overInfo) {
    const drowned = tiles.filter((t) => t.owner === 'tide').length;
    return (
      <ArenaResult
        game="tideline"
        run={{ wpm: overInfo.wpm, acc: overInfo.acc, value: overInfo.lights }}
        score={tideScore(overInfo.lights, overInfo.wpm)}
        ranked={overInfo.ranked}
        practiceHint="Play the ranked shore when you want a place on the board."
        title={overInfo.won
          ? `Shore yours, ${overInfo.lights} ${overInfo.lights === 1 ? 'light' : 'lights'} to ${overInfo.rivalLights}`
          : `${rival.name} holds it, ${overInfo.rivalLights} to ${overInfo.lights}`}
        newBest={overInfo.won}
        onAgain={start}
      >
        <RewardsBanner rewards={overInfo.rewards} />
        <p className="small muted" style={{ maxWidth: 440 }}>
          {drowned > (size * size) / 3
            ? `The tide took ${drowned} tiles nobody reached. Work along one edge and the chains come cheaper than the sprint does.`
            : overInfo.won
              ? 'Well read. Chained tiles are what did that, not the ones you got to first.'
              : 'Try building out from a single corner. Two lights a tile beats one, every time.'}
        </p>
        <Btn kind="soft" onClick={() => setPhaseBoth('intro')}>Change rival pace</Btn>
      </ArenaResult>
    );
  }

  return (
    <>
      <ArenaStage
        game="tideline"
        quiet
        hud={(
          <>
            <span className="row gap"><Avatar v={data.profile.avatar} size={22} /> {lights.you}</span>
            <span className="tl-bar" aria-label={`You ${lights.you} lights, ${rival.name} ${lights.rival}`}>
              <i className="tl-bar-you" style={{ flexGrow: Math.max(1, lights.you) }} />
              <i className="tl-bar-foe" style={{ flexGrow: Math.max(1, lights.rival) }} />
            </span>
            <span className="row gap">{lights.rival} <BlockAvatar preset={rival.avatar} size={22} /></span>
            <span className="grow" />
            {/* What is left to play on, not where the water is.
                "Tide at row 3 of 4" counted DOWN while the water climbed UP,
                so the one number on screen contradicted the one thing moving
                and read as the tide going out. */}
            <span className="tl-dry">
              <Ic n="waves" size={14} />
              {waterRow > 1
                ? `${waterRow} rows still dry`
                : waterRow === 1 ? 'Last dry row' : 'The tide has it'}
            </span>
          </>
        )}
        main={(
          <div className="tl-arena">
            <div
              className="tl-grid"
              style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
              aria-label="The shore"
            >
              {tiles.map((t, i) => {
                const row = Math.floor(i / size);
                const flooded = row >= waterRow;
                const matched = !t.owner && !flooded && buffer.length > 0 && t.word.startsWith(buffer);
                const dimmed = !t.owner && !flooded && buffer.length > 0 && !matched;
                return (
                  <span
                    key={i}
                    className={[
                      'tl-tile',
                      t.owner ? `tl-${t.owner}` : '',
                      t.chained ? 'tl-chained' : '',
                      matched ? 'tl-match' : '',
                      dimmed ? 'tl-dim' : '',
                      flooded && !t.owner ? 'tl-flooded' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {/* A drowned tile keeps its word, struck through. Swapping
                        in a wave icon deleted the one piece of information the
                        moment is about: which word you just lost, and whether
                        it was the one you were reaching for. */}
                    {matched
                      ? <><b>{t.word.slice(0, buffer.length)}</b>{t.word.slice(buffer.length)}</>
                      : t.word}
                    {t.chained && t.owner !== 'tide' && <i className="tl-chain-dot" aria-label="chained, worth two" />}
                  </span>
                );
              })}
              <span className="tl-water" style={{ height: `${Math.min(100, (waterLevel / size) * 100)}%` }} aria-hidden />
            </div>
            <div className={`tl-buffer ${miss ? 'tl-buffer-live' : ''}`} key={miss} aria-live="off">
              {buffer ? <span className="tl-typed">{buffer}</span> : <span className="small muted">Start any word on the shore</span>}
            </div>
          </div>
        )}
      />
      <MobileKeys active={phase === 'live'} />
    </>
  );
}
