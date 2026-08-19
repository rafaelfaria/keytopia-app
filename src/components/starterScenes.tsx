import type { ReactElement } from 'react';
import { CharacterSprite, PRESET_CHARACTERS } from './avatars';
import { STARTER_PALS } from './gamekit';
import { Ic } from './icons';

/**
 * The front door of each starter game: a small, still view of its own world.
 *
 * When the six starters left the boards, the second column of their intro
 * screens emptied and every one of them opened as a paragraph beside a gap.
 * These fill it, and they do a job a board never did for this age: a child who
 * cannot read the paragraph can look at the picture and know what the game is.
 * The garden with a letter falling into it says more to a five year old than
 * "one letter floats down at a time" ever will.
 *
 * They are deliberately not live games. Nothing here is on a timer, nothing is
 * interactive, and the only motion is a slow drift or a blink, because this is
 * a screen someone is meant to read a sentence and press a button on.
 */

const PETALS = ['#ff8fa3', '#ffb26b', '#ffd166', '#7dd8a0', '#5fc9e0', '#8b9cf5'];

function Flower({ x, tint, scale = 1 }: { x: number; tint: number; scale?: number }) {
  return (
    <i className="ss-flower" style={{ left: `${x}%`, ['--petal' as string]: PETALS[tint], ['--s' as string]: scale }}>
      <svg viewBox="0 0 24 34" width="26" height="36">
        <path d="M12 34 V16" stroke="color-mix(in oklab, var(--good) 55%, #1d3b23)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="12" cy="7" rx="3.6" ry="5.6" fill="var(--petal)" transform={`rotate(${a} 12 12)`} />
        ))}
        <circle cx="12" cy="12" r="3.4" fill="var(--gold)" />
      </svg>
    </i>
  );
}

function Pal({ i, size = 44 }: { i: number; size?: number }) {
  return <CharacterSprite ch={PRESET_CHARACTERS[STARTER_PALS[i].preset].ch} size={size} expr="happy" />;
}

/** Letter Fall: a letter on its way into the garden it is about to join. */
function LetterFallScene() {
  return (
    <div className="ss ss-garden">
      <span className="ss-sun"><Ic n="sun" size={26} /></span>
      <span className="ss-seed" style={{ ['--petal' as string]: PETALS[4] }}>f</span>
      <span className="ss-ground" />
      <Flower x={14} tint={0} scale={0.76} />
      <Flower x={31} tint={2} scale={0.76} />
      <Flower x={48} tint={3} scale={0.76} />
      <Flower x={65} tint={4} scale={0.76} />
      <Flower x={20} tint={5} />
      <Flower x={40} tint={1} />
      <Flower x={58} tint={0} />
      <span className="ss-basket">
        <svg viewBox="0 0 64 52" width="58" height="47">
          <ellipse cx="32" cy="47" rx="18" ry="4" fill="rgba(0,0,0,0.16)" />
          <path d="M14 22 h36 l-4 22 h-28 Z" fill="var(--surface2)" stroke="var(--border)" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M12 22 h40" stroke="var(--border)" strokeWidth="4" strokeLinecap="round" />
          <circle cx="32" cy="14" r="11" fill="var(--accent2)" />
          <path d="M23 7 l-1 -8 l8 4 Z M41 7 l1 -8 l-8 4 Z" fill="var(--accent2)" />
          <circle cx="28" cy="14" r="1.8" fill="var(--bg)" />
          <circle cx="36" cy="14" r="1.8" fill="var(--bg)" />
        </svg>
      </span>
    </div>
  );
}

/** Key Safari: three found, and one still behind a key. */
function KeySafariScene() {
  return (
    <div className="ss ss-meadow">
      <span className="ss-sun"><Ic n="sun" size={26} /></span>
      <i className="ss-cloud" style={{ left: '10%', top: '18%' }} />
      <i className="ss-cloud ss-cloud-sm" style={{ right: '22%', top: '30%' }} />
      <span className="ss-grass" />
      <span className="ss-pal" style={{ left: '18%', bottom: 74 }}><Pal i={0} size={32} /></span>
      <span className="ss-pal" style={{ left: '44%', bottom: 74 }}><Pal i={3} size={32} /></span>
      <span className="ss-pal" style={{ left: '30%', bottom: 34 }}><Pal i={1} size={42} /></span>
      <span className="ss-pal" style={{ left: '58%', bottom: 34 }}><Pal i={4} size={42} /></span>
      {/* The one still hiding, ears over the cap. */}
      <span className="ss-hidekey">
        <span className="ss-peek"><Pal i={2} size={34} /></span>
        <i>r</i>
      </span>
    </div>
  );
}

/** Alphabet Rocket: on the pad, with the whole climb above it. */
function RocketScene() {
  return (
    <div className="ss ss-sky">
      <span className="ss-moon"><Ic n="moon" size={26} /></span>
      <span className="ss-stars" />
      <i className="ss-cloud" style={{ left: '12%', bottom: '46%' }} />
      <i className="ss-cloud ss-cloud-sm" style={{ right: '16%', bottom: '56%' }} />
      <span className="ss-trail" />
      <i className="ss-mark" style={{ bottom: 34 }}>a</i>
      <i className="ss-mark" style={{ bottom: 62 }}>b</i>
      <i className="ss-mark" style={{ bottom: 90 }}>c</i>
      <span className="ss-rocket">
        <svg viewBox="0 0 44 74" width="38" height="64">
          <path d="M22 2 C33 16 35 34 35 46 H9 C9 34 11 16 22 2 Z" fill="var(--surface)" stroke="var(--border)" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M9 46 L1 60 L9 56 Z M35 46 L43 60 L35 56 Z" fill="var(--accent2)" />
          <circle cx="22" cy="26" r="7" fill="var(--accent)" stroke="var(--border)" strokeWidth="2" />
          <g className="ss-flame">
            <path d="M15 56 q7 18 7 18 q0 0 7 -18 q-7 4 -14 0 Z" fill="var(--warn)" />
            <path d="M18 56 q4 12 4 12 q0 0 4 -12 q-4 3 -8 0 Z" fill="var(--gold)" />
          </g>
        </svg>
      </span>
      <span className="ss-pad" />
    </div>
  );
}

/** Paint Reveal: three patches off, and somebody underneath. */
function PaintScene() {
  const tiles = ['e', 'r', '', 'k', '', 'o', 'a', 'i', 'm', '', 's', 't'];
  return (
    <div className="ss ss-paint">
      <span className="ss-canvas">
        <span className="ss-under"><Pal i={2} size={150} /></span>
        <span className="ss-tiles">
          {tiles.map((t, i) => (
            <i key={i} className={t ? '' : 'ss-tile-off'}>{t}</i>
          ))}
        </span>
      </span>
    </div>
  );
}

/** First Letter: the whole game in one row. */
function FirstLetterScene() {
  return (
    <div className="ss ss-first">
      <span className="ss-pair">
        <span className="ss-thing"><Ic n="apple" size={92} strokeWidth={1.5} /></span>
        <span className="ss-arrow"><Ic n="chevron-right" size={26} /></span>
        <span className="ss-letter">a</span>
      </span>
      {/* The pictures still in the pile, so the frame says "and then more of
          these" rather than showing one apple in an empty room. */}
      <span className="ss-queue">
        <i><Ic n="fish" size={26} strokeWidth={1.6} /></i>
        <i><Ic n="moon" size={26} strokeWidth={1.6} /></i>
        <i><Ic n="bell" size={26} strokeWidth={1.6} /></i>
        <i><Ic n="tree" size={26} strokeWidth={1.6} /></i>
      </span>
    </div>
  );
}

/** Word Bridge: half a crossing. */
function BridgeScene() {
  return (
    <div className="ss ss-river">
      <span className="ss-bank ss-bank-l" />
      <span className="ss-bank ss-bank-r" />
      <span className="ss-deck">
        {Array.from({ length: 8 }).map((_, i) => <i key={i} className={i < 4 ? 'ss-laid' : ''} />)}
      </span>
      <span className="ss-walker"><Pal i={1} size={38} /></span>
      <span className="ss-current"><i /><i /></span>
    </div>
  );
}

const SCENES: Record<string, () => ReactElement> = {
  letterfall: LetterFallScene,
  keysafari: KeySafariScene,
  rocket: RocketScene,
  paint: PaintScene,
  firstletter: FirstLetterScene,
  bridge: BridgeScene,
};

/** The front door picture for a starter game, or nothing for anything else. */
export function StarterScene({ game }: { game: string }) {
  const Scene = SCENES[game];
  if (!Scene) return null;
  return (
    <div className="ss-frame" aria-hidden>
      <Scene />
    </div>
  );
}
