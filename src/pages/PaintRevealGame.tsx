import { useEffect, useMemo, useRef, useState } from 'react';
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
import { MobileKeys, STARTER_PALS, useGameKeys } from '../components/gamekit';
import { KeyboardVisual } from '../components/KeyboardVisual';
import { CharacterSprite, PRESET_CHARACTERS } from '../components/avatars';
import { sparkBurst } from '../lib/fx';
import type { GuideStyle, Rewards } from '../lib/types';

/**
 * Paint Reveal — the starter game with no target at all.
 *
 * The other three name one key and wait for it. That is the right shape for
 * learning where a particular letter lives, and it is also the shape that
 * leaves a child stuck: if they cannot find that key, nothing happens, and the
 * game is a locked door until the hint arrives.
 *
 * Here every tile is a door. Twenty four letters are on screen at once and any
 * of them opens something, so a child who cannot find b can find o instead and
 * the game keeps moving. What it trains is the thing that comes before knowing
 * where a key is: scanning a keyboard for a letter you are holding in your
 * head, over and over, at whatever pace you like.
 *
 * Underneath is one of the pals, and which one is the reason to keep going. A
 * picture appearing one patch at a time asks its own question, and a child will
 * answer it out loud long before the last tile goes.
 */

interface Tile { ch: string; gone: boolean }

export default function PaintRevealGame() {
  const data = useData();
  const recordSession = useStore((s) => s.recordSession);
  const patchData = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const [phase, setPhase] = useState<'intro' | 'run' | 'over'>('intro');
  const [, force] = useState(0);
  const [press, setPress] = useState<{ key: string; ok: boolean; t: number } | null>(null);
  const [overInfo, setOverInfo] = useState<
    { score: number; cleared: number; who: string; acc: number; wpm: number; rewards: Rewards | null;
      newBest: boolean; level: number; goal: number; unlocked: boolean } | null
  >(null);

  const st = useRef({
    tiles: [] as Tile[], pal: 0, score: 0,
    strokes: [] as GameStroke[], startedAt: 0,
    rng: mulberry32(Date.now() % 1e9),
  });
  const boardRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef(0);

  const { level, cleared: clearedLevels, chosen, setChosen, clear, total } = useStarterLadder('paint');
  const COLS = level.cols ?? 6;
  const ROWS = level.rows ?? 4;
  const TILES = level.goal;

  const layout = data?.profile.layout ?? 'qwerty';
  const guide: GuideStyle = data?.settings.guide === 'hidden' ? 'plain' : (data?.settings.guide ?? 'hands');

  const s = st.current;
  const left = s.tiles.filter((t) => !t.gone).length;
  const pal = STARTER_PALS[s.pal] ?? STARTER_PALS[0];

  /**
   * Every letter still on the board, lit at once.
   *
   * This is the opposite of the other starters' single lit key and it is the
   * point: the keyboard shows the whole set of right answers, and choosing
   * among them is the child's own move rather than the game's.
   */
  const marks = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of s.tiles) if (!t.gone) m[t.ch] = 'pr-live';
    return m;
    // Recomputed on every reveal, which is what `left` tracks.
  }, [left, s.tiles]);

  const endGame = () => {
    const cur = st.current;
    if (!cur.startedAt) return;
    const cleared = cur.tiles.length - cur.tiles.filter((t) => !t.gone).length;
    const won = cleared >= cur.tiles.length && cur.tiles.length > 0;
    const result = resultFromStrokes('game', 'Paint Reveal', cur.strokes, cur.startedAt, performance.now(), {
      game: 'paint', score: cur.score, cleared,
    });
    const rewards = cur.strokes.length > 6 ? recordSession(result) : null;
    let newBest = false;
    patchData((d) => {
      const prev = d.gameBests['paint'];
      if (!prev || cur.score > prev.score) { d.gameBests['paint'] = { score: cur.score, level: cleared }; newBest = true; }
    });
    if (newBest) pushToast({ kind: 'record', icon: 'trophy', title: 'New Paint Reveal best!' });
    if (won) {
      clear(chosen);
      if (chosen === clearedLevels + 1) pushToast({ kind: 'record', icon: 'map', title: `Level ${chosen} done!` });
    }
    setOverInfo({
      score: cur.score, cleared, who: STARTER_PALS[cur.pal].name,
      acc: result.acc, wpm: result.wpm, rewards, newBest,
      level: chosen, goal: TILES, unlocked: won,
    });
    setPhase('over');
  };

  const start = () => {
    const rng = st.current.rng;
    // Twenty four different letters, so every tile is its own key and pressing
    // one can never be ambiguous about which patch it opens.
    const pool = (level.chars ?? 'abcdefghijklmnopqrstuvwxyz').split('');
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    st.current = {
      ...st.current,
      tiles: pool.slice(0, TILES).map((ch) => ({ ch, gone: false })),
      pal: STARTER_PALS.indexOf(pick(rng, STARTER_PALS)),
      score: 0, strokes: [], startedAt: performance.now(),
    };
    setPress(null);
    setPhase('run');
  };

  useEffect(() => () => window.clearTimeout(pressTimer.current), []);

  const flashKey = (key: string, ok: boolean) => {
    setPress({ key, ok, t: performance.now() });
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => setPress(null), ok ? 200 : 320);
  };

  const handleKey = (raw: string) => {
    const cur = st.current;
    if (phase !== 'run') return;
    const key = raw.toLowerCase();
    if (key < 'a' || key > 'z') return;
    const t = performance.now();
    const idx = cur.tiles.findIndex((x) => x.ch === key && !x.gone);
    if (idx < 0) {
      // A letter with no tile behind it. The key shakes and nothing else
      // happens: there are twenty four right answers on screen and being wrong
      // about one of them is not worth a consequence.
      cur.strokes.push({ t, exp: key, ok: false });
      flashKey(key, false);
      if (data?.settings.soundOn) snd.err();
      force((n) => n + 1);
      return;
    }
    cur.tiles[idx].gone = true;
    cur.strokes.push({ t, exp: key, ok: true });
    flashKey(key, true);
    cur.score += 10;
    if (data?.settings.soundOn) snd.pop();
    const board = boardRef.current;
    const el = board?.querySelector(`[data-tile="${key}"]`) as HTMLElement | null;
    if (board && el) {
      const br = board.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      sparkBurst(board, er.left + er.width / 2 - br.left, er.top + er.height / 2 - br.top, 9);
    }
    const now = cur.tiles.filter((x) => !x.gone).length;
    if (now === 0) {
      cur.score += 60;
      if (data?.settings.soundOn) snd.step();
      window.setTimeout(endGame, 1500);
    } else if (now % 6 === 0 && data?.settings.soundOn) {
      snd.step();
    }
    force((n) => n + 1);
  };

  useGameKeys(phase === 'run', handleKey, { onEscape: endGame });

  if (!data) return null;

  if (phase === 'intro') {
    return (
      <ArenaIntro
        game="paint"
        title="Uncover the hidden pal"
        onPlay={start}
        cta={`Level ${chosen}: ${level.name} →`}
        side={(
          <>
            <StarterScene game="paint" />
            <LevelPicker game="paint" cleared={clearedLevels} chosen={chosen} onPick={setChosen} />
          </>
        )}
        stats={[
          { label: 'Levels done', value: `${clearedLevels} of ${total}` },
          { label: 'Patches this level', value: level.goal },
        ]}
      >
        <p>
          Somebody is hiding under twenty four painted tiles, and every tile has a letter on it.
          Press any letter you can find and that tile comes away.
        </p>
        <p>
          There is no order and no clock. If one letter is being tricky, go and find an easier one:
          they all uncover a piece, and the picture underneath is the same either way.
        </p>
      </ArenaIntro>
    );
  }

  if (phase === 'over' && overInfo) {
    return (
      <ArenaResult
        game="paint"
        run={{ wpm: overInfo.wpm, acc: overInfo.acc, value: overInfo.cleared }}
        score={overInfo.score}
        title={overInfo.unlocked ? `It was ${overInfo.who}!` : 'Half a picture is still a picture'}
        newBest={overInfo.newBest}
        onAgain={start}
        standing={(
          <LevelResult
            game="paint" level={overInfo.level} done={overInfo.cleared}
            goal={overInfo.goal} cleared={clearedLevels} unlocked={overInfo.unlocked}
          />
        )}
      >
        <RewardsBanner rewards={overInfo.rewards} />
        <p className="small muted" style={{ maxWidth: 430 }}>
          {overInfo.unlocked
            ? `${overInfo.cleared} letters found, one after another, and ${overInfo.who} was under all of them.`
            : `You uncovered ${overInfo.cleared} patches. Somebody is still under there.`}
        </p>
      </ArenaResult>
    );
  }

  const nearly = left <= Math.max(3, Math.round(TILES / 3));

  return (
    <>
      <ArenaStage
        game="paint"
        quiet
        wide
        hud={(
          <>
            <span><b>{TILES - left}</b> of {TILES} uncovered</span>
            <span className="lv-hud"><Ic n="map" size={13} /> Level {chosen} <b>{level.name}</b></span>
            <span className="grow" />
            <span className="st-promise"><Ic n="heart" size={14} /> any letter works</span>
          </>
        )}
        main={(
          <div className="pr-band">
            <p className="arena-stage-kicker"><Ic n="palette" size={14} /> Press any letter you can see</p>
            <p className="pr-question">
              {left === 0
                ? <><strong>{pal.name}!</strong></>
                : nearly ? 'Who do you think it is?' : 'Somebody is under there'}
            </p>
            {/* The letters still to find, big enough to pick one out of and to
                point at. A child works from this, not from the tiles. */}
            <ul className="pr-left" aria-label="Letters still to press">
              {s.tiles.filter((t) => !t.gone).map((t) => <li key={t.ch}>{t.ch}</li>)}
            </ul>
            <div className="pr-meta">
              <Chip tone={nearly ? 'good' : undefined}>
                <Ic n="sparkles" size={12} /> {left} {left === 1 ? 'patch' : 'patches'} left
              </Chip>
            </div>
          </div>
        )}
        side={(
          <div className="pr-scene">
            <div className="pr-board" ref={boardRef}>
              {/* Picture and tiles share one box, or a patch coming away at the
                  edge uncovers the background instead of the pal, and the top
                  of their head sits outside the cover in plain sight. */}
              <div className="pr-cover">
                <span className="pr-pic" aria-hidden>
                  <CharacterSprite ch={PRESET_CHARACTERS[pal.preset].ch} size={300} expr="happy" />
                </span>
                <div className="pr-grid" style={{ ['--cols' as string]: COLS }}>
                  {s.tiles.map((t, i) => (
                    <span
                      key={t.ch}
                      data-tile={t.ch}
                      className={`pr-tile ${t.gone ? 'pr-off' : ''}`}
                      style={{ ['--i' as string]: i % COLS + Math.floor(i / COLS) }}
                    >
                      {t.ch}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="pr-keys">
              <KeyboardVisual
                layout={layout} guide={guide} compact markChars={marks} lastPress={press}
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
