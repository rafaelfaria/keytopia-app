import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useData } from '../lib/store';
import { Room, normalizeCode, roomsLive, type RoomPhase, type RoomPlayer } from '../lib/room';
import { GhostInput, TypingText, useTypingSession } from '../components/typing';
import { COUNT_FROM, COUNT_STEP_MS, GO_MS, RaceClock, RaceCue, RaceLanes, markAbsent, raceDecided, reconcileFinished, type RaceLane } from '../components/raceLanes';
import { Btn, Chip, Logo, Stat } from '../components/ui';
import { Ic } from '../components/icons';
import { Avatar } from '../components/avatars';
import { RACER_NAMES } from '../lib/words';
import { mulberry32, pick, avatarIndexFor } from '../lib/rng';
import { useNoIndex } from '../lib/seo/Seo';
import type { SessionResult } from '../lib/types';
import { BRAND } from '../lib/brand';

/**
 * The guest door into a private room.
 *
 * A race room is the one part of KeyTopia that works with no account at all,
 * and it is the only part that can: a room is a Realtime channel and nothing
 * else — no table, no row, no owner — so a browser holding the publishable key
 * can stand in one exactly as well as a signed-in browser can. Everything else
 * under /app owns saved progress, which is why it still needs a session.
 *
 * So this page is deliberately outside the account boundary, and deliberately
 * keeps nothing: no profile is created, no session is opened, nothing is
 * written to storage, and the run posts to no board (room races are practice for
 * everyone, signed in or not). A guest types their name, races their friend,
 * sees what they did, and is invited to keep it.
 *
 * A signed-in visitor is bounced to the real thing at /app/race/room/:code,
 * where the same room comes with their profile, their rewards and their board.
 */

const MAX_NAME = 16;

/** Nothing is moderated in a room, so a typed name is bounded and stripped of
 *  anything that is not a name: no newlines, no control characters, no essay. */
function cleanName(raw: string): string {
  return raw.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trimStart().slice(0, MAX_NAME);
}

type Stage = 'name' | 'lobby' | 'race' | 'done';

export default function GuestRoom() {
  const { code: rawCode } = useParams();
  const code = normalizeCode(rawCode ?? '');
  const data = useData();
  useNoIndex('Race room');

  // A room's address is one link for everybody. Somebody who already has a
  // profile should land in their own Lightstream, not in a stripped guest copy
  // of it, so the account holder is forwarded before anything here runs.
  const signedIn = Boolean(data);

  const suggested = useMemo(() => pick(mulberry32(Date.now() % 1e6), RACER_NAMES), []);
  const [name, setName] = useState('');
  const [stage, setStage] = useState<Stage>('name');
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [phase, setPhase] = useState<RoomPhase>('connecting');
  const [error, setError] = useState<string | null>(null);

  // Race state. Same shape as the signed-in race, minus everything that needs a
  // profile: no rewards, no ghost, no board.
  const [text, setText] = useState('');
  const [count, setCount] = useState(COUNT_FROM);
  const [go, setGo] = useState(false);
  const [running, setRunning] = useState(false);
  const [, force] = useState(0);
  const [result, setResult] = useState<{ r: SessionResult; place: number; cut: boolean; abandoned: boolean } | null>(null);
  /** Told the room you want another. The host still calls it. */
  const [rematchReady, setRematchReady] = useState(false);
  const lanes = useRef<RaceLane[]>([]);
  const timer = useRef(0);
  const startedAt = useRef(0);

  /**
   * Who the guest is, fixed at the moment they press Join. A ref rather than
   * derived state on purpose: presence carries this name to everybody else's
   * screen, so it must be read once, from the field as it stood when they
   * entered, and never re-derived from a later render.
   */
  const guest = useRef<{ id: string; name: string; avatar: string } | null>(null);

  useEffect(() => () => { room?.leave(); window.clearInterval(timer.current); }, [room]);

  /**
   * Leaving a race announces itself, so nobody is left racing a car that has
   * gone home. Same reasoning as RaceLive: written every render, read once on
   * the way out.
   */
  const quitting = useRef(false);
  useEffect(() => () => { if (quitting.current) room?.sendQuit(); }, [room]);

  const enter = () => {
    if (!code) { setError('That room code does not look right.'); return; }
    setError(null);
    setStage('lobby');
    const n = cleanName(name).trim() || suggested;
    const who = { id: `g-${Math.random().toString(36).slice(2, 10)}`, name: n, avatar: `bk:${avatarIndexFor(n)}` };
    guest.current = who;
    const r = Room.open(code, who, { expectOthers: true });
    r.on({
      onPlayers: (ps) => setPlayers([...ps]),
      onPhase: (p, e) => { setPhase(p); setError(e ?? null); },
      onStart: ({ text: t }) => startRace(t, r),
      // Both handlers repaint. Your own tick stops the moment you finish, and
      // without a repaint here the standings would freeze at the instant you
      // crossed, showing rivals parked mid-track for ever. They are still
      // racing, and the results screen is where that is watched from.
      onProgress: (id, p, wpm) => {
        const lane = lanes.current.find((l) => l.id === id);
        if (!lane || lane.finishedAt) return;
        lane.progress = Math.max(lane.progress, p);
        lane.wpm = Math.round(wpm);
        force((n) => n + 1);
      },
      // Only a racer who crossed gets the line and a rank. One who was stopped
      // short keeps the ground they covered and sorts below the finishers.
      onFinish: (id, wpm, _acc, crossed) => {
        const lane = lanes.current.find((l) => l.id === id);
        if (lane && !lane.finishedAt) {
          // Their final figure. A race can end between progress packets.
          lane.wpm = Math.round(wpm);
          if (crossed) { lane.progress = 1; lane.finishedAt = performance.now(); }
          else lane.stopped = true;
        }
        force((n) => n + 1);
      },
      // Called back for another. Straight to the lobby from wherever this
      // screen is: mid-race, or reading its own result.
      onLobby: () => {
        window.clearInterval(timer.current);
        setResult(null);
        setRematchReady(false);
        setRunning(false);
        setGo(false);
        setCount(COUNT_FROM);
        setStage('lobby');
      },
    });
    setRoom(r);
  };

  /** Rejoin the same code. A friend who was slow to open the room fixes this. */
  const retryJoin = () => {
    room?.leave();
    setRoom(null);
    setPlayers([]);
    setPhase('connecting');
    setError(null);
    enter();
  };

  /** Out. The channel is dropped rather than left listening to a dead room. */
  const cancelJoin = () => {
    room?.leave();
    setRoom(null);
    setPlayers([]);
    setPhase('connecting');
    setError(null);
    setStage('name');
  };

  const startRace = (t: string, r: Room) => {
    lanes.current = [
      { id: r.me.id, name: r.me.name, avatar: r.me.avatar, you: true, progress: 0, wpm: 0, finishedAt: null },
      ...r.players.filter((p) => !p.you).map((p) => ({
        id: p.id, name: p.name, avatar: p.avatar, remote: true, progress: 0, wpm: 0, finishedAt: null,
      })),
    ];
    setText(t);
    setResult(null);
    setCount(COUNT_FROM);
    setGo(false);
    setRunning(false);
    setStage('race');
  };

  const session = useTypingSession(
    {
      text: text || ' ',
      mode: 'race',
      label: `Room ${code}`,
      // Blocks on a wrong key, exactly as the signed-in race does. The two are
      // the same race and cannot be scored by different rules. See RaceLive.
      correction: 'strict',
      stopOnComplete: true,
      allowBackspace: true,
      keepTimeline: true,
    },
    {
      disabled: !running || Boolean(result),
      onFinish: (r) => finish(r),
    },
  );

  // Focus while the count is still running: the typing surface frosts itself
  // until it has focus, and the countdown is for reading the first line.
  useEffect(() => {
    if (stage !== 'race') return;
    const t = window.setTimeout(session.focus, 80);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Countdown, then a 25fps tick that moves your own lane and tells the room
  // where you are. Everybody else's lane moves only when their browser says so.
  useEffect(() => {
    if (stage !== 'race') return;
    if (count > 0) {
      const t = window.setTimeout(() => setCount((c) => c - 1), COUNT_STEP_MS);
      return () => window.clearTimeout(t);
    }
    setGo(true);
    const goOff = window.setTimeout(() => setGo(false), GO_MS);
    startedAt.current = performance.now();
    setRunning(true);
    window.setTimeout(session.focus, 60);
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      if (room) {
        reconcileFinished(lanes.current, (id) => room.isFinished(id));
        markAbsent(lanes.current, (id) => room.isPresent(id));
      }
      // Everybody else is across the line or out of the room: the race is over,
      // so this screen stops with it rather than typing on alone. Somebody
      // closing the room used to leave the others racing a car that had gone
      // home. See raceDecided.
      if (raceDecided(lanes.current)) { session.stop(); return; }
      const you = lanes.current.find((l) => l.you);
      if (you && text) {
        // Distance, not cursor. See Engine.distance().
        you.progress = session.engine.distance();
        you.wpm = session.engine.liveStats(performance.now()).wpm;
        room?.sendProgress(you.progress, you.wpm);
      }
      force((n) => n + 1);
    }, 40);
    return () => { window.clearInterval(timer.current); window.clearTimeout(goOff); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, count, text]);

  /*
   * NOT a useCallback.
   *
   * It used to be one, memoised on [room], and it therefore closed over the
   * `session` from an early render — the one built before `startRace` set the
   * text, whose engine still held the one-space placeholder. So this function
   * asked a dead engine whether the racer had reached the end of the text (0 >=
   * 1: no) and how far they had got (0%), while the result handed to it came
   * from the live engine. A guest who won the race was told they were still
   * racing at 0%, with 78 wpm printed above it.
   *
   * The hook reads its options through a ref on every keystroke, so a plain
   * function defined after `session` is both correct and always current.
   */
  const finish = (r: SessionResult) => {
    window.clearInterval(timer.current);
    const you = lanes.current.find((l) => l.you);
    // Crossing the line and being stopped because everybody else already had
    // are different results. See the same split in RaceLive.finishRace.
    const crossed = session.engine.pos >= session.engine.text.length;
    if (you) {
      you.wpm = Math.round(r.wpm);
      you.progress = crossed ? 1 : session.engine.distance();
      you.finishedAt = crossed ? performance.now() : null;
    }
    room?.sendFinish(r.wpm, r.acc, crossed);
    // Only people who were already across count as ahead. Rivals still typing
    // are behind you by definition, and the standings below keep moving until
    // they land.
    const ahead = lanes.current.filter((l) => !l.you && l.finishedAt !== null).length;
    // Stopped because the room emptied, rather than because it was beaten.
    const rivals = lanes.current.filter((l) => !l.you);
    const abandoned = !crossed && rivals.length > 0 && rivals.every((l) => l.left);
    setResult({ r, place: ahead + 1, cut: !crossed, abandoned });
    setStage('done');
    setRematchReady(false);
    room?.reopen();
  };

  quitting.current = stage === 'race' && !result;

  if (signedIn) return <Navigate to={`/app/race/room/${code}`} replace />;

  const list = players;
  /**
   * The room cannot be raced in: nobody is standing in it (the code is wrong,
   * or the friend never opened it), or the connection to it is gone. Either way
   * there is nothing in the lobby to wait for.
   */
  const dead = phase === 'empty' || phase === 'error';
  const meRow = list.find((p) => p.you);
  const isHost = room?.isHost ?? false;
  const allReady = list.length >= 2 && list.every((p) => p.ready);
  // Your own tick stops the moment you finish, so the results screen asks the
  // room directly on every repaint. This is what keeps a rival who lands while
  // you are reading your own numbers from staying "still racing" for ever.
  if (room) reconcileFinished(lanes.current, (id) => room.isFinished(id));
  /** Who crossed and when, then whoever is furthest along of the rest. */
  const standings = [...lanes.current].sort((a, b) => {
    const at = a.finishedAt ?? Infinity, bt = b.finishedAt ?? Infinity;
    if (at !== bt) return at - bt;
    return b.progress - a.progress;
  });

  return (
    <div className="guest-page">
      {/* The invitation to keep an account lives here, beside the logo, on every
          stage. It used to be the loudest button on the results card, which put
          a sign-up where the eye lands after a race and left the standings, the
          thing everybody actually turns to, underneath it. Up here it is
          present the whole visit and in the way of nothing. */}
      <header className="guest-top">
        <Link to="/" aria-label={`${BRAND.name} home`}><Logo /></Link>
        {/* Which room this is, on every stage. A racer who wants to read the
            code out to somebody else, or check they are in the right room, had
            nowhere to look once the race started. */}
        {code && <Chip tone="accent" className="guest-room-tag"><Ic n="ticket" size={13} /> {code}</Chip>}
        <span className="grow" />
        <Btn to="/signin" kind="soft" className="guest-join"><Ic n="sparkles" size={15} /> Create your {BRAND.name}</Btn>
      </header>

      {stage === 'name' && (
        <section className="guest-card">
          <h1><Ic n="ticket" size={22} /> Join room {code || '—'}</h1>
          <p className="muted">
            A friend invited you to a typing race. No account, no email, nothing to install.
            Pick a name and you are in.
          </p>
          {!roomsLive() && (
            <p className="small warnline"><Ic n="warn" size={14} /> Live rooms are not available in this build.</p>
          )}
          <form
            className="guest-name"
            onSubmit={(e) => { e.preventDefault(); enter(); }}
          >
            <label className="small muted" htmlFor="guest-name">Your racing name</label>
            <input
              id="guest-name" className="ob-input" autoFocus maxLength={MAX_NAME}
              placeholder={suggested} value={name}
              onChange={(e) => setName(cleanName(e.target.value))}
            />
            <p className="small muted">
              Everyone in the room sees this. Your real name is nobody's business, so a nickname is perfect.
            </p>
            <Btn type="submit" big disabled={!code}>
              <Ic n="flag" size={17} /> Join the race
            </Btn>
          </form>
          {error && <p className="small warnline"><Ic n="warn" size={14} /> {error}</p>}
        </section>
      )}

      {/*
        A room that is not there is a dead end, and it used to be a dead end
        with a lobby drawn around it: the ready button, the host's start button
        and "waiting for the room" all sat under a line saying nobody was in it.
        Nothing on the screen was pressable to any effect and there was no way
        back. A room nobody is standing in has exactly two answers, so the whole
        card becomes those two.
      */}
      {stage === 'lobby' && dead && (
        <section className="guest-card">
          <h1><Ic n="warn" size={22} /> Room {code} is not open</h1>
          <p className="muted">
            {error ?? 'The room closed, or the code is not the one your friend sent.'}
          </p>
          <div className="guest-again">
            <Btn big onClick={retryJoin}><Ic n="refresh" size={16} /> Try the room again</Btn>
            <button type="button" className="guest-cancel" onClick={cancelJoin}>Cancel</button>
          </div>
        </section>
      )}

      {stage === 'lobby' && !dead && (
        <section className="guest-card">
          <h1><Ic n="ticket" size={22} /> Room {code}</h1>
          {phase === 'connecting' && <p className="small muted">Connecting to the room…</p>}
          {error && <p className="small warnline" role="status"><Ic n="warn" size={14} /> {error}</p>}

          <div className="lobby-list">
            {list.map((p) => (
              <div className="lobby-player" key={p.id}>
                <Avatar v={p.avatar} size={26} />
                <strong>{p.name}</strong>
                {p.you && <Chip tone="accent">you</Chip>}
                {list[0]?.id === p.id && <Chip>host</Chip>}
                <span className="grow" />
                <span className={`ready-dot ${p.ready ? 'rdy' : ''}`} />
                <span className="small muted lobby-ready-txt">{p.ready ? 'Ready' : 'Not ready'}</span>
              </div>
            ))}
            {list.length < 2 && (
              <p className="small muted lobby-waiting"><span className="lobby-pulse" aria-hidden /> Waiting for the room…</p>
            )}
          </div>

          <div className="row gap wrap lobby-actions">
            <Btn kind={meRow?.ready ? 'soft' : 'primary'} onClick={() => room?.setReady(!meRow?.ready)}>
              {meRow?.ready ? 'Cancel ready' : "I'm ready"}
            </Btn>
            {isHost && (
              <Btn disabled={!allReady} onClick={() => room?.start(text || defaultText())} big>
                <Ic n="flag" size={16} /> {allReady ? 'Start race' : 'Waiting for players'}
              </Btn>
            )}
            {!isHost && <span className="small muted">The host starts the race when everyone is ready.</span>}
          </div>
        </section>
      )}

      {stage === 'race' && (
        <section className="guest-card guest-race">
          <div className="card" style={{ position: 'relative' }}>
            <RaceClock startedAt={running ? startedAt.current : null} stopped={Boolean(result)} />
            <RaceCue count={count} go={go} />
            <RaceLanes lanes={lanes.current} running={running} youAvatar={guest.current?.avatar ?? 'bk:4'} />
          </div>
          <div className="train-stage" onClick={session.focus}>
            <TypingText engine={session.engine} caret="bar" focused={session.focused} onClick={session.focus} />
            <GhostInput bind={session.bindInput} />
            <div className="row spread">
              <span className="muted small">
                Accuracy {session.engine.liveStats().acc}% · a wrong key holds the car until you correct it
              </span>
              <span className="muted small">{Math.round(session.engine.distance() * 100)}% of the track</span>
            </div>
          </div>
        </section>
      )}

      {stage === 'done' && result && (
        <section className="guest-card">
          <h1>
            {result.abandoned ? 'Everyone left the room.'
              : result.cut ? 'The race is over.'
              : result.place === 1 ? 'You won!'
              : result.place === 2 ? 'Second across the line.'
              : `You finished ${ordinal(result.place)}.`}
          </h1>
          {result.cut && (
            <p className="muted">
              {result.abandoned
                ? 'Nobody was left to race, so the run stopped there.'
                : 'Everyone else was across the line, so the room stopped there rather than leaving you typing on your own.'}
            </p>
          )}
          <div className="row gap wrap" style={{ justifyContent: 'center' }}>
            <Stat v={Math.round(result.r.wpm)} l="wpm" tone="accent" />
            <Stat v={`${Math.round(result.r.acc)}%`} l="accuracy" />
          </div>

          {/* Everybody, in order, still moving. A race is a comparison, and a
              results screen that shows one person's two numbers is a test
              result. Rivals who have not landed yet keep counting up here
              rather than being frozen at the moment you crossed. */}
          <ol className="guest-standings">
            {standings.map((l, i) => (
              <li key={l.id} className={l.you ? 'is-you' : ''}>
                <span className="guest-pos">{l.finishedAt !== null ? i + 1 : '·'}</span>
                <Avatar v={l.avatar} size={26} />
                {/* Your own name, with the tag rather than instead of it. The
                    row that says only "You" is the one row on the board that
                    does not tell you what everybody else is seeing. */}
                <span className="guest-racer">
                  {l.name}{l.you && <span className="guest-you"> (you)</span>}
                </span>
                <span className="grow" />
                {l.finishedAt !== null ? (
                  <span className="guest-line">{l.wpm} wpm</span>
                ) : l.left ? (
                  <span className="guest-line muted">left the room</span>
                ) : (
                  /* "Still racing" is only true of somebody who really is. Your
                     own row stopped when this screen did, and a rival's stops
                     when their screen says so. */
                  <span className="guest-line muted">
                    {Math.round(l.progress * 100)}% · {l.you || l.stopped ? 'stopped' : 'still racing'}
                  </span>
                )}
              </li>
            ))}
          </ol>

          <div className="guest-again">
            <Btn
              big={!rematchReady} kind={rematchReady ? 'soft' : 'primary'}
              onClick={() => { const next = !rematchReady; setRematchReady(next); room?.setReady(next); }}
            >
              <Ic n={rematchReady ? 'tick' : 'flag'} size={16} />
              {rematchReady ? 'Ready. Waiting for the host.' : 'Ready for the next game'}
            </Btn>
            {rematchReady && (
              <p className="small muted">The host starts it and you will be pulled straight in.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** A guest host still needs something to race over when nobody has raced yet. */
function defaultText(): string {
  return 'Accuracy first, speed second, style always. A calm mind makes fewer errors than a hurried one.';
}
