import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useData, useStore, useUi } from '../lib/store';
import { COMMON_WORDS, KID_WORDS } from '../lib/words';
import { mulberry32, pickN } from '../lib/rng';
import { Btn } from '../components/ui';
import { resultFromStrokes, type GameStroke } from '../components/typing';
import { snd } from '../lib/sound';
import { RewardsBanner } from '../components/ResultsPanel';
import { ArenaIntro, ArenaResult, ArenaStage } from '../components/arena';
import { arenaRunFigures } from '../lib/arenaBoard';
import { Ic } from '../components/icons';
import { Diver, MobileKeys, useGameKeys } from '../components/gamekit';
import type { Rewards } from '../lib/types';

/**
 * Pearl Dive — one descent, and every dive is longer than the last.
 *
 * Land a dive without a single wrong key and you go deeper. One slip, or one
 * empty breath, and the run is over where it stands. Every word brought up
 * clean is a pearl, so the board is simply how deep you got.
 *
 * It began as six bets: choose shallow, deep or trench before each dive, for
 * one, four or ten pearls. The arithmetic killed it. Above roughly 85% per-word
 * accuracy the trench pays best every time, so the choice was a formality with
 * three buttons that the player had to perform six times, and two runs on the
 * same board could have nothing in common beyond a name. One path removes the
 * fake decision and makes the board a single legible number.
 *
 * What survives is the thing no other competitive game in the Arena measures.
 * There is no speed term anywhere near this game: the breath meter bounds a
 * dive so it cannot become forty words typed at leisure, and beyond that the
 * only question is how long you can go without dropping a letter.
 */

/**
 * The board's own formula, mirrored so the number counting up on the finish
 * screen is the number that lands on the row underneath it. Must stay in step
 * with the `pearl` branch of `arena_score()`
 * (supabase/migrations/20260820090000_pearl_dive.sql).
 */
const pearlScore = (pearls: number, acc: number) => {
  const f = arenaRunFigures({ wpm: 0, acc, value: pearls });
  return Math.round(f.value * 30 + f.acc * 6);
};

/**
 * The ladder, in words per dive.
 *
 * Growth is gentle at the top and steep further down, because the failure it is
 * built around is cumulative: at a fixed per-word accuracy the chance of landing
 * a phrase falls off a cliff with length, and a ladder that grew linearly would
 * have a long boring stretch followed by a wall. Past the written rungs it keeps
 * climbing by a fixed step, so a run has no ceiling and an exceptional one is
 * never cut short by the table running out.
 */
const LADDER = {
  kid: { rungs: [3, 4, 6, 8, 10, 13, 16, 19, 23, 27], step: 5 },
  other: { rungs: [4, 6, 8, 11, 14, 18, 22, 27, 32, 38], step: 8 },
};

function wordsAt(n: number, kid: boolean): number {
  const l = kid ? LADDER.kid : LADDER.other;
  return n <= l.rungs.length
    ? l.rungs[n - 1]
    : l.rungs[l.rungs.length - 1] + (n - l.rungs.length) * l.step;
}

/**
 * Where the water gets its names. `from` is the first dive of the zone, so a
 * run that landed four dives reached the Deep and one that landed none never
 * left the surface.
 */
const ZONES = [
  { from: 1, name: 'the Shallows' },
  { from: 3, name: 'the Deep' },
  { from: 5, name: 'the Trench' },
  { from: 7, name: 'the Abyss' },
];

const zoneFor = (landed: number) =>
  [...ZONES].reverse().find((z) => landed >= z.from)?.name ?? 'the surface';

/**
 * How far down the column a diver sits having landed `n` dives. Ten dives spans
 * it; anything beyond that holds at the floor rather than swimming off the
 * bottom of the panel.
 */
const depthAt = (n: number) => 8 + 80 * Math.min(1, n / 10);

/**
 * Breath per word. A dive has to be bounded or a forty-word phrase becomes
 * forty words typed at leisure, but the meter must never be the thing that
 * decides a dive for a learner typing at a sensible pace: this is roughly twice
 * what a 20 wpm typist needs, and kids get more again.
 */
const BREATH_PER_WORD = { kid: 5000, other: 3500 };

type Outcome = 'landed' | 'slipped' | 'drowned';

/**
 * What the surfacing card says, captured at the instant the dive ended.
 *
 * Every field is read off a ref at that moment rather than off state
 * afterwards, because the next dive overwrites the phrase and the position: a
 * card that reconstructed "what went wrong" from current state would be
 * describing the dive after the one it is about.
 */
interface Surfaced {
  outcome: Outcome;
  /** Which dive this was, and how long it was. */
  dive: number;
  words: number;
  phrase: string;
  /** How far into the phrase the dive got. */
  at: number;
  /** The letter the phrase wanted there, and the one that actually arrived. */
  expected: string;
  got: string;
  /** What the next dive would be, for a landing. */
  next: number;
}

/**
 * How long the card ignores the keyboard.
 *
 * The card is dismissed by any key, which is right for a game played entirely
 * with the hands on the keys, and wrong for the first fraction of a second: a
 * dive ends on a wrong keystroke, and the keystroke already on its way when
 * that happened would skip the explanation before it rendered. Fast typists hit
 * this every time, which is exactly the group most likely to need reading what
 * they did.
 */
const READ_GRACE = 750;

/**
 * How many WHOLE words were behind the diver when the dive ended. A word half
 * typed is not a word got, which is the count that makes "three of ten" mean
 * something.
 */
function wordsIn(phrase: string, at: number): number {
  if (at <= 0) return 0;
  const parts = phrase.slice(0, at).split(' ');
  const midWord = at < phrase.length && phrase[at] !== ' ';
  return Math.max(0, parts.length - (midWord ? 1 : 0));
}

/** A space typed as ␣, so "you pressed  where it wanted e" cannot happen. */
const shown = (c: string) => (c === ' ' ? '␣' : c);

/**
 * The surfacing card: what just happened, before anything else moves.
 *
 * The phrase is reprinted with the break marked, because the useful thing to
 * know after a lost dive is not "you slipped" but *where*: three words in with
 * seven to go is a different lesson from the last letter of the last word.
 */
function SurfacedCard({ s, onGo, ready }: { s: Surfaced; onGo: () => void; ready: boolean }) {
  const got = wordsIn(s.phrase, s.at);
  const landed = s.outcome === 'landed';

  const head = landed
    ? `Dive ${s.dive} landed.`
    : s.outcome === 'slipped' ? 'The line slipped.' : 'Out of breath.';

  // No number appears twice across these two lines: the first says what
  // happened, the second says what it means for the run.
  const line = landed
    ? `${s.words} words, not one wrong key. That is ${s.words} more pearls.`
    : s.outcome === 'slipped'
      ? `You pressed ${shown(s.got)} where it wanted ${shown(s.expected)}.`
      : 'The air went before the words did.';

  const cost = landed
    ? `Dive ${s.dive + 1} is ${s.next} words.`
    : `${got} of ${s.words} words. The run ends here.`;

  return (
    <div className={`pv-card pv-card-${s.outcome}`} role="status">
      <span className="pv-card-ic"><Ic n={landed ? 'shell' : 'waves'} size={22} /></span>
      <h2 className="pv-card-head">{head}</h2>
      <p className="pv-card-line">{line}</p>
      {/* The break, shown rather than described. */}
      <p className="pv-card-phrase">
        <span className="good">{s.phrase.slice(0, s.at)}</span>
        {s.at < s.phrase.length && (
          <span className={s.outcome === 'slipped' ? 'pv-card-break' : 'pv-card-stop'}>
            {shown(s.phrase[s.at])}
          </span>
        )}
        <span className="muted">{s.phrase.slice(s.at + 1)}</span>
      </p>
      <p className="pv-card-cost">{cost}</p>
      <Btn onClick={onGo} className="pv-card-go">
        {landed ? 'Go deeper →' : 'See your haul →'}
      </Btn>
      <span className={`pv-card-hint small muted ${ready ? 'on' : ''}`}>or press any key</span>
    </div>
  );
}

export default function PearlDiveGame() {
  const data = useData();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const kid = data?.profile.ageGroup === 'kid';
  const rng = useRef(mulberry32(Date.now() % 1e9));

  const [phase, setPhase] = useState<'intro' | 'dive' | 'surfaced' | 'over'>('intro');
  const [dive, setDive] = useState(1);
  const [landed, setLanded] = useState(0);
  const [pearls, setPearls] = useState(0);
  const [phrase, setPhrase] = useState('');
  const [pos, setPos] = useState(0);
  const [breath, setBreath] = useState(1);
  const [surfaced, setSurfaced] = useState<Surfaced | null>(null);
  const [readable, setReadable] = useState(false);
  const [log, setLog] = useState<{ dive: number; words: number; outcome: Outcome }[]>([]);
  const [overInfo, setOverInfo] = useState<{
    pearls: number; landed: number; acc: number; wpm: number; rewards: Rewards | null;
  } | null>(null);

  // Refs are the source of truth for anything the key handler reads, so no
  // keystroke is lost to a stale closure when two land before a re-render.
  const phraseRef = useRef('');
  const posRef = useRef(0);
  const phaseRef = useRef<typeof phase>('intro');
  const pearlsRef = useRef(0);
  const landedRef = useRef(0);
  const diveRef = useRef(1);
  const logRef = useRef<{ dive: number; words: number; outcome: Outcome }[]>([]);
  const strokes = useRef<GameStroke[]>([]);
  const startedAt = useRef(0);
  const breathTimer = useRef(0);
  const diveDone = useRef(false);

  const setPhaseBoth = (p: typeof phase) => { phaseRef.current = p; setPhase(p); };
  const clearTimers = () => window.clearInterval(breathTimer.current);
  useEffect(() => clearTimers, []);

  const pool = useMemo(
    () => (kid ? KID_WORDS : COMMON_WORDS).filter((w) => w.length >= 3 && w.length <= 8),
    [kid],
  );

  const finishRun = useCallback(() => {
    clearTimers();
    const result = resultFromStrokes(
      'game', 'Pearl Dive', strokes.current, startedAt.current, performance.now(),
      { game: 'pearl', pearls: pearlsRef.current, dives: landedRef.current },
    );
    const rewards = strokes.current.length > 10 ? recordSession(result) : null;
    patch((s) => {
      const cur = s.gameBests['pearl'];
      const score = pearlScore(pearlsRef.current, result.acc);
      if (!cur || score > cur.score) s.gameBests['pearl'] = { score, level: landedRef.current };
    });
    if (landedRef.current >= 5) {
      pushToast({
        kind: 'record', icon: 'shell', title: 'Deep haul!',
        body: `${landedRef.current} dives, down to ${zoneFor(landedRef.current)}`,
      });
    }
    if (data?.settings.soundOn) snd.done();
    setOverInfo({
      pearls: pearlsRef.current, landed: landedRef.current,
      acc: result.acc, wpm: result.wpm, rewards,
    });
    setPhaseBoth('over');
  }, [data?.settings.soundOn, recordSession, patch, pushToast]);

  const startDive = useCallback((n: number) => {
    clearTimers();
    const words = wordsAt(n, kid);
    const text = pickN(rng.current, pool, words).join(' ');
    phraseRef.current = text;
    posRef.current = 0;
    diveDone.current = false;
    diveRef.current = n;
    setDive(n);
    setSurfaced(null);
    setPhrase(text);
    setPos(0);
    setBreath(1);
    setPhaseBoth('dive');
    const total = words * (kid ? BREATH_PER_WORD.kid : BREATH_PER_WORD.other);
    const from = performance.now();
    breathTimer.current = window.setInterval(() => {
      const leftPct = Math.max(0, 1 - (performance.now() - from) / total);
      setBreath(leftPct);
      if (leftPct <= 0) endDive('drowned');
    }, 100);
    // endDive only touches refs and setters, so it does not need to be a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, kid]);

  /**
   * Land or lose the dive in one place, so every ending books the same things
   * and then stops on the same card.
   *
   * It used to book them and move straight on, which for a slip meant the dive
   * was over in the same frame as the mistake: the only trace was one line of
   * text above the next screen, and a player genuinely could not tell whether
   * they had mistyped or the breath had run out.
   */
  const endDive = useCallback((outcome: Outcome, got = '') => {
    if (diveDone.current || phaseRef.current !== 'dive') return;
    diveDone.current = true;
    clearTimers();
    const n = diveRef.current;
    const words = wordsAt(n, kid);
    if (outcome === 'landed') {
      // One pearl per word brought up clean, which is why the board's count and
      // the thing the game is about are the same number.
      pearlsRef.current += words;
      landedRef.current = n;
      setPearls(pearlsRef.current);
      setLanded(n);
    }
    logRef.current = [...logRef.current, { dive: n, words, outcome }];
    setLog(logRef.current);
    setSurfaced({
      outcome, dive: n, words,
      phrase: phraseRef.current,
      at: posRef.current,
      expected: phraseRef.current[posRef.current] ?? '',
      got,
      next: wordsAt(n + 1, kid),
    });
    setReadable(false);
    window.setTimeout(() => setReadable(true), READ_GRACE);
    if (data?.settings.soundOn) (outcome === 'landed' ? snd.pop() : snd.err());
    setPhaseBoth('surfaced');
  }, [kid, data?.settings.soundOn]);

  /** Off the card: one rung deeper, or the finish screen. */
  const goOn = useCallback(() => {
    if (phaseRef.current !== 'surfaced') return;
    if (surfaced?.outcome === 'landed') startDive(diveRef.current + 1);
    else finishRun();
  }, [surfaced, startDive, finishRun]);

  const startRun = () => {
    strokes.current = [];
    startedAt.current = performance.now();
    pearlsRef.current = 0;
    landedRef.current = 0;
    logRef.current = [];
    setPearls(0);
    setLanded(0);
    setLog([]);
    setSurfaced(null);
    setOverInfo(null);
    startDive(1);
  };

  const handleKey = (key: string) => {
    if (phaseRef.current !== 'dive' || key.length !== 1) return;
    const want = phraseRef.current[posRef.current];
    if (want === undefined) return;
    const ok = key === want;
    strokes.current.push({ t: performance.now(), exp: want, ok });
    if (!ok) { endDive('slipped', key); return; }
    posRef.current += 1;
    setPos(posRef.current);
    if (data?.settings.soundOn) snd.key();
    if (posRef.current >= phraseRef.current.length) endDive('landed');
  };

  // Any key moves on, once the card has been up long enough to have been read.
  // A dedicated listener rather than a branch inside useGameKeys, because that
  // hook swallows the keystroke as a typed character and this one is a nudge.
  useEffect(() => {
    if (phase !== 'surfaced' || !readable) return;
    const on = () => goOn();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [phase, readable, goOn]);

  useGameKeys(phase === 'dive', handleKey, {
    onEscape: () => { clearTimers(); diveDone.current = true; finishRun(); },
  });

  if (!data) return null;

  const best = data.gameBests['pearl'];
  const words = wordsAt(dive, kid);
  // Where the diver is: between the depth they held and the one this dive wins.
  const from = depthAt(dive - 1);
  const to = depthAt(dive);
  const diverTop = phase === 'dive'
    ? from + (pos / Math.max(1, phrase.length)) * (to - from)
    : depthAt(landed);

  if (phase === 'intro') {
    return (
      <ArenaIntro
        game="pearl"
        title="One descent. Every dive is longer."
        onPlay={startRun}
        cta="Take the first breath →"
        stats={[
          { label: 'First dive', value: `${wordsAt(1, kid)} words` },
          { label: 'Fifth dive', value: `${wordsAt(5, kid)} words` },
          ...(best ? [{ label: 'Deepest run', value: `${best.level} ${best.level === 1 ? 'dive' : 'dives'}` }] : []),
        ]}
      >
        <p>
          Dive one is {wordsAt(1, kid)} words. Land it without a single wrong key and you go
          deeper, and the next dive is longer, and so on for as long as you can hold it.
          Every word you bring up clean is a pearl.
        </p>
        <p>
          One slip, or one empty breath, and the run ends where it stands. There is no
          correcting a mistake down there and no easier route to take, so the board is
          simply how deep you got.
        </p>
        <div className="pv-ladder" aria-hidden>
          {ZONES.map((z) => (
            <div key={z.name} className="pv-rung">
              <span className="pv-rung-n">{wordsAt(z.from, kid)}</span>
              <span className="pv-rung-name">{z.name}</span>
            </div>
          ))}
        </div>
      </ArenaIntro>
    );
  }

  if (phase === 'over' && overInfo) {
    const reached = zoneFor(overInfo.landed);
    return (
      <ArenaResult
        game="pearl"
        run={{ wpm: overInfo.wpm, acc: overInfo.acc, value: overInfo.pearls }}
        score={pearlScore(overInfo.pearls, overInfo.acc)}
        title={overInfo.landed === 0
          ? 'The first dive got away'
          : `${overInfo.landed} ${overInfo.landed === 1 ? 'dive' : 'dives'}, down to ${reached}`}
        newBest={!best || pearlScore(overInfo.pearls, overInfo.acc) > best.score}
        onAgain={startRun}
      >
        <RewardsBanner rewards={overInfo.rewards} />
        <ul className="pv-log" aria-label="Your descent">
          {log.map((h) => (
            <li key={h.dive} className={`pv-log-row pv-log-${h.outcome}`}>
              <span className="pv-log-n">{h.dive}</span>
              <span className="pv-log-name">{h.words} words</span>
              <span className="pv-log-out">
                {h.outcome === 'landed' ? `+${h.words}` : h.outcome === 'slipped' ? 'slipped' : 'no breath'}
              </span>
            </li>
          ))}
        </ul>
        <p className="small muted" style={{ maxWidth: 430 }}>
          {overInfo.landed >= 6
            ? 'That is a long way down without dropping a letter. Very few runs reach the Trench.'
            : overInfo.landed >= 3
              ? 'The rungs get steep from here. Slowing down on the long ones is how they get landed.'
              : 'The early dives are short on purpose. Take them at a pace you can be exact at, and the depth comes.'}
        </p>
      </ArenaResult>
    );
  }

  const scene = (
    <div className="pv-scene">
      <div className="pv-water">
        <span className="pv-surface" />
        {ZONES.map((z) => (
          <span
            key={z.name}
            className={`pv-mark ${zoneFor(landed) === z.name ? 'on' : ''}`}
            style={{ top: `${depthAt(z.from - 1)}%` }}
          >
            <b>{wordsAt(z.from, kid)}</b> {z.name}
          </span>
        ))}
        <span className="pv-diver" style={{ top: `${diverTop}%` }} aria-hidden>
          <Diver size={110} />
        </span>
        <span className="pv-floor" />
      </div>
      <div className="pv-purse" aria-label={`${pearls} pearls so far`}>
        {Array.from({ length: Math.min(pearls, 60) }).map((_, i) => <i key={i} className="pv-pearl" />)}
        {pearls === 0 && <span className="small muted">No pearls yet</span>}
      </div>
    </div>
  );

  return (
    <>
      <ArenaStage
        game="pearl"
        quiet
        hud={(
          <>
            <span>Dive {dive} · {words} words</span>
            <span className="grow" />
            <span className="pv-hud-pearls"><Ic n="shell" size={15} /> {pearls} {pearls === 1 ? 'pearl' : 'pearls'}</span>
          </>
        )}
        main={(
          <div className="pv-band">
            {phase === 'surfaced' && surfaced ? (
              <SurfacedCard s={surfaced} onGo={goOn} ready={readable} />
            ) : (
              <>
                <div className="pv-breath" aria-label={`Breath ${Math.round(breath * 100)}%`}>
                  <i style={{ width: `${breath * 100}%` }} className={breath < 0.25 ? 'pv-breath-low' : ''} />
                </div>
                <span className="pv-depth-tag">
                  <Ic n="waves" size={14} /> {zoneFor(dive)} · {words} words · no second chances
                </span>
                <p className="pv-phrase" aria-live="off">
                  <span className="good">{phrase.slice(0, pos)}</span>
                  <span className="pv-cur">{phrase[pos] === ' ' ? '␣' : phrase[pos] ?? ''}</span>
                  <span className="muted">{phrase.slice(pos + 1)}</span>
                </p>
              </>
            )}
          </div>
        )}
        side={scene}
      />
      <MobileKeys active={phase === 'dive' || phase === 'surfaced'} />
    </>
  );
}
