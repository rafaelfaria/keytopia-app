import { useState } from 'react';
import { useData, useStore, useUi } from '../lib/store';
import { THEMES } from '../lib/themes';
import { Btn, Card, Chip, Modal, Seg, Toggle } from '../components/ui';
import { LAYOUT_NAMES } from '../lib/keyboard';
import type { CaretStyle, Correction, GuideStyle, LayoutId, ThemeId } from '../lib/types';
import { snd } from '../lib/sound';
import { Ic } from '../components/icons';

export default function Settings() {
  const data = useData();
  const patch = useStore((s) => s.patch);
  const clearSeeded = useStore((s) => s.clearSeeded);
  const pushToast = useUi((s) => s.pushToast);
  const [confirmClear, setConfirmClear] = useState(false);
  if (!data) return null;
  const s = data.settings;

  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => patch((d) => { (d.settings as unknown as Record<string, unknown>)[k as string] = v; });

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Themes, sound, keyboard, learning style and accessibility. Every change applies instantly and is saved on this device.</p>
        </div>
      </div>

      <Card className="settings-section">
        <h3><Ic n="palette" size={17} /> Theme gallery</h3>
        <p className="small muted" style={{ marginBottom: 12 }}>Pick any world you like. They're all yours.</p>
        <div className="theme-grid">
          {THEMES.map((t) => {
            const on = s.theme === t.id;
            return (
              <button
                key={t.id} type="button"
                className={`theme-tile ${on ? 'on' : ''}`}
                onClick={() => { set('theme', t.id as ThemeId); }}
                aria-pressed={on}
                title={t.desc}
              >
                <span className="theme-swatch" style={{ background: t.preview[0] }}>
                  <i style={{ background: t.preview[1] }} />
                  <i style={{ background: t.preview[2], opacity: 0.8 }} />
                </span>
                <span className="theme-name">
                  {t.name}
                  {on ? <span style={{ color: 'var(--accent)' }}>✓</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="settings-section">
        <h3><Ic n="access" size={17} /> Accessibility</h3>
        <div className="row gap wrap" style={{ margin: '10px 0 4px' }}>
          <span className="small muted">Text size</span>
          <Seg
            options={[{ v: '0.9', label: 'S' }, { v: '1', label: 'M' }, { v: '1.15', label: 'L' }, { v: '1.3', label: 'XL' }]}
            value={String(s.fontScale) as '1'} onChange={(v) => set('fontScale', Number(v))} ariaLabel="Text size"
          />
        </div>
        <Toggle on={s.dyslexiaFont} onChange={(v) => set('dyslexiaFont', v)} label="High-legibility font" desc="Atkinson Hyperlegible across the whole app, including typing text" />
        <Toggle on={s.reducedMotion} onChange={(v) => set('reducedMotion', v)} label="Reduce motion" desc="Minimises animation everywhere, including the landing page" />
        <Toggle on={s.untimed} onChange={(v) => set('untimed', v)} label="Untimed learning" desc="Hides timers in lessons and practice (speed sprints stay timed)" />
        <Toggle on={s.hideLeaderboards} onChange={(v) => set('hideLeaderboards', v)} label="Hide leaderboards" desc="Removes all ranked boards and comparisons" />
        {!s.hideLeaderboards && (
          <>
            <Toggle on={s.hideGlobalBoards} onChange={(v) => set('hideGlobalBoards', v)} label="Hide boards of strangers" desc="Keeps family and class boards, leaves the global Arena boards. Your scores stop being uploaded to them too" />
            {!s.hideGlobalBoards && <BoardNameField />}
          </>
        )}
        <p className="small muted" style={{ marginTop: 10 }}>Success and errors are always shown with symbols and text, never colour alone. High-contrast lives in the theme gallery above.</p>
      </Card>

      <Card className="settings-section">
        <h3><Ic n="volume" size={17} /> Sound</h3>
        <Toggle on={s.soundOn} onChange={(v) => { set('soundOn', v); if (v) setTimeout(() => snd.done(), 60); }} label="Sound effects" desc="Key clicks, gentle error cues, celebrations" />
        <div className="row gap" style={{ padding: '12px 2px' }}>
          <span className="small muted" style={{ width: 90 }}>Volume</span>
          <input
            type="range" min={0} max={1} step={0.05} value={s.volume} style={{ flex: 1, accentColor: 'var(--accent)' }}
            onChange={(e) => set('volume', Number(e.target.value))}
            onMouseUp={() => snd.key()} onTouchEnd={() => snd.key()}
            aria-label="Sound volume"
          />
        </div>
      </Card>

      <Card className="settings-section">
        <h3><Ic n="keyboard" size={17} /> Keyboard & typing</h3>
        <div className="row gap wrap" style={{ margin: '8px 0' }}>
          <span className="small muted">Layout</span>
          <select className="ob-input" style={{ maxWidth: 260, padding: '8px 12px' }} value={data.profile.layout} onChange={(e) => patch((d) => { d.profile.layout = e.target.value as LayoutId; })} aria-label="Keyboard layout">
            {(Object.keys(LAYOUT_NAMES) as LayoutId[]).map((l) => <option key={l} value={l}>{LAYOUT_NAMES[l]}</option>)}
          </select>
        </div>
        <div className="row gap wrap" style={{ margin: '8px 0' }}>
          <span className="small muted">On-screen guide</span>
          <Seg
            options={[{ v: 'hands', label: 'Hands + zones' }, { v: 'zones', label: 'Colour zones' }, { v: 'plain', label: 'Plain keys' }, { v: 'hidden', label: 'Hidden' }]}
            value={s.guide as GuideStyle} onChange={(v) => set('guide', v)} ariaLabel="Keyboard guide style"
          />
        </div>
        <div className="row gap wrap" style={{ margin: '8px 0' }}>
          <span className="small muted">Caret</span>
          <Seg options={[{ v: 'bar', label: '| Bar' }, { v: 'block', label: '▮ Block' }, { v: 'under', label: '▁ Under' }]} value={s.caret as CaretStyle} onChange={(v) => set('caret', v)} ariaLabel="Caret style" />
        </div>
        <div className="row gap wrap" style={{ margin: '8px 0' }}>
          <span className="small muted">Mistakes</span>
          <Seg
            options={[{ v: 'standard', label: 'Flow on: fix if you wish' }, { v: 'strict', label: 'Stop until corrected' }]}
            value={s.correction as Correction} onChange={(v) => set('correction', v)} ariaLabel="Correction policy"
          />
        </div>
        <Toggle on={s.showLiveWpm} onChange={(v) => set('showLiveWpm', v)} label="Live WPM while typing" desc="Hide it to focus on accuracy" />
        <Toggle on={s.showKeyboard} onChange={(v) => set('showKeyboard', v)} label="Show on-screen keyboard" />
        <Toggle on={s.showHands} onChange={(v) => set('showHands', v)} label="Show hand model" desc="Animated hands beneath the keyboard in lessons" />
      </Card>

      <Card className="settings-section">
        <h3><Ic n="grad" size={17} /> Learning</h3>
        <Toggle on={s.unlockAll} onChange={(v) => set('unlockAll', v)} label="Unlock all regions" desc="Free exploration of the whole Atlas. Mastery checks still apply" />
        {data.profile.ageGroup === 'kid' && (
          <Toggle on={s.kidWorld !== false} onChange={(v) => set('kidWorld', v)} label="Kid World home" desc="The friendly island-map home. Turn off to use the full explorer dashboard" />
        )}
        <Toggle on={s.focusMode} onChange={(v) => set('focusMode', v)} label="Focus mode" desc="Slims the interface down to almost nothing" />
        <div className="row gap wrap" style={{ margin: '8px 0' }}>
          <span className="small muted">Coach frequency</span>
          <Seg
            options={[{ v: 'high', label: 'Chatty' }, { v: 'normal', label: 'Normal' }, { v: 'low', label: 'Rare' }, { v: 'off', label: 'Off' }]}
            value={s.coachFreq} onChange={(v) => set('coachFreq', v)} ariaLabel="Coach frequency"
          />
        </div>
        <div className="row gap wrap" style={{ margin: '8px 0' }}>
          <span className="small muted">Daily goal</span>
          <Seg
            options={[{ v: '5', label: '5m' }, { v: '8', label: '8m' }, { v: '10', label: '10m' }, { v: '15', label: '15m' }, { v: '20', label: '20m' }]}
            value={String(data.dailyGoalMin) as '10'} onChange={(v) => patch((d) => { d.dailyGoalMin = Number(v); })} ariaLabel="Daily goal minutes"
          />
        </div>
      </Card>

      <Card className="settings-section">
        <h3><Ic n="database" size={17} /> Data</h3>
        <p className="small muted">Everything is stored locally in your browser (no account, no cloud). Sample history was added after your assessment so the analytics feel alive.</p>
        <div className="row gap wrap" style={{ marginTop: 12 }}>
          <Btn kind="soft" onClick={() => setConfirmClear(true)} disabled={data.seedCleared}>{data.seedCleared ? 'Sample history removed' : 'Remove sample history'}</Btn>
          <Chip>{data.sessions.filter((x) => x.seeded).length} sample sessions</Chip>
        </div>
      </Card>

      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} labelledBy="clear-title">
        <h2 id="clear-title">Remove sample history?</h2>
        <p className="muted">This deletes the demo sessions that were seeded after onboarding. Your real sessions, XP, badges and key mastery stay untouched.</p>
        <div className="col gap">
          <Btn onClick={() => { clearSeeded(); setConfirmClear(false); pushToast({ kind: 'info', icon: 'check', title: 'Sample history removed' }); }}>Remove samples</Btn>
          <Btn kind="soft" onClick={() => setConfirmClear(false)}>Cancel</Btn>
        </div>
      </Modal>
    </div>
  );
}

/**
 * The name boards of strangers show.
 *
 * Offered to every age, because the alias-or-real-name split solved the child
 * case and left an adult who would rather not be identified with no option at
 * all. A name someone picked is the only one of the three that is both real to
 * them and not necessarily their real name.
 *
 * For a kid the field starts empty, which means the generated handle: the safe
 * default stays the default, and changing it is a deliberate act by whoever is
 * sitting there. The copy says plainly who sees it, because that is the whole
 * decision being made.
 */
function BoardNameField() {
  const data = useData();
  const patch = useStore((st) => st.patch);
  const [draft, setDraft] = useState<string | null>(null);
  if (!data) return null;

  const kid = data.profile.ageGroup === 'kid';
  const saved = data.profile.boardName ?? '';
  const value = draft ?? saved;
  // Mirrors the CHECK in 20260816120000_arena_boards.sql. Wide enough for a
  // handle, too narrow to carry an email address or a link to somewhere else.
  const ok = value === '' || /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,19}$/.test(value);
  const fallback = kid ? 'a nickname we pick for you' : data.profile.name;

  // Saves as you type, like every other control on this page. Committing only
  // on blur meant a name typed and then navigated away from was silently lost,
  // which on a phone is most of the time. The draft exists only to let someone
  // type through an invalid intermediate state without it being rejected.
  const onType = (v: string) => {
    setDraft(v);
    const next = v.trim().slice(0, 20);
    if (next !== '' && !/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,19}$/.test(next)) return;
    patch((d) => { d.profile.boardName = next; });
  };

  return (
    <label className="set-field">
      <span className="set-field-label">Name on boards of strangers</span>
      <input
        className="ob-input"
        value={value}
        maxLength={20}
        placeholder={fallback}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={!ok}
        onChange={(e) => onType(e.target.value)}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      />
      <small className={ok ? 'muted' : 'warnline'}>
        {!ok
          ? 'Letters, numbers, spaces, dots, dashes and underscores. Two to twenty characters.'
          : value === ''
            ? <>Leave it empty and the board shows <strong>{fallback}</strong>. Family and class boards always show your real name.</>
            : <>Strangers see <strong>{value}</strong>. Family and class boards still show your real name.</>}
      </small>
    </label>
  );
}
