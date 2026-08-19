import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../lib/store';
import { CPU_LEVELS, makeRacers, recentAvgWpm, type RacerSpec } from '../lib/challenge';
import { SENTENCES, KID_SENTENCES, RACER_NAMES, CLASSMATE_NAMES } from '../lib/words';
import { mulberry32, pickN } from '../lib/rng';
import { setRaceSetup } from '../lib/race';
import { Room, currentRoom, makeRoomCode, normalizeCode, roomUrl, roomsLive, type RoomPhase, type RoomPlayer } from '../lib/room';
import { Btn, Card, Chip, Modal } from '../components/ui';
import { ArenaBoard } from '../components/arena';
import { Ic } from '../components/icons';
import { Avatar } from '../components/avatars';

function raceText(kid: boolean): string {
  const rng = mulberry32(Date.now() % 1e9);
  return pickN(rng, kid ? KID_SENTENCES : SENTENCES, kid ? 2 : 3).join(' ');
}

const DIFF_ICON: Record<string, string> = {
  beginner: 'sprout', casual: 'moon', skilled: 'sparkles', expert: 'flame', adaptive: 'sliders',
};

/**
 * The one race that reaches the board. Every other way to race here is practice.
 *
 * The Lightstream's board score is `wpm × 10 + acc × 2`, so unlike Quill Duel no
 * setting hands out free points directly. What a setting changes is the pull: a
 * 70 wpm rival drags a run faster than a 15 wpm one, and Adaptive — pegged to
 * your own recent average — pulls not at all. Ranking all five together would
 * put a run that was chased against one that was not on the same list and call
 * them the same contest. Ghost races (you against a recording of yourself) and
 * private rooms (whoever turned up, at whatever pace) are the same problem with
 * the pull turned into a coin toss.
 *
 * So one CPU pace per age division is the ranked race, tuned the way the duel's
 * is: fast enough to pull, close enough to the division's median to be worth
 * chasing. Boards are already split by division, so nobody is ever ranked
 * against someone who raced a different rival.
 *
 * Practice races are real: they score, they earn rewards, they move your career
 * record and they can still set your ghost. They just do not post.
 */
const RANKED_CPU: Record<'kid' | 'teen' | 'adult', string> = {
  kid: 'casual',     // 28 wpm
  teen: 'skilled',   // 45 wpm
  adult: 'skilled',
};

/**
 * The server drops a Lightstream run below this (`arena_submit`, the accuracy
 * floor), so the picker has to say so before the race rather than the finish
 * screen explaining it afterwards.
 */
const RANKED_ACC_FLOOR = 90;

export default function RaceHub() {
  const data = useData();
  const nav = useNavigate();
  const { code: urlCode } = useParams();
  // Whether this browser opened the room or arrived at somebody else's. A host
  // alone is normal; a joiner alone means the code is wrong, and Room.open needs
  // to be told which of the two it is. Carried in history state so a pasted link
  // is always the joiner's door, whoever sent it.
  const hostEntry = (useLocation().state as { host?: boolean } | null)?.host === true;
  const rankedId = RANKED_CPU[data?.profile.ageGroup ?? 'adult'];

  // Live room (Supabase Realtime). Survives navigation into a race, so coming
  // back from a finished race lands in the lobby you already belong to.
  const [room, setRoom] = useState<Room | null>(() => currentRoom());
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [phase, setPhase] = useState<RoomPhase>('open');
  const [roomError, setRoomError] = useState<string | null>(null);

  // Practice room: the same lobby against simulated friends, for when there is
  // no project configured or no connection.
  const [sim, setSim] = useState<null | { code: string; players: RoomPlayer[] }>(null);
  const simTimers = useRef<number[]>([]);

  const [joinCode, setJoinCode] = useState('');
  /** 'manual': the clipboard refused, so the text is selected and waiting. */
  const [copied, setCopied] = useState<'link' | 'code' | 'manual' | null>(null);

  useEffect(() => () => { simTimers.current.forEach(clearTimeout); }, []);

  useEffect(() => {
    if (!room) return;
    room.reopen();
    setPlayers(room.players);
    setPhase(room.phase);
    room.on({
      onPlayers: (ps) => setPlayers([...ps]),
      onPhase: (p, e) => { setPhase(p); setRoomError(e ?? null); },
      onStart: ({ text }) => {
        setRaceSetup({
          kind: 'room',
          label: `Room ${room.code}`,
          racers: [],
          remotes: room.players.filter((p) => !p.you).map((p) => ({ id: p.id, name: p.name, avatar: p.avatar })),
          text,
          withGhost: false,
          roomCode: room.code,
          live: true,
        });
        nav('/app/race/live');
      },
    });
  }, [room, nav]);

  /**
   * The URL is the room. `/app/race/room/TYP-4KQ2` opens that channel, whether
   * it was reached by pressing Create, typing a code, or following a link a
   * friend sent; leaving goes back to `/app/race` and closes it. The ref is what
   * keeps that idempotent — this effect re-runs on any navigation, and joining
   * the channel twice would take the lobby down.
   */
  const openedCode = useRef<string | null>(currentRoom()?.code ?? null);
  useEffect(() => {
    if (!data) return;
    const code = normalizeCode(urlCode ?? '');
    if (!code) {
      // Navigated off the room address (Leave, back button, a link elsewhere).
      if (openedCode.current) {
        currentRoom()?.leave();
        setRoom(null);
        setSim(null);
        setPlayers([]);
        openedCode.current = null;
      }
      return;
    }
    if (openedCode.current === code) return;
    currentRoom()?.leave();
    openedCode.current = code;
    setRoomError(null);
    setPlayers([]);
    const meNow = { id: data.profile.id, name: data.profile.name, avatar: data.profile.avatar };
    if (!roomsLive()) { setRoom(null); openSimRoom(code); return; }
    setSim(null);
    setRoom(Room.open(code, meNow, { expectOthers: !hostEntry }));
    // openSimRoom is stable enough for this: it only reads `kid` and the profile,
    // and re-running this effect on every render would rejoin the channel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode, hostEntry, data?.profile.id]);

  if (!data) return null;
  const kid = data.profile.ageGroup === 'kid';
  const avg = recentAvgWpm(data);
  const hasHistory = data.sessions.length > 0;
  const live = roomsLive();

  // ---------- starts ----------

  const startCpu = (id: string) => {
    const lvl = CPU_LEVELS.find((l) => l.id === id) ?? CPU_LEVELS[1];
    const target = lvl.id === 'adaptive' ? avg : lvl.wpm;
    const rng = mulberry32(Date.now() % 1e9);
    setRaceSetup({
      kind: 'cpu',
      label: `${lvl.name} CPU race`,
      racers: makeRacers(rng, target, 3),
      text: raceText(kid),
      withGhost: false,
      ranked: lvl.id === rankedId,
    });
    nav('/app/race/live');
  };

  const startGhost = () => {
    if (!data.ghost) return;
    setRaceSetup({ kind: 'ghost', label: 'Ghost race', racers: [], text: raceText(kid), withGhost: true });
    nav('/app/race/live');
  };

  // ---------- rooms ----------

  const me = { id: data.profile.id, name: data.profile.name, avatar: data.profile.avatar };

  // Creating and joining both do the same thing: put the room's address in the
  // URL. Opening the channel is the effect below, so a pasted link, a typed
  // code and a pressed button all arrive at the room the same way, and the room
  // a learner is standing in is something they can send to somebody.
  const createRoom = () => {
    const code = live ? makeRoomCode() : `TYP-${Math.floor(Math.random() * 900) + 100}`;
    nav(`/app/race/room/${code}`, { state: { host: true } });
  };

  const joinRoom = () => {
    const code = normalizeCode(joinCode);
    if (code.length < 5) { setRoomError('Room codes look like TYP-4KQ2.'); return; }
    setRoomError(null);
    nav(`/app/race/room/${code}`);
  };

  const leaveRoom = () => {
    room?.leave();
    setRoom(null);
    setPlayers([]);
    setRoomError(null);
    simTimers.current.forEach(clearTimeout);
    setSim(null);
    nav('/app/race');
  };

  const openSimRoom = (code: string) => {
    const rng = mulberry32(Date.now() % 1e9);
    const names = pickN(rng, kid ? CLASSMATE_NAMES : RACER_NAMES, 3);
    const avatars = ['bk:2', 'bk:5', 'bk:8'];
    setSim({ code, players: [{ ...me, ready: true, joinedAt: Date.now(), you: true }] });
    names.forEach((n, i) => {
      simTimers.current.push(window.setTimeout(() => {
        setSim((l) => l && ({ ...l, players: [...l.players, { id: n, name: n, avatar: avatars[i % 3], ready: false, joinedAt: Date.now() }] }));
        simTimers.current.push(window.setTimeout(() => {
          setSim((l) => l && ({ ...l, players: l.players.map((p) => (p.id === n ? { ...p, ready: true } : p)) }));
        }, 900 + rng() * 2400));
      }, 700 + i * 1200));
    });
  };

  const startSimRace = () => {
    if (!sim) return;
    const rng = mulberry32(Date.now() % 1e9);
    const racers: RacerSpec[] = sim.players.filter((p) => !p.you).map((p) => ({
      name: p.name, avatar: p.avatar,
      baseWpm: Math.max(10, avg + (rng() - 0.5) * avg * 0.3),
      volatility: 0.3, stumbleRate: 2, sprintFinish: rng() > 0.5, personality: 'friend',
    }));
    setRaceSetup({ kind: 'room', label: `Practice room ${sim.code}`, racers, text: raceText(kid), withGhost: false, roomCode: sim.code });
    nav('/app/race/live');
  };

  /**
   * One flash of feedback for either button, keyed so the right one confirms.
   *
   * The clipboard call can be refused outright: a browser that has not granted
   * write permission, an embedded webview, an insecure origin. That used to
   * end here silently, which on the one screen whose entire job is handing a
   * friend an address is the worst possible failure. So a refusal selects the
   * text instead and the note underneath says to press the key, which is the
   * same outcome by hand.
   */
  const copy = (what: 'link' | 'code', text: string) => {
    const flash = (state: 'link' | 'code' | 'manual') => {
      setCopied(state);
      window.setTimeout(() => setCopied(null), 2400);
    };
    const byHand = () => {
      const el = document.querySelector(what === 'code' ? '.lobby-code > span' : '.lobby-url-txt');
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      flash('manual');
    };
    if (!navigator.clipboard?.writeText) { byHand(); return; }
    navigator.clipboard.writeText(text).then(() => flash(what), byHand);
  };

  // Typed as always present in lib.dom, so it has to be probed rather than truthy-tested.
  const canShare = typeof navigator.share === 'function';

  const shareRoom = (code: string) => {
    const url = roomUrl(code);
    // The share sheet is the right primitive on a phone, where the friend being
    // invited is in a messaging app rather than at a second keyboard. Where
    // there is no sheet, copying the link is the same gesture without the menu.
    if (canShare) {
      void navigator.share({ title: 'KeyTopia race room', text: `Race me in room ${code}`, url }).catch(() => copy('link', url));
      return;
    }
    copy('link', url);
  };

  // ---------- lobby ----------

  const lobbyCode = room?.code ?? sim?.code;
  const list = room ? players : sim?.players ?? [];
  const isHost = room ? room.isHost : true;
  const allReady = list.length >= 2 && list.every((p) => p.ready);
  const meRow = list.find((p) => p.you);
  const startRace = () => (room ? room.start(raceText(kid)) : startSimRace());

  /**
   * The lobby is a dialog over the hub, not a page of its own. A room is a
   * two-minute wait for one friend, and replacing the whole Lightstream with it
   * meant the hub had to be rebuilt on the way out, the board vanished while you
   * waited, and "Leave room" was the only way back to anything.
   */
  const roomModal = lobbyCode ? (
    <Modal open onClose={leaveRoom} labelledBy="ls-room-h" closeLabel="Leave room">
      {/*
        Two things matter in a room: the code, and who is standing in it. The
        dialog used to open with three lines of policy, then a paragraph of
        instructions, then two full-width buttons under the code, then two more
        full-width buttons and a third under those. Five controls and four
        sentences around one six-character string.

        Now the code is the object, its copy button lives on it, the address is
        printed underneath so it can be read off a screen rather than only
        pushed through a share sheet, and there is one action at the foot.
      */}
      <div className="ls-lobby">
        <h2 id="ls-room-h"><Ic n="ticket" size={20} /> Race room</h2>

        <div className="lobby-share">
          <div className="lobby-code" aria-label={`Room code ${lobbyCode}`}>
            <span>{lobbyCode}</span>
            {/* On the code, not under it: the button that copies a thing
                belongs to the thing. */}
            <button
              type="button" className={`lobby-copy ${copied === 'code' ? 'is-done' : ''}`}
              onClick={() => copy('code', lobbyCode)}
              aria-label={copied === 'code' ? 'Code copied' : 'Copy room code'}
            >
              <Ic n={copied === 'code' ? 'tick' : 'clipboard'} size={17} />
            </button>
          </div>

          {/* The address itself, selectable. A share sheet is the right gesture
              on a phone and no gesture at all on a desktop, where the link was
              reachable only by pressing a button and trusting it. */}
          <div className="lobby-url">
            <span className="lobby-url-txt" title={roomUrl(lobbyCode)}>{roomUrl(lobbyCode)}</span>
            <button
              type="button" className={`lobby-copy ${copied === 'link' ? 'is-done' : ''}`}
              onClick={() => copy('link', roomUrl(lobbyCode))}
              aria-label={copied === 'link' ? 'Link copied' : 'Copy room link'}
            >
              <Ic n={copied === 'link' ? 'tick' : 'link'} size={16} />
            </button>
            {canShare && (
              <button
                type="button" className="lobby-copy"
                onClick={() => shareRoom(lobbyCode)}
                aria-label="Share room link"
              >
                <Ic n="send" size={16} />
              </button>
            )}
          </div>
          {/* A copy that worked is confirmed by the tick on the button that did
              it, so there is nothing to say. This line exists for the one case
              the icon cannot cover: a clipboard that refused, where the text is
              now selected and the keyboard has to finish the job. */}
          {copied === 'manual' && (
            <p className="small muted lobby-share-note" role="status">Selected. Press ⌘C or Ctrl+C to copy.</p>
          )}
        </div>

        {phase === 'connecting' && room && <p className="small muted center">Connecting to the room…</p>}
        {roomError && <p className="small warnline" role="status"><Ic n="warn" size={14} /> {roomError}</p>}

        <div className="lobby-list">
          {list.map((p) => (
            <div className="lobby-player" key={p.id}>
              <Avatar v={p.avatar} size={30} />
              <strong>{p.name}</strong>
              {p.you && <Chip tone="accent">you</Chip>}
              {/* Not while the room is reporting itself empty: "host" beside
                  "nobody is in this room" reads as two answers to one question. */}
              {list[0]?.id === p.id && phase !== 'empty' && <Chip>host</Chip>}
              <span className="grow" />
              {/* Your own readiness is a property of your row, not a button at
                  the bottom of the dialog. It sat down there as a second
                  full-width control competing with the one that starts the
                  race, which is the thing everybody is actually waiting for. */}
              {p.you && room ? (
                <button
                  type="button"
                  className={`lobby-ready ${p.ready ? 'is-ready' : ''}`}
                  onClick={() => room.setReady(!p.ready)}
                  aria-pressed={p.ready}
                >
                  <span className={`ready-dot ${p.ready ? 'rdy' : ''}`} aria-hidden />
                  {p.ready ? 'Ready' : 'Tap when ready'}
                </button>
              ) : (
                <span className="lobby-ready lobby-ready-flat">
                  <span className={`ready-dot ${p.ready ? 'rdy' : ''}`} aria-hidden />
                  {p.ready ? 'Ready' : 'Not ready'}
                </span>
              )}
            </div>
          ))}
          {list.length < 2 && phase !== 'empty' && (
            <p className="small muted lobby-waiting"><span className="lobby-pulse" aria-hidden /> Waiting for friends to join…</p>
          )}
        </div>

        <div className="lobby-actions">
          {isHost ? (
            <Btn onClick={startRace} disabled={!allReady} big>
              <Ic n="flag" size={16} /> {allReady ? 'Start race' : list.length < 2 ? 'Waiting for players' : 'Waiting for ready'}
            </Btn>
          ) : (
            <p className="small muted center">The host starts the race when everyone is ready.</p>
          )}
          {/* No "Leave room" button. The dialog's own X is that action, and a
              second control for it sat under the one button anybody came here
              to press. */}
        </div>
      </div>
    </Modal>
  ) : null;

  // ---------- hub ----------

  const ranked = CPU_LEVELS.find((l) => l.id === rankedId) ?? CPU_LEVELS[2];
  const practiceLevels = CPU_LEVELS.filter((l) => l.id !== rankedId);

  return (
    <div className="ls-hub">
      <header className="ls-hero">
        <span className="rh-sky" aria-hidden />
        <span aria-hidden><i className="rh-comet" /><i className="rh-comet" /><i className="rh-comet" /></span>
        <div className="ls-hero-txt">
          <h1>The Lightstream</h1>
          <p>Comet racing across the night. Speed wins races, and accuracy keeps your comet burning bright.</p>
        </div>
        <dl className="ls-career">
          <div><dt>Races</dt><dd>{data.race.races}</dd></div>
          <div><dt>Wins</dt><dd className="good">{data.race.wins}</dd></div>
          <div><dt>Best wpm</dt><dd className="accent">{data.race.bestWpm || '·'}</dd></div>
        </dl>
      </header>

      {/*
        Three ways to race, then the paces, then the board.

        The hub kept growing sideways: a ranked card, four practice tiles each
        carrying a sentence, and — below all of it, inside the practice group —
        the two things people actually come back for, racing a friend and racing
        their own ghost. Both were a scroll away and dressed as practice
        settings. They are modes, so they sit beside the ranked race at mode
        weight, and the five CPU paces collapse into one strip of pills: a pace
        is a number, and a number does not need a paragraph.
      */}
      <div className="ls-grid">
        {/*
          The modes are ONE grid item, not three.

          They were three rows with the board spanning all of them, and a
          spanning item taller than the rows it crosses pushes its extra height
          back into them: every row grew, `align-items: start` parked each card
          at the top of its oversized row, and the page filled with gaps nobody
          wrote. A column that stacks itself cannot be stretched by its neighbour.
        */}
        <div className="ls-modes">
        <Card className="ls-ranked">
          <div className="ls-card-head">
            <h2 className="ls-ranked-title"><Ic n="medal" size={19} /> The ranked race</h2>
            <Chip tone="accent">Counts</Chip>
          </div>
          <p className="ls-ranked-lead">
            Three rival comets at <strong>{ranked.name} pace, around {ranked.wpm} wpm</strong>,
            over {kid ? 'two sentences' : 'three sentences'}.
          </p>

          {/* Two rules, as marks rather than sentences. There were three, each a
              full line: the third said speed scores and accuracy breaks ties,
              which the board itself demonstrates every time you look at it. */}
          <ul className="ls-facts">
            <li><Ic n="target" size={14} /><span>Posts at <strong>{RANKED_ACC_FLOOR}%</strong> accuracy or better</span></li>
            <li><Ic n="shield" size={14} /><span>Ranked against your own age division only</span></li>
          </ul>

          <div className="ls-cta-row">
            <Btn onClick={() => startCpu(rankedId)} big><Ic n="flag" size={17} /> Race now</Btn>
          </div>
        </Card>

        {/* The other two modes, at mode weight. Not settings, not practice
            variants: one is the only way to race a person, the other the only
            way to race yourself. */}
        <div className="ls-ways">
          <Card className="ls-way ls-room">
            <div className="ls-card-head">
              <h3><Ic n="ticket" size={17} /> Private room</h3>
              {!live && <Chip>Simulated friends</Chip>}
            </div>
            <p className="small muted">
              {live
                ? 'Race a friend on a private link. They do not need an account.'
                : 'Rooms run against simulated friends until you sign in.'}
            </p>
            <div className="ls-way-cta">
              <Btn onClick={createRoom}><Ic n="ticket" size={16} /> Create room</Btn>
              <span className="ls-join">
                {/* A visible label, not a placeholder standing in for one: the
                    placeholder is an example code and disappears on the first
                    keystroke, which is exactly when "what is this field" gets
                    asked. */}
                <label htmlFor="ls-code" className="ls-join-label">Have a code?</label>
                <span className="ls-join-row">
                  <input
                    id="ls-code" className="ob-input ls-code-input" placeholder="TYP-4KQ2" maxLength={10}
                    value={joinCode} onChange={(e) => { setJoinCode(e.target.value); setRoomError(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') joinRoom(); }}
                  />
                  <Btn kind="soft" onClick={joinRoom} disabled={!joinCode.trim()}>Join</Btn>
                </span>
              </span>
            </div>
            {roomError && <p className="small warnline" role="status"><Ic n="warn" size={14} /> {roomError}</p>}
          </Card>

          <Card className={data.ghost ? 'ls-way ls-ghost ls-ghost-on' : 'ls-way ls-ghost'}>
            <div className="ls-card-head">
              <h3><Ic n="ghost" size={17} /> Ghost race</h3>
              {data.ghost && <Chip tone="accent">{Math.round(data.ghost.wpm)} wpm</Chip>}
            </div>
            {data.ghost ? (
              <>
                <p className="small muted">
                  Chase your best run, {Math.round(data.ghost.wpm)} wpm at {Math.round(data.ghost.acc)}%. Beat it and it becomes the new ghost.
                </p>
                <div className="ls-way-cta">
                  <Btn onClick={startGhost}><Ic n="ghost" size={16} /> Race your ghost</Btn>
                </div>
              </>
            ) : (
              <>
                <p className="small muted">Finish a race at 85% accuracy and your best run becomes a ghost you can chase.</p>
                <div className="ls-way-cta">
                  <Btn kind="soft" onClick={() => startCpu(rankedId)}><Ic n="flag" size={16} /> Race to unlock</Btn>
                </div>
              </>
            )}
          </Card>
        </div>

        {/* A pace is a number. Four tiles carrying a sentence each turned the
            least important choice on the page into its densest block. */}
        <section className="ls-practice" aria-labelledby="ls-practice-h">
          {/* "Nothing posted" answered a question nobody had asked yet: posted
              where, and by whom. It is a rival pace to practise against, and
              the thing it is not is ranked. */}
          <h2 className="pace-group-label" id="ls-practice-h">
            <Ic n="sliders" size={13} /> Other paces to practise against · not ranked
          </h2>
          <div className="ls-paces">
            {practiceLevels.map((l) => (
              <PaceTile
                key={l.id} level={l}
                pace={l.id === 'adaptive'
                  ? (hasHistory ? `${Math.round(avg)} wpm` : 'your pace')
                  : `${l.wpm} wpm`}
                onRace={() => startCpu(l.id)}
              />
            ))}
          </div>
        </section>
        </div>

        {/* The board, in the column the two short cards used to leave half
            empty. It sticks as the practice column scrolls past it, and on a
            narrow screen it moves below everything: rule 1 of the Arena design
            is that a board never sits between a learner and a race. */}
        <div className="ls-boardcol">
          <ArenaBoard game="lightstream" limit={10} />
        </div>
      </div>

      {roomModal}
    </div>
  );
}

/**
 * One practice pace, and pressing it races it.
 *
 * These were radios above a shared "Race now": two clicks, and a selected state
 * you had to read back off a tile before the button meant anything. With the
 * ranked race owning its own button, nothing here needs selecting first — and a
 * pace only ever needed to say its name and its speed, so the tile lost the
 * description that made four of them heavier than everything above.
 */
function PaceTile({ level, pace, onRace }: {
  level: { id: string; name: string };
  pace: string;
  onRace: () => void;
}) {
  return (
    <button type="button" className="ls-pace-pill" onClick={onRace} title={`Race at ${pace}`}>
      <Ic n={DIFF_ICON[level.id]} size={16} />
      <strong>{level.name}</strong>
      <span className="ls-pace">{pace}</span>
    </button>
  );
}
