import { useEffect, useMemo, useRef, useState } from 'react';
import { useData, useStore, useUi } from '../lib/store';
import { Chip } from '../components/ui';
import { resultFromStrokes, type GameStroke } from '../components/typing';
import { snd } from '../lib/sound';
import { RewardsBanner } from '../components/ResultsPanel';
import { ArenaIntro, ArenaResult, ArenaStage } from '../components/arena';
import { StarterScene } from '../components/starterScenes';
import { LevelActions, LevelPicker, LevelResult, useStarterLadder } from '../components/starterLevels';
import { Ic } from '../components/icons';
import { MobileKeys, useGameKeys } from '../components/gamekit';
import { KeyboardVisual } from '../components/KeyboardVisual';
import { FINGER_NAMES, makeCharLookup } from '../lib/keyboard';
import { sparkBurst } from '../lib/fx';
import type { GuideStyle, Rewards } from '../lib/types';

/**
 * Alphabet Rocket — the third starter game, and the one that needs no reading
 * at all.
 *
 * A child who cannot read still knows the alphabet, because they have sung it
 * a hundred times. That is the whole design: the game never has to tell you
 * what comes next, because you already know, which leaves exactly one task on
 * screen, finding the key. Letter Fall names a random letter and asks you to
 * find it; this one asks the same question twenty six times in the order the
 * song goes, so a child who is stuck can sing their way to the answer instead
 * of waiting for a hint.
 *
 * It is also the only one of the three with a destination. Letter Fall ends
 * when three letters land and Key Safari ends when the meadow is full, and
 * both are fine, but neither is somewhere you arrive. This one is: z is the
 * moon, and the rocket is standing on it for the rest of the finish screen.
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

/** The bands the rocket climbs through, as a fraction of the flight. */
const BANDS = [
  { at: 0, name: 'on the launchpad' },
  { at: 0.16, name: 'over the trees' },
  { at: 0.36, name: 'in the clouds' },
  { at: 0.58, name: 'above the weather' },
  { at: 0.78, name: 'out among the stars' },
  { at: 0.96, name: 'coming in to land' },
];

export default function RocketGame() {
  const data = useData();
  const recordSession = useStore((s) => s.recordSession);
  const patchData = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const [phase, setPhase] = useState<'intro' | 'run' | 'over'>('intro');
  const [, force] = useState(0);
  const [press, setPress] = useState<{ key: string; ok: boolean; t: number } | null>(null);
  const [overInfo, setOverInfo] = useState<
    { score: number; solo: number; flown: number; acc: number; wpm: number;
      rewards: Rewards | null; newBest: boolean; level: number; goal: number; unlocked: boolean } | null
  >(null);

  const st = useRef({
    i: 0, solo: 0, score: 0, tries: 0, since: 0, helped: false,
    strokes: [] as GameStroke[], startedAt: 0,
  });
  const skyRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef(0);
  const tick = useRef(0);

  const { level, cleared, chosen, setChosen, begin, active, clear, total } = useStarterLadder('rocket');
  /** This level's stretch of the alphabet, in the direction it flies. */
  const AZ = useMemo(() => {
    const slice = ALPHABET.slice(level.from ?? 0, level.to ?? 26);
    return level.reverse ? [...slice].reverse() : slice;
  }, [level.from, level.to, level.reverse]);

  const layout = data?.profile.layout ?? 'qwerty';
  const lookup = useMemo(() => makeCharLookup(layout), [layout]);
  const guide: GuideStyle = data?.settings.guide === 'hidden' ? 'plain' : (data?.settings.guide ?? 'hands');

  const s = st.current;
  const ch = AZ[s.i] ?? '';
  const info = ch ? lookup(ch) : null;
  /**
   * The rule that makes the board mean something. A letter you found on your
   * own counts; a letter the game had to light up for you does not, and that
   * is the only difference between a first flight and a tenth. Nothing is
   * taken away for using the hint: it simply is not the same as not needing it.
   */
  const helping = phase === 'run' && !!ch && (performance.now() - s.since > 4000 || s.tries >= 2);

  const endGame = (landed: boolean) => {
    const cur = st.current;
    if (!cur.startedAt) return;
    window.clearInterval(tick.current);
    const at = active.current;
    const want = ALPHABET.slice(at.level.from ?? 0, at.level.to ?? 26).length;
    const won = landed || cur.i >= want;
    const first = won && at.n === cleared + 1;
    const result = resultFromStrokes('game', 'Alphabet Rocket', cur.strokes, cur.startedAt, performance.now(), {
      game: 'rocket', score: cur.score, solo: cur.solo, landed: landed ? 1 : 0, level: at.n,
      starterCleared: first ? 1 : 0,
    });
    /**
     * A finished level always counts, however few keys it took.
     *
     * The stroke floor is there to stop a run somebody opened and abandoned
     * from writing a session, and it was quietly eating the whole reward for
     * the shortest levels: level one of Paint Reveal is six tiles, so it never
     * reached the floor, never recorded a session, and paid nothing for the
     * level it had just cleared.
     */
    const rewards = (won || cur.strokes.length > 6) ? recordSession(result) : null;
    let newBest = false;
    patchData((d) => {
      const prev = d.gameBests['rocket'];
      if (!prev || cur.score > prev.score) { d.gameBests['rocket'] = { score: cur.score, level: cur.i }; newBest = true; }
    });
    if (newBest) pushToast({ kind: 'record', icon: 'trophy', title: 'New Alphabet Rocket best!' });
    if (won) {
      clear(at.n);
      if (first) pushToast({ kind: 'record', icon: 'map', title: `Level ${at.n} done!` });
    }
    setOverInfo({
      score: cur.score, solo: cur.solo, flown: cur.i, acc: result.acc, wpm: result.wpm,
      rewards, newBest, level: at.n, goal: want, unlocked: won,
    });
    setPhase('over');
  };

  const start = (n?: number) => {
    begin(n ?? active.current.n);
    st.current = { i: 0, solo: 0, score: 0, tries: 0, since: performance.now(), helped: false, strokes: [], startedAt: performance.now() };
    setPress(null);
    setPhase('run');
    // Nothing moves on its own here either. The tick exists so the hint can
    // arrive after a few seconds of hunting, and for no other reason.
    window.clearInterval(tick.current);
    tick.current = window.setInterval(() => force((n) => n + 1), 250);
  };

  useEffect(() => () => {
    window.clearInterval(tick.current);
    window.clearTimeout(pressTimer.current);
  }, []);

  const flashKey = (key: string, ok: boolean) => {
    setPress({ key, ok, t: performance.now() });
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => setPress(null), ok ? 200 : 320);
  };

  const handleKey = (raw: string) => {
    const cur = st.current;
    if (phase !== 'run' || !AZ[cur.i]) return;
    const key = raw.toLowerCase();
    if (key < 'a' || key > 'z') return;
    const t = performance.now();
    const want = AZ[cur.i];
    if (key !== want) {
      // Wrong key: the key you pressed shakes and the rocket does not move.
      // That is the whole consequence. No height is lost, because a rocket that
      // sinks when you guess turns a hunt into a punishment.
      cur.strokes.push({ t, exp: want, ok: false });
      flashKey(key, false);
      cur.tries++;
      if (data?.settings.soundOn) snd.err();
      force((n) => n + 1);
      return;
    }
    cur.strokes.push({ t, exp: want, ok: true });
    flashKey(key, true);
    const clean = !helping;
    if (clean) cur.solo++;
    cur.score += clean ? 20 : 10;
    cur.i++;
    cur.tries = 0;
    cur.since = performance.now();
    const sky = skyRef.current;
    if (sky) {
      // The burst goes where the rocket is, so the thrust reads as coming from
      // the letter you just pressed.
      const y = sky.clientHeight - 40 - (cur.i / AZ.length) * (sky.clientHeight - 120);
      sparkBurst(sky, sky.clientWidth / 2, y + 26, 8);
    }
    if (data?.settings.soundOn) snd.pop();
    if (cur.i >= AZ.length) {
      if (data?.settings.soundOn) snd.step();
      window.setTimeout(() => endGame(true), 1100);
      force((n) => n + 1);
      return;
    }
    if (cur.i % 6 === 0 && data?.settings.soundOn) snd.step();
    force((n) => n + 1);
  };

  useGameKeys(phase === 'run', handleKey, { onEscape: () => endGame(false) });

  if (!data) return null;

  if (phase === 'intro') {
    return (
      <ArenaIntro
        game="rocket"
        title="Fly the alphabet to the moon"
        onPlay={start}
        cta={`Level ${chosen}: ${level.name} →`}
        side={(
          <>
            <StarterScene game="rocket" />
            <LevelPicker game="rocket" cleared={cleared} chosen={chosen} onPick={setChosen} />
          </>
        )}
        stats={[
          { label: 'Levels done', value: `${cleared} of ${total}` },
          { label: 'This flight', value: `${AZ[0].toUpperCase()} to ${AZ[AZ.length - 1].toUpperCase()}` },
        ]}
      >
        <p>
          The rocket climbs one letter at a time, in alphabet order. Press <b>a</b> and it lifts off,
          then <b>b</b>, then <b>c</b>, all the way to <b>z</b> on the moon.
        </p>
        <p>
          You already know what comes next, because you know the song. The only job is finding it on
          the keyboard, and if a letter hides for too long the game lights it up for you.
        </p>
      </ArenaIntro>
    );
  }

  if (phase === 'over' && overInfo) {
    return (
      <ArenaResult
        game="rocket"
        run={{ wpm: overInfo.wpm, acc: overInfo.acc, value: overInfo.solo }}
        score={overInfo.score}
        title={overInfo.unlocked ? 'You landed on the moon' : 'Back on the ground'}
        /* The points best is still tracked, but the ribbon only comes out when
           the level actually went in. "New personal best" over a level you did
           not finish is two scoreboards disagreeing in front of a child. */
        newBest={overInfo.unlocked && overInfo.newBest}
        onAgain={() => start()}
        actions={(
          <LevelActions
            game="rocket" level={overInfo.level} unlocked={overInfo.unlocked}
            onPlay={(n) => start(n)} onPick={() => setPhase('intro')}
          />
        )}
        standing={(
          <LevelResult
            game="rocket" level={overInfo.level} done={overInfo.flown}
            goal={overInfo.goal} cleared={cleared} unlocked={overInfo.unlocked}
          />
        )}
      >
        <RewardsBanner rewards={overInfo.rewards} />
        <p className="small muted" style={{ maxWidth: 430 }}>
          {overInfo.solo >= overInfo.goal - 2
            ? `You found ${overInfo.solo} ${overInfo.solo === 1 ? 'letter' : 'letters'} on your own, with no help at all. You know this keyboard.`
            : `Found without a hint: ${overInfo.solo} of ${overInfo.goal}. Every flight, a few more of them are yours.`}
        </p>
      </ArenaResult>
    );
  }

  const flown = s.i / AZ.length;
  const band = [...BANDS].reverse().find((b) => flown >= b.at) ?? BANDS[0];

  return (
    <>
      <ArenaStage
        game="rocket"
        quiet
        wide
        hud={(
          <>
            <span><b>{s.i}</b> of {AZ.length} letters</span>
            <span className="lv-hud"><Ic n="map" size={13} /> Level {chosen} <b>{level.name}</b></span>
            <span className="grow" />
            <span className="ar-band"><Ic n="cloud" size={14} /> {band.name}</span>
          </>
        )}
        main={(
          <div className="ar-band-col">
            <p className="arena-stage-kicker"><Ic n="keyboard" size={14} /> Next in the alphabet</p>
            <div className="ar-big" data-help={helping ? 'true' : undefined}>
              {ch ? <span className="ar-big-ch">{ch}</span> : <span className="ar-big-ch ar-big-done"><Ic n="moon" size={54} /></span>}
            </div>
            <p className="ar-hint">
              {ch && info?.key && (helping
                ? <><Ic n="person" size={14} /> Use your <strong>{FINGER_NAMES[info.finger]}</strong> finger</>
                : <><Ic n="music" size={14} /> Sing it if you get stuck</>)}
              {!ch && <span className="good">The moon. You flew the whole alphabet.</span>}
            </p>
            {/* The alphabet itself, as the progress bar. It is the one progress
                bar a child can also use as an answer sheet: what comes next is
                the letter after the lit one, which is the question the game is
                asking. */}
            <ol className="ar-strip" aria-label={`Letter ${s.i + 1} of ${AZ.length}`}>
              {AZ.map((c, n) => (
                <li key={c} className={n < s.i ? 'ar-done' : n === s.i ? 'ar-now' : ''}>{c}</li>
              ))}
            </ol>
            <div className="ar-meta">
              <Chip tone={s.solo > 0 ? 'good' : undefined}><Ic n="star" size={12} /> {s.solo} all by yourself</Chip>
            </div>
          </div>
        )}
        side={(
          <div className="ar-scene">
            <div className="ar-sky" ref={skyRef} style={{ ['--flown' as string]: flown.toFixed(3) }}>
              <span className="ar-moon" aria-hidden><Ic n="moon" size={34} /></span>
              <span className="ar-stars" aria-hidden />
              <span className="ar-cloud ar-cloud-1" aria-hidden />
              <span className="ar-cloud ar-cloud-2" aria-hidden />
              <span className="ar-cloud ar-cloud-3" aria-hidden />
              {/* The trail. Every fifth letter only: twenty six labels over a
                  climb this tall is four pixels apart, which is a vertical
                  smear rather than a record of anything. The rest of the
                  alphabet is in the strip beside it, where there is room. */}
              {AZ.slice(0, s.i).map((c, n) => (n % 5 === 0 ? (
                <i key={c} className="ar-mark" style={{ ['--n' as string]: n / AZ.length }}>{c}</i>
              ) : null))}
              {/* How far up the climb has already come. */}
              <span className="ar-trail" aria-hidden />
              <span className="ar-rocket" aria-hidden>
                <svg viewBox="0 0 44 74" width="44" height="74">
                  <path d="M22 2 C33 16 35 34 35 46 H9 C9 34 11 16 22 2 Z" fill="var(--surface)" stroke="var(--border)" strokeWidth="2.5" strokeLinejoin="round" />
                  <path d="M9 46 L1 60 L9 56 Z M35 46 L43 60 L35 56 Z" fill="var(--accent2)" />
                  <circle cx="22" cy="26" r="7" fill="var(--accent)" stroke="var(--border)" strokeWidth="2" />
                  <circle cx="22" cy="26" r="2.6" fill="var(--surface)" opacity="0.85" />
                  <g className="ar-flame">
                    <path d="M15 56 q7 18 7 18 q0 0 7 -18 q-7 4 -14 0 Z" fill="var(--warn)" />
                    <path d="M18 56 q4 12 4 12 q0 0 4 -12 q-4 3 -8 0 Z" fill="var(--gold)" />
                  </g>
                </svg>
              </span>
              <span className="ar-ground" aria-hidden />
            </div>
            <div className={`ar-keys ${helping ? 'ar-keys-help' : ''}`}>
              <KeyboardVisual
                layout={layout}
                guide={guide}
                compact
                nextChar={helping ? ch : undefined}
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
