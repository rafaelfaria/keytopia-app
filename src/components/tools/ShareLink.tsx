/**
 * "Copy link to this setup".
 *
 * The other half of src/lib/tools/deepLink.ts: the parsers let a link arrive
 * configured, and this lets somebody leave with one. It is what turns a tool
 * into something a teacher can set, an article can cite, or a support reply can
 * link to, without anybody having to learn the query-string syntax.
 *
 * It copies an absolute URL rather than a path, because the thing being pasted
 * is going into an email, a lesson plan or a message, none of which know what
 * origin it came from.
 */

import { useEffect, useState } from 'react';
import { absUrl } from '../../lib/seo/site';

export function ShareLink({ path, label = 'Copy link to this setup', hint }: {
  /** A tool path, already carrying its query string. */
  path: string;
  label?: string;
  /** One line under the button explaining what the link reproduces. */
  hint?: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const url = absUrl(path);

  // Any change of setup invalidates the "Copied" confirmation: it referred to
  // a different link, and leaving it up says the wrong thing is on the
  // clipboard.
  useEffect(() => { setState('idle'); }, [path]);

  return (
    <div className="tool-share">
      <button
        type="button"
        className="tool-share-btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setState('copied');
          } catch {
            // Clipboard access is refused on insecure origins and under some
            // permissions policies. Showing the URL to copy by hand beats a
            // button that appears to do nothing.
            setState('manual');
          }
        }}
      >
        {state === 'copied' ? 'Link copied' : label}
      </button>

      {state === 'manual' && (
        <input
          className="tool-input tool-share-url"
          value={url}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Link to this setup, select and copy"
        />
      )}

      {hint && <p className="tool-note tool-share-hint">{hint}</p>}
    </div>
  );
}
