/**
 * "Keep this result" — the one place a tool writes into the progress tracker.
 *
 * Saving is a button rather than something that happens to you. Silently
 * recording every run would fill the tracker with warm-ups and mistakes, and
 * the whole value of the chart is that the rows in it are runs somebody meant
 * to keep. The button reports what it did and then stops offering, so nobody
 * saves the same run four times wondering whether it worked.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { saveResult, type ToolSource } from '../../lib/tools/storage';
import { progressSaved, type ToolId } from '../../lib/tools/analytics';
import type { SessionResult } from '../../lib/types';

export function SaveResult({ tool, source, result }: {
  tool: ToolId;
  source: ToolSource;
  result: SessionResult;
}) {
  const [saved, setSaved] = useState(false);

  if (saved) {
    return (
      <p className="tool-saved" role="status">
        Kept. <Link to="/tools/typing-progress-tracker">See it in your progress tracker</Link>.
      </p>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-soft"
      onClick={() => {
        saveResult({
          source,
          wpm: result.wpm,
          raw: result.raw,
          acc: result.acc,
          seconds: result.seconds,
          mistakes: result.uncorrected,
          typed: result.typed,
        });
        progressSaved(tool, result.wpm, result.acc, false);
        setSaved(true);
      }}
    >
      Keep this result
    </button>
  );
}
