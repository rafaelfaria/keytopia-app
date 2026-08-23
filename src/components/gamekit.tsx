import { useEffect, useRef } from 'react';
import { Avatar, BlockAvatar, ANIMAL_START } from './avatars';

/**
 * Window-level key capture for games. Games previously relied on a hidden
 * <input> keeping focus — one stray click and typing silently died. This hook
 * listens on window, so the game hears keys no matter what has focus, while a
 * tiny companion input (MobileKeys) still summons the virtual keyboard on touch.
 */
export function useGameKeys(
  active: boolean,
  onChar: (ch: string) => void,
  opts?: { onEscape?: () => void; onBackspace?: () => void },
): void {
  const charRef = useRef(onChar);
  const escRef = useRef(opts?.onEscape);
  const bsRef = useRef(opts?.onBackspace);
  charRef.current = onChar;
  escRef.current = opts?.onEscape;
  bsRef.current = opts?.onBackspace;
  const lastHandled = useRef(0);

  useEffect(() => {
    if (!active) return;
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const isMobilePad = !!t?.classList?.contains('ghost-input');
      // let real form fields behave normally — but our own pad routes here
      if (t && !isMobilePad && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'Escape') { escRef.current?.(); return; }
      if (e.key === 'Backspace') { bsRef.current?.(); e.preventDefault(); return; }
      if (e.key.length === 1) {
        lastHandled.current = performance.now();
        charRef.current(e.key);
        e.preventDefault();
      }
    };
    // input event fallback (mobile IMEs that don't emit useful keydown)
    const input = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (!t?.classList?.contains('ghost-input')) return;
      const v = t.value;
      t.value = '';
      if (performance.now() - lastHandled.current < 40) return;
      for (const ch of v) charRef.current(ch);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('input', input, true);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('input', input, true);
    };
  }, [active]);
}

/** Invisible input purely to summon the on-screen keyboard on touch devices. */
export function MobileKeys({ active }: { active: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (active && 'ontouchstart' in window) ref.current?.focus({ preventScroll: true });
  }, [active]);
  return (
    <input
      ref={ref} className="ghost-input" aria-hidden tabIndex={-1}
      autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false}
    />
  );
}

/** A little runner: block-avatar head on a body with animated legs. */
export function Runner({ av, preset, size = 40, running, benched, you }: {
  av?: string; preset?: number; size?: number; running?: boolean; benched?: boolean; you?: boolean;
}) {
  return (
    <span
      className={`runner ${running ? 'runner-go' : ''} ${benched ? 'runner-bench' : ''} ${you ? 'runner-you' : ''}`}
      style={{ width: size, height: size * 1.45 }}
    >
      <span className="runner-head">
        {av !== undefined ? <Avatar v={av} size={size * 0.72} /> : <BlockAvatar preset={preset ?? 0} size={size * 0.72} />}
      </span>
      <span className="runner-body" />
      <span className="runner-legs"><i className="leg-a" /><i className="leg-b" /></span>
    </span>
  );
}

/** Pixel cannon; barrel rotates to aim. angle 0 = straight up, +right/-left. */
export function Cannon({ angle = 0, firing }: { angle?: number; firing?: boolean }) {
  return (
    <span className={`cannon ${firing ? 'cannon-fire' : ''}`} aria-hidden>
      <svg viewBox="0 0 90 74" width="90" height="74">
        <g className="cannon-barrel" style={{ transform: `rotate(${Math.max(-62, Math.min(62, angle))}deg)` }}>
          <rect x="39" y="2" width="12" height="38" rx="5" fill="var(--text)" opacity="0.88" />
          <rect x="36" y="0" width="18" height="9" rx="4" fill="var(--accent)" />
        </g>
        <circle cx="45" cy="48" r="17" fill="var(--surface2)" stroke="var(--border)" strokeWidth="2.5" />
        <circle cx="45" cy="48" r="7" fill="var(--accent)" />
        <rect x="18" y="60" width="54" height="11" rx="5" fill="var(--surface2)" stroke="var(--border)" strokeWidth="2" />
      </svg>
    </span>
  );
}

/** Castle battlement (adult) / garden fence (kid) strip for Wordfall. */
export function CityWall({ kid }: { kid?: boolean }) {
  if (kid) {
    return (
      <svg viewBox="0 0 400 34" preserveAspectRatio="none" className="wf-wall" aria-hidden>
        {Array.from({ length: 14 }).map((_, i) => (
          <rect key={i} x={i * 29 + 2} y="8" width="7" height="26" rx="2.5" fill="var(--surface2)" stroke="var(--border)" />
        ))}
        <rect x="0" y="6" width="400" height="5" rx="2.5" fill="var(--surface2)" stroke="var(--border)" />
        {Array.from({ length: 7 }).map((_, i) => (
          <circle key={`f${i}`} cx={i * 58 + 24} cy="6" r="4.5" fill={['#f2789f', '#ffd166', '#8b7cff'][i % 3]} />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 400 34" preserveAspectRatio="none" className="wf-wall" aria-hidden>
      <rect x="0" y="12" width="400" height="22" fill="var(--surface2)" stroke="var(--border)" />
      {Array.from({ length: 20 }).map((_, i) => (
        <rect key={i} x={i * 20 + 1.5} y="0" width="11" height="13" fill="var(--surface2)" stroke="var(--border)" />
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={`w${i}`} x={i * 50 + 21} y="20" width="6" height="8" rx="2" fill="var(--gold)" opacity="0.8" />
      ))}
    </svg>
  );
}

/** Glider sprite: paper plane for grown-ups, flappy pixel bird for kids. */
export function Glider({ kid, turbulent }: { kid?: boolean; turbulent?: boolean }) {
  if (kid) {
    return (
      <span className={`bird ${turbulent ? 'bird-turb' : ''}`} aria-hidden>
        <svg viewBox="0 0 40 32" width="52" height="42" shapeRendering="crispEdges">
          <rect x="8" y="10" width="20" height="12" fill="#ffd166" />
          <rect x="24" y="6" width="10" height="10" fill="#ffd166" />
          <rect x="32" y="9" width="5" height="4" fill="#f0863a" />
          <rect x="27" y="8" width="3" height="3" fill="#1b2559" />
          <rect x="10" y="22" width="6" height="4" fill="#f0863a" />
          <rect x="18" y="22" width="6" height="4" fill="#f0863a" />
          <rect className="bird-wing" x="10" y="4" width="12" height="8" fill="#f9b24e" />
        </svg>
      </span>
    );
  }
  return (
    <span className={`plane ${turbulent ? 'bird-turb' : ''}`} aria-hidden>
      <svg viewBox="0 0 48 34" width="54" height="40">
        <path d="M2 20 L46 4 L28 30 L22 20 Z" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M22 20 L46 4 L26 24 Z" fill="var(--accent)" opacity="0.35" />
      </svg>
    </span>
  );
}

/** Pixel racing car for The Lightstream. Wheels spin via --wheelspin. */
export function PixelCar({ color = '#14d8c4', you, ghost }: { color?: string; you?: boolean; ghost?: boolean }) {
  return (
    <span className={`pcar ${you ? 'pcar-you' : ''} ${ghost ? 'pcar-ghost' : ''}`} aria-hidden>
      <svg viewBox="0 0 64 30" width="58" height="27" shapeRendering="crispEdges">
        <rect x="4" y="12" width="56" height="10" rx="3" fill={color} />
        <rect x="18" y="4" width="24" height="10" rx="3" fill={color} />
        <rect x="22" y="6" width="8" height="6" fill="#dff3ff" opacity="0.9" />
        <rect x="33" y="6" width="7" height="6" fill="#dff3ff" opacity="0.75" />
        <rect x="58" y="14" width="5" height="4" fill="#ffe9a8" className="pcar-light" />
        <g className="pcar-wheel" style={{ transformOrigin: '16px 23px' }}>
          <circle cx="16" cy="23" r="6" fill="#141824" stroke="#3a4358" strokeWidth="2" />
          <rect x="15" y="18.5" width="2" height="9" fill="#8b93b8" />
        </g>
        <g className="pcar-wheel" style={{ transformOrigin: '46px 23px' }}>
          <circle cx="46" cy="23" r="6" fill="#141824" stroke="#3a4358" strokeWidth="2" />
          <rect x="45" y="18.5" width="2" height="9" fill="#8b93b8" />
        </g>
      </svg>
    </span>
  );
}

/** The five pixel pals — named animal friends, one guarding each island. */
export const PIXEL_PALS = [
  { name: 'Clementine', kind: 'cat', preset: ANIMAL_START },
  { name: 'Miso', kind: 'fox', preset: ANIMAL_START + 1 },
  { name: 'Pip', kind: 'frog', preset: ANIMAL_START + 2 },
  { name: 'Waffles', kind: 'panda', preset: ANIMAL_START + 3 },
  { name: 'Biscuit', kind: 'owl', preset: ANIMAL_START + 4 },
];

/**
 * The pals as the starter games use them: by preset index, with the two rare
 * ones on the end.
 *
 * Kept separate from PIXEL_PALS above, which the worlds index into as guardians
 * (`guardian % PIXEL_PALS.length`) and whose length is therefore load-bearing.
 * Two lists is the cheaper mistake here.
 */
export const STARTER_PALS: { preset: number; name: string; rare?: boolean }[] = [
  { preset: ANIMAL_START, name: 'Clementine' },
  { preset: ANIMAL_START + 1, name: 'Miso' },
  { preset: ANIMAL_START + 2, name: 'Pip' },
  { preset: ANIMAL_START + 3, name: 'Waffles' },
  { preset: ANIMAL_START + 4, name: 'Biscuit' },
  { preset: 14, name: 'Noodle', rare: true },
  { preset: 19, name: 'Ember', rare: true },
];

/** Tiny decorative critter that floats/flutters. Purely ornamental. */
export function Critter({ kind, style }: { kind: 'butterfly' | 'bee' | 'snail'; style?: React.CSSProperties }) {
  if (kind === 'butterfly') {
    return (
      <span className="critter critter-fly" style={style} aria-hidden>
        <svg viewBox="0 0 26 22" width="30" height="26">
          <g className="cr-wing-l">
            <ellipse cx="8" cy="7" rx="6.5" ry="5.5" fill="#c99cf5" />
            <ellipse cx="7" cy="15" rx="5" ry="4.2" fill="#f59cd8" />
            <circle cx="8" cy="7" r="2" fill="#fff" opacity="0.65" />
          </g>
          <g className="cr-wing-r">
            <ellipse cx="18" cy="7" rx="6.5" ry="5.5" fill="#ff8fa3" />
            <ellipse cx="19" cy="15" rx="5" ry="4.2" fill="#ffb26b" />
            <circle cx="18" cy="7" r="2" fill="#fff" opacity="0.65" />
          </g>
          <rect x="11.7" y="4" width="2.6" height="15" rx="1.3" fill="#3a3342" />
          <path d="M12.5,4 Q10.5,0.5 8.8,1.4 M13.5,4 Q15.5,0.5 17.2,1.4" fill="none" stroke="#3a3342" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  if (kind === 'bee') {
    return (
      <span className="critter critter-fly" style={style} aria-hidden>
        <svg viewBox="0 0 20 14" width="20" height="14" shapeRendering="crispEdges">
          <rect x="4" y="4" width="12" height="8" rx="4" fill="#ffd166" />
          <rect x="8" y="4" width="2" height="8" fill="#3a3342" />
          <rect x="12" y="4" width="2" height="8" fill="#3a3342" />
          <rect className="cr-wing-l" x="6" y="0" width="8" height="5" rx="2" fill="#dff3ff" opacity="0.85" />
        </svg>
      </span>
    );
  }
  return (
    <span className="critter" style={style} aria-hidden>
      <svg viewBox="0 0 22 14" width="22" height="14" shapeRendering="crispEdges">
        <circle cx="9" cy="8" r="6" fill="#7dd8a0" />
        <rect x="13" y="6" width="7" height="6" rx="3" fill="#f0a05a" />
        <rect x="18" y="2" width="2" height="4" fill="#f0a05a" />
      </svg>
    </span>
  );
}

/**
 * Pearl Dive's diver: horizontal, snorkelled, trailing bubbles.
 *
 * Drawn rather than borrowed from the icon set, because the icon set's nearest
 * thing is a standing person, and a standing figure in a water column reads as
 * someone waiting at a bus stop underwater. What the game needs said in one
 * glance is "this person is swimming down through the sea", and the three
 * things that say it are the horizontal body, the snorkel and the bubbles.
 *
 * Every shape carries an ink outline. Without one the suit, the head and the
 * fin are three fills of similar weight touching each other, and at the size
 * this actually renders they merge into a single orange lozenge: the first
 * pass looked like a carrot with a bubble over it. The outline is what makes it
 * a silhouette rather than a blob, and it is also what keeps the figure legible
 * against the pale top of the water and the near-black bottom of it.
 *
 * Colours come from `--dv-*` custom properties with sensible defaults, so the
 * same sprite works on the game's column and on the hub card without the two
 * needing to agree about anything else.
 */
export function Diver({ size = 66 }: { size?: number }) {
  const ink = 'var(--dv-ink, #06293f)';
  const limb = { fill: 'none', stroke: 'var(--dv-suit, #ff9f4a)', strokeWidth: 3.2, strokeLinecap: 'round' as const };
  return (
    <span className="diver" aria-hidden>
      <svg viewBox="0 0 64 40" width={size} height={size * 0.625}>
        <circle className="dv-bub dv-bub-a" cx="47" cy="8" r="2.4" />
        <circle className="dv-bub dv-bub-b" cx="51" cy="8" r="1.7" />
        <circle className="dv-bub dv-bub-c" cx="44" cy="8" r="1.3" />
        <path
          className="dv-snorkel" d="M42 14 V8.6 a3.2 3.2 0 0 1 3.2-3.2 h1.4"
          fill="none" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"
        />
        {/* Two legs in a V, each ending in a blade. One fin behind a torso read
            as a tail and the whole sprite came out a fish; two legs is the one
            shape nothing else in the sea has. The group swings from the hip. */}
        <g className="dv-kick">
          <path d="M17 19 L8 13.5" {...limb} />
          <path d="M17 21.5 L8.5 27" {...limb} />
          <path className="dv-fin" d="M9.5 13.5 L1 9.5 L2.5 17 Z" stroke={ink} strokeWidth="1.4" strokeLinejoin="round" />
          <path className="dv-fin" d="M10 27 L1.5 31.5 L2.5 24 Z" stroke={ink} strokeWidth="1.4" strokeLinejoin="round" />
        </g>
        {/* Swept back, the way a snorkeller's trailing arm sits. Forward and
            over the head it drew a loop that read as a bag handle. */}
        <path d="M34 23 C29 26.5, 25 27.5, 21.5 26.5" {...limb} strokeWidth={2.8} />
        <circle className="dv-hand" cx="20.5" cy="26.4" r="2.1" stroke={ink} strokeWidth="1.2" />
        <path
          className="dv-body"
          d="M14.5 20 C18.5 14.2, 30 13.2, 39 16.4 L40 23.6 C30 26.8, 18.5 25.8, 14.5 20 Z"
          stroke={ink} strokeWidth="1.5" strokeLinejoin="round"
        />
        <circle className="dv-head" cx="45.5" cy="19.4" r="7" stroke={ink} strokeWidth="1.5" />
        {/* Goggles across the front of the face, with the strap behind. */}
        <path className="dv-strap" d="M39.5 17.4 h4" stroke={ink} strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <rect
          className="dv-mask" x="44.2" y="15.6" width="8.4" height="7.2" rx="2.6"
          stroke={ink} strokeWidth="1.4" strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
