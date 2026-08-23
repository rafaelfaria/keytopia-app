import { useEffect, useMemo, useRef, useState } from 'react';
import { useData, useStore, useUi } from '../lib/store';
import { mulberry32 } from '../lib/rng';
import { Chip } from '../components/ui';
import { resultFromStrokes, type GameStroke } from '../components/typing';
import { snd } from '../lib/sound';
import { RewardsBanner } from '../components/ResultsPanel';
import { ArenaIntro, ArenaResult, ArenaStage } from '../components/arena';
import { StarterScene } from '../components/starterScenes';
import { LevelActions, LevelPicker, LevelResult, useStarterLadder } from '../components/starterLevels';
import { Ic } from '../components/icons';
import { MobileKeys, STARTER_PALS, useGameKeys } from '../components/gamekit';
import { KeyboardVisual } from '../components/KeyboardVisual';
import { CharacterSprite, PRESET_CHARACTERS } from '../components/avatars';
import { FINGER_NAMES, makeCharLookup } from '../lib/keyboard';
import { sparkBurst } from '../lib/fx';
import type { GuideStyle, Rewards } from '../lib/types';

/**
 * Word Bridge — the last starter, and the one that hands over to Wordfall.
 *
 * Every other starter asks for one key and then forgets it. A word is the
 * thing that comes next, and it is a real step up: you have to hold a place in
 * a sequence while hunting for a key, which is exactly the load that made
 * Wordfall unplayable at seven.
 *
 * So the load is removed one piece at a time rather than all at once. The word
 * is three or four letters, it is drawn as a row of planks with the letters
 * already printed on them, the plank you are on is lit, and the key for it is
 * lit on the keyboard too. Nothing is remembered, nothing is timed, and a
 * wrong key does not restart the word: the child's only job is to find the
 * letters in order, which is a word, which is typing.
 *
 * A finished word becomes a plank in a bridge, and a pal walks across it. Eight
 * words and the bridge reaches the other side.
 */

/** Short, concrete, and every letter on the keyboard's home ground. */
const WORDS = [
  'cat', 'dog', 'sun', 'hat', 'bug', 'cup', 'pig', 'bee', 'owl', 'ant',
  'egg', 'map', 'pen', 'red', 'run', 'six', 'toy', 'van', 'fox', 'jam',
  'ball', 'bird', 'boat', 'cake', 'duck', 'fish', 'frog', 'goat', 'kite',
  'leaf', 'lion', 'moon', 'nest', 'star', 'tree',
];

export default function WordBridgeGame() {
  const data = useData();
  const recordSession = useStore((s) => s.recordSession);
  const patchData = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const [phase, setPhase] = useState<'intro' | 'run' | 'over'>('intro');
  const [, force] = useState(0);
  const [press, setPress] = useState<{ key: string; ok: boolean; t: number } | null>(null);
  const [overInfo, setOverInfo] = useState<
    { score: number; built: number; clean: number; acc: number; wpm: number; rewards: Rewards | null;
      newBest: boolean; level: number; goal: number; unlocked: boolean } | null
  >(null);

  const st = useRef({
    queue: [] as string[],
    built: 0, hit: 0, clean: 0, score: 0, slips: 0, pal: 0,
    strokes: [] as GameStroke[], startedAt: 0,
    rng: mulberry32(Date.now() % 1e9),
    crossing: false,
  });
  const sceneRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef(0);
  const nextTimer = useRef(0);

  const { level, cleared, chosen, setChosen, begin, active, clear, total } = useStarterLadder('bridge');
  const PLANKS = level.goal;

  const layout = data?.profile.layout ?? 'qwerty';
  const lookup = useMemo(() => makeCharLookup(layout), [layout]);
  const guide: GuideStyle = data?.settings.guide === 'hidden' ? 'plain' : (data?.settings.guide ?? 'hands');

  const s = st.current;
  const word = s.queue[s.built] ?? '';
  const ch = word[s.hit] ?? '';
  const info = ch ? lookup(ch) : null;
  const pal = STARTER_PALS[s.pal] ?? STARTER_PALS[0];

  const endGame = () => {
    const cur = st.current;
    if (!cur.startedAt) return;
    window.clearTimeout(nextTimer.current);
    const at = active.current;
    const won = cur.built >= at.level.goal;
    const first = won && at.n === cleared + 1;
    const result = resultFromStrokes('game', 'Word Bridge', cur.strokes, cur.startedAt, performance.now(), {
      game: 'bridge', score: cur.score, built: cur.built, level: at.n,
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
      const prev = d.gameBests['bridge'];
      if (!prev || cur.score > prev.score) { d.gameBests['bridge'] = { score: cur.score, level: cur.built }; newBest = true; }
    });
    if (newBest) pushToast({ kind: 'record', icon: 'trophy', title: 'New Word Bridge best!' });
    if (won) {
      clear(at.n);
      if (first) pushToast({ kind: 'record', icon: 'map', title: `Level ${at.n} done!` });
    }
    setOverInfo({
      score: cur.score, built: cur.built, clean: cur.clean, acc: result.acc, wpm: result.wpm,
      rewards, newBest, level: at.n, goal: at.level.goal, unlocked: won,
    });
    setPhase('over');
  };

  const start = (n?: number) => {
    const lvl = begin(n ?? active.current.n);
    const rng = st.current.rng;
    const pool = [...WORDS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // The level picks the word length. Three letters is a first crossing, four
    // is the one that hands over to Wordfall.
    const want = lvl.len ?? 3;
    const queue = pool.filter((w) => w.length === want).slice(0, lvl.goal);
    st.current = {
      ...st.current,
      queue,
      built: 0, hit: 0, clean: 0, score: 0, slips: 0,
      pal: Math.floor(rng() * 5),
      strokes: [], startedAt: performance.now(), crossing: false,
    };
    setPress(null);
    setPhase('run');
  };

  useEffect(() => () => {
    window.clearTimeout(pressTimer.current);
    window.clearTimeout(nextTimer.current);
  }, []);

  const flashKey = (key: string, ok: boolean) => {
    setPress({ key, ok, t: performance.now() });
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => setPress(null), ok ? 200 : 320);
  };

  const handleKey = (raw: string) => {
    const cur = st.current;
    if (phase !== 'run' || cur.crossing) return;
    const w = cur.queue[cur.built];
    if (!w) return;
    const key = raw.toLowerCase();
    if (key < 'a' || key > 'z') return;
    const t = performance.now();
    const want = w[cur.hit];
    if (key !== want) {
      // The word does not restart. Losing four letters of progress for one
      // wrong key is how a child learns that words are dangerous.
      cur.strokes.push({ t, exp: want, ok: false });
      flashKey(key, false);
      cur.slips++;
      if (data?.settings.soundOn) snd.err();
      force((n) => n + 1);
      return;
    }
    cur.strokes.push({ t, exp: want, ok: true });
    flashKey(key, true);
    cur.hit++;
    cur.score += 5;
    if (data?.settings.soundOn) snd.key();
    if (cur.hit >= w.length) {
      const clean = cur.slips === 0;
      if (clean) { cur.clean++; cur.score += 20; }
      cur.built++;
      cur.hit = 0;
      cur.slips = 0;
      cur.crossing = true;
      if (data?.settings.soundOn) snd.pop();
      const sc = sceneRef.current;
      if (sc) sparkBurst(sc, sc.clientWidth * (0.1 + 0.8 * (cur.built / PLANKS)), sc.clientHeight * 0.52, 10);
      // The pal walks onto the plank that was just laid, and only then does the
      // next word arrive. A word finishing and the next one appearing in the
      // same frame is a treadmill; this is a crossing.
      window.clearTimeout(nextTimer.current);
      nextTimer.current = window.setTimeout(() => {
        const c = st.current;
        c.crossing = false;
        if (c.built >= active.current.level.goal) endGame();
        else force((n) => n + 1);
      }, 900);
    }
    force((n) => n + 1);
  };

  useGameKeys(phase === 'run', handleKey, { onEscape: endGame });

  if (!data) return null;

  if (phase === 'intro') {
    return (
      <ArenaIntro
        game="bridge"
        title="Build the bridge, word by word"
        onPlay={start}
        cta={`Level ${chosen}: ${level.name} →`}
        side={(
          <>
            <StarterScene game="bridge" />
            <LevelPicker game="bridge" cleared={cleared} chosen={chosen} onPick={setChosen} />
          </>
        )}
        stats={[
          { label: 'Levels done', value: `${cleared} of ${total}` },
          { label: 'Planks this level', value: level.goal },
        ]}
      >
        <p>
          Each word is a plank, and each letter is a step across it. The letter you need is lit on
          the plank and lit on the keyboard, so there is nothing to remember.
        </p>
        <p>
          A wrong key never sends you back to the start of the word. {level.goal} words and {pal.name} can
          walk all the way over.
        </p>
      </ArenaIntro>
    );
  }

  if (phase === 'over' && overInfo) {
    return (
      <ArenaResult
        game="bridge"
        run={{ wpm: overInfo.wpm, acc: overInfo.acc, value: overInfo.built }}
        score={overInfo.score}
        title={overInfo.unlocked ? 'All the way across' : 'A good stretch of bridge'}
        /* The points best is still tracked, but the ribbon only comes out when
           the level actually went in. "New personal best" over a level you did
           not finish is two scoreboards disagreeing in front of a child. */
        newBest={overInfo.unlocked && overInfo.newBest}
        onAgain={() => start()}
        actions={(
          <LevelActions
            game="bridge" level={overInfo.level} unlocked={overInfo.unlocked}
            onPlay={(n) => start(n)} onPick={() => setPhase('intro')}
          />
        )}
        standing={(
          <LevelResult
            game="bridge" level={overInfo.level} done={overInfo.built}
            goal={overInfo.goal} cleared={cleared} unlocked={overInfo.unlocked}
          />
        )}
      >
        <RewardsBanner rewards={overInfo.rewards} />
        <p className="small muted" style={{ maxWidth: 430 }}>
          {overInfo.clean >= overInfo.built && overInfo.built > 0
            ? `Every one of those ${overInfo.built} ${overInfo.built === 1 ? 'word' : 'words'} came out perfectly first time. You are typing words now, not letters.`
            : `${overInfo.clean} of ${overInfo.built} words with no wrong keys at all. Whole words are the next thing, and you are doing them.`}
        </p>
      </ArenaResult>
    );
  }

  const crossed = s.built / PLANKS;

  return (
    <>
      <ArenaStage
        game="bridge"
        quiet
        wide
        hud={(
          <>
            <span><b>{s.built}</b> of {PLANKS} planks</span>
            <span className="lv-hud"><Ic n="map" size={13} /> Level {chosen} <b>{level.name}</b></span>
            <span className="grow" />
            <span className="st-promise"><Ic n="heart" size={14} /> a wrong key never restarts a word</span>
          </>
        )}
        main={(
          <div className="wb-band">
            <p className="arena-stage-kicker"><Ic n="route" size={14} /> Walk across the word</p>
            {/* The word as planks: done ones behind you, the one under your feet
                lit, the rest waiting. It is the word, the progress bar and the
                instruction in one shape. */}
            <div className="wb-word">
              {word ? word.split('').map((c, i) => (
                <span key={i} className={`wb-plank ${i < s.hit ? 'wb-walked' : i === s.hit ? 'wb-here' : ''}`}>
                  {/* On the bare levels the planks ahead keep their letters to
                      themselves, so the word cannot be read in one glance and
                      each letter has to be found as it comes. The one under
                      your feet always shows, because this is not a memory
                      test. */}
                  {level.bare && i > s.hit ? <i className="wb-blank" /> : c}
                  {i === s.hit && <i className="wb-foot" aria-hidden />}
                </span>
              )) : <span className="wb-plank wb-done"><Ic n="flag" size={28} /></span>}
            </div>
            <p className="wb-hint">
              {ch && info?.key
                ? <><Ic n="person" size={14} /> <strong>{ch}</strong> is under your {FINGER_NAMES[info.finger]} finger</>
                : <span className="good"><Ic n="check" size={14} /> Across!</span>}
            </p>
            <div className="wb-meta">
              <Chip tone={s.clean > 0 ? 'good' : undefined}>
                <Ic n="star" size={12} /> {s.clean} perfect {s.clean === 1 ? 'word' : 'words'}
              </Chip>
            </div>
          </div>
        )}
        side={(
          <div className="wb-scene">
            <div className="wb-river" ref={sceneRef} style={{ ['--crossed' as string]: crossed.toFixed(3) }}>
              <span className="wb-far" aria-hidden />
              <span className="wb-near" aria-hidden />
              {/* The bridge, one plank per finished word. */}
              <span className="wb-deck" aria-hidden>
                {Array.from({ length: PLANKS }).map((_, i) => (
                  <i key={i} className={i < s.built ? 'wb-laid' : ''} />
                ))}
              </span>
              <span className="wb-walker" aria-hidden>
                <CharacterSprite ch={PRESET_CHARACTERS[pal.preset].ch} size={46} expr="happy" />
              </span>
              <span className="wb-water" aria-hidden><i /><i /><i /></span>
            </div>
            <div className="wb-keys">
              <KeyboardVisual
                layout={layout} guide={guide} compact
                nextChar={ch || undefined} lastPress={press}
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
