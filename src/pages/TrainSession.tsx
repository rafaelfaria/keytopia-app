import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData, useStore, useUi } from '../lib/store';
import { buildModeText } from '../lib/adaptive';
import type { Rewards, SessionMode, SessionResult } from '../lib/types';
import { GhostInput, LiveStats, TypingText, useTypingSession } from '../components/typing';
import { KeyboardVisual } from '../components/KeyboardVisual';
import { Btn, Chip } from '../components/ui';
import { PauseModal, ResultsPanel } from '../components/ResultsPanel';
import { Stage } from '../components/stage';
import { TrainRecord } from '../components/trainRecord';
import { nextAction, sessionInsight } from '../lib/coach';
import { snd, startZen, stopZen } from '../lib/sound';
import { recentAvgWpm } from '../lib/challenge';
import { Ic } from '../components/icons';

/**
 * A training session, on the same stage the mini games play on.
 *
 * The Arena work (docs/arena-leaderboards.md §7.4) settled how an activity with
 * a front door, a run and a finish should be shaped, and none of that reasoning
 * was about games: one frame across all three phases, the invitation as the
 * headline with the name as a kicker above it, the thing you are chasing in the
 * column beside the button, and the way out always in the same corner. Practice
 * had three different shapes for the same three phases, so starting a session
 * and finishing one felt like two different products.
 *
 * The one thing it does not take is the moving keycap field. A game's backdrop
 * is part of its identity and it costs a WebGL context; fifteen practice modes
 * neither need an identity that strong nor deserve to spend a frame budget on
 * scenery. So the stage gets its still wash instead, and everything else is the
 * same component.
 */

interface ModeMeta {
  id: SessionMode;
  name: string;
  icon: string;
  desc: string;
  skill: string;
  /**
   * The invitation, not the name. The name is the kicker directly above it, so
   * a headline that repeated it would spend the biggest type on the page saying
   * the same thing twice. Same split as the games' front doors.
   */
  title: string;
  /** This mode's own call to action. "Start the sprint", not "Start". */
  cta: string;
  pre?: 'duration' | 'copy';
  precisionFirst?: boolean;
  untimedOk?: boolean;
  /**
   * Modes that exist in order to not keep score. Zen hides its statistics until
   * the end on purpose, so a panel of past runs beside it would undo the one
   * thing it promises.
   */
  unranked?: boolean;
}

export const MODES: ModeMeta[] = [
  { id: 'adaptive', name: 'Adaptive practice', icon: 'brain', title: 'Practise exactly what keeps going wrong', cta: 'Start the set →', desc: 'Every set is generated from your Mastery Map. Weak keys and slow transitions get extra reps without feeling repetitive.', skill: 'Personal weak spots' },
  { id: 'weakkeys', name: 'Weak-key workout', icon: 'dumbbell', title: 'Repair your weakest key', cta: 'Start the workout →', desc: 'A short, concentrated session on your single weakest key and its neighbourhood.', skill: 'Targeted repair' },
  { id: 'speed', name: 'Speed sprint', icon: 'zap', title: 'Find out how fast you actually are', cta: 'Start the sprint →', desc: 'A classic timed test on common words. Choose your distance and fly.', skill: 'Raw speed', pre: 'duration' },
  { id: 'accuracy', name: 'Accuracy Lab', icon: 'target', title: 'Type it clean, however long it takes', cta: 'Start the lab →', desc: 'Precision-first scoring: errors cost everything, speed counts for little. Slow down and paint clean lines.', skill: 'Error-free control', precisionFirst: true, untimedOk: true },
  { id: 'rhythm', name: 'Rhythm studio', icon: 'waves', title: 'Land every keystroke on the beat', cta: 'Start the pulse →', desc: 'A gentle pulse marks your target pace. Try to land every keystroke on the beat: smooth beats fast.', skill: 'Consistent timing' },
  { id: 'zen', name: 'Zen typing', icon: 'flower', title: 'Type with nothing keeping score', cta: 'Begin →', desc: 'Ambient sound, soft words, no rankings, statistics hidden until the end. Just you and the keys.', skill: 'Calm & flow', untimedOk: true, unranked: true },
  { id: 'endurance', name: 'The long walk', icon: 'route', title: 'Hold one pace from first line to last', cta: 'Set off →', desc: 'A long passage that rewards a sustainable pace from first line to last.', skill: 'Stamina & focus' },
  { id: 'realworld', name: 'Real-world desk', icon: 'clipboard', title: 'Practise the typing your day is made of', cta: 'Open the desk →', desc: 'Emails, meeting notes and updates. The typing you actually do at school and work.', skill: 'Practical writing' },
  { id: 'code', name: 'Code forge', icon: 'braces', title: 'Brackets, symbols and indentation', cta: 'Fire the forge →', desc: 'JavaScript, Python, HTML, CSS, SQL and shell. Brackets, symbols and indentation included.', skill: 'Symbols & syntax' },
  { id: 'numbers', name: 'Numeral Peaks', icon: 'peaks', title: 'Own the number row', cta: 'Start the climb →', desc: 'Quantities, times and decimals. Long reaches, steady returns.', skill: 'Number row' },
  { id: 'copy', name: 'Copy desk', icon: 'file', title: 'Practise on your own text', cta: 'Start typing it →', desc: 'Paste any text of your own and practise typing it. It never leaves this device.', skill: 'Your own material', pre: 'copy' },
  { id: 'blind', name: 'Lights out', icon: 'eye-off', title: 'Trust your fingers with the labels off', cta: 'Lights out →', desc: 'The on-screen keyboard fades as you progress. Learn to trust your fingers.', skill: 'Typing without looking' },
  { id: 'recovery', name: 'Recovery training', icon: 'lifebuoy', title: 'Stay calm after a miss', cta: 'Start the drill →', desc: 'Tricky words are planted on purpose. Practise staying calm after a miss and rebuilding rhythm fast.', skill: 'Composure after errors' },
  { id: 'checkpoint', name: 'Camp checkpoint', icon: 'tent', title: 'See what has actually stuck', cta: 'Start the review →', desc: 'A calm mixed review of everything you\'ve learned so far. Optional, badge-worthy, never a gate.', skill: 'Retention & recall' },
];

const BACK = '/app/practice';

export default function TrainSession() {
  const { mode: modeParam } = useParams();
  const nav = useNavigate();
  const data = useData();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const celebrate = useUi((s) => s.celebrate);
  const pushToast = useUi((s) => s.pushToast);

  const meta = MODES.find((m) => m.id === modeParam) ?? MODES[0];

  /* Every route into a mode lands on its front door, including the hub's
     recommendation, which used to skip it with `?start=1`. That was the right
     call while the intro only restated the mode's name: a second Start button
     is a wasted screen. It is not right now that the screen shows your last
     runs in the mode and the gap to your best, which is information you want
     before a run rather than only after one. */
  const [phase, setPhase] = useState<'pre' | 'run' | 'done'>('pre');
  const [duration, setDuration] = useState(60);
  const [customText, setCustomText] = useState('');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [finished, setFinished] = useState<{ result: SessionResult; rewards: Rewards } | null>(null);
  const [paused, setPaused] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => { setPhase('pre'); setFinished(null); setSeed(Math.floor(Math.random() * 1e9)); }, [modeParam]);

  const gen = useMemo(
    () => (data ? buildModeText(meta.id, data, { seconds: duration, seed, custom: customText }) : null),
    [data?.profile.id, meta.id, duration, seed, phase === 'run' ? 1 : 0],
  );

  const timeLimit = meta.id === 'speed' && !data?.settings.untimed ? duration : undefined;

  const session = useTypingSession(
    {
      text: gen?.text || ' ',
      mode: meta.id,
      label: gen?.label ?? meta.name,
      correction: meta.id === 'accuracy' ? 'standard' : data?.settings.correction ?? 'standard',
      timeLimitSec: timeLimit,
      stopOnComplete: true,
      keepTimeline: true,
    },
    {
      soundOn: data?.settings.soundOn && meta.id !== 'zen',
      disabled: phase !== 'run' || paused,
      onEscape: () => setPaused(true),
      onFinish: (r) => {
        if (meta.id === 'speed') r.extra = { duration };
        if (!data) return;
        stopZen();
        const rewards = recordSession(r);
        if (meta.id === 'copy' === false) void 0;
        if (data.settings.soundOn) snd.done();
        if (rewards.levelUp) celebrate({ kind: 'level', icon: 'party', title: `Level ${rewards.levelUp}!`, body: 'New themes and avatars may be waiting in Settings.' });
        else if (rewards.badges.length) pushToast({ kind: 'badge', icon: 'medal', title: 'Badge unlocked!', body: 'See it in your collection.' });
        if (rewards.records.length) pushToast({ kind: 'record', icon: 'trophy', title: 'New personal record!' });
        setFinished({ result: r, rewards });
        setPhase('done');
      },
    },
  );

  // Rhythm metronome
  const targetIki = data ? Math.max(140, Math.min(420, 12000 / Math.max(10, recentAvgWpm(data)))) : 250;
  useEffect(() => {
    if (meta.id !== 'rhythm' || phase !== 'run' || paused) return;
    const int = window.setInterval(() => {
      setPulse(true);
      if (data?.settings.soundOn) snd.tick();
      setTimeout(() => setPulse(false), 140);
    }, targetIki * 2);
    return () => window.clearInterval(int);
  }, [meta.id, phase, paused, targetIki, data?.settings.soundOn]);

  // Zen ambience
  useEffect(() => {
    if (meta.id === 'zen' && phase === 'run' && data?.settings.soundOn) startZen();
    return () => stopZen();
  }, [meta.id, phase, data?.settings.soundOn]);

  useEffect(() => () => stopZen(), []);

  if (!data) return null;

  const blindHide = meta.id === 'blind' && session.engine.text.length > 0 && session.engine.pos / session.engine.text.length > 0.3;

  const start = () => {
    if (meta.id === 'copy' && customText.trim().length < 12) return;
    setSeed(Math.floor(Math.random() * 1e9));
    setPhase('run');
    setTimeout(session.focus, 60);
  };

  /**
   * The right-hand column: your own past runs in this mode, ranked, with the
   * gap to your best underneath. It is the training answer to the games'
   * leaderboard, and it is absent for the modes that exist not to keep score.
   */
  const record = meta.unranked ? undefined : (
    <TrainRecord
      mode={meta.id}
      modeName={meta.name}
      sessions={data.sessions}
      precisionFirst={meta.precisionFirst}
      highlightId={finished?.result.id}
    />
  );

  const kicker = <span className="arena-stage-kicker"><Ic n={meta.icon} size={15} /> {meta.name}</span>;

  /* Zen's wash follows it through all three phases. A mode whose whole promise
     is calm cannot arrive at that calm only once you have started typing. */
  const skin = meta.id === 'zen' ? 'stage-zen' : '';

  // ----- the front door -----
  if (phase === 'pre') {
    return (
      <Stage
        backTo={BACK} backLabel="Practice"
        side={record}
        className={skin}
        // The pasted-text mode carries a textarea, a privacy note and a library
        // of saved texts, which is more than one screen holds.
        tall={meta.pre === 'copy'}
        main={(
          <div className="arena-intro-play">
            {kicker}
            <h2>{meta.title}</h2>
            <div className="arena-intro-body">
              <p>{meta.desc}</p>
              {meta.id === 'accuracy' && <p className="small muted">Scoring: accuracy × 10 plus a small speed bonus. A 100% run beats any fast messy one.</p>}
              {meta.id === 'rhythm' && <p className="small muted">Your pulse is set near your recent pace ({Math.round(60000 / targetIki / 5)} wpm). Land keystrokes evenly: the bar flashes on each beat.</p>}
            </div>
            <Chip tone="accent">Trains: {meta.skill}</Chip>

            {meta.pre === 'duration' && (
              <div className="train-pre">
                <span className="train-pre-label" id="dur-label">How long</span>
                <div className="duration-row" role="radiogroup" aria-labelledby="dur-label">
                  {[15, 30, 60, 120, 300].map((d) => (
                    <button key={d} type="button" className={`btn ${duration === d ? 'btn-primary' : 'btn-soft'}`} onClick={() => setDuration(d)} aria-pressed={duration === d}>
                      {d < 60 ? `${d}s` : `${d / 60}min`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {meta.pre === 'copy' && (
              <div className="train-pre train-pre-copy">
                <label className="train-pre-label" htmlFor="copy-in">Paste or write your text (12 to 2000 characters)</label>
                <textarea id="copy-in" className="copy-input" value={customText} maxLength={2000} onChange={(e) => setCustomText(e.target.value)} placeholder="Paste an article paragraph, your study notes, song-free lyrics of your own…" />
                <p className="small muted">Privacy: this text is processed only in your browser. It is not uploaded or stored unless you tap "Save to my library".</p>
                {customText.trim().length >= 12 && (
                  <Btn kind="ghost" onClick={() => { patch((d) => { if (!d.customTexts.includes(customText.trim())) d.customTexts.push(customText.trim()); }); pushToast({ kind: 'info', icon: 'save', title: 'Saved to your library' }); }}><Ic n="save" size={15} /> Save to my library</Btn>
                )}
                {data.customTexts.length > 0 && (
                  <div className="row gap wrap">
                    {data.customTexts.slice(-4).map((t, i) => (
                      <button key={i} type="button" className="chip" onClick={() => setCustomText(t)}>{t.slice(0, 28)}…</button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Btn big onClick={start} className="arena-intro-cta" disabled={meta.pre === 'copy' && customText.trim().length < 12}>{meta.cta}</Btn>
          </div>
        )}
      />
    );
  }

  // ----- the finish -----
  if (phase === 'done' && finished) {
    const labScore = Math.round(finished.result.acc * 10 + Math.min(finished.result.wpm, 40));
    return (
      <Stage
        backTo={BACK} backLabel="Practice"
        side={record}
        className={skin}
        // The breakdown under the headline figures is longer than a screen, and
        // the half that explains the run is the half that would be clipped.
        tall
        main={(
          <div className="train-result">
            {kicker}
            <h2>{gen?.label ?? meta.name}, finished</h2>
            {meta.id === 'accuracy' && (
              <p className="train-lab-score">
                Lab score <strong>{labScore}</strong>
                {finished.result.acc === 100 && <Chip tone="gold">Flawless</Chip>}
              </p>
            )}
            <ResultsPanel
              result={finished.result}
              rewards={finished.rewards}
              insight={sessionInsight(data, finished.result)}
              next={nextAction(data, finished.result)}
              onRetry={() => { setFinished(null); setPhase('pre'); }}
              precisionFirst={meta.precisionFirst}
              soundOn={data.settings.soundOn}
              extraActions={<Btn kind="ghost" to={BACK}>All modes</Btn>}
            />
          </div>
        )}
      />
    );
  }

  // ----- the run -----
  // Solo, and no record panel: the words are the whole screen while someone is
  // typing, and a board of past runs beside a live one is a distraction dressed
  // as information. `quiet` steps the backdrop back for the same reason.
  return (
    <>
      <Stage
        backTo={BACK} backLabel="Practice"
        quiet tall={meta.id !== 'zen'}
        className={`stage-train ${skin}`}
        // Beside the way out, not among the live numbers. It was in the HUD,
        // which on a phone wraps to its own row below the back link: the one
        // label on the strip that never changes was travelling with the ones
        // that change every keystroke, and landing in a different place than
        // the same label does in a mini game.
        title={<><Ic n={meta.icon} size={15} /> {gen?.label ?? meta.name}</>}
        hud={(
          <>
            {meta.id !== 'zen' ? (
              <LiveStats engine={session.engine} showWpm={data.settings.showLiveWpm && !meta.precisionFirst} untimed={data.settings.untimed && meta.id !== 'speed'} />
            ) : (
              <span className="muted small grow">stats are waiting quietly at the end</span>
            )}
            <Btn kind="ghost" onClick={() => setPaused(true)} ariaLabel="Pause"><Ic n="pause" size={17} /></Btn>
          </>
        )}
        main={(
          <div className="train-run" onClick={session.focus}>
            {(meta.id === 'adaptive' || meta.id === 'weakkeys') && gen && (
              <div className="why-box"><strong>Why this set:</strong> {gen.why}</div>
            )}
            {meta.id === 'zen' && <div className="zen-breath" aria-hidden />}
            <TypingText
              engine={session.engine}
              caret={data.settings.caret}
              big={data.profile.ageGroup === 'kid'}
              focused={session.focused}
              onClick={session.focus}
            />
            <GhostInput bind={session.bindInput} />
            {meta.id === 'zen' && <p className="center muted small">esc to pause</p>}
            {meta.id === 'rhythm' && <div className={`rhythm-pulse ${pulse ? 'pulse-on' : ''}`} aria-hidden />}
            {data.settings.showKeyboard && meta.id !== 'zen' && data.settings.guide !== 'hidden' && (
              <div className="train-kbd">
                <KeyboardVisual
                  layout={data.profile.layout}
                  guide={data.settings.guide === 'hands' ? 'zones' : data.settings.guide}
                  nextChar={meta.id === 'blind' ? undefined : session.engine.text[session.engine.pos]}
                  lastPress={session.engine.lastPress}
                  hiddenLabels={blindHide ? 'all' : undefined}
                  compact={meta.id === 'blind'}
                />
                {meta.id === 'blind' && blindHide && <p className="center muted small" style={{ marginTop: 6 }}>Labels off. Your fingers remember.</p>}
              </div>
            )}
          </div>
        )}
      />

      <PauseModal
        open={paused}
        onResume={() => { setPaused(false); setTimeout(session.focus, 50); }}
        onRestart={() => { setPaused(false); setPhase('pre'); }}
        onExit={() => nav(BACK)}
      />
    </>
  );
}
