import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useData, useStore, useUi } from '../lib/store';
import { COMMON_WORDS, KID_WORDS } from '../lib/words';
import { mulberry32, pick } from '../lib/rng';
import { Chip } from '../components/ui';
import { resultFromStrokes, type GameStroke } from '../components/typing';
import { snd } from '../lib/sound';
import { RewardsBanner } from '../components/ResultsPanel';
import { ArenaIntro, ArenaResult, ArenaStage } from '../components/arena';
import { Ic } from '../components/icons';
import { MobileKeys, useGameKeys } from '../components/gamekit';
import { sparkBurst, floatText, screenShake } from '../lib/fx';
import { createFlightScene, type FlightScene, type FlightFrame } from './flightScene';
import type { Rewards } from '../lib/types';

/**
 * Wordflight: Flappy Bird where the flapping is typing, over open sea.
 *
 * Every correct letter is one wing-beat. Gravity never stops, so the moment
 * the letters stop coming the bird sinks, and the water is the end of the run.
 * There is no clock and no course that flies itself: the only thing holding
 * the bird up is the next keystroke.
 *
 * There is exactly one hazard and it is the bottom of the world. This game
 * used to fly through Flappy pillars, and threading a gap turned out to be a
 * precision game about *position* when the thing being taught is *not
 * stopping*. Missing a gap by a hair felt like a punishment for typing well,
 * and there was no way to recover from a bad approach. The sea asks the same
 * question with no dexterity attached: are you still typing?
 *
 * So a run ends only one way, and it always ends: the sea climbs and the air
 * thickens the further you fly, which squeezes the sky slowly enough that you
 * can always see it coming and never so fast that one slip is fatal.
 *
 * The score is the distance, literally. Not a point total that distance feeds
 * into: there is no bonus for finishing a word and none for passing a buoy,
 * because the moment anything but flying can add to the number, the number
 * stops being the answer to "how far did I get" and starts needing a legend.
 * Typing well is still what scores — it is what keeps the bird in the air —
 * but it pays in the only currency this game has, which is more sky.
 */

/** Alt units are the sky: 0 the seabed line, 1 the ceiling. Gravity and
 *  wing-beats are tuned against each other so about two letters a second is a
 *  comfortable hover. */
const GRAV = { kid: 0.58, grown: 0.78 };
const FLAP = { kid: 0.26, grown: 0.28 };
/** A typo is not a wing-beat and also knocks you down a little. Gentle: over
 *  water a stumble should cost height you can climb back, not the run. */
const MISS_KNOCK = 0.1;
const VY_MIN = -1.05;
const VY_MAX = 0.5;
/** Game distance units per second, before the run speeds up. */
const SPEED0 = { kid: 132, grown: 156 };
/** Ten distance units to the metre, which is what the HUD counts. */
const PER_M = 10;
/** A buoy every this many units: about 90m, five or six seconds of flying. */
const BUOY_EVERY = 900;
/**
 * The squeeze. The sea climbs toward SEA_MAX over SEA_OVER units of distance
 * and gravity grows by GRAV_MAX over GRAV_OVER, so a run always ends without
 * anything ever jumping out at the player. Both are deliberately slower for
 * kids: the failure has to arrive as weather, not as an ambush.
 */
const SEA_MAX = { kid: 0.3, grown: 0.42 };
const SEA_OVER = { kid: 34000, grown: 26000 };
const GRAV_MAX = 0.55;
const GRAV_OVER = 30000;

interface Buoy { id: number; at: number; passed: boolean }

/** The run's score, and the only thing it ever is: metres flown. */
const metresOf = (dist: number): number => Math.round(dist / PER_M);

export default function WordflightGame() {
  const data = useData();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const kid = data?.profile.ageGroup === 'kid';
  const pool = useMemo(() => (kid ? KID_WORDS : COMMON_WORDS.filter((w) => w.length >= 3 && w.length <= 7)), [kid]);

  const [phase, setPhase] = useState<'intro' | 'run' | 'over'>('intro');
  const [, force] = useState(0);
  const [hudInfo, setHud] = useState({ buoys: 0, m: 0, launched: false, low: false });
  const [overInfo, setOverInfo] = useState<{ m: number; buoys: number; smooth: number; acc: number; wpm: number; cause: 'water' | 'quit'; rewards: Rewards | null; newBest: boolean } | null>(null);

  const st = useRef({
    word: '', next: '', hit: 0,
    alt: 0.62, vy: 0, dist: 0, turb: 0, flapN: 0, seaAlt: 0,
    launched: false, dead: false, deadT: 0, cause: 'water' as 'water' | 'quit',
    buoys: [] as Buoy[], buoysPassed: 0, nextBuoy: BUOY_EVERY, buoyId: 1,
    words: 0,
    strokes: [] as GameStroke[], recentIkis: [] as number[], lastKeyT: 0,
    launchAt: 0, pausedAt: 0,
    rng: mulberry32(Date.now() % 1e9),
  });
  const skyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<FlightScene | null>(null);
  const endedRef = useRef(false);
  const phaseRef = useRef(phase);
  const soundRef = useRef(false);
  phaseRef.current = phase;
  soundRef.current = !!data?.settings.soundOn;

  const newWord = () => {
    const s = st.current;
    s.word = s.next || pick(s.rng, pool);
    s.next = pick(s.rng, pool);
    s.hit = 0;
  };

  const endGame = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    const s = st.current;
    const from = s.launchAt || performance.now();
    const m = metresOf(s.dist);
    const result = resultFromStrokes('game', 'Wordflight', s.strokes, from, performance.now(), { game: 'wordflight', score: m, buoys: s.buoysPassed });
    const rewards = s.strokes.length > 10 ? recordSession(result) : null;
    let newBest = false;
    patch((d) => {
      const cur = d.gameBests['wordflight'];
      if (!cur || m > cur.score) { d.gameBests['wordflight'] = { score: m, level: s.buoysPassed }; newBest = true; }
    });
    if (newBest) pushToast({ kind: 'record', icon: 'trophy', title: 'New Wordflight best!' });
    // wpm rides along for the Arena board. docs/arena-leaderboards.md §10 step 4.
    setOverInfo({
      m, buoys: s.buoysPassed,
      smooth: result.consistency, acc: result.acc, wpm: result.wpm,
      cause: s.cause, rewards, newBest,
    });
    setPhase('over');
  }, [recordSession, patch, pushToast]);
  const endRef = useRef(endGame);
  endRef.current = endGame;

  const drown = () => {
    const s = st.current;
    if (s.dead) return;
    s.dead = true;
    s.deadT = 0;
    s.cause = 'water';
    if (soundRef.current) snd.err();
    const sky = skyRef.current;
    if (sky) {
      screenShake(sky, 9);
      floatText(sky, 'splash', sky.clientWidth * 0.34, sky.clientHeight * 0.62, 'fx-bad');
    }
  };

  /**
   * One frame of the run, called by the scene once per rendered frame. This is
   * the whole game: gravity, the rising sea, the buoys. The keystroke handler
   * only ever changes `vy`; the one thing that can end the run happens here.
   */
  const tick = (dt: number): FlightFrame => {
    const s = st.current;
    if (s.dead) {
      // The fall in: gravity still owns the body on the way down. The result
      // screen waits for the splash, because a death you never saw is a bug
      // report.
      s.deadT += dt;
      s.vy = Math.max(VY_MIN, s.vy - (kid ? GRAV.kid : GRAV.grown) * 2 * dt);
      s.alt = Math.max(s.seaAlt - 0.12, s.alt + s.vy * dt);
      if (s.deadT > 1.1) endRef.current();
      return frameOf(s);
    }
    if (!s.launched) return frameOf(s);

    // The air thickens the further you fly. This is the whole of the game's
    // escalation along with the sea, and both are slow on purpose: the run has
    // to end, but never on a step change the player could not see coming.
    const grav = (kid ? GRAV.kid : GRAV.grown) * (1 + Math.min(GRAV_MAX, s.dist / GRAV_OVER));
    s.vy = Math.max(VY_MIN, Math.min(VY_MAX, s.vy - grav * dt));
    s.alt += s.vy * dt;
    if (s.alt >= 1) { s.alt = 1; s.vy = Math.min(0, s.vy); }
    s.turb = Math.max(0, s.turb - dt * 2);

    const speed = (kid ? SPEED0.kid : SPEED0.grown) + Math.min(80, s.buoysPassed * 3);
    s.dist += speed * dt;
    s.seaAlt = Math.min(kid ? SEA_MAX.kid : SEA_MAX.grown, s.dist / (kid ? SEA_OVER.kid : SEA_OVER.grown) * (kid ? SEA_MAX.kid : SEA_MAX.grown));

    if (s.alt <= s.seaAlt) { s.alt = s.seaAlt; drown(); return frameOf(s); }

    // Buoys mark the distance. They cannot be hit, cost nothing to miss, and
    // pay nothing for passing: the distance already counted itself. Flying over
    // one is just the moment the sea says how far you have come.
    while (s.nextBuoy < s.dist + 1400) {
      s.buoys.push({ id: s.buoyId++, at: s.nextBuoy, passed: false });
      s.nextBuoy += BUOY_EVERY;
    }
    for (const b of s.buoys) {
      if (b.passed || b.at > s.dist) continue;
      b.passed = true;
      s.buoysPassed++;
      if (soundRef.current) snd.pop();
      const sky = skyRef.current;
      if (sky) {
        sparkBurst(sky, sky.clientWidth * 0.31, (1 - s.alt) * sky.clientHeight, 9);
        floatText(sky, `${metresOf(b.at)}m`, sky.clientWidth * 0.34, (1 - s.alt) * sky.clientHeight - 18, 'fx-score');
      }
    }
    s.buoys = s.buoys.filter((b) => b.at > s.dist - 400);
    return frameOf(s);
  };
  const tickRef = useRef(tick);
  tickRef.current = tick;

  const start = () => {
    const s = st.current;
    Object.assign(s, {
      alt: 0.62, vy: 0, dist: 0, turb: 0, flapN: 0, seaAlt: 0,
      launched: false, dead: false, deadT: 0, cause: 'water',
      buoys: [], buoysPassed: 0, nextBuoy: BUOY_EVERY, buoyId: 1,
      words: 0, strokes: [], recentIkis: [], lastKeyT: 0,
      launchAt: 0, pausedAt: 0,
    });
    newWord();
    endedRef.current = false;
    setHud({ buoys: 0, m: 0, launched: false, low: false });
    setPhase('run');
  };

  const handleKey = (key: string) => {
    const s = st.current;
    if (phaseRef.current !== 'run' || s.dead) return;
    const t = performance.now();
    // One word rides the wind at a time with nothing after it, so there is no
    // space on screen to type and asking for one made the last keystroke of
    // every word a press at a character nobody could see. The final letter ends
    // the word. A space pressed out of habit is swallowed rather than charged
    // against the next word's first letter — which, now that words turn over on
    // their own, is the only place it could land, and here a stray miss costs
    // altitude.
    if (key === ' ') return;
    const want = s.word[s.hit];
    if (want === undefined) return;
    const ok = key === want;
    s.strokes.push({ t, exp: want, ok });
    if (s.lastKeyT) {
      const dt = t - s.lastKeyT;
      if (dt > 20 && dt < 1500) { s.recentIkis.push(dt); if (s.recentIkis.length > 12) s.recentIkis.shift(); }
    }
    s.lastKeyT = t;
    if (ok) {
      if (soundRef.current) snd.key();
      if (!s.launched) {
        // The run starts on the first true letter, not on the phase flip:
        // nobody should be losing altitude while they read the word.
        s.launched = true;
        s.launchAt = t;
      }
      // The wing-beat. Setting the speed rather than adding to it is what
      // makes this Flappy: mashing cannot stockpile lift, only keep it. The
      // air thins with height, so a beat lifts less the higher you are, which
      // is what gives the bird a cruising altitude instead of pinning every
      // typist to the ceiling. Your cadence is what picks that altitude, and
      // the height you hold is the margin you have when you falter.
      s.vy = (kid ? FLAP.kid : FLAP.grown) * (1.15 - 0.9 * s.alt);
      s.flapN++;
      s.hit++;
      if (s.hit >= s.word.length) {
        // The separator is still recorded, unpressed. Speed here is characters
        // over five like everywhere else, and a word counted without its space
        // is a fifth short: dropping it would price the same typing lower in
        // this game than in any other and drag the rolling average with it.
        s.strokes.push({ t, exp: ' ', ok: true });
        s.words++;
        newWord();
      }
    } else {
      // A typo is a stumble mid-air: no beat, and a knock downward on top of
      // the fall you were already in.
      s.turb = 1;
      if (s.launched) s.vy = Math.max(VY_MIN, Math.min(s.vy, 0) - MISS_KNOCK);
      if (soundRef.current) snd.err();
    }
    force((n) => n + 1);
  };

  useGameKeys(phase === 'run', handleKey, {
    onEscape: () => { st.current.cause = 'quit'; endGame(); },
  });

  // The scene lives as long as the run does, and it drives the clock: physics
  // runs in its tick so flight is integrated at render rate, not interval rate.
  useEffect(() => {
    if (phase !== 'run' || !canvasRef.current) return;
    const style = getComputedStyle(document.documentElement);
    const hue = readHue(style.getPropertyValue('--accent')) ?? 210;
    const light = isLight(style.getPropertyValue('--bg'));
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = createFlightScene(canvasRef.current, {
      hue, light, calm, kid: !!kid,
      tick: (dt) => tickRef.current(dt),
    });
    sceneRef.current = scene;
    scene.start();
    return () => { scene.dispose(); sceneRef.current = null; };
  }, [phase, kid]);

  // A hidden tab suspends requestAnimationFrame, which here suspends the whole
  // game: no physics, no fall, no death. All that needs holding is the wpm
  // clock, so coming back does not price the pause as slow typing.
  useEffect(() => {
    if (phase !== 'run') return;
    const onVisibility = () => {
      const s = st.current;
      if (document.hidden) {
        sceneRef.current?.stop();
        s.pausedAt = performance.now();
      } else {
        if (s.pausedAt) {
          const gap = performance.now() - s.pausedAt;
          if (s.launchAt) s.launchAt += gap;
          if (s.lastKeyT) s.lastKeyT += gap;
          s.pausedAt = 0;
        }
        sceneRef.current?.start();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [phase]);

  // The HUD reads the run a few times a second. The numbers move every frame,
  // but re-rendering the stage at 60fps to say so would be the tail wagging
  // the dog; the scene is where the run is watched.
  useEffect(() => {
    if (phase !== 'run') return;
    const id = window.setInterval(() => {
      const s = st.current;
      setHud({
        buoys: s.buoysPassed, m: metresOf(s.dist),
        launched: s.launched, low: !s.dead && s.launched && s.alt - s.seaAlt < 0.16,
      });
    }, 150);
    return () => window.clearInterval(id);
  }, [phase]);

  if (!data) return null;
  const s = st.current;

  if (phase === 'intro') {
    return (
      <ArenaIntro
        game="wordflight"
        title={kid ? 'Fly the little bird' : 'Every letter is a wing-beat'}
        onPlay={start}
        cta={kid ? 'Flap flap →' : 'Take off →'}
        stats={data.gameBests['wordflight'] ? [
          { label: 'Furthest flight', value: `${data.gameBests['wordflight'].score}m` },
          { label: 'Most buoys', value: data.gameBests['wordflight'].level },
        ] : undefined}
      >
        <p>
          Type the running words. <strong>Every correct letter beats the wings once</strong>,
          and gravity never stops pulling. Stop typing and the bird sinks toward the sea.
          Touch the water and the flight is over.
        </p>
        <p>
          Nothing else is in your way. There is only open water, the buoys counting off
          the distance, and a sea that climbs a little the further you go. The score is
          how far you flew: <strong>keep a beat you can hold</strong> and the bird stays up.
        </p>
      </ArenaIntro>
    );
  }

  if (phase === 'over' && overInfo) {
    return (
      <ArenaResult
        game="wordflight"
        run={{ wpm: overInfo.wpm, acc: overInfo.acc, value: overInfo.buoys }}
        score={overInfo.m}
        title={overInfo.newBest ? 'New flight record!' : overInfo.cause === 'quit' ? 'Landed early' : 'Down in the water'}
        newBest={overInfo.newBest}
        onAgain={start}
      >
        <Chip tone={overInfo.smooth >= 65 ? 'good' : 'default'}>
          <Ic n="waves" size={12} /> {overInfo.smooth}% smooth
        </Chip>
        <RewardsBanner rewards={overInfo.rewards} />
        <p className="small muted" style={{ maxWidth: 430 }}>
          {overInfo.smooth >= 65
            ? 'That rhythm was silk. The long flights belong to typists who never stop.'
            : 'The bird only asks for the next letter. A beat you can hold flies further than a sprint.'}
        </p>
      </ArenaResult>
    );
  }

  return (
    <>
      <ArenaStage
        game="wordflight"
        quiet
        wide
        hud={(
          <>
            <span><b>{hudInfo.m}</b> metres</span>
            <span className="muted">{hudInfo.buoys} {hudInfo.buoys === 1 ? 'buoy' : 'buoys'}</span>
            <span className="grow" />
            {/* Height over the water, not height in the world. As the sea
                climbs, the same altitude is less air, and the meter has to
                mean the thing that kills you. */}
            <span className={`arena-meter ${hudInfo.low ? 'bad' : ''}`} title="Air below you">
              <Ic n="send" size={13} />
              <i><b style={{ width: `${Math.round(Math.max(0, (s.alt - s.seaAlt) / Math.max(0.05, 1 - s.seaAlt)) * 100)}%` }} /></i>
            </span>
          </>
        )}
        main={(
          <div className="wf-band">
            <p className="arena-stage-kicker"><Ic n="keyboard" size={14} /> {kid ? 'Type me' : 'Type to fly'}</p>
            <div className="wf-locked">
              <span className="good">{s.word.slice(0, s.hit)}</span>
              <span className="duel-cur">{s.word[s.hit] ?? ''}</span>
              <span className="muted">{s.word.slice(s.hit + 1)}</span>
            </div>
            <div className="wf-band-meta">
              {s.turb > 0.3
                ? <Chip tone="warn"><Ic n="wind" size={12} /> turbulence</Chip>
                : <Chip tone="good"><Ic n="waves" size={12} /> smooth air</Chip>}
              <span className="stack-next"><span className="muted">next</span> {s.next}</span>
            </div>
            <p className="stack-hint muted small">
              <Ic n="bulb" size={13} /> Each letter is one wing-beat. Stop typing and you sink.
            </p>
          </div>
        )}
        side={(
          <div className={`flight-sky ${kid ? 'flight-kid' : ''}`} ref={skyRef}>
            <canvas className="flight-canvas" ref={canvasRef} />
            {!hudInfo.launched && (
              <span className="flight-launch"><Ic n="keyboard" size={13} /> Type the word to take off</span>
            )}
          </div>
        )}
      />
      <MobileKeys active={phase === 'run'} />
    </>
  );
}

const frameOf = (s: { alt: number; vy: number; dist: number; turb: number; flapN: number; seaAlt: number; launched: boolean; dead: boolean; buoys: Buoy[] }): FlightFrame => ({
  alt: s.alt, vy: s.vy, dist: s.dist, turb: s.turb, flapN: s.flapN, seaAlt: s.seaAlt,
  launched: s.launched, dead: s.dead, buoys: s.buoys,
});

/** Read a hue out of a theme token so the bird is coloured like the app. */
function readHue(css: string): number | null {
  const hex = css.trim();
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function isLight(css: string): boolean {
  const hex = css.trim();
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 140;
}
