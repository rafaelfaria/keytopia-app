import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, useStore, useUi } from '../lib/store';
import { getRaceSetup, setRaceSetup } from '../lib/race';
import { GhostInput, TypingText, useTypingSession } from '../components/typing';
import { Btn, Chip } from '../components/ui';
import { ArenaResult } from '../components/arena';
import { RewardsBanner } from '../components/ResultsPanel';
import { snd } from '../lib/sound';
import { Ic } from '../components/icons';
import { Avatar } from '../components/avatars';
import { COUNT_FROM, COUNT_STEP_MS, GO_MS, RaceClock, RaceCue, RaceLanes, markAbsent, raceDecided, reconcileFinished, type RaceLane as Lane } from '../components/raceLanes';
import { mulberry32 } from '../lib/rng';
import { currentRoom } from '../lib/room';
import type { Rewards, SessionResult } from '../lib/types';

/**
 * The board's own formula, mirrored so the number counting up on the finish
 * screen is the number that lands on the row beneath it. Must stay in step with
 * the `lightstream` branch of `arena_score()`
 * (supabase/migrations/20260816120000_arena_boards.sql).
 */
const lightstreamScore = (wpm: number, acc: number) => Math.round(wpm * 10 + acc * 2);

/**
 * `arena_submit` drops a Lightstream run below this accuracy without saying so,
 * because a sloppy sprint must not outrank a clean one. The finish screen has to
 * know the same rule, or a ranked race would silently produce no standing and
 * read as a broken board rather than a missed floor.
 */
const RANKED_ACC_FLOOR = 90;

/**
 * A saved ghost holds one progress sample per second of the run, so replaying it
 * means walking that curve rather than assuming an even pace. It matters: the
 * interesting part of racing yourself is watching where past-you sped up.
 */
function ghostProgress(curve: number[] | undefined, elapsed: number, fallbackWpm: number, textLen: number): number {
  if (!curve || curve.length < 2) {
    const totalSec = (textLen / 5 / Math.max(1, fallbackWpm)) * 60;
    return Math.min(1, elapsed / totalSec);
  }
  if (elapsed >= curve.length - 1) return 1;
  const i = Math.floor(elapsed);
  const f = elapsed - i;
  return Math.min(1, curve[i] + (curve[i + 1] - curve[i]) * f);
}

export default function RaceLive() {
  const data = useData();
  const nav = useNavigate();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);
  const setup = getRaceSetup();

  const [count, setCount] = useState(COUNT_FROM);
  const [go, setGo] = useState(false);
  const [running, setRunning] = useState(false);
  const [, force] = useState(0);
  /** `cut`: the race was called before this screen reached the end of the text. */
  const [done, setDone] = useState<{ result: SessionResult; rewards: Rewards; place: number; lanes: Lane[]; best: boolean; cut: boolean; abandoned: boolean } | null>(null);

  const lanes = useRef<Lane[]>([]);
  const botState = useRef<Record<string, { stumbleUntil: number; noise: number }>>({});
  const timer = useRef(0);
  const startT = useRef(0);
  const lastT = useRef(0);
  const progressSamples = useRef<number[]>([]);
  const rng = useRef(mulberry32(Date.now() % 1e9));

  useEffect(() => {
    if (!setup) { nav('/app/race', { replace: true }); }
  }, [setup, nav]);

  const session = useTypingSession(
    {
      text: setup?.text ?? ' ',
      mode: 'race',
      label: setup?.label ?? 'Race',
      /*
       * A race blocks on a wrong key. It does not carry it.
       *
       * Standard correction walks the cursor over a mistake and leaves it
       * behind, which in a race is a way of buying ground with errors: type
       * anything fast enough and you reach the end of the text first, whatever
       * you actually typed. Every fix for that is a rule about how much a
       * mistake should cost, and the honest answer is that it costs the key
       * again. This is what a typing race has always done, and it makes the
       * position on the track, the wpm beside it and the text on screen three
       * views of one number.
       */
      correction: 'strict',
      stopOnComplete: true,
      allowBackspace: true,
      keepTimeline: true,
    },
    {
      soundOn: data?.settings.soundOn,
      disabled: !running || !!done,
      onFinish: (r) => finishRace(r),
    },
  );

  // Build lanes for this race setup (memo so they exist on first render, during countdown)
  useMemo(() => {
    if (!setup || !data) return;
    const ls: Lane[] = [{ id: 'you', name: data.profile.name, avatar: data.profile.avatar, you: true, progress: 0, wpm: 0, finishedAt: null }];
    botState.current = {};
    for (const r of setup.racers) {
      ls.push({ id: r.name, name: r.name, avatar: r.avatar, progress: 0, wpm: Math.round(r.baseWpm), finishedAt: null });
      botState.current[r.name] = { stumbleUntil: 0, noise: 1 };
    }
    // Real people. Their lanes are moved by their own browsers, never guessed.
    for (const r of setup.remotes ?? []) {
      ls.push({ id: r.id, name: r.name, avatar: r.avatar, remote: true, progress: 0, wpm: 0, finishedAt: null });
    }
    if (setup.withGhost && data.ghost) {
      ls.push({ id: 'ghost', name: `Ghost (${data.ghost.wpm} wpm)`, avatar: 'ghost-ic', ghost: true, progress: 0, wpm: data.ghost.wpm, finishedAt: null });
    }
    lanes.current = ls;
  }, [setup, data?.profile.id, count === COUNT_FROM]);

  /** Re-arm for another race on this setup, optionally with fresh text. */
  const resetRace = useCallback((text?: string) => {
    if (!setup) return;
    setRaceSetup({ ...setup, ...(text ? { text } : {}) });
    window.clearInterval(timer.current);
    progressSamples.current = [];
    lanes.current = [];
    botState.current = {};
    setDone(null);
    setRunning(false);
    setGo(false);
    setCount(COUNT_FROM);
    session.restart();
  }, [setup, session]);

  // Live room: remote lanes move only when their own browser says so, and the
  // host can re-arm everybody from the results screen.
  useEffect(() => {
    if (!setup?.live) return;
    currentRoom()?.on({
      onProgress: (id, p, wpm) => {
        const lane = lanes.current.find((l) => l.id === id);
        if (!lane || lane.finishedAt) return;
        lane.progress = Math.max(lane.progress, p);
        lane.wpm = Math.round(wpm);
      },
      // Only a racer who crossed gets the line and a rank. One who was stopped
      // short keeps the ground they covered and sorts below the finishers.
      onFinish: (id, wpm, _acc, crossed) => {
        const lane = lanes.current.find((l) => l.id === id);
        if (!lane || lane.finishedAt) return;
        // Their final figure, not whatever the last progress packet happened to
        // carry: the standings print this and a race can end between packets.
        lane.wpm = Math.round(wpm);
        if (crossed) { lane.progress = 1; lane.finishedAt = performance.now(); }
        else lane.stopped = true;
      },
      onStart: ({ text }) => resetRace(text),
      // The host called everyone back. A rematch gathers the room again rather
      // than dropping straight into a countdown, so this is a navigation, not
      // a restart: the lobby is where people ready up and where somebody
      // holding the link can still walk in.
      onLobby: () => nav(`/app/race/room/${setup.roomCode ?? ''}`),
    });
  }, [setup, resetRace, nav]);

  /**
   * Focus the input while the count is still running, not at GO.
   *
   * The typing surface frosts itself until it has focus, so waiting until the
   * race started meant the five seconds meant for reading the first line were
   * five seconds of unreadable text. Keystrokes are gated by `running`, so this
   * is safe: it only makes the words legible before they matter.
   */
  useEffect(() => {
    if (!setup || done) return;
    const t = window.setTimeout(session.focus, 80);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup, done]);

  // Countdown
  useEffect(() => {
    if (!setup) return;
    if (count > 0) {
      if (data?.settings.soundOn) snd.count(false);
      const t = setTimeout(() => setCount((c) => c - 1), COUNT_STEP_MS);
      return () => clearTimeout(t);
    }
    if (data?.settings.soundOn) snd.count(true);
    // GO! leaves on its own clock. Tying it to the first keystroke meant it
    // covered the track for as long as somebody hesitated.
    setGo(true);
    const goOff = window.setTimeout(() => setGo(false), GO_MS);
    setRunning(true);
    startT.current = performance.now();
    lastT.current = 0;
    setTimeout(session.focus, 60);
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => tick(performance.now()), 40);
    return () => { window.clearInterval(timer.current); window.clearTimeout(goOff); };
  }, [count, setup]);

  const tick = useCallback((t: number) => {
    if (!setup || !data) return;
    const elapsed = (t - startT.current) / 1000;
    const dt = Math.min(0.08, lastT.current ? (t - lastT.current) / 1000 : 0.016);
    lastT.current = t;
    const textLen = setup.text.length;

    // Remote lanes first: a rival who has crossed is placed on the line even if
    // their finish broadcast never arrived. See reconcileFinished.
    if (setup.live) {
      const room = currentRoom();
      if (room) {
        reconcileFinished(lanes.current, (id) => room.isFinished(id));
        markAbsent(lanes.current, (id) => room.isPresent(id));
      }
      if (raceDecided(lanes.current)) { session.stop(); return; }
    }

    // user lane
    const you = lanes.current.find((l) => l.you)!;
    // Distance, not cursor. Under strict correction the two agree, and they
    // must keep agreeing: the bots move at a rate derived from words per
    // minute, so a lane measured in raw keystrokes would be racing them in a
    // different unit. See Engine.distance().
    you.progress = session.engine.distance();
    you.wpm = session.engine.liveStats(t).wpm;
    if (Math.floor(elapsed) > progressSamples.current.length - 1) progressSamples.current.push(you.progress);
    if (setup.live) currentRoom()?.sendProgress(you.progress, you.wpm);

    // bots
    for (const spec of setup.racers) {
      const lane = lanes.current.find((l) => l.id === spec.name)!;
      if (lane.finishedAt) continue;
      const bs = botState.current[spec.name];
      if (t < bs.stumbleUntil) continue;
      if (rng.current() < (spec.stumbleRate / 60) * 0.016 * 60) {
        bs.stumbleUntil = t + 300 + rng.current() * 900;
      }
      bs.noise += (rng.current() - 0.5) * spec.volatility * 0.2;
      bs.noise = Math.max(0.55, Math.min(1.45, bs.noise));
      let wpm = spec.baseWpm * bs.noise;
      if (spec.sprintFinish && lane.progress > 0.8) wpm *= 1.16;
      const cps = (wpm * 5) / 60;
      lane.progress = Math.min(1, lane.progress + (cps / textLen) * dt);
      lane.wpm = Math.round(wpm);
      if (lane.progress >= 1 && !lane.finishedAt) lane.finishedAt = t;
    }

    // ghost
    if (setup.withGhost && data.ghost) {
      const lane = lanes.current.find((l) => l.ghost);
      if (lane && !lane.finishedAt) {
        lane.progress = ghostProgress(data.ghost.curve, elapsed, data.ghost.wpm, textLen);
        if (lane.progress >= 1) lane.finishedAt = t;
      }
    }

    force((n) => n + 1);
  }, [setup, data, session.engine]);

  useEffect(() => () => window.clearInterval(timer.current), []);

  /**
   * Walking out of a race in a room has to be announced.
   *
   * Going back to the room is not leaving the room, so presence keeps showing
   * this browser at the table while its car has simply stopped. Every other
   * screen would race on against it until the text ran out. The ref is written
   * on every render and read once, in the unmount that follows.
   */
  const quitting = useRef(false);
  quitting.current = Boolean(setup?.live) && running && !done;
  useEffect(() => () => { if (quitting.current) currentRoom()?.sendQuit(); }, []);

  const finishRace = (r: SessionResult) => {
    if (!setup || !data) return;
    window.clearInterval(timer.current);
    // Read before recordSession writes the new career figures over it.
    const prevBest = data.race.bestWpm;
    const you = lanes.current.find((l) => l.you)!;
    /*
     * Two ways a run can end, and they are not the same result.
     *
     * Reaching the end of the text is crossing the line, and under strict
     * correction there is no way to reach it without having typed it. Being
     * stopped because every rival was already across is not: the car stays
     * where it got to, and `finishedAt` stays null so the standings sort it
     * behind everybody who actually finished rather than by the moment the
     * race was called.
     */
    const crossed = session.engine.pos >= session.engine.text.length;
    you.wpm = Math.round(r.wpm);
    you.progress = crossed ? 1 : session.engine.distance();
    you.finishedAt = crossed ? performance.now() : null;
    // Stopped because the room emptied, rather than because it was beaten.
    const rivals = lanes.current.filter((l) => !l.you && !l.ghost);
    const abandoned = !crossed && rivals.length > 0 && rivals.every((l) => l.left);
    if (setup.live) currentRoom()?.sendFinish(r.wpm, r.acc, crossed);
    // The order on the track is the order on the podium and the place in the
    // record, from one sort: who crossed the line, then how far the rest got.
    // Reconciled first, so a rival who landed a moment before you is on the
    // line rather than wherever their last progress message left them.
    if (setup.live) {
      const room = currentRoom();
      if (room) reconcileFinished(lanes.current, (id) => room.isFinished(id));
    }
    const snapshot = lanes.current.map((l) => ({ ...l }));
    snapshot.sort((a, b) => {
      const at = a.finishedAt ?? Infinity, bt = b.finishedAt ?? Infinity;
      if (at !== bt) return at - bt;
      return b.progress - a.progress;
    });
    const place = snapshot.findIndex((l) => l.you) + 1;
    r.extra = { ...r.extra, place, race: setup.kind };
    const rewards = recordSession(r);
    if (place === 1 && data.settings.soundOn) snd.badge();
    else if (data.settings.soundOn) snd.done();
    // store ghost if best
    if (r.acc >= 85 && (!data.ghost || r.wpm >= data.ghost.wpm)) {
      const curve = [...progressSamples.current, 1];
      patch((d) => { d.ghost = { wpm: r.wpm, acc: r.acc, curve, t: Date.now() }; });
      pushToast({ kind: 'info', icon: 'ghost', title: 'New ghost saved', body: 'Your best run is now raceable.' });
    }
    if (rewards.badges.length) pushToast({ kind: 'badge', icon: 'medal', title: 'Badge unlocked!' });
    setDone({ result: r, rewards, place, lanes: snapshot, best: r.wpm > prevBest, cut: !crossed, abandoned });
  };

  if (!setup || !data) return null;

  if (done) {
    const top3 = done.lanes.slice(0, 3);
    // A ranked race that missed the accuracy floor is a practice run, and the
    // screen says so rather than posting into silence and showing no rank.
    const cleanEnough = done.result.acc >= RANKED_ACC_FLOOR;
    const ranked = setup.ranked === true && cleanEnough;
    return (
      <ArenaResult
        game="lightstream"
        backTo="/app/race"
        run={{ wpm: done.result.wpm, acc: done.result.acc }}
        score={lightstreamScore(done.result.wpm, done.result.acc)}
        ranked={ranked}
        practiceHint={setup.ranked === true && !cleanEnough
          ? `Ranked races post at ${RANKED_ACC_FLOOR}% accuracy or better, so a clean run always beats a fast messy one.`
          : 'The ranked race is the highlighted rival pace in the Lightstream hub.'}
        /* A private room has its own result and no board, so the panel beside
           it is the room's finishing order. It used to be the practice-run
           explainer pointing at the ranked race in the hub, which is a true
           sentence about a screen nobody in a room with a friend is looking
           for. */
        standing={setup.roomCode ? (
          <div className="arena-result-board">
            <h3 className="arena-stage-kicker"><Ic n="ticket" size={15} /> Room {setup.roomCode}</h3>
            <ol className="guest-standings">
              {done.lanes.map((l, i) => (
                <li key={l.id} className={l.you ? 'is-you' : ''}>
                  <span className="guest-pos">{l.finishedAt !== null ? i + 1 : '·'}</span>
                  {l.you ? <Avatar v={data.profile.avatar} size={26} /> : <Avatar v={l.avatar} size={26} />}
                  <span className="guest-racer">
                    {l.you ? data.profile.name : l.name}
                    {l.you && <span className="guest-you"> (you)</span>}
                  </span>
                  <span className="grow" />
                  <span className={`guest-line ${l.finishedAt !== null ? '' : 'muted'}`}>
                    {l.finishedAt !== null ? `${l.wpm} wpm`
                      : l.left ? 'left the room'
                      : `${Math.round(l.progress * 100)}% · ${l.you || l.stopped ? 'stopped' : 'did not finish'}`}
                  </span>
                </li>
              ))}
            </ol>
            <p className="arena-line small muted">
              <Ic n="users" size={13} /> Room races are practice. They earn rewards and post to no board.
            </p>
          </div>
        ) : undefined}
        title={done.abandoned ? 'Everyone left the room.'
          : done.cut ? 'The race was over before you got there.'
          : done.place === 1 ? 'Victory! Your comet crossed first.'
          : done.place === 2 ? 'So close. Second across the sky.'
          : done.place === 3 ? 'On the podium!'
          : `You finished ${done.place}th.`}
        newBest={done.best}
        onAgain={() => resetRace()}
        /* Two buttons in a room, three outside one. The room row used to carry
           "Rematch: back to the room" and "Back to room" side by side, which is
           the same destination twice, plus Home: three controls of three
           different widths wrapping into each other. */
        actions={setup.live ? (
          <>
            {currentRoom()?.isHost ? (
              <Btn big onClick={() => currentRoom()?.returnToLobby()}>
                <Ic n="refresh" size={15} /> Rematch: back to the room
              </Btn>
            ) : (
              <Btn big to={`/app/race/room/${setup.roomCode ?? ''}`}>
                <Ic n="ticket" size={15} /> Back to the room
              </Btn>
            )}
            <Btn kind="ghost" to="/app">Home</Btn>
            {!currentRoom()?.isHost && (
              <p className="small muted arena-result-wait">The host can call everyone back for another.</p>
            )}
          </>
        ) : (
          <>
            <Btn big onClick={() => resetRace()}><Ic n="refresh" size={15} /> Rematch</Btn>
            <Btn kind="soft" to="/app/race">Race hub</Btn>
            <Btn kind="ghost" to="/app">Home</Btn>
          </>
        )}
      >
        {/* The podium is the celebration for a race whose result is not written
            anywhere else on the screen. A room's result is: the panel beside
            this one lists everybody in order, with their figures. Drawing both
            said the same thing twice and pushed the buttons under the fold. */}
        {!setup.roomCode && <div className="podium">
          {[1, 0, 2].map((idx) => {
            const lane = top3[idx];
            if (!lane) return <div key={idx} style={{ width: 86 }} />;
            return (
              <div key={idx} className={`podium-col podium-${idx + 1}`}>
                {lane.ghost ? <Ic n="ghost" size={26} /> : lane.you ? <Avatar v={data.profile.avatar} size={26} /> : <Avatar v={lane.avatar} size={26} />}
                <small className={lane.you ? 'good' : 'muted'} style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lane.name}</small>
                <div className="podium-block"><Ic n={idx === 0 ? 'trophy' : 'medal'} size={20} /></div>
              </div>
            );
          })}
        </div>}
        <RewardsBanner rewards={done.rewards} />
        {done.cut && (
          <p className="small muted" style={{ maxWidth: 430 }}>
            {done.abandoned
              ? 'Nobody was left to race, so the run stopped there.'
              : 'Everyone else was across the line, so the room stopped there.'}
            You got {Math.round((done.lanes.find((l) => l.you)?.progress ?? 0) * 100)}% of the way,
            and what you typed still counts.
          </p>
        )}
        {/* "6 career wins" was a number with no noun: wins of what, counted
            since when. It is every first place you have taken in the
            Lightstream, so it says that, and it stays off a room's result
            where the room's own order is the thing being read. */}
        <p className="small muted" style={{ maxWidth: 430 }}>
          {done.result.consistency}% consistency
          {!setup.roomCode && data.race.wins > 0 && (
            <> · {data.race.wins} first {data.race.wins === 1 ? 'place' : 'places'} in the Lightstream</>
          )}
        </p>
      </ArenaResult>
    );
  }

  return (
    <div className="train-page" onClick={session.focus}>
      <div className="train-top">
        {/* Out of a room race goes back to the room, not to the hub: the hub is
            the one address that means "not in a room", so landing there would
            quietly drop you out of one. Leaving is the dialog's own button. */}
        <Btn kind="ghost" onClick={() => nav(setup.roomCode ? `/app/race/room/${setup.roomCode}` : '/app/race')} ariaLabel="Exit race">←</Btn>
        <h1><Ic n="rocket" size={20} /> {setup.label}</h1>
        {/* Only when the heading does not already say it. A room race is
            labelled "Room TYP-QTSK", and the chip beside it said the same six
            characters a second time. */}
        {setup.roomCode && !setup.label.includes(setup.roomCode) && <Chip tone="accent">Room {setup.roomCode}</Chip>}
      </div>

      <div className="card" style={{ position: 'relative' }}>
        <RaceClock startedAt={running ? startT.current : null} stopped={Boolean(done)} />
        <RaceCue count={count} go={go} />
        <RaceLanes lanes={lanes.current} running={running} youAvatar={data.profile.avatar} />
      </div>

      <div className="train-stage">
        <TypingText engine={session.engine} caret={data.settings.caret} focused={session.focused} onClick={session.focus} />
        <GhostInput bind={session.bindInput} />
        {/* Two percentages sat here, one labelled "Accuracy" and one bare, and
            they disagreed: the bare one was the cursor's way through the text
            while the car was drawn from something else entirely. Both are now
            named, and the right-hand one is the car's own distance, so the
            number under the text and the position on the track are the same
            fact. */}
        <div className="row spread">
          <span className="muted small">
            Accuracy {session.engine.liveStats().acc}% · a wrong key holds the car until you correct it
          </span>
          <span className="muted small">{Math.round(session.engine.distance() * 100)}% of the track</span>
        </div>
      </div>
    </div>
  );
}
