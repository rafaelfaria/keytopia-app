import { useMemo, useRef, useState } from 'react';
import { useData, useStore, useUi } from '../lib/store';
import { COMMON_WORDS, KID_WORDS } from '../lib/words';
import { mulberry32, pick, shuffle } from '../lib/rng';
import { Btn, Chip } from '../components/ui';
import { resultFromStrokes, type GameStroke } from '../components/typing';
import { snd } from '../lib/sound';
import { RewardsBanner } from '../components/ResultsPanel';
import { ArenaIntro, ArenaResult, ArenaStage } from '../components/arena';
import { Ic } from '../components/icons';
import { MobileKeys, useGameKeys } from '../components/gamekit';
import type { Rewards } from '../lib/types';

const DURATION = 75;

function scrambled(rng: () => number, word: string): string {
  let s = word;
  for (let guard = 0; guard < 10 && s === word; guard++) {
    s = shuffle(rng, word.split('')).join('');
  }
  return s;
}

export default function CipherGame() {
  const data = useData();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const kid = data?.profile.ageGroup === 'kid';
  const rng = useRef(mulberry32(Date.now() % 1e9));
  const pool = useMemo(
    () => (kid ? KID_WORDS.filter((w) => w.length >= 4 && w.length <= 6) : COMMON_WORDS.filter((w) => w.length >= 5 && w.length <= 8)),
    [kid],
  );

  const [phase, setPhase] = useState<'intro' | 'run' | 'over'>('intro');
  const [answer, setAnswer] = useState('');
  const [cipher, setCipher] = useState('');
  const [buffer, setBuffer] = useState('');
  const [revealed, setRevealed] = useState(0);
  const [score, setScore] = useState(0);
  const [solved, setSolved] = useState(0);
  const [shake, setShake] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  // The Arena board is posted by <ArenaResult> from these numbers, so the run's
  // typing quality has to survive into the over phase alongside the game's own
  // score. See docs/arena-leaderboards.md §10 step 4.
  const [overInfo, setOverInfo] = useState<
    { rewards: Rewards | null; newBest: boolean; score: number; solved: number; wpm: number; acc: number } | null
  >(null);
  // Score, solved count and phase are read back from the interval's endGame,
  // which closes over the render that started the run. Mirror them in refs so
  // the finished run is scored from what actually happened, not from render 1.
  const scoreRef = useRef(0);
  const solvedRef = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const bumpScore = (fn: (s: number) => number) => {
    scoreRef.current = fn(scoreRef.current);
    setScore(scoreRef.current);
  };

  const strokes = useRef<GameStroke[]>([]);
  const startedAt = useRef(0);
  const wordShownAt = useRef(0);
  const timer = useRef(0);

  const newPuzzle = () => {
    const w = pick(rng.current, pool);
    setAnswer(w);
    setCipher(scrambled(rng.current, w));
    setBuffer('');
    setRevealed(0);
    wordShownAt.current = performance.now();
  };

  const start = () => {
    strokes.current = [];
    startedAt.current = performance.now();
    scoreRef.current = 0; solvedRef.current = 0;
    setScore(0); setSolved(0); setTimeLeft(DURATION);
    newPuzzle();
    setPhase('run');
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      const left = DURATION - (performance.now() - startedAt.current) / 1000;
      setTimeLeft(Math.max(0, left));
      if (left <= 0) endGame();
    }, 250);
  };

  const endGame = () => {
    window.clearInterval(timer.current);
    if (phaseRef.current !== 'run') return;
    const finalScore = scoreRef.current;
    const finalSolved = solvedRef.current;
    const result = resultFromStrokes('game', 'Cipher Run', strokes.current, startedAt.current, performance.now(), { game: 'cipher', score: finalScore, solved: finalSolved });
    const rewards = strokes.current.length > 8 ? recordSession(result) : null;
    let newBest = false;
    patch((d) => {
      const cur = d.gameBests['cipher'];
      if (!cur || finalScore > cur.score) { d.gameBests['cipher'] = { score: finalScore, level: finalSolved }; newBest = true; }
    });
    if (newBest) pushToast({ kind: 'record', icon: 'puzzle', title: 'New Cipher Run best!' });
    setOverInfo({ rewards, newBest, score: finalScore, solved: finalSolved, wpm: result.wpm, acc: result.acc });
    setPhase('over');
  };

  const solve = () => {
    const secs = (performance.now() - wordShownAt.current) / 1000;
    const bonus = Math.max(0, Math.round((8 - secs) * 4));
    bumpScore((s) => s + answer.length * 12 + bonus);
    solvedRef.current += 1;
    setSolved(solvedRef.current);
    if (data?.settings.soundOn) snd.pop();
    newPuzzle();
  };

  const handleKey = (key: string) => {
    if (phase !== 'run') return;
    if (key === 'Backspace') { setBuffer((b) => b.slice(0, -1)); return; }
    if (key.length !== 1 || !/[a-z]/i.test(key)) return;
    const ch = key.toLowerCase();
    // letter must still be available in the answer's remaining multiset
    const remaining = answer.split('');
    for (const c of buffer) {
      const i = remaining.indexOf(c);
      if (i >= 0) remaining.splice(i, 1);
    }
    const okLetter = remaining.includes(ch);
    strokes.current.push({ t: performance.now(), exp: okLetter ? ch : answer[buffer.length] ?? ch, ok: okLetter });
    if (!okLetter) {
      setShake(true);
      setTimeout(() => setShake(false), 220);
      if (data?.settings.soundOn) snd.err();
      return;
    }
    if (data?.settings.soundOn) snd.key();
    const nb = buffer + ch;
    if (nb.length === answer.length) {
      if (nb === answer) { setBuffer(nb); setTimeout(solve, 120); }
      else {
        setBuffer('');
        setShake(true);
        setTimeout(() => setShake(false), 260);
        bumpScore((s) => Math.max(0, s - 4));
        if (data?.settings.soundOn) snd.err();
      }
    } else {
      setBuffer(nb);
    }
  };

  useGameKeys(phase === 'run', (ch) => handleKey(ch), { onEscape: endGame, onBackspace: () => handleKey('Backspace') });

  const hint = () => {
    if (revealed >= answer.length - 1) return;
    setRevealed((r) => r + 1);
    setBuffer(answer.slice(0, revealed + 1));
    bumpScore((s) => Math.max(0, s - 15));
    if (data?.settings.soundOn) snd.thock();
  };

  const skip = () => {
    bumpScore((s) => Math.max(0, s - 8));
    newPuzzle();
    if (data?.settings.soundOn) snd.thock();
  };

  if (!data) return null;

  if (phase === 'intro') {
    return (
      <ArenaIntro
        game="cipher"
        title="Unscramble the runes"
        onPlay={start}
        cta="Crack the first cipher →"
        stats={data.gameBests['cipher'] ? [
          { label: 'Best score', value: data.gameBests['cipher'].score },
          { label: 'Most decoded', value: `${data.gameBests['cipher'].level} runes` },
        ] : undefined}
      >
        <p>
          Each rune is a real word with its letters shuffled. Type the <strong>true word</strong>:
          only letters the word actually contains will land, so a wrong letter bounces
          before it costs you anything.
        </p>
        <p>
          A full guess that is wrong clears the slots. Hints cost 15 points and skips cost 8,
          and decoding fast is worth a bonus, so the quickest read is the best read.
        </p>
      </ArenaIntro>
    );
  }

  if (phase === 'over' && overInfo) {
    return (
      <ArenaResult
        game="cipher"
        run={{ wpm: overInfo.wpm, acc: overInfo.acc, value: overInfo.solved }}
        score={overInfo.score}
        title={overInfo.newBest ? 'New best decode run!' : `${overInfo.solved} ${overInfo.solved === 1 ? 'rune' : 'runes'} cracked`}
        newBest={overInfo.newBest}
        onAgain={start}
      >
        <RewardsBanner rewards={overInfo.rewards} />
        <p className="small muted" style={{ maxWidth: 430 }}>
          Decoding builds the deep letter-map that fast typing sits on. Sneaky, isn't it?
        </p>
      </ArenaResult>
    );
  }

  return (
    <>
      {/* One column, deliberately. Cipher Run has no second thing to look at:
          the rune you are reading and the answer you are building have to sit
          together, and splitting them across two columns would add eye travel
          to a timed game for the sake of matching a grid. */}
      <ArenaStage
        game="cipher"
        quiet
        hud={(
          <>
            <span><b>{score}</b> points</span>
            <span><b>{solved}</b> decoded</span>
            <span className="grow" />
            <span className={`arena-hud-clock ${timeLeft < 12 ? 'bad' : ''}`}>{Math.ceil(timeLeft)}s</span>
          </>
        )}
        main={(
          <div className="cipher-stage">
            <p className="arena-stage-kicker"><Ic n="puzzle" size={14} /> The scrambled rune</p>
            <div className="cipher-word">{cipher.split('').map((c, i) => <span key={i} className="cipher-tile">{c}</span>)}</div>
            <p className="arena-stage-kicker cipher-answer-label"><Ic n="keyboard" size={14} /> Your answer</p>
            <div className={`cipher-word ${shake ? 'cipher-shake' : ''}`}>
              {answer.split('').map((_, i) => (
                <span key={i} className={`cipher-tile cipher-slot ${buffer[i] ? 'filled' : ''}`}>{buffer[i] ?? ''}</span>
              ))}
            </div>
            <div className="row gap cipher-actions">
              <Btn kind="soft" onClick={hint}><Ic n="bulb" size={15} /> Hint (−15)</Btn>
              <Btn kind="ghost" onClick={skip}>Skip (−8)</Btn>
            </div>
          </div>
        )}
      />
      <MobileKeys active={phase === 'run'} />
    </>
  );
}
