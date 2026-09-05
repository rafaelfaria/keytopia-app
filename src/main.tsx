import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import '@fontsource-variable/manrope';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles/base.css';
import './styles/app.css';
import './styles/landing.css';
import './styles/gameart.css';
import './styles/public.css';
import './styles/tools.css';
import './styles/blog.css';
import './styles/mock.css';
import './styles/classroom.css';
import './styles/arena.css';
import { AppShell, ThemeSync } from './components/Shell';
import { Boundary } from './components/Boundary';
import Landing from './pages/Landing';
import {
  AboutPage, AdaptivePracticePage, AnalyticsPage, CurriculumPage, FaqPage, GlossaryPage,
  KidsPage, LearnToTypePage, PracticeModesPage, PrivacyPage, RacesPage,
  SchoolsPage, TermsPage, TypingGamesPage,
} from './pages/public/pages';
import { NotFoundPage } from './pages/public/NotFound';
import { TypingTestPage } from './pages/public/TypingTest';
import {
  AccuracyTestPage, DailyExercisePage, ProgressTrackerPage, SpeedByAgePage,
  SpeedTestPage, TimedChallengePage, ToolsHubPage, WeakKeysPage, WpmCalculatorPage,
} from './pages/tools';

import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { GtagLoader } from './components/analytics/GtagLoader';

/**
 * The blog is the one part of the public site that is code-split.
 *
 * Fifty articles are roughly seventy thousand words of Markdown, and every
 * other route in this file is imported eagerly into the single main chunk. A
 * reader who came to type should not download the whole content campaign to get
 * there, so these two routes — and the article bodies they pull in behind them —
 * load only when somebody actually asks for /blog.
 */
/**
 * The fifteen games, loaded on demand.
 *
 * Together they were 359 kB gzipped — sixty per cent of the main bundle — and
 * every visitor downloaded them: the landing page, somebody reading a blog
 * article from a search result, somebody using a free tool. None of those
 * people run a line of it. Three.js and the game scenes now arrive when a
 * game route does.
 *
 * The games are behind the account boundary, so the reader who benefits most
 * is the first-time visitor who never reaches one.
 */
/**
 * The application, split away from the marketing pages.
 *
 * Every one of these used to be a static import, so the 1.3 MB entry chunk was
 * downloaded and parsed by someone who had landed on a blog post from a search
 * result and would never sign in. The public pages are prerendered, so that
 * work bought them nothing at all: the text was already on screen.
 *
 * These routes sit behind RequireAccount or a deliberate click, which is the
 * natural seam. Landing and the public pages stay eager because they are what
 * a first visit actually renders.
 */
// Account pulls in the Supabase client, so a static import here put a 200 kB
// auth bundle in the modulepreload list of every prerendered marketing page.
// It is only ever rendered behind a route that already requires an account.
const RequireAccount = React.lazy(() => import('./components/Account').then((m) => ({ default: m.RequireAccount })));
const AuthCallback = React.lazy(() => import('./components/Account').then((m) => ({ default: m.AuthCallback })));
const Onboarding = React.lazy(() => import('./pages/Onboarding'));
const ProfilePicker = React.lazy(() => import('./pages/ProfilePicker'));
const Learn = React.lazy(() => import('./pages/Learn'));
const LessonPlayer = React.lazy(() => import('./pages/LessonPlayer'));
const PracticeHub = React.lazy(() => import('./pages/PracticeHub'));
const TrainSession = React.lazy(() => import('./pages/TrainSession'));
const Games = React.lazy(() => import('./pages/Games'));
const RaceHub = React.lazy(() => import('./pages/RaceHub'));
const RaceLive = React.lazy(() => import('./pages/RaceLive'));
const GuestRoom = React.lazy(() => import('./pages/GuestRoom'));
const Challenge = React.lazy(() => import('./pages/Challenge'));
const ProgressHub = React.lazy(() => import('./pages/ProgressHub'));
const BadgesPage = React.lazy(() => import('./pages/BadgesPage'));
const Family = React.lazy(() => import('./pages/Family'));
const Profile = React.lazy(() => import('./pages/Profile'));
const ExplorerBuilder = React.lazy(() => import('./pages/ExplorerBuilder'));
const Settings = React.lazy(() => import('./pages/Settings'));
const SignIn = React.lazy(() => import('./pages/SignIn'));
const CreateProfile = React.lazy(() => import('./pages/CreateProfile'));
const JoinClass = React.lazy(() => import('./pages/JoinClass'));
const HomeGate = React.lazy(() => import('./pages/KidHome').then((m) => ({ default: m.HomeGate })));

const WordfallGame = React.lazy(() => import('./pages/WordfallGame'));
const LetterFallGame = React.lazy(() => import('./pages/LetterFallGame'));
const KeySafariGame = React.lazy(() => import('./pages/KeySafariGame'));
const RocketGame = React.lazy(() => import('./pages/RocketGame'));
const PaintRevealGame = React.lazy(() => import('./pages/PaintRevealGame'));
const FirstLetterGame = React.lazy(() => import('./pages/FirstLetterGame'));
const WordBridgeGame = React.lazy(() => import('./pages/WordBridgeGame'));
const KeyforgeGame = React.lazy(() => import('./pages/KeyforgeGame'));
const WordflightGame = React.lazy(() => import('./pages/WordflightGame'));
const DuelGame = React.lazy(() => import('./pages/DuelGame'));
const TideLineGame = React.lazy(() => import('./pages/TideLineGame'));
const PearlDiveGame = React.lazy(() => import('./pages/PearlDiveGame'));
const CipherGame = React.lazy(() => import('./pages/CipherGame'));
const StackGame = React.lazy(() => import('./pages/StackGame'));
const SurvivorGame = React.lazy(() => import('./pages/SurvivorGame'));

const BlogIndex = React.lazy(() => import('./pages/blog/BlogIndex'));
const BlogPost = React.lazy(() => import('./pages/blog/BlogPost'));

/**
 * The fallback is a bare page-coloured surface, not a spinner.
 *
 * These routes are prerendered, so a visitor from a search result is already
 * reading the article while this chunk downloads. A spinner would be announcing
 * work the reader cannot see and does not care about; painting the page's own
 * background just avoids a white flash on the swap.
 */
/**
 * Games render inside AppShell, which has already painted the frame around
 * them, so the fallback only has to hold the space the game is about to fill
 * rather than redraw the page.
 */
function GameChunk({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense fallback={<div style={{ minHeight: '60vh' }} />}>
      {children}
    </React.Suspense>
  );
}

function BlogChunk({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense fallback={<div className="pub-root" style={{ minHeight: '100vh' }} />}>
      {children}
    </React.Suspense>
  );
}

/**
 * Reset the scroll position on navigation.
 *
 * A browser does this for free; a client-side router does not, so following a
 * footer link from halfway down the landing page dropped you into the middle of
 * the next one. Nothing appeared to happen except that the content changed
 * under you.
 *
 * Hash links are left alone so in-page anchors (the table of contents on the
 * guides, the landing's own section links) still jump where they mean to. The
 * scroll is explicitly instant because base.css sets `scroll-behavior: smooth`,
 * which would otherwise animate the whole length of the page you just left.
 */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  React.useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash]);
  return null;
}

/**
 * One React root per container, for the life of the page.
 *
 * This file exports things that are not components, so Fast Refresh cannot
 * patch it and Vite re-executes the whole module instead. `createRoot` at
 * module scope therefore ran again on every edit, mounting a SECOND copy of the
 * entire app into the same element — React says so in the console — and the
 * first copy never unmounted. It kept its timers: a countdown that had already
 * been left behind carried on beeping from a screen that was no longer on
 * screen, and every interval in it went on running for the rest of the session.
 *
 * Caching the root on the element makes a re-execution a re-render instead.
 */
const container = document.getElementById('root')! as HTMLElement & { __ktRoot?: ReactDOM.Root };
container.__ktRoot ??= ReactDOM.createRoot(container);
container.__ktRoot.render(
  <Boundary>
    <BrowserRouter>
      <ThemeSync />
      <ScrollToTop />
      {/* One boundary above every route, because the application pages are lazy
          chunks now and a route without a boundary above it throws rather than
          waits. The public pages are eager and prerendered, so they never
          suspend and never see this fallback. */}
      <React.Suspense fallback={<div className="pub-root" style={{ minHeight: '100vh' }} />}>
      <Routes>
        <Route path="/" element={<Landing />} />

        {/* Public, crawlable pages. Each is prerendered to static HTML at build
            time (scripts/prerender.mjs) and registered in src/lib/seo/site.ts —
            adding one here means also adding it there, which is what feeds the
            sitemap, robots.txt, llms.txt and the OG-image generator. */}
        <Route path="/typing-test" element={<TypingTestPage />} />
        <Route path="/learn-to-type" element={<LearnToTypePage />} />
        <Route path="/curriculum" element={<CurriculumPage />} />
        <Route path="/typing-games" element={<TypingGamesPage />} />
        <Route path="/adaptive-practice" element={<AdaptivePracticePage />} />
        <Route path="/typing-practice-modes" element={<PracticeModesPage />} />
        <Route path="/typing-races" element={<RacesPage />} />
        <Route path="/typing-analytics" element={<AnalyticsPage />} />
        <Route path="/typing-for-kids" element={<KidsPage />} />
        <Route path="/typing-for-schools" element={<SchoolsPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/typing-glossary" element={<GlossaryPage />} />

        {/* The free tools. Eight working tools plus their hub, sharing the
            typing engine, the WPM definition and the local result store. Each
            one is a registry entry in src/lib/seo/toolsPages.ts and a row in
            src/lib/tools/registry.ts, and the tests assert that this list, that
            registry and the prerenderer's own map all agree. */}
        <Route path="/tools" element={<ToolsHubPage />} />
        <Route path="/tools/typing-speed-test" element={<SpeedTestPage />} />
        <Route path="/tools/wpm-calculator" element={<WpmCalculatorPage />} />
        <Route path="/tools/typing-accuracy-test" element={<AccuracyTestPage />} />
        <Route path="/tools/timed-typing-challenge" element={<TimedChallengePage />} />
        <Route path="/tools/weak-key-analysis" element={<WeakKeysPage />} />
        <Route path="/tools/daily-typing-exercise" element={<DailyExercisePage />} />
        <Route path="/tools/typing-speed-by-age" element={<SpeedByAgePage />} />
        <Route path="/tools/typing-progress-tracker" element={<ProgressTrackerPage />} />

        {/* The blog. Both routes are prerendered per article (see
            src/lib/seo/site.ts, which derives one registry entry per published
            post), so these components are what a reader gets *after* the static
            document has already painted. */}
        <Route path="/blog" element={<BlogChunk><BlogIndex /></BlogChunk>} />
        <Route path="/blog/:slug" element={<BlogChunk><BlogPost /></BlogChunk>} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        {/* A private race room, for somebody who does not have KeyTopia.
            A room is a Realtime channel and owns no data, so a guest needs no
            account to stand in one — see src/pages/GuestRoom.tsx. Signed-in
            visitors are forwarded to /app/race/room/:code by the page itself.
            Not prerendered and not in the sitemap: the address is one specific
            room, alive for as long as somebody is standing in it. */}
        <Route path="/race/room/:code" element={<GuestRoom />} />

        {/* --- the account boundary -------------------------------------
            Everything above this line is open to anyone and prerendered for
            search engines. Everything below owns saved progress, so it needs a
            session: a profile can never exist outside an account, which is what
            keeps "whose progress is this?" from ever being a question. */}
        <Route path="/signin" element={<SignIn />} />
        {/* Where Google and email sign-in links come back to. Must match the
            redirect allowlist in the Supabase dashboard. */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route path="/welcome" element={<RequireAccount><CreateProfile /></RequireAccount>} />
        <Route path="/who" element={<RequireAccount><ProfilePicker /></RequireAccount>} />
        {/* Joining a class needs an account, but never an email: the sign-in
            page offers a device-bound anonymous seat for students. */}
        <Route path="/join" element={<RequireAccount><JoinClass /></RequireAccount>} />
        {/* The full guided setup with the placement test. Reachable from inside
            the app; no longer the front door. */}
        <Route path="/onboarding" element={<RequireAccount><Onboarding /></RequireAccount>} />
        <Route path="/app" element={<RequireAccount><AppShell /></RequireAccount>}>
          <Route index element={<HomeGate />} />
          <Route path="learn" element={<Learn />} />
          <Route path="lesson/:id" element={<LessonPlayer />} />
          <Route path="practice" element={<PracticeHub />} />
          <Route path="train/:mode" element={<TrainSession />} />
          <Route path="games" element={<Games />} />
          <Route path="arena" element={<Games />} />
          <Route path="games/wordfall" element={<GameChunk><WordfallGame /></GameChunk>} />
          <Route path="games/letterfall" element={<GameChunk><LetterFallGame /></GameChunk>} />
          <Route path="games/keysafari" element={<GameChunk><KeySafariGame /></GameChunk>} />
          <Route path="games/rocket" element={<GameChunk><RocketGame /></GameChunk>} />
          <Route path="games/paint" element={<GameChunk><PaintRevealGame /></GameChunk>} />
          <Route path="games/firstletter" element={<GameChunk><FirstLetterGame /></GameChunk>} />
          <Route path="games/bridge" element={<GameChunk><WordBridgeGame /></GameChunk>} />
          <Route path="games/keyforge" element={<GameChunk><KeyforgeGame /></GameChunk>} />
          <Route path="games/wordflight" element={<GameChunk><WordflightGame /></GameChunk>} />
          <Route path="games/duel" element={<GameChunk><DuelGame /></GameChunk>} />
          <Route path="games/tideline" element={<GameChunk><TideLineGame /></GameChunk>} />
          <Route path="games/pearl" element={<GameChunk><PearlDiveGame /></GameChunk>} />
          <Route path="games/cipher" element={<GameChunk><CipherGame /></GameChunk>} />
          <Route path="games/stack" element={<GameChunk><StackGame /></GameChunk>} />
          <Route path="games/survivor" element={<GameChunk><SurvivorGame /></GameChunk>} />
          <Route path="race" element={<RaceHub />} />
          <Route path="race/live" element={<RaceLive />} />
          {/* A room is an address, so it can be sent to a friend. Same hub, with
              the lobby dialog open over it. */}
          <Route path="race/room/:code" element={<RaceHub />} />
          <Route path="challenge" element={<Challenge />} />
          <Route path="progress" element={<ProgressHub />} />
          <Route path="badges" element={<BadgesPage />} />
          <Route path="family" element={<Family />} />
          <Route path="profile" element={<Profile />} />
          <Route path="explorer" element={<ExplorerBuilder />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        {/* The prerendered 404 document hydrates here, and any unknown path in
            the running app lands here too.

            This used to be `<Navigate to="/" replace />`, the client-side half
            of the same fault as the server rewrite: a wrong URL silently became
            the home page instead of saying it was wrong. A person lost the
            evidence of their typo, and a crawler was told the page existed. */}
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </React.Suspense>

      {/* Two measurements, deliberately. GA4 runs in Consent Mode with storage
          denied, which keeps the privacy page's "no analytics cookies" true but
          leaves it unable to tell one visitor from another: every page view
          looks like a new person. Vercel identifies a visitor by a hash of IP,
          user agent and a salt that rotates daily and is then thrown away, so
          the visitor and bounce numbers are real without anything being stored
          on the device. GA keeps the event stream; Vercel counts the people. */}
      <GtagLoader />
      <VercelAnalytics />
    </BrowserRouter>
  </Boundary>,
);

// Sync starts *after* the first render, never before it: the app must paint
// from localStorage without waiting on any network call (plan §8, instant bar).
// A timeout rather than requestAnimationFrame on purpose — rAF never fires in a
// background tab, which would strand a restored session with sync switched off.
// With no Supabase project configured this is a no-op.
// Imported dynamically as well as deferred. A static import puts the sync
// engine and the whole Supabase client in the entry graph, so Vite emits a
// modulepreload for them on every prerendered marketing page, and a reader who
// arrived at a blog post from a search result downloaded an auth client they
// will never use.
setTimeout(() => { void import('./lib/syncEngine').then((m) => m.startSync()); }, 0);
// Same contract for the classroom mirror: it watches the store from outside and
// pushes finished daily-challenge runs to class boards in the background, so no
// classroom code sits on the typing path (docs/classrooms-plan.md §2.5).
setTimeout(() => { void import('./lib/classroom').then((m) => m.startClassroomWatch()); }, 0);



