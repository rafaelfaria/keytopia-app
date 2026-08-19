import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { MobileKeys, STARTER_PALS as PALS, useGameKeys } from '../components/gamekit';
import { KeyboardVisual } from '../components/KeyboardVisual';
import { CharacterSprite, PRESET_CHARACTERS } from '../components/avatars';
import { FINGER_NAMES, makeCharLookup } from '../lib/keyboard';
import { floatText, sparkBurst } from '../lib/fx';  // floatText: row milestones only
import type { GuideStyle, Rewards } from '../lib/types';

/**
 * Key Safari — the second starter game, and the one with nothing to lose.
 *
 * Letter Fall asks a child to read a letter and then find it. This asks less
 * and earlier: an animal hides behind a key, the key rustles with its ears
 * over the top, and pressing it lets the animal out into the meadow. Nothing
 * falls, nothing is timed, and there is no way to fail, so the only thing the
 * game can do to you is take a while.
 *
 * That is deliberate. A child who has never typed needs one loop that is pure
 * "look at the keyboard, find the thing, press it" with no second demand on
 * top, and a game with a fail state cannot be that however gentle it is.
 *
 * The rustle is the cue, not the lit key. Lighting it immediately would end
 * the search, and the search IS the lesson: after a few seconds, or two wrong
 * keys, the game gives in and lights it anyway, because a child stuck at a
 * wall learns nothing except that they are stuck.
 */

const COMMON = PALS.filter((p) => !p.rare);
const RARE = PALS.filter((p) => p.rare);

/**
 * One expedition: rows of eight, filling back to front.
 *
 * It was one row of twelve, which finished about a minute after it started and
 * left the meadow looking like a queue rather than a place. Rows give the run a
 * shape a child can see coming ("this row is nearly full") and give the meadow
 * somewhere to grow into, which is the same reason Letter Fall plants its
 * flowers in a bed rather than wherever the letter happened to fall.
 *
 * A child who wants to stop before the meadow is full can, at any time, from
 * the button in the band. There is no clock here and there is no obligation to
 * finish either.
 */
const ROW = 8;

/** Where a find stands in the meadow. Later rows are nearer, and larger. */
function meadowSpot(i: number, finds: number) {
  const n = i % Math.max(ROW, finds);
  const col = n % ROW;
  const row = Math.floor(n / ROW);
  const step = 84 / (ROW - 1);
  return {
    // Odd rows sit half a step across, so a pal in the back row stands in the
    // gap between two in front of it rather than directly behind one. Without
    // the stagger, three rows in a meadow this size is one row and two rumours.
    x: 8 + col * step + (row % 2 ? step / 2 : 0) - (row % 2 ? 2 : 0),
    bottom: 70 - row * 28,
    scale: 0.72 + row * 0.14,
    z: row + 1,
  };
}

interface Found { id: number; pal: number; x: number; bottom: number; scale: number; z: number; dx: number; dy: number }

export default function KeySafariGame() {
  const data = useData();
  const recordSession = useStore((s) => s.recordSession);
  const patchData = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const [phase, setPhase] = useState<'intro' | 'run' | 'over'>('intro');
  const [, force] = useState(0);
  const [press, setPress] = useState<{ key: string; ok: boolean; t: number } | null>(null);
  const [peek, setPeek] = useState<{ x: number; y: number } | null>(null);
  /** The pal who just arrived says their own name, briefly. */
  const [say, setSay] = useState<number | null>(null);
  const [overInfo, setOverInfo] = useState<
    { score: number; found: number; firstTry: number; acc: number; wpm: number;
      rewards: Rewards | null; newBest: boolean; level: number; goal: number; unlocked: boolean } | null
  >(null);

  const st = useRef({
    ch: '', pal: 0, since: 0, tries: 0, rowNote: 0, streak: 0,
    found: [] as Found[], firstTry: 0, score: 0,
    strokes: [] as GameStroke[], startedAt: 0,
    rng: mulberry32(Date.now() % 1e9),
  });
  const sceneRef = useRef<HTMLDivElement>(null);
  const meadowRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef(0);
  const tick = useRef(0);
  const nextTimer = useRef(0);
  const sayTimer = useRef(0);
  const bloomTimers = useRef<number[]>([]);

  const { level, cleared, chosen, setChosen, clear, total } = useStarterLadder('keysafari');
  const FINDS = level.goal;

  const layout = data?.profile.layout ?? 'qwerty';
  const lookup = useMemo(() => makeCharLookup(layout), [layout]);
  const guide: GuideStyle = data?.settings.guide === 'hidden' ? 'plain' : (data?.settings.guide ?? 'hands');

  const s = st.current;
  const info = s.ch ? lookup(s.ch) : null;
  const pal = PALS[s.pal] ?? PALS[0];
  /** Give in and light the key. See the note at the top: being stuck teaches nothing. */
  const helping = phase === 'run' && !!s.ch && (performance.now() - s.since > 3500 || s.tries >= 2);

  const hide = useCallback(() => {
    const cur = st.current;
    const chars = (level.chars ?? 'fjdk').split('');
    let ch = pick(cur.rng, chars);
    for (let i = 0; i < 5 && ch === cur.ch; i++) ch = pick(cur.rng, chars);
    const table = cur.rng() < 0.12 ? RARE : COMMON;
    const who = pick(cur.rng, table);
    cur.ch = ch;
    cur.pal = PALS.indexOf(who);
    cur.since = performance.now();
    cur.tries = 0;
    force((n) => n + 1);
  }, []);

  const endGame = useCallback(() => {
    const cur = st.current;
    if (!cur.startedAt) return;
    window.clearInterval(tick.current);
    window.clearTimeout(nextTimer.current);
    const result = resultFromStrokes('game', 'Key Safari', cur.strokes, cur.startedAt, performance.now(), {
      game: 'keysafari', score: cur.score, found: cur.found.length,
    });
    const rewards = cur.strokes.length > 6 ? recordSession(result) : null;
    let newBest = false;
    patchData((d) => {
      const prev = d.gameBests['keysafari'];
      if (!prev || cur.score > prev.score) { d.gameBests['keysafari'] = { score: cur.score, level: cur.found.length }; newBest = true; }
    });
    if (newBest) pushToast({ kind: 'record', icon: 'trophy', title: 'New Key Safari best!' });
    // The level only goes in if the meadow actually filled. Stopping early
    // costs nothing and leaves it exactly where it was.
    const won = cur.found.length >= FINDS;
    if (won) {
      clear(chosen);
      if (chosen === cleared + 1) pushToast({ kind: 'record', icon: 'map', title: `Level ${chosen} done!` });
    }
    setOverInfo({
      score: cur.score, found: cur.found.length, firstTry: cur.firstTry,
      acc: result.acc, wpm: result.wpm, rewards, newBest,
      level: chosen, goal: FINDS, unlocked: won,
    });
    setPhase('over');
  }, [recordSession, patchData, pushToast]);

  const start = () => {
    st.current = {
      ...st.current,
      ch: '', pal: 0, since: 0, tries: 0, rowNote: 0, streak: 0, found: [], firstTry: 0, score: 0,
      strokes: [], startedAt: performance.now(),
    };
    setPress(null);
    setPeek(null);
    setPhase('run');
    hide();
    // Nothing in this game moves on its own. The only reason to tick at all is
    // so the hint can arrive after a few seconds of hunting.
    window.clearInterval(tick.current);
    tick.current = window.setInterval(() => force((n) => n + 1), 250);
  };

  useEffect(() => () => {
    window.clearInterval(tick.current);
    window.clearTimeout(pressTimer.current);
    window.clearTimeout(nextTimer.current);
    window.clearTimeout(sayTimer.current);
    bloomTimers.current.forEach(window.clearTimeout);
  }, []);

  /**
   * Put the ears over the right key.
   *
   * Measured off the rendered keyboard rather than computed from the layout,
   * because the keyboard is fluid: it is a different width on a phone, in a
   * split stage and in every one of the five layouts, and a hiding place that
   * is one key off is worse than no hiding place at all.
   */
  useLayoutEffect(() => {
    if (phase !== 'run' || !s.ch) { setPeek(null); return; }
    const place = () => {
      const wrap = keysRef.current;
      const code = lookup(s.ch).key?.code;
      const el = code ? wrap?.querySelector(`[data-code="${code}"]`) : null;
      if (!wrap || !el) return;
      const w = wrap.getBoundingClientRect();
      const k = (el as HTMLElement).getBoundingClientRect();
      setPeek({ x: k.left + k.width / 2 - w.left, y: k.top - w.top });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [phase, s.ch, lookup]);

  /**
   * Everyone in the meadow jumps, in a wave rolling out from `from`.
   *
   * The tween lands on an inner wrapper rather than on .ks-found itself, whose
   * transform is already carrying the row's placement and depth scale. Two
   * animations on one transform is one animation and a bug.
   */
  const cheer = (from: number, big: boolean) => {
    if (data?.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const m = meadowRef.current;
    if (!m) return;
    const els = Array.from(m.querySelectorAll('.ks-pal')) as HTMLElement[];
    els.forEach((el, idx) => {
      el.getAnimations().forEach((a) => a.cancel());
      el.animate(
        [{ transform: 'translateY(0)' }, { transform: `translateY(${big ? -20 : -13}px)` }],
        {
          duration: big ? 230 : 190,
          // The wave starts at whoever just arrived and rolls outward, capped
          // so that a full meadow does not take a second and a half to finish
          // celebrating something that happened at one end of it.
          delay: Math.min(360, Math.abs(idx - from) * 45),
          iterations: big ? 4 : 2,
          direction: 'alternate',
          easing: 'ease-out',
        },
      );
    });
  };

  const flashKey = (key: string, ok: boolean) => {
    setPress({ key, ok, t: performance.now() });
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => setPress(null), ok ? 200 : 320);
  };

  const findIt = () => {
    const cur = st.current;
    const scene = sceneRef.current;
    const meadow = meadowRef.current;
    const wrap = keysRef.current;
    const i = cur.found.length;
    const spot = meadowSpot(i, FINDS);
    let dx = 0;
    let dy = 120;
    if (scene && meadow && wrap && peek) {
      // Where the animal is now (over its key) relative to where it is going
      // (its own place in the meadow), so the hop is drawn between two real
      // points rather than along a guess.
      const mr = meadow.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      dx = (wr.left + peek.x) - (mr.left + (spot.x / 100) * mr.width);
      dy = (wr.top + peek.y) - (mr.bottom - spot.bottom - 16);
    }
    // A find with no wrong keys before it is worth double. Quietly: a seven
    // year old should never be told they lost points, and this is the only
    // place the board can tell a confident press from a lucky one.
    const clean = cur.tries === 0;
    if (clean) { cur.firstTry++; cur.streak++; } else { cur.streak = 0; }
    cur.score += clean ? 20 : 10;
    cur.found.push({ id: i, pal: cur.pal, x: spot.x, bottom: spot.bottom, scale: spot.scale, z: spot.z, dx, dy });
    if (data?.settings.soundOn) { snd.pop(); if (clean) snd.step(); }

    /**
     * The moment itself, which used to be a sprite quietly appearing in a grid.
     *
     * Four things happen at once and all of them are cheap: a puff where the
     * pal was hiding, confetti where they land, their name over their head, and
     * every pal already in the meadow jumping in a wave that starts at the new
     * arrival. The wave is the one that matters. It turns a row of stickers
     * into a crowd who noticed, and it costs one tween.
     */
    if (wrap && peek) sparkBurst(wrap, peek.x, peek.y, 6);
    const landed = window.setTimeout(() => {
      const m = meadowRef.current;
      if (m) {
        const mr = m.getBoundingClientRect();
        // Confetti, and no number. A score float is for a reader; this player
        // gets the sparkle and their parent gets the figure in the HUD.
        sparkBurst(m, (spot.x / 100) * mr.width, mr.height - spot.bottom - 30, 12);
      }
      cheer(i, false);
      setSay(i);
      window.clearTimeout(sayTimer.current);
      sayTimer.current = window.setTimeout(() => setSay(null), 1300);
    }, 420);
    bloomTimers.current.push(landed);

    // A row filling up is the milestone this game has instead of a level, and
    // the whole meadow celebrates it rather than a chip changing.
    if (cur.found.length % ROW === 0 && cur.found.length < FINDS) {
      cur.rowNote = performance.now();
      window.setTimeout(() => {
        cheer(0, true);
        const m = meadowRef.current;
        if (m) floatText(m, 'Row full!', m.clientWidth / 2, 26, 'fx-score');
      }, 700);
      if (data?.settings.soundOn) window.setTimeout(() => snd.step(), 760);
    }
    if (cur.found.length >= FINDS) {
      window.clearTimeout(nextTimer.current);
      nextTimer.current = window.setTimeout(endGame, 900);
      cur.ch = '';
      force((n) => n + 1);
      return;
    }
    window.clearTimeout(nextTimer.current);
    nextTimer.current = window.setTimeout(hide, 700);
    cur.ch = '';
    force((n) => n + 1);
  };

  const handleKey = (raw: string) => {
    const cur = st.current;
    if (phase !== 'run' || !cur.ch) return;
    const key = raw.toLowerCase();
    if (key < 'a' || key > 'z') return;
    const t = performance.now();
    if (key === cur.ch) {
      cur.strokes.push({ t, exp: cur.ch, ok: true });
      flashKey(key, true);
      findIt();
      return;
    }
    // Wrong key: the pressed key shakes and that is the entire consequence.
    cur.strokes.push({ t, exp: cur.ch, ok: false });
    flashKey(key, false);
    cur.tries++;
    if (data?.settings.soundOn) snd.err();
    force((n) => n + 1);
  };

  useGameKeys(phase === 'run', handleKey, { onEscape: endGame });

  if (!data) return null;

  if (phase === 'intro') {
    return (
      <ArenaIntro
        game="keysafari"
        title="Find who is hiding"
        onPlay={start}
        cta={`Level ${chosen}: ${level.name} →`}
        side={(
          <>
            <StarterScene game="keysafari" />
            <LevelPicker game="keysafari" cleared={cleared} chosen={chosen} onPick={setChosen} />
          </>
        )}
        stats={[
          { label: 'Levels done', value: `${cleared} of ${total}` },
          { label: 'Pals this level', value: level.goal },
        ]}
      >
        <p>
          One of the pals is hiding behind a key on the keyboard below. Watch for the key that
          wiggles, press it, and out they hop into the meadow to wait for you.
        </p>
        <p>
          There is no clock and no way to lose. Press as many wrong keys as you like:
          if a hiding place is too tricky, the game lights it up for you.
        </p>
      </ArenaIntro>
    );
  }

  if (phase === 'over' && overInfo) {
    return (
      <ArenaResult
        game="keysafari"
        run={{ wpm: overInfo.wpm, acc: overInfo.acc, value: overInfo.found }}
        score={overInfo.score}
        /* Going home early is a choice this game offers, so the finish screen
           must not congratulate you on filling a meadow you did not fill. */
        title={overInfo.unlocked ? 'The meadow is full' : 'A good day out'}
        newBest={overInfo.newBest}
        onAgain={start}
        standing={(
          <LevelResult
            game="keysafari" level={overInfo.level} done={overInfo.found}
            goal={overInfo.goal} cleared={cleared} unlocked={overInfo.unlocked}
          />
        )}
      >
        <RewardsBanner rewards={overInfo.rewards} />
        <p className="small muted" style={{ maxWidth: 430 }}>
          {overInfo.firstTry >= overInfo.found - 1 && overInfo.found > 2
            ? `You found ${overInfo.firstTry} of them on the very first key you pressed. You know where these letters live.`
            : `Found on the first press: ${overInfo.firstTry} of ${overInfo.found}. That number goes up every single time you play.`}
        </p>
      </ArenaResult>
    );
  }

  const done = s.found.length;
  const rowFull = performance.now() - s.rowNote < 1800;

  return (
    <>
      <ArenaStage
        game="keysafari"
        quiet
        wide
        hud={(
          <>
            <span><b>{done}</b> of {FINDS} found</span>
            <span className="lv-hud"><Ic n="map" size={13} /> Level {chosen} <b>{level.name}</b></span>
            <span className="grow" />
            <span className="st-promise"><Ic n="heart" size={14} /> nothing to lose here</span>
          </>
        )}
        main={(
          <div className="ks-band">
            <p className="arena-stage-kicker"><Ic n="telescope" size={14} /> Who is hiding?</p>
            <div className="ks-who" data-help={helping ? 'true' : undefined}>
              {s.ch ? (
                <CharacterSprite ch={PRESET_CHARACTERS[pal.preset].ch} size={92} expr="happy" />
              ) : (
                <span className="ks-who-done"><Ic n="sparkles" size={40} /></span>
              )}
            </div>
            <p className="ks-line">
              {s.ch
                ? <><strong>{pal.name}</strong> is behind the <b className="ks-ch">{s.ch}</b> key</>
                : done >= FINDS ? 'Everybody is out. What a safari.' : <span className="muted">Someone else is hiding now</span>}
            </p>
            <p className="ks-hint">
              {s.ch && info?.key && (helping
                ? <><Ic n="person" size={14} /> Use your <strong>{FINGER_NAMES[info.finger]}</strong> finger</>
                : <><Ic n="eye" size={14} /> Look for the key that is wiggling</>)}
            </p>
            <div className="ks-band-meta">
              {/* "12 found first try" was the ranked metric wearing its own
                  name, and neither a seven year old nor their parent could tell
                  what it meant. It belongs on the finish screen, in a sentence.
                  What stays here is a streak, which every child already
                  understands, and how close this row is to full. */}
              {rowFull
                ? <Chip tone="gold"><Ic n="party" size={12} /> That row is full</Chip>
                : s.streak >= 2
                  ? <Chip tone="good"><Ic n="flame" size={12} /> {s.streak} straight to the right key</Chip>
                  : <Chip><Ic n="telescope" size={12} /> {done} of {FINDS} out of hiding</Chip>}
              <span className="ks-toward"><b>{ROW - (done % ROW)}</b> more in this row</span>
            </div>
            {/* A no-clock game still has to be leaveable, and a child should not
                have to find the browser's back button to stop. It appears only
                once there is something worth keeping. */}
            {done >= 4 && (
              <button type="button" className="ks-stop" onClick={endGame}>
                Finish the safari and go home →
              </button>
            )}
          </div>
        )}
        side={(
          <div className="ks-scene" ref={sceneRef}>
            <div className="ks-meadow" ref={meadowRef}>
              <span className="ks-sun" aria-hidden><Ic n="sun" size={28} /></span>
              {/* Everyone found so far, waiting on the grass. This is the score
                  a child can actually read: the meadow gets busier. */}
              {s.found.map((f) => (
                <span
                  key={f.id}
                  className="ks-found"
                  style={{
                    left: `${f.x}%`,
                    bottom: f.bottom,
                    zIndex: f.z,
                    ['--grow' as string]: f.scale,
                    ['--i' as string]: f.id,
                    ['--fx' as string]: `${f.dx.toFixed(0)}px`,
                    ['--fy' as string]: `${f.dy.toFixed(0)}px`,
                  }}
                >
                  <span className="ks-pal">
                    <CharacterSprite ch={PRESET_CHARACTERS[PALS[f.pal].preset].ch} size={42} expr="happy" />
                    {say === f.id && <b className="ks-say">{PALS[f.pal].name}!</b>}
                  </span>
                </span>
              ))}
              <span className="ks-grass" aria-hidden />
            </div>
            <div className={`ks-keys ${helping ? 'ks-keys-help' : ''}`} ref={keysRef}>
              <KeyboardVisual
                layout={layout}
                guide={guide}
                compact
                /* The rustle is always on the hiding key. The lit key only
                   arrives once the child has been hunting a while. */
                markChars={s.ch ? { [s.ch]: 'ks-hiding' } : undefined}
                hiddenLabels={level.dark ? 'all' : undefined}
                nextChar={helping ? s.ch : undefined}
                lastPress={press}
              />
              {/* The ears over the key. Absolutely placed from a measurement of
                  the real key, so it is right in every layout and width. */}
              {peek && s.ch && (
                <span className="ks-peek" style={{ left: peek.x, top: peek.y }} aria-hidden>
                  <CharacterSprite ch={PRESET_CHARACTERS[pal.preset].ch} size={38} expr="happy" />
                </span>
              )}
            </div>
          </div>
        )}
      />
      <MobileKeys active={phase === 'run'} />
    </>
  );
}
