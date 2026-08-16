import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Ic } from './icons';

/**
 * The stage: one shell for every activity that has a front door, a run and a
 * finish.
 *
 * It was built for the mini games (docs/arena-leaderboards.md §7.4) and the
 * reasoning is not specific to them: an activity that changes shape between
 * starting, playing and finishing reorganises itself twice while the learner is
 * still inside it. So the frame is fixed and only the contents change:
 *
 *   intro   what this is + the button    |  where you stand
 *   run     what to type                 |  the world, or nothing
 *   over    what you scored              |  where that put you
 *
 * The one thing a mini game has that a training session does not is the moving
 * keycap field behind it. That field is a game's identity and it costs a WebGL
 * context; a practice mode wants the same frame and none of the motion, so the
 * backdrop is a slot. Hand in a canvas and you get the field, hand in nothing
 * and the same veil is painted over the flat page. Everything else is shared,
 * which is what makes a training mode and a mini game feel like the same app.
 */
export interface StageProps {
  /** Left column: what this screen is about. */
  main: ReactNode;
  /** Right column: where you stand, or the world. Omitted = a single column. */
  side?: ReactNode;
  /** A strip above both columns. Score, clock and the pause button live here. */
  hud?: ReactNode;
  /**
   * What the learner is inside, named, on the row with the way out.
   *
   * The intro and the finish screen each say the name in their own copy; the
   * run in between said nothing, so the longest part of a visit was also the
   * only anonymous one. It sits with the back link rather than in the HUD
   * because it is the one thing on that row that does not change while you
   * play, and it reads as the counterpart to where the link goes back to.
   */
  title?: ReactNode;
  backTo: string;
  /** Where the back link says it goes. It is the section, not the page. */
  backLabel: string;
  /**
   * The animated backdrop, when there is one. Games pass their keycap field;
   * everything else takes the still wash, which is the same veil with nothing
   * moving underneath it.
   */
  backdrop?: ReactNode;
  /** Give the right column the larger share, for a horizontal world. */
  wide?: boolean;
  /** Step the backdrop back. Nothing competes with someone who is typing. */
  quiet?: boolean;
  /**
   * Let the stage grow past the viewport and scroll with the page. A finish
   * screen with a full breakdown under it does not fit in one screen, and
   * clipping it at 100dvh would hide the half that explains the run.
   */
  tall?: boolean;
  className?: string;
}

export function Stage({ main, side, hud, title, backTo, backLabel, backdrop, wide, quiet, tall, className = '' }: StageProps) {
  const cls = [
    'arena-stage',
    side ? '' : 'arena-stage-solo',
    quiet ? 'arena-stage-quiet' : '',
    wide ? 'arena-stage-wide' : '',
    tall ? 'arena-stage-tall' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      {backdrop ?? <div className="arena-hero arena-hero-still" aria-hidden><span className="arena-hero-veil" /></div>}
      <div className="arena-stage-top">
        <Link to={backTo} className="arena-back">
          <Ic n="chevron-right" size={15} /> {backLabel}
        </Link>
        {title && <p className="arena-stage-title">{title}</p>}
        {hud && <div className="arena-hud">{hud}</div>}
      </div>
      <div className="arena-stage-grid">
        <div className="arena-stage-main">{main}</div>
        {side && <div className="arena-stage-side">{side}</div>}
      </div>
    </div>
  );
}
