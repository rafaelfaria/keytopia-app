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
import { MobileKeys, useGameKeys } from '../components/gamekit';
import { KeyboardVisual } from '../components/KeyboardVisual';
import { FINGER_NAMES, makeCharLookup } from '../lib/keyboard';
import { sparkBurst } from '../lib/fx';
import type { GuideStyle, Rewards } from '../lib/types';

/**
 * First Letter — the starter game that is really a reading game.
 *
 * A picture appears and you press the letter its name starts with. Everything
 * else here is the same hunt as the other starters, but the question in front
 * of it is different: instead of being handed a letter, the child has to get
 * the letter out of a picture themselves. Apple, so a. That is the first half
 * of phonics, and it is the half a keyboard can actually practise.
 *
 * The word is written under the picture with its first letter carried out in
 * front, which is a reader's crutch and a non-reader's decoration. Neither of
 * them is hurt by it being there.
 *
 * Every picture is an icon from the set the rest of the app draws with, so
 * nothing here is an emoji and nothing needs a downloaded asset. The list is
 * hand-picked for one thing: an adult and a five year old have to agree on the
 * word. A picture of a bird that a child calls "birdie" is fine. A picture of
 * a squirrel that half of them call "a mouse" is not, and is not in the list.
 */
const THINGS: { icon: string; word: string }[] = [
  { icon: 'apple', word: 'apple' },
  { icon: 'banana', word: 'banana' },
  { icon: 'cat', word: 'cat' },
  { icon: 'dog', word: 'dog' },
  { icon: 'fish', word: 'fish' },
  { icon: 'moon', word: 'moon' },
  { icon: 'sun', word: 'sun' },
  { icon: 'star', word: 'star' },
  { icon: 'tree', word: 'tree' },
  { icon: 'key', word: 'key' },
  { icon: 'gift', word: 'gift' },
  { icon: 'bell', word: 'bell' },
  { icon: 'rocket', word: 'rocket' },
  { icon: 'ship', word: 'ship' },
  { icon: 'castle', word: 'castle' },
  { icon: 'candy', word: 'candy' },
  { icon: 'camera', word: 'camera' },
  { icon: 'bike', word: 'bike' },
  { icon: 'flower', word: 'flower' },
  { icon: 'leaf', word: 'leaf' },
  { icon: 'umbrella', word: 'umbrella' },
  { icon: 'snail', word: 'snail' },
  { icon: 'drum', word: 'drum' },
  { icon: 'crown', word: 'crown' },
  { icon: 'heart', word: 'heart' },
  { icon: 'ghost', word: 'ghost' },
  { icon: 'rainbow', word: 'rainbow' },
  { icon: 'anchor', word: 'anchor' },
];

export default function FirstLetterGame() {
  const data = useData();
  const recordSession = useStore((s) => s.recordSession);
  const patchData = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const [phase, setPhase] = useState<'intro' | 'run' | 'over'>('intro');
  const [, force] = useState(0);
  const [press, setPress] = useState<{ key: string; ok: boolean; t: number } | null>(null);
  const [overInfo, setOverInfo] = useState<
    { score: number; done: number; solo: number; acc: number; wpm: number; rewards: Rewards | null;
      newBest: boolean; level: number; goal: number; unlocked: boolean } | null
  >(null);

  const st = useRef({
    queue: [] as { icon: string; word: string }[],
    i: 0, solo: 0, score: 0, tries: 0, since: 0, got: false,
    strokes: [] as GameStroke[], startedAt: 0,
    rng: mulberry32(Date.now() % 1e9),
  });
  const sceneRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef(0);
  const tick = useRef(0);
  const nextTimer = useRef(0);

  const { level, cleared, chosen, setChosen, begin, active, clear, total } = useStarterLadder('firstletter');
  const ROUND = level.goal;

  const layout = data?.profile.layout ?? 'qwerty';
  const lookup = useMemo(() => makeCharLookup(layout), [layout]);
  const guide: GuideStyle = data?.settings.guide === 'hidden' ? 'plain' : (data?.settings.guide ?? 'hands');

  const s = st.current;
  const thing = s.queue[s.i] ?? null;
  const ch = thing ? thing.word[0] : '';
  const info = ch ? lookup(ch) : null;
  /**
   * Later than the other starters. There are two questions here rather than
   * one, and a child who is still working out that "apple" starts with an a
   * has not begun looking for the key yet.
   */
  const helping = phase === 'run' && !!thing && !s.got && (performance.now() - s.since > 5500 || s.tries >= 2);

  const endGame = () => {
    const cur = st.current;
    if (!cur.startedAt) return;
    window.clearInterval(tick.current);
    window.clearTimeout(nextTimer.current);
    const at = active.current;
    const won = cur.i >= at.level.goal;
    const first = won && at.n === cleared + 1;
    const result = resultFromStrokes('game', 'First Letter', cur.strokes, cur.startedAt, performance.now(), {
      game: 'firstletter', score: cur.score, solo: cur.solo, level: at.n,
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
    const rewards = (won || cur.strokes.length > 4) ? recordSession(result) : null;
    let newBest = false;
    patchData((d) => {
      const prev = d.gameBests['firstletter'];
      if (!prev || cur.score > prev.score) { d.gameBests['firstletter'] = { score: cur.score, level: cur.i }; newBest = true; }
    });
    if (newBest) pushToast({ kind: 'record', icon: 'trophy', title: 'New First Letter best!' });
    if (won) {
      clear(at.n);
      if (first) pushToast({ kind: 'record', icon: 'map', title: `Level ${at.n} done!` });
    }
    setOverInfo({
      score: cur.score, done: cur.i, solo: cur.solo, acc: result.acc, wpm: result.wpm,
      rewards, newBest, level: at.n, goal: at.level.goal, unlocked: won,
    });
    setPhase('over');
  };

  const start = (n?: number) => {
    const lvl = begin(n ?? active.current.n);
    const rng = st.current.rng;
    const pool = [...THINGS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // No two pictures in a round starting with the same letter: a child who has
    // just done "cat" and gets "castle" learns that the answer repeats, which
    // is not the thing being taught.
    const seen = new Set<string>();
    const queue: { icon: string; word: string }[] = [];
    for (const p of pool) {
      if (seen.has(p.word[0])) continue;
      seen.add(p.word[0]);
      queue.push(p);
      if (queue.length >= lvl.goal) break;
    }
    st.current = { ...st.current, queue, i: 0, solo: 0, score: 0, tries: 0, since: performance.now(), got: false, strokes: [], startedAt: performance.now() };
    setPress(null);
    setPhase('run');
    window.clearInterval(tick.current);
    tick.current = window.setInterval(() => force((n) => n + 1), 250);
  };

  useEffect(() => () => {
    window.clearInterval(tick.current);
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
    if (phase !== 'run' || !cur.queue[cur.i] || cur.got) return;
    const key = raw.toLowerCase();
    if (key < 'a' || key > 'z') return;
    const t = performance.now();
    const want = cur.queue[cur.i].word[0];
    if (key !== want) {
      cur.strokes.push({ t, exp: want, ok: false });
      flashKey(key, false);
      cur.tries++;
      if (data?.settings.soundOn) snd.err();
      force((n) => n + 1);
      return;
    }
    cur.strokes.push({ t, exp: want, ok: true });
    flashKey(key, true);
    const clean = !helping && cur.tries === 0;
    if (clean) cur.solo++;
    cur.score += clean ? 20 : 10;
    cur.got = true;
    if (data?.settings.soundOn) snd.pop();
    const sc = sceneRef.current;
    if (sc) sparkBurst(sc, sc.clientWidth / 2, sc.clientHeight / 2 - 10, 12);
    // A beat on the answer before the next picture, so the child sees the word
    // and its letter together with the picture still in front of them. That
    // pause is where the association is actually made.
    window.clearTimeout(nextTimer.current);
    nextTimer.current = window.setTimeout(() => {
      const c = st.current;
      c.i++;
      c.tries = 0;
      c.got = false;
      c.since = performance.now();
      if (c.i >= c.queue.length) endGame();
      else force((n) => n + 1);
    }, 1100);
    force((n) => n + 1);
  };

  useGameKeys(phase === 'run', handleKey, { onEscape: endGame });

  if (!data) return null;

  if (phase === 'intro') {
    return (
      <ArenaIntro
        game="firstletter"
        title="What does it start with?"
        onPlay={start}
        cta={`Level ${chosen}: ${level.name} →`}
        side={(
          <>
            <StarterScene game="firstletter" />
            <LevelPicker game="firstletter" cleared={cleared} chosen={chosen} onPick={setChosen} />
          </>
        )}
        stats={[
          { label: 'Levels done', value: `${cleared} of ${total}` },
          { label: 'Pictures this level', value: level.goal },
        ]}
      >
        <p>
          A picture appears. Say what it is, listen to how it starts, then press that letter.
          A picture of an apple wants <b>a</b>.
        </p>
        <p>
          Twelve pictures, no clock, and wrong keys cost nothing. The word is written underneath
          for anybody who wants it, and the key lights up if a picture gets too tricky.
        </p>
      </ArenaIntro>
    );
  }

  if (phase === 'over' && overInfo) {
    return (
      <ArenaResult
        game="firstletter"
        run={{ wpm: overInfo.wpm, acc: overInfo.acc, value: overInfo.solo }}
        score={overInfo.score}
        title={overInfo.unlocked ? 'Every picture answered' : 'Good listening'}
        /* The points best is still tracked, but the ribbon only comes out when
           the level actually went in. "New personal best" over a level you did
           not finish is two scoreboards disagreeing in front of a child. */
        newBest={overInfo.unlocked && overInfo.newBest}
        onAgain={() => start()}
        actions={(
          <LevelActions
            game="firstletter" level={overInfo.level} unlocked={overInfo.unlocked}
            onPlay={(n) => start(n)} onPick={() => setPhase('intro')}
          />
        )}
        standing={(
          <LevelResult
            game="firstletter" level={overInfo.level} done={overInfo.done}
            goal={overInfo.goal} cleared={cleared} unlocked={overInfo.unlocked}
          />
        )}
      >
        <RewardsBanner rewards={overInfo.rewards} />
        <p className="small muted" style={{ maxWidth: 430 }}>
          {overInfo.solo >= overInfo.done - 1 && overInfo.done > 0
            ? `${overInfo.solo} pictures, ${overInfo.solo} first letters, no help. That is reading and typing at the same time.`
            : `Worked out on your own: ${overInfo.solo} of ${overInfo.done}. Saying the word out loud is the trick.`}
        </p>
      </ArenaResult>
    );
  }

  return (
    <>
      <ArenaStage
        game="firstletter"
        quiet
        wide
        hud={(
          <>
            <span><b>{s.i + (s.got ? 1 : 0)}</b> of {ROUND} pictures</span>
            <span className="lv-hud"><Ic n="map" size={13} /> Level {chosen} <b>{level.name}</b></span>
            <span className="grow" />
            <span className="st-promise"><Ic n="heart" size={14} /> no clock, no losing</span>
          </>
        )}
        main={(
          <div className="fl-band">
            <p className="arena-stage-kicker"><Ic n="ear" size={14} /> Say it out loud</p>
            {/* The word, with its first letter pulled out in front of it. A
                reader gets the answer, a non-reader gets a shape to match
                against the keyboard, and both of them get the picture. */}
            {/* Levels one to four print the word with its first letter carried
                out in front, which hands a reader the answer. From level five
                the word goes and the picture has to carry it, which is the
                whole skill this game is named after. The letter still appears
                once it has been pressed, so the association still lands. */}
            <p className="fl-word">
              {!thing ? <span className="muted">…</span>
                : level.bare && !s.got ? <b className="fl-first fl-first-bare">?</b>
                : (
                  <>
                    <b className={`fl-first ${s.got ? 'fl-first-got' : ''}`}>{ch}</b>
                    {!level.bare && <span>{thing.word.slice(1)}</span>}
                  </>
                )}
            </p>
            <p className="fl-hint">
              {thing && !s.got && info?.key && (helping
                ? <><Ic n="person" size={14} /> <strong>{ch}</strong> is under your {FINGER_NAMES[info.finger]} finger</>
                : <><Ic n="bulb" size={14} /> Which letter does it start with?</>)}
              {s.got && <span className="good"><Ic n="check" size={14} /> {thing?.word} starts with {ch}</span>}
            </p>
            <div className="fl-meta">
              <Chip tone={s.solo > 0 ? 'good' : undefined}><Ic n="star" size={12} /> {s.solo} worked out by yourself</Chip>
            </div>
          </div>
        )}
        side={(
          <div className="fl-scene">
            <div className={`fl-pic ${s.got ? 'fl-pic-got' : ''}`} ref={sceneRef}>
              {thing && <Ic n={thing.icon} size={150} strokeWidth={1.5} />}
              {s.got && <span className="fl-stamp" aria-hidden><Ic n="check" size={40} /></span>}
            </div>
            <div className={`fl-keys ${helping ? 'fl-keys-help' : ''}`}>
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
