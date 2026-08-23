import { useEffect, useMemo, useRef, useState } from 'react';
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
import { floatText, screenShake } from '../lib/fx';
import { createStackScene, type StackScene } from './stackScene';
import type { Rewards } from '../lib/types';

const DURATION = 60;

/**
 * Block Stack: the tower is your speed curve stood on end.
 *
 * Every word adds a storey, and the only thing that sets its width is how fast
 * that word came out relative to your own pace. So the building is a record of
 * the run: a warm-up taper at the bottom, a steady column where you found your
 * rhythm, a shelf where you tried to sprint.
 *
 * There is one failure and it is visible in the building itself: the tower
 * narrows when you drop below your pace, and a storey too thin to carry
 * anything snaps the whole spire off. No hidden meter decides it. Typos eat
 * width as well, so accuracy and speed spend the same currency.
 *
 * Which makes the winning strategy the same as the real lesson: find a pace you
 * can actually hold and raise it a little at a time. Because width compounds, a
 * cold streak is visible three storeys before it costs you anything.
 */

/**
 * Width in pace units, where the tower starts at 1.
 *
 * Width is not recomputed from each word, it is *carried*: every word
 * multiplies the width of the storey below it. Beat your pace and the tower
 * grows, drop under it and the tower tapers, and holding your pace exactly
 * holds the width. That compounding is the whole game, because it means a
 * cold streak is visible three storeys before it kills you.
 */
const MIN_W = 0.34;
const MAX_W = 1.75;
/** Below this a storey is too thin to carry anything and the tower buckles. */
const CRITICAL = 0.38;
/** After a buckle the tower resumes from the last storey at least this wide. */
const FOOTING = 0.8;
/** The most one word may change the width, so masonry does not teleport. */
const MAX_GROW = 1.26;
const MAX_SHRINK = 0.76;
/**
 * Each typo eats this much of the storey on top of whatever the pace did, and
 * a thoroughly mistyped word can cost more than a merely slow one, which is
 * why the floor here is below MAX_SHRINK.
 */
const ERROR_BITE = 0.06;
const ERROR_FLOOR = 0.6;

const HINTS = [
  'Finish before the bar empties and the next storey comes out wider.',
  'Fall behind and the tower tapers. Too thin and the spire snaps off.',
  'Typos eat width as well. Clean and quick is what builds high.',
];

interface Landing { id: number; word: string; kind: 'wider' | 'steady' | 'narrower' | 'cracked' }

export default function StackGame() {
  const data = useData();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const kid = data?.profile.ageGroup === 'kid';
  const rng = useRef(mulberry32(Date.now() % 1e9));
  const pool = useMemo(
    () => (kid ? KID_WORDS.filter((w) => w.length >= 3) : COMMON_WORDS.filter((w) => w.length >= 4 && w.length <= 9)),
    [kid],
  );

  /**
   * The pace every storey is measured against, in words per minute, fixed for
   * the whole run. A rolling baseline would chase the learner and flatten the
   * tower into a featureless column: beating your own pace has to be visible.
   */
  const baseline = useMemo(() => {
    const recent = (data?.sessions ?? []).slice(-12).map((s) => s.wpm).filter((n) => n > 3).sort((a, b) => a - b);
    if (!recent.length) return kid ? 12 : 28;
    return Math.max(6, recent[Math.floor(recent.length / 2)]);
  }, [data?.sessions, kid]);

  const [phase, setPhase] = useState<'intro' | 'run' | 'over'>('intro');
  const [word, setWord] = useState('');
  const [nextWord, setNextWord] = useState('');
  const [pos, setPos] = useState(0);
  const [wordErrs, setWordErrs] = useState(0);
  const [height, setHeight] = useState(0);
  const [width, setWidth] = useState(1);
  const [collapses, setCollapses] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [wordsDone, setWordsDone] = useState(0);
  const [landing, setLanding] = useState<Landing | null>(null);
  const [paceBase, setPaceBase] = useState(0);
  const [overInfo, setOverInfo] = useState<{ score: number; height: number; gold: number; wpm: number; acc: number; rewards: Rewards | null; newBest: boolean } | null>(null);

  const strokes = useRef<GameStroke[]>([]);
  const startedAt = useRef(0);
  const pausedAt = useRef(0);
  const timer = useRef(0);
  const siteRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<StackScene | null>(null);
  const phaseRef = useRef(phase);
  const landingId = useRef(1);
  const wordShownAt = useRef(0);
  const deltaRef = useRef<HTMLSpanElement>(null);
  const paceRef = useRef<HTMLDivElement>(null);
  const paceFillRef = useRef<HTMLElement>(null);
  /**
   * The run's tally, kept outside React so the timer's endGame reads truth.
   * `widths` is every storey standing, which is what a buckle searches to find
   * the last one with real footing under it.
   */
  const run = useRef({ height: 0, tallest: 0, steady: 0, score: 0, widths: [1], collapses: 0 });
  /**
   * The pace actually being typed at, and the pace the tower is measured
   * against. History can be stale, or from a different kind of session, or
   * simply absent, and a baseline that is wildly wrong makes every storey a
   * neck and the game unplayable through no fault of the player. So the first
   * few words get a vote: if the run disagrees with the history by a lot, the
   * run wins. Small differences are left alone, because beating your usual
   * pace by a little is the entire point and must stay visible.
   */
  const pace = useRef({ base: 0, seen: [] as number[] });
  const st = useRef({ word: '', next: '', pos: 0, errs: 0 });
  phaseRef.current = phase;

  const newWord = () => {
    const s = st.current;
    s.word = s.next || pick(rng.current, pool);
    s.next = pick(rng.current, pool);
    s.pos = 0; s.errs = 0;
    setWord(s.word); setNextWord(s.next); setPos(0); setWordErrs(0);
    wordShownAt.current = performance.now();
  };

  /**
   * How long the current word has taken. The clock simply runs from the moment
   * the word appears: hesitating is slow typing, and a storey that stops
   * shrinking while you stare at the word is a promise the game does not keep.
   *
   * This used to hold for 600ms before the first keystroke, to stop a screen
   * transition poisoning the opening word. That guard belonged to the old
   * scoring, where one slow word could set the width outright; width compounds
   * now and can only move a quarter either way, so the worst a bad start can
   * do is one narrow storey. The scene start reseats this clock for the first
   * word, which is the part that was actually unfair.
   */
  const elapsedFor = (now: number) => now - wordShownAt.current;

  const tick = () => {
    const left = DURATION - (performance.now() - startedAt.current) / 1000;
    setTimeLeft(Math.max(0, left));
    if (left <= 0) endGame();
  };

  const start = () => {
    strokes.current = [];
    startedAt.current = performance.now();
    pausedAt.current = 0;
    st.current.next = '';
    run.current = { height: 0, tallest: 0, steady: 0, score: 0, widths: [1], collapses: 0 };
    pace.current = { base: baseline, seen: [] };
    setPaceBase(baseline);
    setHeight(0); setWidth(1); setCollapses(0); setLanding(null);
    setTimeLeft(DURATION); setWordsDone(0);
    newWord();
    setPhase('run');
    window.clearInterval(timer.current);
    timer.current = window.setInterval(tick, 250);
  };

  const endGame = () => {
    window.clearInterval(timer.current);
    if (phaseRef.current !== 'run') return;
    const r = run.current;
    const result = resultFromStrokes('game', 'Block Stack', strokes.current, startedAt.current, performance.now(), { game: 'stack', score: r.score, height: r.tallest });
    const rewards = strokes.current.length > 8 ? recordSession(result) : null;
    let newBest = false;
    patch((d) => {
      const cur = d.gameBests['stack'];
      if (!cur || r.score > cur.score) { d.gameBests['stack'] = { score: r.score, level: r.tallest }; newBest = true; }
    });
    if (newBest) pushToast({ kind: 'record', icon: 'blocks', title: 'Tallest tower yet!' });
    // The Arena board is posted by <ArenaResult> from these numbers, so the
    // run's typing quality has to survive into the over phase alongside the
    // game's own score. See docs/arena-leaderboards.md §10 step 4.
    setOverInfo({
      score: r.score, height: r.tallest, gold: r.steady,
      wpm: result.wpm, acc: result.acc, rewards, newBest,
    });
    setPhase('over');
  };

  /** The word is done: work out how wide that makes the storey, and stack it. */
  const settle = () => {
    const scene = sceneRef.current;
    const s = st.current;
    const r = run.current;
    const site = siteRef.current;
    setWordsDone((n) => n + 1);

    const elapsed = elapsedFor(performance.now());
    const wpm = (s.word.length / 5) / Math.max(0.0001, elapsed / 60000);

    const p = pace.current;
    p.seen.push(wpm);
    if (p.seen.length === 3) {
      const sorted = [...p.seen].sort((a, b) => a - b);
      const observed = Math.max(4, sorted[1]);
      if (observed > p.base * 1.35 || observed < p.base * 0.65) {
        p.base = observed;
        setPaceBase(observed);
      }
    }
    // How much this word grew or shrank the tower. Beating your pace makes the
    // next storey wider than the last one, missing it makes it narrower, and
    // hitting it exactly holds the line. Same function the live readout uses,
    // so the number under the word is a promise rather than a hint.
    const cracked = s.errs > 0;
    const factor = factorAt(elapsed, s.word.length, s.errs, p.base);

    const prev = r.widths[r.widths.length - 1];
    const raw = prev * factor;

    if (raw < CRITICAL) { buckle(); newWord(); return; }

    const width = Math.max(MIN_W, Math.min(MAX_W, raw));
    // The foundation takes the shape of the storey it carries, so nobody is
    // punished for the pace they happened to open with.
    if (r.height === 0) r.widths[0] = width;
    r.widths.push(width);
    r.height += 1;
    r.tallest = Math.max(r.tallest, r.height);
    // Height is the spine of the score and width is what a fast run buys, so a
    // tall thin tower and a short fat one are worth roughly the same.
    r.score += 8 + Math.round(width * 14);
    if (factor > 1) r.steady += 1;

    scene?.place(width, cracked);
    // The tower sways as it thins: the warning has to be in the thing you are
    // watching, not in a meter somewhere else.
    scene?.setStrain(peril(width));
    setHeight(r.height);
    setWidth(width);
    setLanding({
      id: landingId.current++,
      word: s.word,
      kind: cracked ? 'cracked' : factor > 1.02 ? 'wider' : factor < 0.98 ? 'narrower' : 'steady',
    });

    if (data?.settings.soundOn) (factor > 1 ? snd.step() : snd.pop());
    newWord();
  };

  /**
   * Too thin to carry anything. The spire snaps off at the last storey with
   * real footing under it, so what you lose is exactly the stretch where you
   * were slowing down, and you carry on from the part you built properly.
   */
  const buckle = () => {
    const r = run.current;
    const scene = sceneRef.current;
    const site = siteRef.current;

    let footing = 0;
    for (let i = r.widths.length - 1; i >= 0; i--) {
      if (r.widths[i] >= FOOTING) { footing = i; break; }
    }
    const lost = r.height - footing;

    scene?.shear(footing);
    r.widths = r.widths.slice(0, footing + 1);
    r.height = footing;
    r.collapses += 1;

    const w = r.widths[r.widths.length - 1] ?? 1;
    scene?.setStrain(peril(w));
    setHeight(r.height);
    setWidth(w);
    setCollapses(r.collapses);
    setLanding(null);
    if (site) {
      screenShake(site, 10);
      floatText(site, lost > 1 ? `${lost} storeys lost` : 'it buckled', site.clientWidth / 2, site.clientHeight * 0.4, 'fx-bad');
    }
    if (data?.settings.soundOn) snd.err();
  };

  const handleKey = (key: string) => {
    const s = st.current;
    if (phaseRef.current !== 'run' || key.length !== 1) return;
    const want = s.word[s.pos];
    if (want === undefined) return;
    const ok = key === want;
    strokes.current.push({ t: performance.now(), exp: want, ok });
    if (ok) {
      if (data?.settings.soundOn) snd.key();
      if (s.pos + 1 >= s.word.length) settle();
      else { s.pos += 1; setPos(s.pos); }
    } else {
      s.errs += 1;
      setWordErrs(s.errs);
      if (data?.settings.soundOn) snd.err();
    }
  };

  useGameKeys(phase === 'run', handleKey, { onEscape: endGame });
  useEffect(() => () => window.clearInterval(timer.current), []);

  // The live preview: the storey you are about to place, hovering over the
  // tower at the width it would come out right now, shrinking while you type.
  // The percentage beside the word is the same number said precisely.
  //
  // Deliberately not React state. This changes twelve times a second and
  // nothing else on the page depends on it, so it writes to one text node and
  // one mesh instead of re-rendering the stage.
  useEffect(() => {
    if (phase !== 'run') return;
    const paint = () => {
      const s = st.current;
      if (!s.word) return;
      const r = run.current;
      const elapsed = elapsedFor(performance.now());
      const f = factorAt(elapsed, s.word.length, s.errs, pace.current.base);
      const prev = r.widths[r.widths.length - 1];
      const raw = prev * f;

      sceneRef.current?.setPreview(Math.min(MAX_W, raw), raw < CRITICAL);

      // The bar empties exactly as the factor crosses 1, because both are the
      // same number: at your own pace a word takes `expected` milliseconds.
      const expected = ((s.word.length / 5) / pace.current.base) * 60000;
      if (paceFillRef.current) {
        paceFillRef.current.style.transform = `scaleX(${Math.max(0, Math.min(1, 1 - elapsed / expected))})`;
      }
      if (paceRef.current) paceRef.current.dataset.over = elapsed > expected ? 'true' : 'false';

      const el = deltaRef.current;
      if (!el) return;
      const pct = Math.round((f - 1) * 100);
      el.textContent = raw < CRITICAL ? 'too thin to stand' : `${pct > 0 ? '+' : ''}${pct}% width`;
      el.dataset.tone = raw < CRITICAL ? 'down' : pct > 0 ? 'up' : pct < 0 ? 'down' : 'level';
    };
    paint();
    const id = window.setInterval(paint, 80);
    return () => window.clearInterval(id);
  }, [phase]);

  // A hidden tab suspends requestAnimationFrame, so the tower stops moving
  // while the clock, which is an interval, keeps counting. Coming back to
  // twenty fewer seconds is not a game you lost. Hold both.
  useEffect(() => {
    if (phase !== 'run') return;
    const onVisibility = () => {
      if (document.hidden) {
        window.clearInterval(timer.current);
        sceneRef.current?.stop();
        pausedAt.current = performance.now();
      } else {
        if (pausedAt.current) {
          startedAt.current += performance.now() - pausedAt.current;
          wordShownAt.current += performance.now() - pausedAt.current;
          pausedAt.current = 0;
        }
        sceneRef.current?.start();
        window.clearInterval(timer.current);
        timer.current = window.setInterval(tick, 250);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [phase]);

  // The scene lives as long as the run does. Building it costs a WebGL
  // context, so it is not rebuilt per word, and it is torn down on the way out.
  useEffect(() => {
    if (phase !== 'run' || !canvasRef.current) return;
    const style = getComputedStyle(document.documentElement);
    const hue = readHue(style.getPropertyValue('--accent2')) ?? 268;
    const light = isLight(style.getPropertyValue('--bg'));
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = createStackScene(canvasRef.current, { hue, light, calm });
    sceneRef.current = scene;
    scene.reset();
    scene.start();
    // Building a WebGL context takes long enough to be worth a storey. The
    // first word's clock starts when the tower is actually on screen, not when
    // the phase flipped.
    wordShownAt.current = performance.now();
    return () => { scene.dispose(); sceneRef.current = null; };
  }, [phase]);

  if (!data) return null;
  const hint = wordsDone < HINTS.length ? HINTS[wordsDone] : '';
  const bestLevel = data.gameBests['stack']?.level ?? 0;

  // The intro IS the page. A card inside a page inside a header bar put three
  // frames around a game's front door; the backdrop wants the whole area, and
  // the only chrome it needs is a way back out, which it carries itself.
  if (phase === 'intro') {
    return (
      <ArenaIntro
        game="stack"
        title="Build at the speed you type"
        onPlay={start}
        cta="Lay the foundation →"
        stats={data.gameBests['stack'] ? [
          { label: 'Your tallest', value: `${data.gameBests['stack'].level} storeys` },
          { label: 'Best score', value: data.gameBests['stack'].score },
        ] : undefined}
      >
        <p>
          Every word adds a storey. Beat the pace bar under the word and it comes out
          <strong> wider than the one below</strong>. Miss it and the tower tapers.
          The bar is set to your own pace, about {Math.round(baseline)} wpm.
        </p>
        <p>
          Keep missing and the tower narrows to a spire until it is too thin to carry
          anything, and <strong>the whole spire snaps off</strong>. You carry on from the
          last storey with real footing under it. Typos eat width too, so clean and quick
          is what builds high.
        </p>
      </ArenaIntro>
    );
  }

  // Play and finish share the intro's stage: same backdrop, same way out, same
  // two columns. See docs/arena-leaderboards.md §7.5.
  if (phase === 'over' && overInfo) {
    return (
      <ArenaResult
        game="stack"
        run={{ wpm: overInfo.wpm, acc: overInfo.acc, value: overInfo.height }}
        score={overInfo.score}
        title={overInfo.newBest ? 'Tallest tower yet!' : `A ${overInfo.height}-storey tower`}
        newBest={overInfo.newBest}
        onAgain={start}
      >
        {overInfo.gold > 0 && (
          <Chip tone="gold"><Ic n="sparkles" size={12} /> {overInfo.gold} steady {overInfo.gold === 1 ? 'storey' : 'storeys'}</Chip>
        )}
        <RewardsBanner rewards={overInfo.rewards} />
        <p className="small muted" style={{ maxWidth: 430 }}>
          The tall towers are not the fast ones, they are the even ones. Find a pace you can hold
          and raise it a little at a time.
        </p>
      </ArenaResult>
    );
  }

  return (
    <>
      <ArenaStage
        game="stack"
        quiet
        hud={(
          <>
            <span><b>{height}</b> high</span>
            {collapses > 0 && <span className="muted">{collapses} {collapses === 1 ? 'collapse' : 'collapses'}</span>}
            {bestLevel > 0 && <span className="muted">best {bestLevel}</span>}
            <span className="grow" />
            {/* Footing, not strain. It is the same number the tower is drawn
                from, so the HUD and the building can never disagree. */}
            <span className={`stack-footing ${peril(width) > 0.6 ? 'bad' : ''}`} title="How much footing is left">
              <Ic n="gauge" size={13} />
              <i><b style={{ width: `${Math.round(Math.min(1, width / FOOTING) * 100)}%` }} /></i>
            </span>
            <span className={`arena-hud-clock ${timeLeft < 10 ? 'bad' : ''}`}>{Math.ceil(timeLeft)}s</span>
          </>
        )}
        main={(
          <div className="stack-band">
            <p className="arena-stage-kicker"><Ic n="keyboard" size={14} /> Type this</p>
            <div className="stack-word">
              <span className="good">{word.slice(0, pos)}</span>
              <span className="duel-cur">{word[pos] ?? ''}</span>
              <span className="muted">{word.slice(pos + 1)}</span>
            </div>
            {/* The bar drains over exactly the time this word takes at your own
                pace, so it is the line between a wider storey and a narrower
                one. It used to just empty and sit there, which promised
                something and then did nothing: now the moment it runs out the
                whole thing flips to losing, on the same delay, in CSS. */}
            {/* Driven from the same clock as everything else, not a CSS
                animation of its own. As an animation it started when the word
                appeared, while scoring does not start until just before your
                first keystroke, so the bar could sit empty and red next to a
                readout saying +21%. Two clocks, two answers. */}
            <div className="stack-pace" ref={paceRef}>
              <i ref={paceFillRef} />
              <b />
            </div>
            {/* What finishing right now would do to the width, counting down
                live. "Losing width" named the direction but not the price, and
                the price is the whole decision: it is the difference between
                pushing on and taking the hit. Written straight to the DOM at
                12fps rather than through state, so the readout does not
                re-render the page ten times a second. */}
            <span className="stack-delta" ref={deltaRef} data-tone="up">+0%</span>
            <div className="stack-band-meta">
              {wordErrs > 0
                ? <Chip tone="warn"><Ic n="waves" size={12} /> cracked</Chip>
                : <Chip tone="good"><Ic n="check" size={12} /> clean</Chip>}
              <span className="stack-next"><span className="muted">next</span> {nextWord}</span>
            </div>
            <p className="stack-verdict" key={landing?.id ?? 'none'}>
              {landing?.kind === 'steady' && <span className="stack-v-perfect"><Ic n="check" size={13} /> {landing.word} held the width</span>}
              {landing?.kind === 'wider' && <span className="good"><Ic n="trending" size={13} /> {landing.word} widened the tower</span>}
              {landing?.kind === 'narrower' && <span className="muted">{landing.word} narrowed the tower</span>}
              {landing?.kind === 'cracked' && <span className="warn">{landing.word} cost you width</span>}
            </p>
            <p className="stack-hint muted small">{hint && <><Ic n="bulb" size={13} /> {hint}</>}</p>
          </div>
        )}
        side={(
          <div className="stack-site" ref={siteRef}>
            <canvas className="stack-canvas" ref={canvasRef} />
          </div>
        )}
      />
      <MobileKeys active={phase === 'run'} />
    </>
  );
}

/**
 * What finishing the word right now would do to the width, as a multiplier.
 *
 * Shared by the scoring and by the live readout under the word, because a
 * preview that is computed differently from the thing it previews is worse
 * than no preview at all.
 */
function factorAt(elapsedMs: number, len: number, errs: number, base: number): number {
  const wpm = (len / 5) / Math.max(0.0001, elapsedMs / 60000);
  // The pace is clamped first and the typos bite afterwards. Taking the bite
  // before the clamp meant that early in a word, where the raw pace is far
  // above the cap, three mistakes changed the number by nothing at all: they
  // were charged, but invisibly, which is the same as lying about them.
  const paced = Math.max(MAX_SHRINK, Math.min(MAX_GROW, 1 + (wpm / base - 1) * 0.35));
  return Math.max(ERROR_FLOOR, paced - errs * ERROR_BITE);
}

/** 0 when the tower is solid, 1 when the next slow word will snap it. */
function peril(width: number): number {
  return Math.max(0, Math.min(1, (FOOTING - width) / (FOOTING - CRITICAL)));
}

/** Read a hue out of a theme token so the tower is coloured like the app. */
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
