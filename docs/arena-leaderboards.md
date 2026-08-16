# The Arena Boards — one leaderboard system for every mini game

> **Status (2026-08-16): phases 1–3 shipped.** The schema, the four RPCs, the
> realtime channel, the client layer and the three shared surfaces are built, and
> **Block Stack is wired end to end** as the reference implementation. Phases 4
> and 5 (the remaining seven games, and the Arena hub rebuild that replaces the
> locked `StandingsPreview` mockup) are **not built**.
>
> Shipped: `supabase/migrations/20260816120000_arena_boards.sql`,
> `supabase/tests/arena_rls.sql` (15 sections, all passing), `src/lib/arena.ts`,
> `src/lib/arenaBoard.ts`, `src/lib/arenaLive.ts`, `src/components/arena.tsx`,
> `src/styles/arena.css`, the `hideGlobalBoards` setting, and the intro/result
> panels in `src/pages/StackGame.tsx`.
>
> **Revised 2026-08-16 after review.** The first pass made the pre-game panel a
> short two-column card with the board floating in its top third, and the finish
> screen one centred column of undifferentiated figures. Both were rebuilt:
> §7.5 (the game's front door, with the 3D backdrop) and §9 are what shipped.
>
> Three deviations from this document as written, all deliberate:
> `arena_scores` gained a `last_at` column separate from `updated_at` (§3 below
> explains why a rate limit that only sees improvements has a hole);
> `ArenaIntro` takes a `title` rather than reusing the registry's game name,
> because every game page already carries its name and "trains" chip in the
> header above the panel; and the finish screen falls back to the *board's* next
> target when the server could not be reached, so rule 2 survives being offline.
>
> **Revised a third time.** The stage (§7.4) now wraps all three phases, so a
> game keeps one layout from front door to finish. "Blueprint" is gone from
> Block Stack's interface. Board names are chosen by the learner at any age
> (§12.2). Every screen was checked at 375px.
>
> **Revised again after a second review.** Five changes, all in §7.5 / §8 / §12:
> the 3D field now tints from theme tokens rather than fixed hex; boards show a
> top ten and page with "show more"; teen and adult global boards show real
> names (kids stay aliased); the "Trains:" chip moved off the persistent header
> onto the intro; and the intro lost its card — it is the page.
>
> **Verified end to end through a signed-in session** against the local stack:
> a run posts, ranks, and the board comes back with real rows. This also turned
> up that `hideLeaderboards` was being honoured by showing a *simulated* board —
> a board of invented rivals with a target line, which is the comparison the
> setting exists to switch off. Boards are now absent entirely when it is on.

This is the design contract. Section 10 is the checklist every future mini game
follows, and it is the reason this document exists: before it, each game invented
its own ending and none of them ranked you.

Eight play surfaces exist. **The Lightstream** (`RaceHub.tsx` → `RaceLive.tsx`) is
the headline, then Quill Duel and Survivor Sprint under Competitive, then five skill
quests: Wordfall Defence, Block Stack, Cipher Run, Keyforge, Wordflight. Every one of
them ends with a number nobody else will ever see.

---

## 1. What exists today (honest audit)

- **`gameBests` is a local shrug.** `ProfileData.gameBests: Record<string, {score, level}>`
  (`src/lib/types.ts:124`) is written by seven games in seven slightly different ways
  and read back as a single gold chip on the intro screen. It syncs to Supabase as an
  opaque blob (`src/lib/sync.ts:25`). Nothing compares it to anyone.
- **A real leaderboard already ships, for one feature.** `daily_scores` +
  `daily_board_global()` / `daily_board_group()`
  (`supabase/migrations/20260814120000_daily_leaderboards.sql`) back the Daily
  Challenge, with the two rules that govern everything below: **the client never
  states its own score** (generated column), and **a child's real name never reaches
  a stranger** (`keytopia_alias()`). `boards` / `board_members` give households a
  private board with a six-character code. All of this is reusable as-is.
- **The Lightstream's standings are a mockup.** `StandingsPreview` in
  `RaceHub.tsx:340` renders four deliberately locked skeleton rows and a "Coming
  soon" chip. That is the single biggest gap in the product, and it is the thing the
  Arena hub is named after.
- **Realtime is already proven here.** `src/lib/room.ts` runs private race rooms on a
  Supabase Realtime channel with presence and broadcast, degrading to simulated
  friends when no project is configured. The Arena boards borrow its shape wholesale,
  including the degrade rule.
- **Every game shares one skeleton.** `phase: 'intro' | 'run' | 'over'`, with intro
  and over both rendered as a `.game-over` panel inside `.game-frame`. That is the
  insertion point: two panels, eight games, one component each.

---

## 2. Principles

1. **The board never blocks play.** Press "Play" and you play. Boards load beside the
   button, never in front of it. Every fetch degrades to a local view rather than an
   error, the way `fetchBoard()` already does.
2. **One number you are chasing.** A rank with no target is a scoreboard. A rank with
   "14 points to pass Bright Kestrel" is a game. Every board surface ends in a
   *next target* line, and that line is the design's centre of gravity.
3. **You are always on screen.** Outside the top N, your row is pinned below an
   explicit gap. A board that drops you reads as "you did not count".
4. **Rank is never carried by colour alone.** Podium tints decorate a numeral.
   Movement is an arrow *and* a number *and* a screen-reader sentence.
5. **The server ranks, the client renders.** The client posts raw metrics and gets a
   rank back in the same round trip. It never computes a position it then has to
   defend.
6. **Pseudonymous by default, real names only where everyone was invited.** Inherited
   from the Daily Challenge, unchanged, and it is what makes a global board safe for a
   nine-year-old.
7. **Social, not stakes.** Runs happen in a browser. Clamps and generated scores stop
   casual forgery; they do not make this a ranked ladder with prizes, and the copy
   never pretends otherwise.

---

## 3. Data model

One table for every game, including the Lightstream. Adding a game is a row in a
registry and a `when` branch in one function, not a new table.

```sql
-- supabase/migrations/2026XXXX_arena_boards.sql

-- Which games may be ranked, and how their runs are described. A table rather
-- than a CHECK list so the client registry and the database can be diffed.
create table arena_games (
  id          text primary key,          -- 'lightstream' | 'stack' | ...
  name        text not null,
  -- Labels for the two game-specific metrics on the board. NULL hides the column.
  value_label text,                      -- 'height', 'waves', 'gates', 'rounds'
  active      boolean not null default true
);

create table arena_scores (
  game        text not null references arena_games (id),
  -- 'd:2026-08-16' | 'w:2026-W33' | 'all'. One row per learner per bucket, so
  -- "today", "this week" and "all time" are the same query with a different key.
  period      text not null check (period ~ '^(d:\d{4}-\d{2}-\d{2}|w:\d{4}-W\d{2}|all)$'),
  profile_id  text not null references profiles (id) on delete cascade,
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  age_group   text not null check (age_group in ('kid','teen','adult')),

  -- What a client may state. Bounds are what a human hand can produce.
  wpm         real not null check (wpm  >= 0 and wpm <= 250),
  acc         real not null check (acc  >= 0 and acc <= 100),
  value       real not null default 0 check (value >= 0 and value <= 100000),
  runs        integer not null default 1 check (runs >= 0 and runs <= 100000),

  -- What it may not.
  score       integer not null generated always as (arena_score(game, wpm, acc, value)) stored,
  alias       text    not null generated always as (keytopia_alias(profile_id)) stored,
  display_name text   not null check (length(display_name) between 1 and 40),
  avatar      text    not null check (length(avatar) <= 64),

  first_at    timestamptz not null default now(),
  -- When the BEST changed. A ranking input: ties break on the earlier posting,
  -- so a run that fails to improve must not touch it.
  updated_at  timestamptz not null default now(),
  -- When a run was last posted at all. What the rate limit reads, and separate
  -- from updated_at precisely because a limiter that only sees improvements has
  -- a hole exactly the shape of a forger posting in a loop.
  last_at     timestamptz not null default now(),
  primary key (game, period, profile_id)
);

create index arena_scores_board on arena_scores (game, period, age_group, score desc, updated_at asc);
create index arena_scores_by_profile on arena_scores (profile_id);
```

`arena_score()` is `immutable` (a generated column requires it) and holds one branch
per game — the same shape as the `case mode` already in `daily_scores`:

```sql
create or replace function arena_score(p_game text, p_wpm real, p_acc real, p_value real)
returns integer language sql immutable as $$
  select (case p_game
    when 'lightstream' then round(p_wpm * 10 + p_acc * 2)          -- speed, accuracy as tiebreak
    when 'duel'        then round(p_value * 200 + p_wpm * 5)       -- rounds won, then pace
    when 'survivor'    then round(p_value * 150 + p_wpm * 5)       -- heats survived
    when 'wordfall'    then round(p_value * 60 + p_acc * 6)        -- waves held
    when 'stack'       then round(p_value * 40 + p_acc * 4)        -- blocks stacked
    when 'cipher'      then round(p_value * 50 + p_wpm * 3)        -- runes solved
    when 'keyforge'    then round(p_value * 45 + p_wpm * 4)        -- treasures forged
    when 'wordflight'  then round(p_value * 55 + p_acc * 5)        -- gates threaded
    else round(p_wpm * 10 + p_acc)
  end)::integer;
$$;
```

**This is deliberately a migration per new game.** The alternative — a formula string
read from `arena_games` — cannot back a generated column, and the moment the formula
is data the client can be told what it is, which is halfway to the client stating its
own score. The cost is one `case` branch; the benefit is that a tampered client cannot
put a number on a stranger's screen.

**Scope reuses what exists.** `boards` / `board_members` already give a household a
private board with a code, and the Leaderboard component already knows how to create
and join one. The Arena adds no second invitation concept: `scope=global` is your age
division under aliases, `scope=board` is a `boards` row under real names. Classroom
boards stay in the Classroom product, as they do today.

**RLS is unchanged in shape.** Own rows only, restrictive "no anonymous writes",
cross-learner reads exclusively through the security-definer functions in §4. Anonymous
school seats may read a board and never appear on one, exactly as with `daily_scores`.

---

## 4. RPCs — one round trip per screen

The performance answer the whole system rests on: no screen issues N queries.

### `arena_home(p_profile_id, p_age, p_period)` → one row per game
Backs the entire Games/Arena hub. Returns, per active game: your best score, your
rank, total ranked players, the leader's alias and score, and your rank in the
previous period so the hub can show movement. One `lateral` per game over the covering
index; it is one statement and a handful of index scans.

### `arena_board(p_game, p_period, p_scope, p_board_id, p_age, p_profile_id, p_limit)`
The board itself. Returns top N *plus* your row when it fell outside, plus your two
neighbours (rank−1 and rank+1) so the "next target" line needs no second call.
Columns: `rank, name, avatar, wpm, acc, value, score, you, is_neighbour`.

### `arena_submit(p_game, p_profile_id, p_age, p_wpm, p_acc, p_value, p_name, p_avatar)`
The important one. It writes the day / week / all-time rows **and returns the finish
screen in the same response**:

```
returns table (
  period        text,     -- one row per bucket written
  score         int,      -- what this run scored
  best          int,      -- your best in this bucket after the write
  improved      boolean,  -- did this run beat it
  rank          int,      -- your rank now
  prev_rank     int,      -- your rank before this run (null if unranked)
  passed        int,      -- how many people you overtook
  passed_name   text,     -- the nearest one, for the copy line
  total         int,      -- ranked players in this bucket
  next_rank     int,      -- the rank above you
  next_gap      int       -- points needed to take it
)
```

The client therefore knows, before it paints a single pixel of the finish screen, that
you went from 22nd to 14th, passed eight people including Bright Kestrel, and are 18
points off 13th. No polling, no second fetch, no flicker. Writes are upserts keeping
the best per bucket, so retrying is safe and the "fire and forget" posture from
`submitDailyScore()` carries over.

**Results and identity are kept on different clocks.** The run's figures, and the
`updated_at` that breaks ties, only move when the run beat what was there. The
display name, avatar, board name and the global-boards flag refresh on *every*
posted run, improving or not: those are not results, they are how you appear, and
an explorer someone just built would otherwise sit stale on the board until the
day they happened to beat their own record. The avatar column is bounded at 160
characters for the same reason — a built explorer encodes to around 98, and
truncating one does not shrink a picture, it cuts a field in half and brings the
explorer back in the wrong colour.

`arena_submit` also rate-limits: reject a second submission for the same
`(game, profile)` inside three seconds. A run cannot legitimately be that short and a
loop that can is the cheapest possible forgery.

All four are `security definer`, `revoke execute … from public` **then** grant to
`authenticated`, and re-check `is_anonymous` in the body — because definer rights mean
RLS is not doing it for us. That trap is documented in the existing migration and in
memory; it is repeated here because it is repeated in every one of these functions.

---

## 5. Realtime

**Broadcast, not postgres_changes.** RLS on `arena_scores` is "own rows only", so
Postgres change events would deliver a learner nothing but their own writes — and a
firehose of every score in the product is the wrong shape regardless.

A trigger on `arena_scores` calls `realtime.send()` to a topic per board:

```
arena:<game>:<period>:<age_group>
```

with a payload carrying only what the board already shows to that division:
`{ alias, avatar, score, wpm, value }`. No profile id, no display name, no owner. The
same row also lands on the topic for each `boards` row the profile belongs to, where
the payload may carry the display name because everyone there was invited.

The client (`src/lib/arenaLive.ts`) subscribes to the topic of the board currently on
screen, and on each message:

1. merges the score into its local rows and re-ranks **optimistically** — the row
   glides to its new position immediately, which is the whole point of the feature;
2. schedules a trailing 2-second authoritative `arena_board` refetch, so an optimistic
   merge can never drift from the truth for longer than a blink.

Presence rides the same channel and gives the board a genuinely alive header:
"**7 typists on this board right now**". It costs one `track()` call and it is the
cheapest liveness signal available.

Subscriptions are dropped on unmount and while a game is in `phase: 'run'` — nothing
re-renders behind a typing test.

**Degrade rule, unchanged:** no project, no session, or no network means the board
falls back to the locally simulated rivals with the honest "practice rivals" chip. A
leaderboard is never worth a blocked page.

---

## 6. The client registry

`src/lib/arena.ts` is the single place a game declares itself:

```ts
export interface ArenaGame {
  id: string;
  name: string;
  icon: string;
  to: string;
  /** What the run trains. Already written per game in Games.tsx. */
  trains: string;
  /** Label for the third metric column. Null hides it. */
  valueLabel: string | null;
  /** How the finish screen phrases the achievement. */
  unit: (v: number) => string;      // 14 => '14 blocks'
  /** Pulled from the game's own result object at submit time. */
  metric: 'height' | 'waves' | 'gates' | 'rounds' | 'heats' | 'solved' | 'items' | 'wpm';
}
export const ARENA_GAMES: Record<string, ArenaGame>;
```

`Games.tsx` already holds four of these five fields in its `COMPETITIVE` / `QUESTS`
arrays; the registry absorbs those arrays so the hub, the boards, the submit path and
the docs cannot disagree about what a game is called.

---

## 7. Surface one — the Arena hub

`Games.tsx` becomes a standings floor rather than a menu.

```
┌────────────────────────────────────────────────────────────────┐
│  THE ARENA                        Rising Stars · this week     │
│  Eight games. One ladder.                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ #14      │ │ ▲ 8      │ │ 4 of 8   │ │ 312      │           │  ← your standing strip
│  │ best rank│ │ this week│ │ ranked   │ │ arena pts│           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                │
│  ● live   Bright Kestrel just took #3 in Keyforge      ─────────│  ← realtime ticker
├────────────────────────────────────────────────────────────────┤
│  THE LIGHTSTREAM                              [ full board → ] │
│  ╔══════════════════════════════════════════════════════════╗  │
│  ║ 1  ▮ Swift Otter      88 wpm  98%   902                  ║  │  ← real standings,
│  ║ 2  ▮ Calm Comet       81 wpm  97%   838                  ║  │    replacing the
│  ║ 3  ▮ Bold Falcon      79 wpm  95%   819                  ║  │    locked mockup
│  ║ ···                                                      ║  │
│  ║ 14 ▮ You              62 wpm  94%   638   ▲8             ║  │
│  ║    18 points to pass Merry Willow at #13                 ║  │  ← next target
│  ╚══════════════════════════════════════════════════════════╝  │
│                                        [ Enter the Lightstream ]│
├────────────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                  │
│  │  [art]     │ │  [art]     │ │  [art]     │                  │  ← existing GameArt
│  │ #7 ▲2      │ │ #22 ▼1     │ │  unranked  │                  │    + rank strip
│  │ Block Stack│ │ Keyforge   │ │ Cipher Run │                  │
│  │ 640 · #7 of│ │ 410 · #22  │ │ post a run │                  │
│  │ 214        │ │ of 198     │ │ to enter   │                  │
│  └────────────┘ └────────────┘ └────────────┘                  │
└────────────────────────────────────────────────────────────────┘
```

Decisions worth stating:

- **The Lightstream gets the board inline, the quests get a strip.** The hub's job is
  to answer "where am I, and where is the nearest rung" in one glance; eight full
  boards would answer nothing.
- **"Arena points" is the only cross-game number**: `sum over games of max(0, 101 −
  your rank)`, capped at 100 per game. It rewards breadth without pretending a Cipher
  Run point equals a Lightstream point, and it makes the hub's headline stat something
  you can move today by playing the game you are worst at.
- **Unranked is an invitation, not a blank.** "Post a run to enter" with the game's
  player count beside it.
- The ticker is the realtime channel for the division, rendered as one line that
  swaps with a 200ms cross-fade. It is decoration and it is the first thing to go
  under `prefers-reduced-motion` (it becomes a static "14 runs posted in the last
  hour").

---

## 7.4 The stage

All three phases of a mini game share one shell, `<ArenaStage>`:

| | left column | right column |
|---|---|---|
| **intro** | what this is, your record, play | the board |
| **run** | what to type | the game world |
| **over** | what you scored | the board, and where you landed |

Plus a constant backdrop, a constant way out, and a HUD strip for the running
game's score and clock. Before this, a game changed shape three times: a hero
page to start, a bordered card to play in, a centred column to finish on. Three
layouts for one activity meant the screen reorganised itself twice while the
learner was still in it, and finishing a run felt like arriving somewhere else.

**The backdrop holds still while you play.** `quiet` stops the field's animation
loop and thickens the veil: the same world, stepped back. Scenery must not
compete with the word someone is trying to type, and no frame budget should be
spent behind a keystroke.

**Game words go in the interface, game metaphors go in the artwork.** Block Stack
labelled the word you had to type "blueprint" — naming the input after the thing
it builds, which is a riddle at the exact moment someone needs an instruction.
It says "Type this".

---

## 7.5 The 3D backdrop

Each game's front door is drawn over the **same keycap field the landing and the
public pages use** (`src/pages/public/heroScene.ts`), in that game's formation and
hue: `stack` climbs in terraces, `lightstream` streams sideways, `wordfall`
scatters, `wordflight` sits calm. Reusing that scene rather than writing a new one
per game is what keeps a game's front door in the same world as the rest of the
product, and it costs one dynamic import.

Three things make WebGL safe in front of a typing game:

- it is imported dynamically, so three.js is in no bundle a learner downloads
  before opening a game;
- it is one `InstancedMesh` and therefore one draw call, whatever the field does;
- it is disposed the moment the intro unmounts, which is the moment play starts.
  Nothing renders behind someone who is typing.

Under `prefers-reduced-motion` (or the in-app switch) the scene draws a single
static frame and never asks for another, so the game still has a front door
rather than a blank panel.

**Each game's colour comes from the theme, not from a hex.** The registry names
two theme *tokens* and a blend between them (`tone: ['accent2', 'accent', 0.15]`),
resolved at mount from the live custom properties. Fixed colours gave every game
one identity and twelve wrong themes: a violet field is right on midnight and
fights meadow's greens and paper's browns. Tokens mean each game still reads as
itself, in whatever palette the learner chose, including themes added later.

The scene gained four optional inputs for this: `fog`, `surfaceA`/`surfaceB` and
`tint`. The public pages omit all three and are unchanged. The Arena passes live
theme tokens, because a learner may be on any of twelve themes including three
light ones and a field fogged to `#0b1020` sits on a cream page like a hole; and
it passes a tint because `terrace`'s five plateaus otherwise take the five
*curriculum world* colours, which is the wrong meaning inside a game.

**Contrast is guaranteed by a veil, not by luck.** `.arena-hero-veil` is opaque
exactly where copy sits and thins out everywhere else. It is anchored left on
desktop, where the text column is, and becomes a top-down band on mobile, where
the column is centred and full width.

---

## 8. Surface two — the pre-game board

Replaces the `phase === 'intro'` panel in every game with one shared component,
`<ArenaIntro game="stack" onPlay={start} />`. Two columns on desktop, stacked on
mobile with the board **below** the button.

```
┌───────────────────────────────┬──────────────────────────────┐
│  ▮ Build the word tower       │  Today  Week  All time       │  ← Seg (period)
│                               │  Global  ·  The Okonkwo house│  ← Seg (scope)
│  Type the blueprint and the   │  ──────────────────────────  │
│  crane drops a block. Clean   │  ● 7 here now                │  ← presence
│  words drop wide. Under 55%   │  1 ▮ Swift Otter        902  │
│  the top crumbles.            │  2 ▮ Calm Comet         838  │
│                               │  3 ▮ Bold Falcon        819  │
│  Trains: word-perfect         │  4 ▮ Merry Willow       656  │
│  precision                    │  5 ▮ Quiet Ember        640  │
│                               │  ···                         │
│  Your best: 640 · 21 blocks   │  14 ▮ You  ▲8           638  │
│                               │  ──────────────────────────  │
│  [   Lay the first block →  ] │  18 points to reach #13      │  ← next target
└───────────────────────────────┴──────────────────────────────┘
```

- The play button is above the fold on every breakpoint, always. Rule 1.
- **The board runs to the bottom of the panel.** The column stretches, the rows
  take the slack and the target line is pinned to the bottom edge. A board that
  stops a third of the way down a tall card reads as an afterthought.
- **Open places fill the rest.** Any board holding fewer learners than it has
  slots draws the remaining ones as numbered empty seats, the treatment the
  Lightstream's standings preview established. A board that simply stops after
  two real entries reads as broken; one that says "nobody has posted a score
  yet" reads as dead; empty numbered seats read as an invitation, and they keep
  the board the same height whether it holds one learner or fifty. With nobody
  on it at all, every seat is open and the learner's own row is already drawn at
  the bottom, waiting for a number.
- **A top ten, then "show more".** Ten rows, with any unheld places drawn as
  open seats. Beyond that the window grows by ten at a time rather than paging:
  a leaderboard's meaning lives at the top and around your own row, and page 7
  of 41 is a place nobody navigates to on purpose. The button says how many are
  still below you, so it is a decision rather than a shrug. `arena_board` takes
  `p_offset` and returns the board's true `total` on every row, so growing the
  window never needs a second call to know when to stop.
- **The rows scroll inside the column; the header, pager and target line do
  not.** On a short window a ten-row board would otherwise push the play button
  off screen, and rule 1 says the board never moves the game.
- **Both columns start at the top.** An earlier pass centred the left column
  vertically to stop the CTA stranding on the bottom edge; the real cause was
  stretching the CTA with `margin-top: auto`, and centring cost the page its
  shared top edge.
- A personal best is shown as figures under labels, not as a sentence.
- Period and scope selections persist per profile in `localStorage`, the way
  `SCOPE_KEY` already does in `Leaderboard.tsx`.
- Skeleton rows while loading — never a spinner, never a collapsed panel that shoves
  the button down when data lands. Reserve the height.

---

## 9. Surface three — the rank reveal

The finish screen, and the reason `arena_submit` returns what it returns. Replaces the
`phase === 'over'` panel. One component, `<ArenaResult submit={…} onAgain={…} />`.

**Two labelled zones, because the first version had none.** "Your run" holds the
score and the run's three figures; "Where that puts you" holds the standing, the
board and the target. Each is introduced by a small-caps label between two rules.
The first pass stacked a score, three inline figures, two kinds of chip, a rank
badge and a board in one centred column, and nothing told the reader which number
answered which question. The run's figures are now tiles — figure over label —
because "42 wpm 83% accurate 29 blocks" reads as one phrase rather than three
measurements. Rewards and the coaching line are grouped under the run as
footnotes to it, not as more results.

Beat by beat (total ~1.9s, every beat skippable by click or key):

| ms | Beat | Motion |
|---|---|---|
| 0 | Score lands | count 0 → 640, 700ms, `expo.out`; the game's own icon, or `trophy` on a personal best |
| 250 | Run stats fade in | `wpm 62 · 94% · 21 blocks`, stagger 0.04 |
| 700 | Board slides in **with you at your old rank** | y 16 → 0, 300ms, `power2.out` |
| 1000 | Your row travels to its new rank | translateY over 550ms `power3.inOut`; passed rows shift down 90ms behind it |
| 1400 | Passed line | "You passed Bright Kestrel and 7 others" |
| 1600 | Percentile ribbon | "Top 12% of Rising Stars this week" |
| 1750 | Next target + CTAs | `[ Build again ]  [ Full board ]  [ All games ]` |

- **The travel is the whole idea.** Seeing your row physically climb past the rows you
  beat is what a static "you are 14th" can never be. It uses `transform` only, so it
  stays on the compositor.
- **`prefers-reduced-motion` renders the final state immediately** — new rank, passed
  line, target, all present, nothing moves. The information is never carried by the
  animation alone.
- **A dropped rank is stated plainly, once**: "13th, down two. Your best this week is
  still 638." No sad theatre. Games get replayed by people who feel capable.
- Offline or signed out, the panel keeps the score, the personal best and the CTAs,
  and swaps the board for the honest "practice rivals, saved on this device" note.
- `aria-live="polite"` announces one sentence when the sequence settles, not each
  beat: "14th of 214 this week, up 8 places."

---

## 10. Adding a mini game — the checklist

Every future game does exactly this, and nothing else:

1. **Migration**: add the row to `arena_games` and the `when` branch to
   `arena_score()`. Post a score in a test and confirm it ranks.
2. **Registry**: add the `ArenaGame` entry in `src/lib/arena.ts`.
3. **Intro**: render `<ArenaIntro game="<id>" onPlay={start} />` for `phase === 'intro'`.
4. **Submit**: on game over, call `submitArena(data, '<id>', { wpm, acc, value })` with
   `value` being the game's own headline count. Keep the existing local `gameBests`
   write — it is what makes the game work offline.
5. **Result**: render `<ArenaResult …>` for `phase === 'over'`.
6. **Copy**: one sentence of coaching, in the app's voice, no em dashes.

A game that skips step 1 does not appear on any board, which is the correct failure:
it is visibly missing rather than silently unranked.

---

## 11. Delivery

| Phase | Contents | Ships as |
|---|---|---|
| 1 ✅ | Migration, `arena_score`, RLS, four RPCs, `supabase/tests/arena_rls.sql` | nothing user-visible |
| 2 ✅ | `src/lib/arena.ts`, `src/lib/arenaBoard.ts`, `src/lib/arenaLive.ts` | nothing user-visible |
| 3 ✅ | `ArenaBoard`, `ArenaIntro`, `ArenaResult`, `RankBadge`, `Movement` + `arena.css` | Block Stack wired end to end as the reference implementation |
| 4 | The remaining seven games wired | all games ranked |
| 5 | Arena hub rebuild, Lightstream standings replacing `StandingsPreview` | the hub |

Phase 3 deliberately wires one game before the other seven: the second game is where a
shared component's wrong assumptions show up, and it is much cheaper to find them
before the eighth.

---

## 12. Decisions

1. **The Lightstream ranks your best wpm at ≥90% accuracy**, whatever you raced.
   A CPU race, a ghost race and a five-friend room all post to the same board, because
   the alternative splits a small pool three ways and invites farming the easiest
   division. Runs under 90% accuracy still save locally and still count toward your
   race record; they just do not post. `arena_score('lightstream', …)` therefore reads
   `round(wpm * 10 + acc * 2)` with the accuracy floor enforced at submit time.
2. **The learner chooses their board name, at any age.** Two earlier rules —
   alias for everyone, then alias-for-kids-real-name-for-adults — each solved
   one case and left another stranded: the second gave adults realness but gave
   an adult who would rather not be identified no option at all. A name someone
   picked is the only one of the three that is both real to them and not
   necessarily their real name, so it is offered to everybody.

   `Profile.boardName` feeds `arena_scores.board_name`, and
   `arena_public_name()` falls back per division when it is empty: a generated
   handle for a kid, the account name for everyone else. **The safe default
   stays the default** — a kid who changes nothing keeps the handle, and
   changing it is a deliberate act by whoever is sitting there. `alias` remains
   a generated column so a tampered client can never influence the fallback.

   **What this does not solve, and should not be presented as solving:** the
   charset (`^[A-Za-z0-9][A-Za-z0-9 ._-]{1,19}$`, enforced in a CHECK *and* in
   the submit function) is wide enough for a handle and too narrow to carry an
   email address, a URL or an @handle somewhere else — but nothing stops a child
   typing their own full name into it. That is a real loosening of the guarantee
   the first rule made, taken deliberately. A reporting path and a name
   blocklist are the missing pieces before this is exposed to a public board of
   strangers at any scale.
3. **Kids get a global board, and households can switch it off.** Aliases only, no
   avatars from strangers, the same machinery the Daily Challenge already trusts. A
   new `Settings.hideGlobalBoards` sits beside `hideLeaderboards`: it hides *and*
   stops uploading to global boards, while family and class boards keep working. A
   setting that only hides is decoration.
4. **Weekly reset stays ISO (Monday).** `w:YYYY-Www` matches what Postgres and the
   client both compute for free, and Monday is the school week.

*(Open: whether Arena points should decay across weeks. Deferred until there is a
real distribution to look at.)*
