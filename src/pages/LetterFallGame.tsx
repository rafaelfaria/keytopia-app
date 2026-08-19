import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useData, useStore, useUi } from '../lib/store';
import { mulberry32, pick } from '../lib/rng';
import { Chip } from '../components/ui';
import { resultFromStrokes, type GameStroke } from '../components/typing';
import { snd } from '../lib/sound';
import { RewardsBanner } from '../components/ResultsPanel';
import { ArenaIntro, ArenaResult, ArenaStage } from '../components/arena';
import { StarterScene } from '../components/starterScenes';
import { LevelPicker, LevelResult, useStarterLadder } from '../components/starterLevels';
import { Ic } from '../components/icons';
import { MobileKeys, useGameKeys } from '../components/gamekit';
import { KeyboardVisual } from '../components/KeyboardVisual';
import { FINGER_NAMES, makeCharLookup } from '../lib/keyboard';
import { floatText, sparkBurst } from '../lib/fx';
import type { GuideStyle, Rewards } from '../lib/types';

/**
 * Letter Fall — the first game, for a player who cannot type yet.
 *
 * Wordfall Defence is the same sky with words in it, and a seven year old
 * cannot play it: finding one letter on a keyboard takes them several seconds,
 * so a five letter word under a draining shield is over before the search for
 * its first key has finished. Everything here follows from that one fact.
 *
 *   One letter at a time.       A word is a search repeated five times.
 *   The keyboard is on screen.  The game IS finding the key. Hiding the map
 *                               and calling that difficulty teaches nothing.
 *   A wrong key costs nothing.  Wrong presses are how a child searches. They
 *                               are recorded, because that is real data about
 *                               which keys they cannot find, but they never
 *                               take points, speed or a life.
 *   No clock, anywhere.         The run ends after three letters have landed,
 *                               and nothing else ends it.
 *
 * The countable a run accumulates is letters caught, and each one plants a
 * flower on the ground. A miss is a flower that did not get planted rather than
 * damage to something you were defending.
 */

/** Flower colours, reused for the falling seeds so a catch keeps its colour. */
const PETALS = ['#ff8fa3', '#ffb26b', '#ffd166', '#7dd8a0', '#5fc9e0', '#8b9cf5', '#c99cf5'];

const PATCH = 6;        // catches per garden row, and the width of a bed row
const MAX_MISS = 3;     // letters allowed to land before the run ends
const GROUND = 88;      // height of the grass strip, in px (matches .lf-ground)
const BED_ROWS = 3;     // rows in the bed before it starts a second layer

interface Seed { id: number; ch: string; x: number; y: number; speed: number; tint: number; caught?: boolean; wobble: number }
/**
 * A planted flower. `slot` rather than an x: a garden that grows in rows, left
 * to right and then forward, reads as progress in a way a scatter of flowers at
 * whatever x the letter happened to fall at does not. It also makes the line
 * "4 more to grow a row" literally true on screen.
 */
interface Flower { id: number; slot: number; tint: number }

/** Where a slot sits in the bed: six across, three rows deep, front row last. */
function bedSpot(slot: number) {
  const n = slot % (PATCH * BED_ROWS);
  const col = n % PATCH;
  const row = Math.floor(n / PATCH);
  return {
    x: 10 + col * (80 / (PATCH - 1)),
    // Rows fill back to front, so the newest flowers are the nearest ones.
    bottom: 54 - row * 24,
    scale: 0.82 + row * 0.09,
    z: row + 1,
    // A garden planted on a grid is a car park. Three pixels of jitter, derived
    // from the slot so it never moves once planted.
    nudge: ((slot * 37) % 7) - 3,
  };
}

export default function LetterFallGame() {
  const data = useData();
  const recordSession = useStore((s) => s.recordSession);
  const patchData = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const [phase, setPhase] = useState<'intro' | 'run' | 'over'>('intro');
  const [, force] = useState(0);
  const [press, setPress] = useState<{ key: string; ok: boolean; t: number } | null>(null);
  const [overInfo, setOverInfo] = useState<
    { score: number; caught: number; best: number; acc: number; wpm: number; rewards: Rewards | null;
      newBest: boolean; level: number; goal: number; unlocked: boolean } | null
  >(null);

  const st = useRef({
    seeds: [] as Seed[],
    flowers: [] as Flower[],
    nextId: 1, score: 0, caught: 0, missed: 0, streak: 0, bestStreak: 0,
    // The bed slot the gardener is standing over, waiting to plant. It advances
    // when a flower actually opens, not when the letter is caught, so the cat
    // never walks off while the letter is still in the air toward it.
    plantSlot: 0,
    targetId: 0, targetSince: 0, tries: 0,
    strokes: [] as GameStroke[],
    startedAt: 0, lastSpawn: 0, lastTick: 0,
    rng: mulberry32(Date.now() % 1e9),
  });
  const boardRef = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  const endedRef = useRef(false);
  const pressTimer = useRef(0);
  const bloomTimers = useRef<number[]>([]);

  const { level, cleared, chosen, setChosen, clear, total } = useStarterLadder('letterfall');
  const GOAL = level.goal;

  const layout = data?.profile.layout ?? 'qwerty';
  const lookup = useMemo(() => makeCharLookup(layout), [layout]);
  /**
   * The keyboard is never hidden here, whatever the profile's guide setting
   * says. That setting is about weaning a reader off the map; this player has
   * not read the map yet, and a blank keyboard would simply end the game.
   */
  const guide: GuideStyle = data?.settings.guide === 'hidden' ? 'plain' : (data?.settings.guide ?? 'hands');

  const patchOf = (caught: number) => Math.floor(caught / PATCH);

  const spawn = useCallback(() => {
    const s = st.current;
    const chars = level.chars ?? 'fjdk';
    // Two seeds in the same column are two seeds a child cannot tell apart, and
    // the one they are hunting for is whichever they did not look at.
    let x = 12 + s.rng() * 76;
    for (let i = 0; i < 6; i++) {
      if (!s.seeds.some((w) => !w.caught && Math.abs(w.x - x) < 22)) break;
      x = 12 + s.rng() * 76;
    }
    s.seeds.push({
      id: s.nextId++,
      ch: pick(s.rng, chars.split('')),
      x,
      // Just inside the top edge. Spawning above the board meant the letter was
      // named in the band a full two seconds before it could be seen in the
      // sky, which is the same dead air by another route.
      y: 2,
      // Slow, and barely faster later. The garden growing is the progression;
      // speed is only enough that a run does not feel identical at flower 40.
      // The level sets the pace; inside a level it only creeps.
      speed: 16 * (level.speed ?? 1) * Math.min(1.35, 1 + patchOf(s.caught) * 0.05),
      tint: Math.floor(s.rng() * PETALS.length),
      wobble: s.rng() * 6.28,
    });
  }, []);

  const endGame = useCallback(() => {
    const s = st.current;
    if (endedRef.current || !s.startedAt) return;
    endedRef.current = true;
    window.clearInterval(timer.current);
    const result = resultFromStrokes('game', 'Letter Fall', s.strokes, s.startedAt, performance.now(), {
      game: 'letterfall', score: s.score, caught: s.caught,
    });
    const rewards = s.strokes.length > 6 ? recordSession(result) : null;
    let newBest = false;
    patchData((d) => {
      const cur = d.gameBests['letterfall'];
      if (!cur || s.score > cur.score) { d.gameBests['letterfall'] = { score: s.score, level: s.caught }; newBest = true; }
    });
    if (newBest) pushToast({ kind: 'record', icon: 'trophy', title: 'New Letter Fall best!' });
    const won = s.caught >= GOAL;
    if (won) {
      clear(chosen);
      if (chosen === cleared + 1) pushToast({ kind: 'record', icon: 'map', title: `Level ${chosen} done!` });
    }
    setOverInfo({
      score: s.score, caught: s.caught, best: s.bestStreak,
      acc: result.acc, wpm: result.wpm, rewards, newBest,
      level: chosen, goal: GOAL, unlocked: won,
    });
    setPhase('over');
  }, [recordSession, patchData, pushToast]);

  const loop = useCallback((t: number) => {
    const s = st.current;
    const board = boardRef.current;
    if (!board || endedRef.current) return;
    const h = board.clientHeight;
    const dt = Math.min(0.05, (t - s.lastTick) / 1000 || 0.016);
    s.lastTick = t;

    const p = patchOf(s.caught);
    const room = level.room ?? 1;
    const live = s.seeds.filter((w) => !w.caught).length;
    /**
     * An empty sky refills fast. The spawn gap is there to keep two or three
     * letters from arriving on top of each other; applied to a sky with nothing
     * in it, it was just dead air, and the early game has room for exactly one
     * letter, so every single catch was followed by a second or two of a child
     * looking at an empty screen wondering whether they had broken it.
     *
     * 640ms is long enough for the caught letter to reach the basket and the
     * flower to open, and short enough that the next letter is the answer to
     * "what now" rather than a wait.
     */
    const gap = live === 0 ? 640 : Math.max(1500, 3200 - p * 130);
    if (t - s.lastSpawn > gap && live < room) {
      s.lastSpawn = t;
      spawn();
    }

    for (const w of s.seeds) {
      if (w.caught) continue;
      w.y += w.speed * dt;
      if (w.y > h - GROUND - 34) {
        // It lands in the grass, bounces once and rolls away. Nothing breaks,
        // nothing drains, and the only thing lost is the flower it would have
        // become.
        w.caught = true;
        s.missed++;
        s.streak = 0;
        // Same clock as a catch: the next letter follows the landing, it does
        // not arrive in the same frame.
        s.lastSpawn = t;
        if (s.targetId === w.id) { s.targetId = 0; s.tries = 0; }
        if (data?.settings.soundOn) snd.err();
        const el = board.querySelector(`[data-seed="${w.id}"]`);
        el?.classList.add('lf-rolled');
        const id = w.id;
        window.setTimeout(() => { st.current.seeds = st.current.seeds.filter((x) => x.id !== id); }, 620);
        if (s.missed >= MAX_MISS) { endGame(); return; }
      }
    }

    // The target is simply the lowest seed, and it is re-read every frame so a
    // catch hands the hint straight to the next one with no gap.
    const low = s.seeds.filter((w) => !w.caught).sort((a, b) => b.y - a.y)[0];
    if (low && low.id !== s.targetId) { s.targetId = low.id; s.targetSince = t; s.tries = 0; }
    if (!low) s.targetId = 0;

    force((n) => n + 1);
  }, [spawn, endGame, data?.settings.soundOn, level.room]);

  const start = () => {
    st.current = {
      ...st.current,
      seeds: [], flowers: [], score: 0, caught: 0, missed: 0, streak: 0, bestStreak: 0,
      plantSlot: 0, targetId: 0, targetSince: 0, tries: 0, strokes: [], nextId: 1,
      startedAt: performance.now(), lastSpawn: 0, lastTick: performance.now(),
    };
    endedRef.current = false;
    setPress(null);
    setPhase('run');
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => loop(performance.now()), 33);
  };

  useEffect(() => () => {
    window.clearInterval(timer.current);
    window.clearTimeout(pressTimer.current);
    bloomTimers.current.forEach(window.clearTimeout);
  }, []);

  /**
   * Light the key that was just pressed, then let it go.
   *
   * The press used to be set and never cleared, so the last key stayed lit
   * beside the next one and the keyboard showed two answers at once. On a
   * screen whose entire job is "this one key", that is the worst possible bug.
   */
  const flashKey = (key: string, ok: boolean) => {
    setPress({ key, ok, t: performance.now() });
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => setPress(null), ok ? 200 : 320);
  };

  /**
   * A catch, as one continuous movement: the letter flies into the basket the
   * cat is holding, and a beat later a flower opens in the next empty spot in
   * the bed.
   *
   * The first version popped the letter where it hung and made a flower appear
   * somewhere near the bottom of the screen, and the two events had no visible
   * connection at all. A child could not tell what the flower was for, which
   * makes the whole reward invisible. Nothing about the scoring changed here;
   * the only change is that you can now see the letter become the flower.
   */
  const catchSeed = (w: Seed) => {
    const s = st.current;
    const board = boardRef.current;
    w.caught = true;
    s.caught++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    // Ten a letter, and a little more while a streak is running. The bonus is
    // small on purpose: this board should rank the child who kept going, not
    // the one who got lucky with an easy set.
    const gained = 10 + Math.min(10, (s.streak - 1) * 2);
    s.score += gained;
    const slot = s.plantSlot;

    if (board) {
      const bw = board.clientWidth;
      const seedX = (w.x / 100) * bw;
      // The gardener is standing on the spot this flower is going into, so the
      // letter flies to the basket AND the flower opens in the same place. The
      // first cut had the cat tracking the falling letter, which meant the
      // letter dropped in one place and the flower appeared in another, and the
      // catch read as two unrelated events.
      const pal = board.querySelector('.lf-pal') as HTMLElement | null;
      const br = board.getBoundingClientRect();
      let toX = (bedSpot(slot).x / 100) * bw;
      let toY = board.clientHeight - bedSpot(slot).bottom - 26;
      if (pal) {
        const pr = pal.getBoundingClientRect();
        toX = pr.left + pr.width / 2 - br.left;
        toY = pr.top + pr.height * 0.62 - br.top;
      }
      const el = board.querySelector(`[data-seed="${w.id}"]`) as HTMLElement | null;
      if (el) {
        el.style.setProperty('--dx', `${(toX - seedX).toFixed(1)}px`);
        el.style.setProperty('--dy', `${(toY - (w.y + 31)).toFixed(1)}px`);
      }
      floatText(board, `+${gained}`, seedX, w.y, 'fx-score');
      pal?.classList.add('lf-pal-catch');
      window.setTimeout(() => pal?.classList.remove('lf-pal-catch'), 460);
    }
    if (data?.settings.soundOn) snd.key();
    // The empty-sky timer runs from the catch, not from the last spawn, or the
    // next letter would appear in the same frame the caught one left.
    s.lastSpawn = performance.now();

    // The flower opens when the letter reaches the basket, not before, and the
    // gardener only steps to the next spot once it has.
    const bloom = window.setTimeout(() => {
      const cur = st.current;
      cur.flowers.push({ id: w.id, slot, tint: w.tint });
      if (cur.flowers.length > PATCH * BED_ROWS * 2) cur.flowers.shift();
      cur.plantSlot = slot + 1;
      const b = boardRef.current;
      if (b) {
        const spot = bedSpot(slot);
        sparkBurst(b, (spot.x / 100) * b.clientWidth, b.clientHeight - spot.bottom - 16, 7);
      }
      if (data?.settings.soundOn) snd.pop();
      cur.seeds = cur.seeds.filter((x) => x.id !== w.id);
      force((n) => n + 1);
    }, 420);
    bloomTimers.current.push(bloom);
    if (s.caught % PATCH === 0 && data?.settings.soundOn) window.setTimeout(() => snd.step(), 560);
    /**
     * The level's goal ends the run, on a win.
     *
     * Before the ladder, the only way out of Letter Fall was three letters
     * landing, so every single run ended on the thing you were trying to avoid.
     * Now the last flower goes in and the garden is finished, which is a
     * different feeling entirely and the one this game was always for.
     */
    if (s.caught >= GOAL) {
      const finish = window.setTimeout(endGame, 900);
      bloomTimers.current.push(finish);
    }
  };

  const handleKey = (raw: string) => {
    const s = st.current;
    if (phase !== 'run') return;
    const key = raw.toLowerCase();
    if (key < 'a' || key > 'z') return;
    const t = performance.now();
    const hit = s.seeds.filter((w) => !w.caught && w.ch === key).sort((a, b) => b.y - a.y)[0];
    if (hit) {
      s.strokes.push({ t, exp: key, ok: true });
      flashKey(key, true);
      if (data?.settings.soundOn) snd.key();
      catchSeed(hit);
      return;
    }
    // A miss on the keyboard, not in the sky. It is recorded against the letter
    // that WAS wanted, so the adaptive drills learn which keys are hard to find,
    // and then the game moves on as if nothing happened.
    const target = s.seeds.find((w) => w.id === s.targetId && !w.caught);
    s.strokes.push({ t, exp: target?.ch ?? key, ok: false });
    flashKey(key, false);
    s.tries++;
    if (data?.settings.soundOn) snd.err();
  };

  useGameKeys(phase === 'run', handleKey, { onEscape: endGame });

  if (!data) return null;
  const s = st.current;
  const target = s.seeds.find((w) => w.id === s.targetId && !w.caught) ?? null;
  const info = target ? lookup(target.ch) : null;
  /**
   * The one escalation in the game. After a few seconds of hunting, or two
   * wrong keys, the hint stops being "this key is lit" and starts naming the
   * hand and the finger out loud. Sooner would talk over a child who was about
   * to find it themselves.
   */
  const helping = !!target && (performance.now() - s.targetSince > 4200 || s.tries >= 2);
  const palSpot = bedSpot(s.plantSlot);

  if (phase === 'intro') {
    return (
      <ArenaIntro
        game="letterfall"
        title="Catch the falling letters"
        onPlay={start}
        cta={`Level ${chosen}: ${level.name} →`}
        side={(
          <>
            <StarterScene game="letterfall" />
            <LevelPicker game="letterfall" cleared={cleared} chosen={chosen} onPick={setChosen} />
          </>
        )}
        stats={[
          { label: 'Levels done', value: `${cleared} of ${total}` },
          { label: 'Catch this level', value: level.goal },
        ]}
      >
        <p>
          One letter floats down at a time. Find it on the keyboard under the garden and press it,
          and it turns into a flower. The key you need is always lit up, so you never have to guess.
        </p>
        <p>
          Pressing the wrong key costs nothing at all. The game only ends when
          <strong> three letters have landed in the grass</strong>, and there is no clock anywhere.
        </p>
      </ArenaIntro>
    );
  }

  if (phase === 'over' && overInfo) {
    return (
      <ArenaResult
        game="letterfall"
        run={{ wpm: overInfo.wpm, acc: overInfo.acc, value: overInfo.caught }}
        score={overInfo.score}
        title={overInfo.unlocked ? 'What a garden' : 'The last one got away'}
        newBest={overInfo.newBest}
        onAgain={start}
        standing={(
          <LevelResult
            game="letterfall" level={overInfo.level} done={overInfo.caught}
            goal={overInfo.goal} cleared={cleared} unlocked={overInfo.unlocked}
          />
        )}
      >
        <RewardsBanner rewards={overInfo.rewards} />
        <p className="small muted" style={{ maxWidth: 430 }}>
          {overInfo.best >= 6
            ? `You caught ${overInfo.best} letters in a row without missing one. Your fingers are learning where the keys live.`
            : 'Every letter you find takes a little less looking next time. That is the whole trick.'}
        </p>
      </ArenaResult>
    );
  }

  const setName = level.name;
  const toPatch = PATCH - (s.caught % PATCH);

  return (
    <>
      <ArenaStage
        game="letterfall"
        quiet
        wide
        hud={(
          <>
            <span><b>{s.caught}</b> of {GOAL} flowers</span>
            <span className="lv-hud"><Ic n="map" size={13} /> Level {chosen} <b>{level.name}</b></span>
            <span className="grow" />
            {/* Lives, as the three flowers that have not been planted yet. A
                bar would say "you are being damaged"; this says "you have three
                more goes", which is what is actually true. */}
            <span className="lf-lives" aria-label={`${MAX_MISS - s.missed} letters can still land`}>
              {Array.from({ length: MAX_MISS }).map((_, i) => (
                <i key={i} className={i < MAX_MISS - s.missed ? 'lf-life' : 'lf-life lf-life-gone'}>
                  <Ic n="flower" size={17} />
                </i>
              ))}
            </span>
          </>
        )}
        main={(
          <div className="lf-band">
            <p className="arena-stage-kicker"><Ic n="keyboard" size={14} /> Press this key</p>
            {/* The letter, big and completely still. The one in the sky is
                moving, and a moving letter is the hard part of reading it. */}
            <div className="lf-big" data-help={helping ? 'true' : undefined}>
              {target ? (
                <span className="lf-big-ch" style={{ ['--petal' as string]: PETALS[target.tint] }}>{target.ch}</span>
              ) : (
                <span className="lf-big-ch lf-big-idle">·</span>
              )}
            </div>
            <p className="lf-finger">
              {target && info?.key ? (
                helping
                  ? <><Ic n="person" size={14} /> Use your <strong>{FINGER_NAMES[info.finger]}</strong> finger</>
                  : <><Ic n="bulb" size={14} /> It is lit up on the keyboard</>
              ) : <span className="muted">Here comes the next one</span>}
            </p>
            <div className="lf-band-meta">
              {s.streak >= 3
                ? <Chip tone="good"><Ic n="sparkles" size={12} /> {s.streak} in a row</Chip>
                : <Chip><Ic n="sprout" size={12} /> {toPatch} more to grow a row</Chip>}
              <span className="lf-set">Letters: <b>{setName}</b></span>
            </div>
          </div>
        )}
        side={(
          <div className="lf-scene">
            <div className="lf-board" ref={boardRef}>
              <span className="lf-sun" aria-hidden><Ic n="sun" size={30} /></span>
              {s.seeds.map((w) => (
                <span
                  key={w.id}
                  data-seed={w.id}
                  className={`lf-seed ${w.id === s.targetId ? 'lf-seed-target' : ''} ${w.caught ? 'lf-seed-caught' : ''}`}
                  style={{
                    left: `${w.x}%`, top: w.y,
                    ['--petal' as string]: PETALS[w.tint],
                    ['--sway' as string]: `${w.wobble.toFixed(2)}s`,
                  }}
                >
                  {w.ch}
                </span>
              ))}
              {/* The garden. Every flower is a letter this child found, and it
                  stays on screen for the rest of the run, which is the only
                  score a pre-reader can actually read. */}
              <div className="lf-ground" aria-hidden>
                {s.flowers.map((f) => {
                  const spot = bedSpot(f.slot);
                  return (
                  <i
                    key={f.id}
                    className="lf-flower"
                    style={{
                      left: `calc(${spot.x}% + ${spot.nudge}px)`,
                      bottom: spot.bottom,
                      zIndex: spot.z,
                      ['--petal' as string]: PETALS[f.tint],
                      ['--grow' as string]: spot.scale,
                    }}
                  >
                    <svg viewBox="0 0 24 34" width="34" height="48">
                      <path d="M12 34 V16" stroke="var(--stem)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
                      <path d="M12 24 q-7 -3 -8 -8 q7 0 8 8" fill="var(--stem)" />
                      {[0, 72, 144, 216, 288].map((a) => (
                        <ellipse key={a} cx="12" cy="7" rx="3.6" ry="5.6" fill="var(--petal)" transform={`rotate(${a} 12 12)`} />
                      ))}
                      <circle cx="12" cy="12" r="3.4" fill="var(--gold)" />
                    </svg>
                  </i>
                  );
                })}
              </div>
              {/* The gardener, waiting over the next empty spot in the bed.
                  It does not track the falling letter: the letter comes to the
                  basket, the flower opens under it, and then the cat steps one
                  spot along. Which letter is armed is already said twice, by
                  the ring around it and by the huge still letter in the band,
                  and a third cue cost the catch its single location. */}
              <span
                className="lf-pal"
                style={{
                  left: `calc(${palSpot.x}% + ${palSpot.nudge}px)`,
                  bottom: palSpot.bottom - 10,
                  ['--pal-scale' as string]: palSpot.scale,
                }}
                aria-hidden
              >
                <svg viewBox="0 0 64 52" width="64" height="52">
                  <ellipse cx="32" cy="47" rx="19" ry="4" fill="rgba(0,0,0,0.16)" />
                  <path d="M14 22 h36 l-4 22 h-28 Z" fill="var(--surface2)" stroke="var(--border)" strokeWidth="2.5" strokeLinejoin="round" />
                  <path d="M12 22 h40" stroke="var(--border)" strokeWidth="4" strokeLinecap="round" />
                  <g className="lf-pal-cat">
                    <circle cx="32" cy="14" r="11" fill="var(--accent2)" />
                    <path d="M23 7 l-1 -8 l8 4 Z M41 7 l1 -8 l-8 4 Z" fill="var(--accent2)" />
                    <circle cx="28" cy="14" r="1.8" fill="var(--bg)" />
                    <circle cx="36" cy="14" r="1.8" fill="var(--bg)" />
                    <path d="M30 18 q2 2 4 0" stroke="var(--bg)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                  </g>
                </svg>
              </span>
            </div>
            {/* The map, always open. This is the game. */}
            <div className={`lf-keys ${helping ? 'lf-keys-help' : ''}`}>
              <KeyboardVisual
                layout={layout}
                guide={guide}
                compact
                nextChar={target?.ch}
                lastPress={press}
                hiddenLabels={level.dark ? 'all' : undefined}
              />
            </div>
          </div>
        )}
      />
      <MobileKeys active={phase === 'run'} />
    </>
  );
}
