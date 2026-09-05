/**
 * The typing area shared by every tool that involves actually typing.
 *
 * Five of the eight tools put text on screen and measure what you do to it.
 * They differ in the passage, the clock and what they report, and in nothing
 * else, so the surface itself is written once here. It wraps KeyTopia's
 * existing engine (`useTypingSession`) rather than reimplementing any of it.
 *
 * What this layer adds on top of the engine:
 *
 *  - Input integrity. Pasting and dropping are refused by the input itself, and
 *    a run that still receives a block of characters in one event is marked
 *    invalid rather than scored, with the reason said out loud.
 *  - A restart that always produces a new passage, so retaking a test cannot
 *    turn into memorising one.
 *  - Focus handling that works from the keyboard, since this is a typing
 *    application and a typing area you can only reach with a mouse would be a
 *    particularly poor joke.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GhostInput, LiveStats, TypingText, useTypingSession, type Engine } from '../typing';
import type { SessionResult } from '../../lib/types';

export interface SurfaceHandle {
  restart: () => void;
  focus: () => void;
}

export interface FinishedRun {
  result: SessionResult;
  /** The keystroke log, for the confusion analysis. Never persisted. */
  strokes: { key: string; exp: string; ok: boolean }[];
}

export function TypingSurface({
  text,
  label,
  seconds,
  showLiveWpm = true,
  correction = 'standard',
  onFinish,
  onStart,
  onInvalid,
  surfaceRef,
  idleHint,
}: {
  text: string;
  /** Describes the run in the saved result. Never shown as a heading. */
  label: string;
  /** Time limit in seconds, or undefined for an untimed passage. */
  seconds?: number;
  showLiveWpm?: boolean;
  correction?: 'standard' | 'strict';
  onFinish: (run: FinishedRun) => void;
  onStart?: () => void;
  /** Called when the run has to be thrown away, with the reason. */
  onInvalid?: (reason: string) => void;
  surfaceRef?: (h: SurfaceHandle) => void;
  idleHint?: string;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  // A ref, not state: it is read inside the finish handler, and a re-render
  // between the paste and the finish would be a race we do not need.
  const tainted = useRef(false);
  const started = useRef(false);

  const cfg = useMemo(
    () => ({
      text,
      mode: 'speed' as const,
      label,
      correction,
      timeLimitSec: seconds,
      keepTimeline: false,
    }),
    [text, label, correction, seconds],
  );

  // The engine that produced the current run, captured on its first keystroke.
  // The finish callback only receives the scored result, and the confusion
  // analysis needs the individual strokes behind it.
  const engineRef = useRef<Engine | null>(null);

  const handleFinish = useCallback(
    (r: SessionResult) => {
      if (tainted.current) {
        onInvalid?.('That run was discarded because text arrived all at once rather than being typed. Start again for a result that means something.');
        return;
      }
      // Handed over, never stored. The analysis wants the strokes for the
      // length of one render; nothing afterwards does, and nothing persists
      // them, which is what keeps the typed text out of storage entirely.
      const strokes = (engineRef.current?.strokes ?? [])
        .map((s) => ({ key: s.key, exp: s.exp, ok: s.ok }));
      onFinish({ result: r, strokes });
    },
    [onFinish, onInvalid],
  );

  const session = useTypingSession(cfg, {
    onFinish: handleFinish,
    soundOn: false,
    onBulkInput: () => {
      tainted.current = true;
      setNotice('Pasted or auto-filled text is not counted. Restart for a result that means something.');
      onInvalid?.('Pasted or auto-filled text was detected, so this run is not being scored.');
    },
    onStroke: (_kind, engine) => {
      engineRef.current = engine;
      if (!started.current) {
        started.current = true;
        onStart?.();
      }
    },
  });

  const restart = useCallback(() => {
    tainted.current = false;
    started.current = false;
    setNotice(null);
    session.restart();
  }, [session]);

  useEffect(() => {
    surfaceRef?.({ restart, focus: session.focus });
  }, [surfaceRef, restart, session.focus]);

  // A new passage means a new engine, which means the guards have to reset too.
  useEffect(() => {
    tainted.current = false;
    started.current = false;
    setNotice(null);
  }, [text]);

  return (
    <div className="tool-surface">
      <LiveStats engine={session.engine} showWpm={showLiveWpm} untimed={!seconds} />

      {/* The click target is the text. `onMouseDown` is prevented inside
          TypingText so focusing never scrolls the passage out from under you. */}
      <div className="tt-field" onClick={session.focus}>
        <TypingText
          engine={session.engine}
          caret="bar"
          focused={session.focused}
          big
          onClick={session.focus}
        />
        <GhostInput
          bind={session.bindInput}
          onPasteBlocked={() => setNotice('Pasting is disabled in typing tests. The point is the keystrokes.')}
        />
        {!session.focused && (
          <p className="tt-hint">
            {idleHint ?? 'Click the text, or press Tab then any key, to begin. The clock starts on your first keystroke.'}
          </p>
        )}
      </div>

      {notice && (
        <p className="tool-notice" role="status">{notice}</p>
      )}
    </div>
  );
}

/**
 * The row of duration buttons.
 *
 * A radio group in behaviour if not in markup: arrow keys are not hijacked,
 * every option is a real button in the tab order, and the current one is
 * announced through `aria-pressed` rather than through colour alone.
 *
 * `children` is where the restart button goes, so a page with a clock gets one
 * controls row rather than two.
 */
export function DurationPicker<T extends number>({
  options, value, onChange, label = 'Test length', children,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="tool-controls">
      <div className="tt-controls" role="group" aria-label={label}>
        {options.map((d) => (
          <button
            key={d}
            type="button"
            className={`tt-dur${d === value ? ' is-on' : ''}`}
            aria-pressed={d === value}
            onClick={() => onChange(d)}
          >
            {d < 60 ? `${d}s` : `${d / 60}m`}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}

/**
 * Abandon this attempt and start a fresh one on new text.
 *
 * Available while the test is running, not only after it. Without it, somebody
 * who fumbled the first word of a two-minute test, or who triggered the paste
 * guard, has to sit and watch a clock produce a result they already know is
 * worthless. It always draws a new passage as well, so repeated attempts
 * cannot turn into memorising one particular set of words.
 */
export function RestartButton({ onClick, label = 'New passage' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="tt-restart" onClick={onClick}>{label}</button>
  );
}

/** A controls row for a tool that has no clock to choose. */
export function ToolControls({ children }: { children: React.ReactNode }) {
  return <div className="tool-controls">{children}</div>;
}
