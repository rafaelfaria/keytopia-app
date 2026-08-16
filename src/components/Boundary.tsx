import React from 'react';

/**
 * The screen a learner sees when a render throws.
 *
 * The first version of this was an inline-styled `<h1>` with the raw exception
 * printed underneath it and a single button that reloaded the site at `/`. Three
 * things were wrong with that, in rising order of cost:
 *
 *  - It rendered outside the design system, so a crash inside a midnight-theme
 *    session flashed a white page with a browser-default button. The app looked
 *    like it had been replaced by a different, broken website.
 *  - `Error: cannot add 'presence' callbacks for realtime:arena:...` is not a
 *    sentence a nine-year-old can act on. The detail still matters to whoever
 *    has to fix it, so it moved into a disclosure that is closed by default.
 *  - Reloading at `/` is the most destructive recovery available and it was the
 *    only one offered. Most render errors are local to one subtree, so trying
 *    the same view again is usually enough, and it keeps the learner where they
 *    were.
 */

function KipTripped() {
  return (
    <svg width={96} height={96} viewBox="0 0 64 64" className="errs-kip" aria-hidden>
      <ellipse cx="32" cy="36" rx="20" ry="18" fill="var(--accent)" opacity="0.16" />
      <ellipse cx="32" cy="36" rx="14" ry="13" fill="var(--accent)" />
      {/* Ears at a lopsided angle: the same mascot as everywhere else, just
          knocked sideways. A separate sad character would read as a different
          app at the worst possible moment. */}
      <ellipse cx="20" cy="26" rx="9" ry="12" fill="var(--accent2)" opacity="0.75" transform="rotate(-42 20 26)" />
      <ellipse cx="44" cy="26" rx="9" ry="12" fill="var(--accent2)" opacity="0.75" transform="rotate(8 44 26)" />
      {/* Eyes as crosses rather than dots: dazed, not distressed. */}
      <path d="M24.6 31.6 L29.4 36.4 M29.4 31.6 L24.6 36.4" stroke="var(--kip-eye, #0b1020)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M34.6 31.6 L39.4 36.4 M39.4 31.6 L34.6 36.4" stroke="var(--kip-eye, #0b1020)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M27 43 Q32 39.5 37 43" stroke="var(--kip-eye, #0b1020)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {/* The headlamp is out. It is lit on every other Kip in the app, so this
          is the one detail a regular player will notice straight away. */}
      <circle cx="32" cy="14" r="3" fill="var(--muted)" />
      <line x1="32" y1="17" x2="32" y2="23" stroke="var(--muted)" strokeWidth="2" />
    </svg>
  );
}

type Props = { children: React.ReactNode };
type State = { err: Error | null; info: string; tries: number; copied: boolean };

export class Boundary extends React.Component<Props, State> {
  state: State = { err: null, info: '', tries: 0, copied: false };
  headingRef = React.createRef<HTMLHeadingElement>();

  static getDerivedStateFromError(err: Error) { return { err }; }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    // Kept because the previous boundary swallowed the component stack, which
    // is the half of a React error that says *where* it came from.
    console.error('[keytopia] render crashed', err, info.componentStack);
    this.setState({ info: info.componentStack ?? '' });
  }

  componentDidUpdate(_prev: Props, prevState: State) {
    // Screen readers get no announcement from a subtree being swapped out, and
    // keyboard focus is left pointing at a node that no longer exists, which
    // sends the next Tab back to the top of the document.
    if (!prevState.err && this.state.err) this.headingRef.current?.focus();
  }

  retry = () => this.setState({ err: null, info: '', copied: false, tries: this.state.tries + 1 });

  copy = () => {
    const { err, info } = this.state;
    navigator.clipboard?.writeText(`${err?.stack || err}\n${info}`.trim())
      .then(() => this.setState({ copied: true }), () => {});
  };

  render() {
    const { err, info, tries, copied } = this.state;
    if (!err) {
      // Remounting on retry is the point: reusing the old element tree would
      // hand the failed render its own broken state straight back.
      return <React.Fragment key={tries}>{this.props.children}</React.Fragment>;
    }
    // A second failure means retrying is not what is wrong, so stop offering it
    // as the obvious move and lead with the reload instead.
    const again = tries > 0;
    return (
      <div className="errs" role="alert">
        <div className="errs-card">
          <KipTripped />
          <h1 className="errs-title" tabIndex={-1} ref={this.headingRef}>
            {again ? 'Still stuck' : 'Kip tripped over a wire'}
          </h1>
          <p className="errs-lede">
            {again
              ? 'That screen will not load right now. Reloading usually clears it.'
              : 'Something on this screen stopped working. Your saved progress is safe.'}
          </p>
          <div className="errs-actions">
            {!again && (
              <button className="btn btn-primary btn-big" onClick={this.retry}>Try again</button>
            )}
            <button
              className={`btn btn-big ${again ? 'btn-primary' : 'btn-soft'}`}
              onClick={() => location.reload()}
            >
              Reload the page
            </button>
            <button className="btn btn-soft btn-big" onClick={() => { location.href = '/app'; }}>
              Go home
            </button>
          </div>
          <details className="errs-details">
            <summary>What went wrong (for a grown-up)</summary>
            <pre className="errs-trace">{String(err.stack || err)}{info}</pre>
            <button className="btn btn-ghost errs-copy" onClick={this.copy}>
              {copied ? 'Copied' : 'Copy details'}
            </button>
          </details>
        </div>
      </div>
    );
  }
}
