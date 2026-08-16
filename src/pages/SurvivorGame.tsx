import { useEffect, useMemo, useRef, useState } from 'react';
import { useData, useStore, useUi } from '../lib/store';
import { COMMON_WORDS, KID_WORDS, RACER_NAMES } from '../lib/words';
import { mulberry32, pick, pickN, avatarIndexFor, hashStr } from '../lib/rng';
import { recentAvgWpm } from '../lib/challenge';
import { wpmOf } from '../lib/metrics';
import { resultFromStrokes, type GameStroke } from '../components/typing';
import { snd } from '../lib/sound';
import { RewardsBanner } from '../components/ResultsPanel';
import { ArenaIntro, ArenaResult, ArenaStage } from '../components/arena';
import { Ic } from '../components/icons';
import { MobileKeys, Runner, useGameKeys } from '../components/gamekit';
import { ANIMAL_START, ANIMAL_COUNT } from '../components/avatars';
import { hopUp, floatText } from '../lib/fx';
import type { Rewards } from '../lib/types';

const HEAT_CLOCKS = [15, 13, 11, 10];         // later heats run hotter
const RIVAL_RAMP = 0.12;                      // rivals toughen 12% per heat
const CUTS = [2, 2, 2, 1]; // 8 → 6 → 4 → 2 → champion

const PLACE_POINTS = 100;   // per place climbed past eighth
const FLAG_POINTS = 40;     // per heat taken outright

/**
 * What a run is worth, in its parts.
 *
 * One function, used live in the HUD and again on the finish screen, because a
 * score that appears only after the fact is a number the learner has no way to
 * connect to anything they did. Every term here is already settled at any
 * moment mid-run: `place` is where a cut on this keystroke would leave you,
 * flags are ones already taken, and pace is measured from the strokes so far.
 * Nothing in it is a projection, so the two step terms only ever climb, and
 * they climb at the moment the thing that earned them happens. Pace is the one
 * term that can fall, and only for the honest reason: you slowed down. It is
 * measured over racing time so a pause can never take points away.
 */
function survivorScore(place: number, flags: number, wpm: number) {
  const survival = (9 - place) * PLACE_POINTS;
  const taken = flags * FLAG_POINTS;
  const pace = Math.round(wpm);
  return { survival, taken, pace, total: survival + taken + pace };
}

interface Entrant {
  name: string; preset: number; you?: boolean;
  wpm: number; chars: number; out: boolean; outHeat?: number;
}

export default function SurvivorGame() {
  const data = useData();
  const recordSession = useStore((s) => s.recordSession);
  const patch = useStore((s) => s.patch);
  const pushToast = useUi((s) => s.pushToast);

  const kid = data?.profile.ageGroup === 'kid';
  const rng = useRef(mulberry32(Date.now() % 1e9));
  const pool = useMemo(() => (kid ? KID_WORDS : COMMON_WORDS.filter((w) => w.length >= 3 && w.length <= 8)), [kid]);

  const [phase, setPhase] = useState<'intro' | 'heat' | 'interlude' | 'over'>('intro');
  const [heat, setHeat] = useState(1);
  const [, force] = useState(0);
  /**
   * The cut, as people rather than a sentence. It used to be a pre-joined
   * string, which is why the two runners walking to the bench could only be
   * named and never shown.
   */
  const [cut, setCut] = useState<{ dropped: Entrant[]; next: number; clock: number; gain: number } | null>(null);
  const [overInfo, setOverInfo] = useState<{
    place: number; champion: boolean; rewards: Rewards | null; score: number;
    parts: ReturnType<typeof survivorScore>;
    heats: number; wpm: number; acc: number; newBest: boolean;
  } | null>(null);

  const ent = useRef<Entrant[]>([]);
  const stream = useRef<string[]>([]);
  const wordIdx = useRef(0);
  const pos = useRef(0);
  const heatTarget = useRef(100);
  const heatDur = useRef(HEAT_CLOCKS[0]);
  const heatWins = useRef(0);
  const heatStart = useRef(0);
  const startedAt = useRef(0);
  const strokes = useRef<GameStroke[]>([]);
  /** Counted as it goes, so the HUD's pace costs nothing to read at 8fps. */
  const correct = useRef(0);
  /**
   * Milliseconds spent actually racing, heats only.
   *
   * Pace measured against the wall clock counts the interludes, which are 2.4
   * seconds each and during which typing is impossible. That made the live
   * total fall across a cut, the one moment the learner had just done well,
   * and it quietly deflated the wpm on the finish screen, which then fed the
   * rolling average that sets rival difficulty everywhere else.
   */
  const raced = useRef(0);
  /**
   * The flag has been crossed and the heat is settling. Without this, every
   * keystroke landing in the 450ms before the heat resolved re-ran the win —
   * another flag on the tally, another badge sound, another "Finish!" — so a
   * four heat match could end claiming seven flags at 40 points each.
   */
  const heatDone = useRef(false);
  const timer = useRef(0);
  const phaseRef = useRef(phase);
  const heatRef = useRef(1);
  const boardRef = useRef<HTMLDivElement>(null);
  phaseRef.current = phase;
  heatRef.current = heat;

  const makeEntrants = (): Entrant[] => {
    const base = data ? Math.max(12, recentAvgWpm(data)) : 25;
    const names = pickN(rng.current, RACER_NAMES, 7);
    const rivals: Entrant[] = names.map((n) => ({
      name: n,
      preset: kid ? ANIMAL_START + (hashStr(n) % ANIMAL_COUNT) : avatarIndexFor(n),
      wpm: Math.max(8, base * (0.55 + rng.current() * 0.8)),
      chars: 0, out: false,
    }));
    return [
      { name: 'You', preset: 0, you: true, wpm: base, chars: 0, out: false },
      ...rivals,
    ];
  };

  const startMatch = () => {
    strokes.current = [];
    correct.current = 0;
    raced.current = 0;
    startedAt.current = performance.now();
    ent.current = makeEntrants();
    heatWins.current = 0;
    setHeat(1);
    heatRef.current = 1;
    startHeat(1);
  };

  const startHeat = (h: number) => {
    // later heats: longer words sneak into the stream (not for the youngest)
    const heatPool = !kid && h >= 3 ? pool.filter((w) => w.length >= 4) : pool;
    stream.current = Array.from({ length: 70 }, () => pick(rng.current, heatPool));
    wordIdx.current = 0;
    pos.current = 0;
    heatDone.current = false;
    const alive = ent.current.filter((e) => !e.out);
    for (const e of alive) e.chars = 0;
    heatDur.current = HEAT_CLOCKS[h - 1] ?? 10;
    const toughen = 1 + (h - 1) * RIVAL_RAMP;
    const fastest = Math.max(...alive.map((e) => (e.you ? e.wpm : e.wpm * toughen)));
    heatTarget.current = Math.max(30, (fastest * 5 / 60) * heatDur.current * 1.05);
    heatStart.current = performance.now();
    setPhase('heat');
    phaseRef.current = 'heat';
    window.clearInterval(timer.current);
    let last = performance.now();
    timer.current = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      // rivals visibly type through the whole heat
      for (const e of ent.current) {
        if (e.out || e.you) continue;
        if (rng.current() < 0.05) continue; // micro-stumble: skips a beat
        e.chars = Math.min(heatTarget.current, e.chars + (e.wpm * toughen * 5 / 60) * dt * (0.8 + rng.current() * 0.4));
      }
      const left = heatDur.current - (now - heatStart.current) / 1000;
      if (left <= 0) resolveHeat(h);
      else force((n) => n + 1);
    }, 120);
  };

  const resolveHeat = (h: number) => {
    window.clearInterval(timer.current);
    if (phaseRef.current !== 'heat') return;
    raced.current += performance.now() - heatStart.current;
    const alive = ent.current.filter((e) => !e.out);
    const sorted = [...alive].sort((a, b) => a.chars - b.chars);
    const cut = Math.min(CUTS[h - 1] ?? 1, sorted.length - 1);
    const dropped = sorted.slice(0, cut);
    for (const d of dropped) { d.out = true; d.outHeat = h; }
    const youOut = dropped.some((d) => d.you);
    const remaining = ent.current.filter((e) => !e.out);

    if (youOut || remaining.length <= 1) {
      finishMatch(youOut ? alive.length : 1, h);
    } else {
      // Surviving a cut is worth every place it moved you up, and this is the
      // moment to say so: the HUD total jumps here, and a number that jumps
      // without a reason beside it is the thing that made the score unfollowable.
      setCut({
        dropped, next: h + 1, clock: HEAT_CLOCKS[h] ?? 10,
        gain: (alive.length - remaining.length) * PLACE_POINTS,
      });
      setPhase('interlude');
      phaseRef.current = 'interlude';
      if (data?.settings.soundOn) snd.step();
      window.setTimeout(() => {
        setHeat(h + 1);
        heatRef.current = h + 1;
        startHeat(h + 1);
      }, 2400);
    }
  };

  const finishMatch = (place: number, lastHeat: number) => {
    window.clearInterval(timer.current);
    const champion = place === 1;
    // Timed over the heats, not the whole visit. The interludes are dead air by
    // design and counting them reported a slower learner than the one who was
    // actually typing, on the finish screen and in the rolling average both.
    const end = performance.now();
    const result = resultFromStrokes('game', 'Survivor Sprint', strokes.current, end - Math.max(1000, raced.current), end, { game: 'survivor', place, heats: lastHeat, heatWins: heatWins.current });
    const rewards = strokes.current.length > 10 ? recordSession(result) : null;
    const parts = survivorScore(place, heatWins.current, result.wpm);
    const score = parts.total;
    let newBest = false;
    patch((d) => {
      const cur = d.gameBests['survivor'];
      if (!cur || score > cur.score) { d.gameBests['survivor'] = { score, level: 9 - place }; newBest = true; }
    });
    if (champion) pushToast({ kind: 'record', icon: 'crown', title: 'Last typist standing!' });
    if (data?.settings.soundOn) (champion ? snd.badge() : snd.done());
    // Heats survived is the game's own count on the board, and wpm/acc rank the
    // typing behind it. docs/arena-leaderboards.md §10 step 4.
    setOverInfo({ place, champion, rewards, score, parts, heats: lastHeat, wpm: result.wpm, acc: result.acc, newBest });
    setPhase('over');
    phaseRef.current = 'over';
  };

  const handleKey = (key: string) => {
    if (phaseRef.current !== 'heat' || heatDone.current) return;
    // One word stands on the track at a time with nothing after it, so there is
    // no space on screen to type and asking for one made the last keystroke of
    // every word a press at a character nobody could see. The final letter ends
    // the word. A space pressed out of habit is swallowed rather than charged
    // against the next word's first letter, which is the only way it could
    // land now that the word turns over on its own.
    if (key === ' ') return;
    const word = stream.current[wordIdx.current] ?? '';
    const want = word[pos.current];
    if (want === undefined) return;
    const t = performance.now();
    const ok = key === want;
    strokes.current.push({ t, exp: want, ok });
    if (!ok) {
      if (data?.settings.soundOn) snd.err();
      return;
    }
    if (data?.settings.soundOn) snd.key();
    correct.current += 1;
    const you = ent.current.find((e) => e.you)!;
    you.chars += 1;
    const ended = pos.current + 1 >= word.length;
    if (ended) {
      // The separator is still recorded, unpressed. Speed here is characters
      // over five like everywhere else, and a word counted without its space is
      // a fifth short: dropping it would price the same typing lower in this
      // game than in any other and drag the learner's rolling average with it.
      strokes.current.push({ t, exp: ' ', ok: true });
      correct.current += 1;
      you.chars += 1;
    }
    // cross the finish line → heat is yours immediately, no waiting out the clock
    if (you.chars >= heatTarget.current) {
      heatDone.current = true;
      heatWins.current += 1;
      if (data?.settings.soundOn) snd.badge();
      const board = boardRef.current;
      // Named and priced. "Finish! heat yours" said what happened but not what
      // it was worth, so the +40 on the HUD had nothing to attach itself to.
      if (board) floatText(board, `Heat yours  +${FLAG_POINTS}`, board.clientWidth / 2, board.clientHeight * 0.3, 'fx-score');
      window.setTimeout(() => resolveHeat(heatRef.current), 450);
      force((n) => n + 1);
      return;
    }
    if (ended) {
      wordIdx.current += 1;
      pos.current = 0;
      const el = boardRef.current?.querySelector<HTMLElement>('.runner-you');
      hopUp(el ?? null, 9);
      if (boardRef.current && el) {
        const r = el.getBoundingClientRect();
        const b = boardRef.current.getBoundingClientRect();
        floatText(boardRef.current, `+${word.length}`, r.left - b.left + 14, r.top - b.top - 6, 'fx-score');
      }
    } else {
      pos.current += 1;
    }
    force((n) => n + 1);
  };

  useGameKeys(phase === 'heat', handleKey, { onEscape: () => resolveHeat(heatRef.current) });
  useEffect(() => () => window.clearInterval(timer.current), []);

  if (!data) return null;
  const word = stream.current[wordIdx.current] ?? '';
  const alive = ent.current.filter((e) => !e.out);
  const benched = ent.current.filter((e) => e.out);
  // Between heats the clock shows what the NEXT one is worth, not the first
  // heat's 15s: the whole point of the interlude is that the track is about to
  // get shorter, and a clock that read 15 every time hid the one fact it had.
  const timeLeft = phase === 'heat'
    ? Math.max(0, heatDur.current - (performance.now() - heatStart.current) / 1000)
    : phase === 'interlude' ? (HEAT_CLOCKS[heat] ?? 10) : HEAT_CLOCKS[0];
  const pctOf = (e: Entrant) => Math.min(96, (e.chars / heatTarget.current) * 100);
  // Where a cut on this keystroke would leave you: last of whoever is still in.
  const racedMs = raced.current + (phase === 'heat' ? performance.now() - heatStart.current : 0);
  const live = survivorScore(alive.length, heatWins.current, wpmOf(correct.current, racedMs));

  if (phase === 'intro') {
    return (
      <ArenaIntro
        game="survivor"
        title="Eight racers, one crown"
        onPlay={startMatch}
        cta="Take your lane →"
        stats={data.gameBests['survivor'] ? [
          { label: 'Best finish', value: data.gameBests['survivor'].level >= 8 ? 'Champion' : `Top ${9 - data.gameBests['survivor'].level}` },
          { label: 'Best score', value: data.gameBests['survivor'].score },
        ] : undefined}
      >
        <p>
          Four heats, each faster than the last: 15 seconds, then 13, then 11, then 10.
          Every correct letter pushes your runner down the track, and reaching the flag
          before the clock takes the heat outright.
        </p>
        <p>
          After each heat the slowest move to the <strong>cheer bench</strong>. No shame,
          instant rematch. Outrun every cut and the final duel to take the crown.
        </p>
      </ArenaIntro>
    );
  }

  if (phase === 'over' && overInfo) {
    return (
      <ArenaResult
        game="survivor"
        run={{ wpm: overInfo.wpm, acc: overInfo.acc, value: overInfo.heats }}
        score={overInfo.score}
        title={overInfo.champion ? 'Last typist standing!' : `Benched in place ${overInfo.place}`}
        newBest={overInfo.newBest}
        onAgain={startMatch}
      >
        {/* The total, shown owing its parts. The big number used to be the
            first and only sight of the score, so there was no way to tell
            whether 141 came from surviving, from flags or from pace, and
            therefore no way to know what to do differently next run. */}
        <dl className="surv-tally">
          <div>
            <dt><Ic n="medal" size={13} /> {overInfo.champion ? 'Champion' : `Survived to place ${overInfo.place}`}</dt>
            <dd>{overInfo.parts.survival}</dd>
          </div>
          <div>
            <dt><Ic n="flag" size={13} /> {heatWins.current} {heatWins.current === 1 ? 'flag' : 'flags'} taken</dt>
            <dd>{overInfo.parts.taken}</dd>
          </div>
          <div>
            <dt><Ic n="gauge" size={13} /> {Math.round(overInfo.wpm)} wpm pace</dt>
            <dd>{overInfo.parts.pace}</dd>
          </div>
          <div className="surv-tally-sum">
            <dt>Total</dt>
            <dd>{overInfo.parts.total}</dd>
          </div>
        </dl>
        <RewardsBanner rewards={overInfo.rewards} />
        <p className="small muted" style={{ maxWidth: 430 }}>
          {overInfo.champion
            ? 'Consistency wins crowns. Take that steadiness into a speed sprint.'
            : 'The bench cheers loudest for rematches. Every heat you survive raises your floor.'}
        </p>
      </ArenaResult>
    );
  }

  return (
    <>
      <ArenaStage
        game="survivor"
        quiet
        wide
        hud={(
          <>
            {/* Points first, and in the same words the finish screen uses. Every
                other game in the Arena runs its score here; this one banked it
                silently and produced the total at the end, which is why the
                number arrived as news rather than as something you watched. */}
            <span><b>{live.total}</b> points</span>
            <span><b>{heat}</b> of 4 heats</span>
            {/* Both of these are drawn elsewhere on the screen: the lanes are
                the count of who is left, and pace is the only term of the score
                that is not. On a phone the strip wraps, and a fifth item pushed
                the clock onto a line of its own, so the two that the board
                already says are the two that go. */}
            <span className="hud-roomy"><b>{alive.length}</b> still racing</span>
            {/* Pace sits behind the learner's own "Live WPM while typing"
                switch: it moves on every keystroke, and some people turn it off
                precisely to stop watching it. */}
            {data.settings.showLiveWpm && <span className="muted hud-roomy">{live.pace} wpm</span>}
            <span className="grow" />
            <span className={`arena-hud-clock ${timeLeft < 5 ? 'bad' : ''}`}>{Math.ceil(timeLeft)}s</span>
          </>
        )}
        main={(
          <div className="surv-band">
            <p className="arena-stage-kicker"><Ic n="keyboard" size={14} /> Type to run</p>
            <div className="surv-typebox" aria-live="off">
              <span className="good">{word.slice(0, pos.current)}</span>
              <span className="duel-cur">{word[pos.current] ?? ''}</span>
              <span className="muted">{word.slice(pos.current + 1)}</span>
            </div>
            <p className="surv-next muted small">
              next {stream.current[wordIdx.current + 1]} {stream.current[wordIdx.current + 2]}
            </p>
          </div>
        )}
        side={(
          <div className={`surv-scene ${kid ? 'surv-kid' : ''}`} ref={boardRef}>
            {/* The cut belongs on the track, over the lanes it just changed —
                not blurred across the far side of the screen. It scrims rather
                than blurs, because the two runners walking to the bench behind
                it are the thing the message is about and the only part of a
                cut that is any fun to watch. */}
            {phase === 'interlude' && cut && (
              <div className="surv-cut" role="status">
                <div className="surv-cut-card">
                  {/* Your own standing first. This screen only ever appears
                      when you survived — being cut ends the match — so the one
                      fact the learner is looking for is already known, and
                      naming who left instead led with somebody else's news. */}
                  <p className="surv-cut-safe">
                    <Ic n="flag" size={15} /> You’re through
                    {cut.gain > 0 && <b className="surv-cut-gain">+{cut.gain}</b>}
                  </p>
                  <ul className="surv-cut-list">
                    {cut.dropped.map((d) => (
                      <li key={d.name}>
                        <Runner preset={d.preset} size={30} benched />
                        <span>{d.name}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="surv-cut-bench small muted">
                    <Ic n="heart" size={13} /> {cut.dropped.length === 1 ? 'heads' : 'head'} to the cheer bench
                  </p>
                  {/* The ramp, said out loud. Each heat runs shorter than the
                      last and nothing ever told anyone that; a learner who was
                      not counting just felt the next one go badly. */}
                  <p className="surv-cut-next">
                    Heat <b>{cut.next}</b> · <b>{cut.clock}s</b>
                    <span className="muted small"> {cut.clock < heatDur.current ? 'shorter' : 'same'} than the last</span>
                  </p>
                  <span className="surv-cut-bar" aria-hidden><i /></span>
                </div>
              </div>
            )}
            <div className="surv-lanes">
              {alive.map((e) => (
                <div key={e.name} className="surv-lane">
                  <span className="surv-lane-name">{e.you ? <strong>You</strong> : e.name}</span>
                  <div className="surv-lane-track">
                    <span className="surv-sprite" style={{ left: `${pctOf(e)}%` }}>
                      <Runner
                        av={e.you ? data.profile.avatar : undefined}
                        preset={e.you ? undefined : e.preset}
                        size={34}
                        running={phase === 'heat'}
                        you={e.you}
                      />
                    </span>
                    <span className="surv-finish"><Ic n="flag" size={16} /></span>
                  </div>
                </div>
              ))}
            </div>
            {benched.length > 0 && (
              <div className="surv-bench">
                <span className="small muted"><Ic n="heart" size={13} /> cheer bench</span>
                {benched.map((e) => (
                  <span key={e.name} className="surv-bench-seat" title={`out in heat ${e.outHeat}`}>
                    <Runner preset={e.preset} av={e.you ? data.profile.avatar : undefined} size={26} benched />
                    <small className="muted">{e.you ? 'You' : e.name}</small>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      />
      <MobileKeys active={phase === 'heat'} />
    </>
  );
}
