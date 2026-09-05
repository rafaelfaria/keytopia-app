import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes, Navigate, useLocation } from 'react-router-dom';
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
import Onboarding from './pages/Onboarding';
import ProfilePicker from './pages/ProfilePicker';
import { HomeGate } from './pages/KidHome';
import Learn from './pages/Learn';
import LessonPlayer from './pages/LessonPlayer';
import PracticeHub from './pages/PracticeHub';
import TrainSession from './pages/TrainSession';
import Games from './pages/Games';
import WordfallGame from './pages/WordfallGame';
import LetterFallGame from './pages/LetterFallGame';
import KeySafariGame from './pages/KeySafariGame';
import RocketGame from './pages/RocketGame';
import PaintRevealGame from './pages/PaintRevealGame';
import FirstLetterGame from './pages/FirstLetterGame';
import WordBridgeGame from './pages/WordBridgeGame';
import KeyforgeGame from './pages/KeyforgeGame';
import WordflightGame from './pages/WordflightGame';
import DuelGame from './pages/DuelGame';
import TideLineGame from './pages/TideLineGame';
import PearlDiveGame from './pages/PearlDiveGame';
import CipherGame from './pages/CipherGame';
import StackGame from './pages/StackGame';
import SurvivorGame from './pages/SurvivorGame';
import RaceHub from './pages/RaceHub';
import RaceLive from './pages/RaceLive';
import GuestRoom from './pages/GuestRoom';
import Challenge from './pages/Challenge';
import ProgressHub from './pages/ProgressHub';
import BadgesPage from './pages/BadgesPage';
import Family from './pages/Family';
import Profile from './pages/Profile';
import ExplorerBuilder from './pages/ExplorerBuilder';
import Settings from './pages/Settings';
import {
  AdaptivePracticePage, AnalyticsPage, CurriculumPage, FaqPage, GlossaryPage,
  KidsPage, LearnToTypePage, PracticeModesPage, PrivacyPage, RacesPage,
  SchoolsPage, TermsPage, TypingGamesPage,
} from './pages/public/pages';
import { TypingTestPage } from './pages/public/TypingTest';
import {
  AccuracyTestPage, DailyExercisePage, ProgressTrackerPage, SpeedByAgePage,
  SpeedTestPage, TimedChallengePage, ToolsHubPage, WeakKeysPage, WpmCalculatorPage,
} from './pages/tools';
import { AuthCallback, RequireAccount } from './components/Account';

import SignIn from './pages/SignIn';
import CreateProfile from './pages/CreateProfile';
import JoinClass from './pages/JoinClass';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { GtagLoader } from './components/analytics/GtagLoader';
import { startSync } from './lib/syncEngine';
import { startClassroomWatch } from './lib/classroom';

/**
 * The blog is the one part of the public site that is code-split.
 *
 * Fifty articles are roughly seventy thousand words of Markdown, and every
 * other route in this file is imported eagerly into the single main chunk. A
 * reader who came to type should not download the whole content campaign to get
 * there, so these two routes — and the article bodies they pull in behind them —
 * load only when somebody actually asks for /blog.
 */
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
          <Route path="games/wordfall" element={<WordfallGame />} />
          <Route path="games/letterfall" element={<LetterFallGame />} />
          <Route path="games/keysafari" element={<KeySafariGame />} />
          <Route path="games/rocket" element={<RocketGame />} />
          <Route path="games/paint" element={<PaintRevealGame />} />
          <Route path="games/firstletter" element={<FirstLetterGame />} />
          <Route path="games/bridge" element={<WordBridgeGame />} />
          <Route path="games/keyforge" element={<KeyforgeGame />} />
          <Route path="games/wordflight" element={<WordflightGame />} />
          <Route path="games/duel" element={<DuelGame />} />
          <Route path="games/tideline" element={<TideLineGame />} />
          <Route path="games/pearl" element={<PearlDiveGame />} />
          <Route path="games/cipher" element={<CipherGame />} />
          <Route path="games/stack" element={<StackGame />} />
          <Route path="games/survivor" element={<SurvivorGame />} />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

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
setTimeout(startSync, 0);
// Same contract for the classroom mirror: it watches the store from outside and
// pushes finished daily-challenge runs to class boards in the background, so no
// classroom code sits on the typing path (docs/classrooms-plan.md §2.5).
setTimeout(startClassroomWatch, 0);



