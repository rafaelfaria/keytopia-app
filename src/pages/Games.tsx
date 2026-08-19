import { Link } from 'react-router-dom';
import { useData } from '../lib/store';
import { Card, Chip } from '../components/ui';
import { Ic } from '../components/icons';
import { ARENA_GAMES, ARENA_LIST, type ArenaGame } from '../lib/arena';

/**
 * The hub reads the registry rather than keeping a second copy of it.
 *
 * It used to hold its own list of every game's name, blurb and trained skill,
 * and the two drifted the moment either was edited alone: this page went on
 * selling Block Stack as "every word becomes a block, clean words build wide"
 * long after the pace bar replaced that design, so the last thing a learner
 * read before pressing play described a game that no longer existed.
 *
 * The Lightstream is filtered out of the competitive row because it is the
 * banner directly above it, not a third card beside its own two.
 */
const LIGHTSTREAM = ARENA_GAMES.lightstream;
const COMPETITIVE = ARENA_LIST.filter((g) => g.tier === 'competitive' && g.id !== LIGHTSTREAM.id);
const QUESTS = ARENA_LIST.filter((g) => g.tier === 'quest');
/**
 * Games for a player who cannot type yet. They lead the hub for a kid profile
 * and close it for everyone else, because a grown-up scrolling past "catch one
 * falling letter" on the way to the Arena reads it as the product being for
 * children, and a seven year old scrolling past four ranked speed games on the
 * way to the one they can play reads it as the product not being for them.
 */
const STARTERS = ARENA_LIST.filter((g) => g.tier === 'starter');

/* Little living scene per game, same vocabulary as the landing page's
   play-art tiles but drawn with theme tokens so every app theme works. */
function GameArt({ id }: { id: string }) {
  switch (id) {
    case 'duel':
      return (
        <div className="arena-art ga-duel" aria-hidden>
          <span className="gd-lane"><i className="gd-fill gd-you" /></span>
          <span className="gd-badge"><Ic n="swords" size={16} /></span>
          <span className="gd-lane"><i className="gd-fill gd-foe" /></span>
        </div>
      );
    case 'survivor':
      return (
        <div className="arena-art ga-sprint" aria-hidden>
          <span className="gs-finish"><Ic n="crown" size={15} /></span>
          <i className="gs-dot" /><i className="gs-dot" /><i className="gs-dot" /><i className="gs-dot" />
        </div>
      );
    case 'bridge':
      /* Planks going in over the water, one word at a time. */
      return (
        <div className="arena-art ga-bridge" aria-hidden>
          <span className="gb-deck">
            <i className="gb-laid" /><i className="gb-laid" /><i className="gb-laid" /><i /><i />
          </span>
          <span className="gb-walk"><Ic n="person" size={22} /></span>
          <span className="gb-water" />
        </div>
      );
    case 'firstletter':
      /* A picture and the letter it wants. */
      return (
        <div className="arena-art ga-first" aria-hidden>
          <span className="gfl-thing"><Ic n="apple" size={40} strokeWidth={1.6} /></span>
          <span className="gfl-arrow"><Ic n="chevron-right" size={20} /></span>
          <span className="gfl-key">a</span>
        </div>
      );
    case 'paint':
      /* Tiles coming away from something underneath. */
      return (
        <div className="arena-art ga-paint" aria-hidden>
          {['a', 'm', 'e', 'r', 't', 'o', 'k', 's', 'i'].map((c, i) => (
            <i key={c} className={`gp-tile ${i === 2 || i === 4 || i === 7 ? 'gp-off' : ''}`}>{c}</i>
          ))}
        </div>
      );
    case 'rocket':
      /* A rocket part way up its own alphabet. */
      return (
        <div className="arena-art ga-rocket" aria-hidden>
          <span className="gr-moon"><Ic n="moon" size={17} /></span>
          <span className="gr-ship"><Ic n="rocket" size={30} /></span>
          <i className="gr-mark" style={{ bottom: 16 }}>a</i>
          <i className="gr-mark" style={{ bottom: 34 }}>b</i>
          <i className="gr-mark" style={{ bottom: 52 }}>c</i>
          <span className="gr-ground" />
        </div>
      );
    case 'keysafari':
      /* Three keycaps, and one of them has ears. */
      return (
        <div className="arena-art ga-safari" aria-hidden>
          <span className="gsf-key">a</span>
          <span className="gsf-key gsf-hiding">
            <i className="gsf-ears" />
            f
          </span>
          <span className="gsf-key">j</span>
          <span className="gsf-grass" />
        </div>
      );
    case 'letterfall':
      /* Single letters dropping into a garden. This art was Wordfall's until
         Letter Fall existed, and it was always drawing this game: five separate
         letters falling one at a time is exactly what Wordfall is not. */
      return (
        <div className="arena-art ga-letterfall" aria-hidden>
          <span className="gl-seed">f</span><span className="gl-seed">j</span><span className="gl-seed">d</span>
          <i className="gl-flower" style={{ left: '22%' }} /><i className="gl-flower" style={{ left: '48%' }} />
          <i className="gl-flower" style={{ left: '71%' }} />
          <span className="gl-grass" />
        </div>
      );
    case 'wordfall':
      /* Whole words falling on a wall, which is the game: the threat is a word
         you have to finish, and the thing at risk is underneath it. */
      return (
        <div className="arena-art ga-wordfall" aria-hidden>
          <span className="gw-word">storm</span>
          <span className="gw-word">lantern</span>
          <span className="gw-word">shield</span>
          <span className="gw-wall" />
        </div>
      );
    case 'stack':
      return (
        <div className="arena-art ga-stack" aria-hidden>
          <span className="gk-col">
            <i className="gk-drop" />
            <i className="gk-b" style={{ width: 58 }} />
            <i className="gk-b" style={{ width: 42 }} />
            <i className="gk-b" style={{ width: 66 }} />
          </span>
        </div>
      );
    case 'cipher':
      return (
        <div className="arena-art ga-cipher" aria-hidden>
          {([['h', 'c'], ['p', 'i'], ['c', 'p'], ['i', 'h'], ['r', 'e'], ['e', 'r']] as const).map(([a, b], i) => (
            <span className="gc-tile" key={i} style={{ animationDelay: `${i * 0.4}s` }}><b>{a}</b><i>{b}</i></span>
          ))}
        </div>
      );
    case 'keyforge':
      return (
        <div className="arena-art ga-forge" aria-hidden>
          <Ic n="hammer" size={36} /><i>✦</i><i>✦</i><i>✦</i>
        </div>
      );
    case 'wordflight':
      return (
        <div className="arena-art ga-flight" aria-hidden>
          <span className="gf-glider"><Ic n="send" size={34} /></span>
        </div>
      );
    default:
      return <div className="arena-art" aria-hidden />;
  }
}

function GameCard({ g, i }: { g: ArenaGame; i: number }) {
  return (
    <Link to={g.to} className="arena-card" style={{ '--i': i } as React.CSSProperties}>
      <div className="arena-artwrap">
        <GameArt id={g.id} />
        <span className="arena-play">Play →</span>
      </div>
      <div className="arena-body">
        <h3><Ic n={g.icon} size={17} /> {g.name}</h3>
        <p className="small muted">{g.desc}</p>
        <div className="row gap wrap arena-foot">
          <Chip tone="accent">{g.trains}</Chip>
        </div>
      </div>
    </Link>
  );
}

export default function Games() {
  const data = useData();
  if (!data) return null;
  const kid = data.profile.ageGroup === 'kid';
  return (
    <div>
      <header className="arena-head">
        <div className="arena-head-txt">
          <div className="dash-kicker">{kid ? 'Playtime' : 'The Arena'}</div>
          <h1>{kid ? 'Pick a game, hero.' : 'Every game trains one real skill.'}</h1>
          <p>And each one tells you which. Not typing glued onto someone else's game.</p>
        </div>
        <div className="arena-head-stats">
          {data.race.wins > 0 && <span className="arena-stat arena-stat-gold"><Ic n="rocket" size={15} /> {data.race.wins} race {data.race.wins === 1 ? 'win' : 'wins'}</span>}
        </div>
      </header>

      {kid && STARTERS.length > 0 && (
        <>
          <h2 className="section-title"><Ic n="sprout" size={19} /> First keys</h2>
          <div className="arena-grid">
            {STARTERS.map((g, i) => <GameCard key={g.id} g={g} i={i} />)}
          </div>
        </>
      )}

      <h2 className="section-title"><Ic n="swords" size={19} /> Competitive</h2>
      <Link to={LIGHTSTREAM.to} className="race-hall" aria-label="Open the Race hub">
        <span className="race-hall-main">
          <span className="race-banner-rocket"><Ic n={LIGHTSTREAM.icon} size={40} /></span>
          <span className="race-banner-txt">
            <strong className="race-hall-title">{LIGHTSTREAM.name}</strong>
            <span className="race-hall-sub">{LIGHTSTREAM.desc}</span>
            <span className="row gap wrap race-hall-chips">
              <Chip tone="accent">{LIGHTSTREAM.trains}</Chip>
              {data.race.wins > 0 && <Chip tone="gold"><Ic n="trophy" size={12} /> {data.race.wins} wins</Chip>}
            </span>
          </span>
          <span className="race-hall-cta">Enter the Race hub →</span>
        </span>
        {/* What a race actually looks like: three lanes creeping toward the
            finish, yours in front. Sits below the copy, never under it. */}
        <span className="rh-track" aria-hidden>
          <i className="rh-lane rh-lane-you"><b /></i>
          <i className="rh-lane rh-lane-2"><b /></i>
          <i className="rh-lane rh-lane-3"><b /></i>
          <span className="rh-finish"><Ic n="flag" size={13} /></span>
        </span>
      </Link>
      <div className="arena-grid race-hall-underlings">
        {COMPETITIVE.map((g, i) => <GameCard key={g.id} g={g} i={i} />)}
      </div>

      <h2 className="section-title"><Ic n="map" size={19} /> Skill quests</h2>
      <div className="arena-grid">
        {QUESTS.map((g, i) => <GameCard key={g.id} g={g} i={i + 2} />)}
      </div>

      {!kid && STARTERS.length > 0 && (
        <>
          <h2 className="section-title"><Ic n="sprout" size={19} /> First keys</h2>
          <p className="small muted" style={{ marginTop: -6 }}>
            For a child who has not typed before. One letter at a time, the keyboard on screen, and no clock.
          </p>
          <div className="arena-grid">
            {STARTERS.map((g, i) => <GameCard key={g.id} g={g} i={i} />)}
          </div>
        </>
      )}

      {!kid && (
        <Card style={{ marginTop: 18 }} className="card">
          <h3><Ic n="users" size={17} /> Cooperative missions</h3>
          <p className="small muted">Team typing missions, where two players share one transmission and type alternating lines, are designed and coming with online play. <Chip>Concept preview</Chip></p>
        </Card>
      )}
    </div>
  );
}
