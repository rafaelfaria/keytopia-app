/**
 * The blog registry: metadata for every article, and nothing else.
 *
 * This module is deliberately body-free. It is imported by src/lib/seo/site.ts,
 * which every page in the app reaches transitively, so anything in here lands
 * in the main bundle. The article prose lives in ./bodies/, which only the two
 * blog routes import — and those routes are lazily loaded in main.tsx, so
 * seventy thousand words of Markdown never reach a reader who came to type.
 *
 * Being the single source of truth for the schedule means the day number, the
 * publication date, the slug, the canonical URL, the sitemap entry, the OG
 * image and the internal-link graph all agree by construction.
 *
 * SSR-safe: no browser globals, no store, no React. The prerenderer and the
 * sitemap/llms.txt generators run this in Node.
 */

/** The clusters. Each one has a pillar article that its members link back to. */
export type BlogCategory =
  | 'Touch typing'
  | 'Kids & parents'
  | 'Students & schools'
  | 'Adults & work'
  | 'Speed & tests'
  | 'Science'
  | 'Keyboards & ergonomics';

export const BLOG_CATEGORIES: BlogCategory[] = [
  'Touch typing',
  'Speed & tests',
  'Kids & parents',
  'Students & schools',
  'Adults & work',
  'Science',
  'Keyboards & ergonomics',
];

/** Category → the hero tint used on the index card and the article hero. */
export const CATEGORY_HUES: Record<BlogCategory, { hue: string; hue2: string }> = {
  'Touch typing': { hue: '#14d8c4', hue2: '#8b7cff' },
  'Speed & tests': { hue: '#5fb3ff', hue2: '#14d8c4' },
  'Kids & parents': { hue: '#6fe3b6', hue2: '#ffb454' },
  'Students & schools': { hue: '#8b7cff', hue2: '#14d8c4' },
  'Adults & work': { hue: '#ffb454', hue2: '#14d8c4' },
  Science: { hue: '#8b7cff', hue2: '#5fb3ff' },
  'Keyboards & ergonomics': { hue: '#f2789f', hue2: '#ffb454' },
};

export interface BlogPost {
  /** 1..50. Unique, and the campaign's ordering. */
  day: number;
  /** Slug only — the path is derived, so `/blog/` is written in one place. */
  slug: string;
  /** The visible `<h1>`. */
  title: string;
  /** The `<title>`, kept near 60 characters. Brand-suffixed by the SEO layer. */
  seoTitle: string;
  /** `<meta name="description">`, 140–160 characters. */
  description: string;
  /** The visible sub-heading under the h1. Never a copy of the description. */
  lede: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: 'Informational' | 'Educational' | 'How-to' | 'Comparison' | 'Navigational';
  audience: string;
  category: BlogCategory;
  /**
   * A pillar anchors a cluster. Pillars publish early so the supporting
   * articles that link back to them always have a live target.
   */
  pillar?: boolean;
  /** Curated "keep reading" slugs. In-body links are separate and contextual. */
  related: string[];
}

/** Day 1 of the campaign. Every publication date is derived from this. */
export const CAMPAIGN_START = '2026-09-04';

/**
 * The publication date for a day number, as an ISO date.
 *
 * Computed rather than typed out fifty times: a hand-written list develops a
 * duplicate or a skipped day the moment the schedule is edited, and the day
 * number is what the rest of the campaign is keyed on.
 */
export function dateForDay(day: number): string {
  const start = new Date(`${CAMPAIGN_START}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + (day - 1));
  return start.toISOString().slice(0, 10);
}

/** `/blog/<slug>`. The one place the blog's URL shape is written down. */
export const BLOG_BASE = '/blog';
export const postPath = (post: Pick<BlogPost, 'slug'>): string => `${BLOG_BASE}/${post.slug}`;

/**
 * The fifty articles, in publication order.
 *
 * Order is an SEO decision, not the order they were commissioned in: the eight
 * pillars go out in the first two weeks so that every cluster article published
 * afterwards has a live page to point at, and the narrow benchmark queries
 * ("is 40 wpm good") follow the broad ones they depend on.
 */
export const BLOG_POSTS: BlogPost[] = [
  {
    day: 1,
    slug: 'how-to-learn-touch-typing',
    title: 'How to Learn Touch Typing: A Beginner’s Step-by-Step Guide',
    seoTitle: 'How to Learn Touch Typing: A Beginner’s Guide',
    description:
      'Learn touch typing from scratch: home row anchors, which finger presses which key, how to practise, and how long it realistically takes to stop looking down.',
    lede: 'Eight stages, in the order they actually work. No pledge to never look down on day one, and no promise that it happens in a week.',
    primaryKeyword: 'how to learn touch typing',
    secondaryKeywords: [
      'learn touch typing', 'touch typing for beginners', 'touch typing lessons',
      'home row', 'finger placement', 'typing practice',
    ],
    searchIntent: 'How-to',
    audience: 'Complete beginners of any age',
    category: 'Touch typing',
    pillar: true,
    related: ['correct-finger-placement-for-touch-typing', 'how-long-to-learn-touch-typing', 'what-is-touch-typing'],
  },
  {
    day: 2,
    slug: 'how-to-type-faster',
    title: 'How to Type Faster: A Complete Guide to Improving Your Typing Speed',
    seoTitle: 'How to Type Faster: The Complete Speed Guide',
    description:
      'A practical guide to typing faster: what actually limits your speed, the six changes that raise it, and a training week you can repeat until the numbers move.',
    lede: 'Speed is not one skill. It is four, and most people spend their practice on the one that is already fine.',
    primaryKeyword: 'how to type faster',
    secondaryKeywords: [
      'improve typing speed', 'increase wpm', 'typing faster tips',
      'typing speed training', 'faster typing practice',
    ],
    searchIntent: 'How-to',
    audience: 'Anyone who can already type but wants more speed',
    category: 'Touch typing',
    pillar: true,
    related: ['typing-speed-vs-accuracy', 'how-to-reach-100-wpm', 'typing-mistakes'],
  },
  {
    day: 3,
    slug: 'what-is-a-good-typing-speed',
    title: 'What Is a Good Typing Speed? WPM by Age and Skill Level',
    seoTitle: 'What Is a Good Typing Speed? WPM by Age & Level',
    description:
      'What counts as a good typing speed, what the commonly quoted numbers actually measure, and honest benchmarks by age, skill level and the job you need it for.',
    lede: 'The number you are chasing depends entirely on what you are typing. Here is where the usual figures come from, and what they are worth.',
    primaryKeyword: 'what is a good typing speed',
    secondaryKeywords: [
      'good wpm', 'typing speed by age', 'wpm chart', 'average typing speed',
      'typing speed levels',
    ],
    searchIntent: 'Informational',
    audience: 'General users comparing themselves to a benchmark',
    category: 'Speed & tests',
    pillar: true,
    related: ['average-typing-speed', 'what-does-wpm-mean', 'is-60-wpm-good'],
  },
  {
    day: 4,
    slug: 'typing-for-kids-guide-for-parents',
    title: 'Typing for Kids: The Complete Guide for Parents',
    seoTitle: 'Typing for Kids: The Complete Parent’s Guide',
    description:
      'When to start, what good practice looks like at each age, how to handle two-finger habits, and how to keep typing practice short enough that it survives the term.',
    lede: 'Written for the parent, not the child. What to expect at each age, what to ignore, and the ten minutes that do the work.',
    primaryKeyword: 'typing for kids',
    secondaryKeywords: [
      'typing for children', 'teach kids to type', 'kids typing practice',
      'typing lessons for kids', 'keyboard skills for children',
    ],
    searchIntent: 'Informational',
    audience: 'Parents of children aged 5–13',
    category: 'Kids & parents',
    pillar: true,
    related: ['what-age-should-kids-learn-to-type', 'how-to-teach-a-child-to-type', 'typing-practice-for-kids-routine'],
  },
  {
    day: 5,
    slug: 'what-does-wpm-mean',
    title: 'What Does WPM Mean? How Typing Speed Is Calculated',
    seoTitle: 'What Does WPM Mean? How Typing Speed Is Measured',
    description:
      'WPM explained properly: the five-character word, net versus raw speed, how accuracy is folded in, and why two typing tests can disagree about the same typing.',
    lede: 'A "word" in WPM is five characters, including the space. Almost everything confusing about typing scores follows from that one convention.',
    primaryKeyword: 'what does wpm mean',
    secondaryKeywords: [
      'wpm meaning', 'words per minute typing', 'how is wpm calculated',
      'net wpm', 'raw wpm', 'cpm',
    ],
    searchIntent: 'Informational',
    audience: 'General users',
    category: 'Speed & tests',
    pillar: true,
    related: ['average-typing-speed', 'how-to-test-typing-speed', 'why-typing-speed-varies-between-tests'],
  },
  {
    day: 6,
    slug: 'what-is-touch-typing',
    title: 'What Is Touch Typing, and Why Is It Better Than Hunt-and-Peck?',
    seoTitle: 'What Is Touch Typing? Touch Typing vs Hunt-and-Peck',
    description:
      'Touch typing means typing without looking, using fixed finger assignments. Here is how it differs from hunt-and-peck, and what changes when you make the switch.',
    lede: 'The definition is simple. What it buys you is less obvious, and it is not mostly about speed.',
    primaryKeyword: 'what is touch typing',
    secondaryKeywords: [
      'touch typing definition', 'touch typing vs hunt and peck', 'hunt and peck typing',
      'touch typing meaning', 'benefits of touch typing',
    ],
    searchIntent: 'Informational',
    audience: 'General users, and parents deciding whether it matters',
    category: 'Touch typing',
    related: ['how-to-learn-touch-typing', 'correct-finger-placement-for-touch-typing', 'stop-looking-at-the-keyboard'],
  },
  {
    day: 7,
    slug: 'correct-finger-placement-for-touch-typing',
    title: 'The Correct Finger Placement for Touch Typing',
    seoTitle: 'Correct Finger Placement for Touch Typing',
    description:
      'Which finger presses which key, why the assignment is built the way it is, and the four placements almost every self-taught typist gets wrong.',
    lede: 'The full map, finger by finger, plus the specific swaps that quietly cost self-taught typists their accuracy.',
    primaryKeyword: 'correct finger placement for typing',
    secondaryKeywords: [
      'typing finger placement', 'which finger for which key', 'finger position keyboard',
      'touch typing fingers', 'keyboard finger chart',
    ],
    searchIntent: 'How-to',
    audience: 'Beginners and self-taught typists correcting technique',
    category: 'Touch typing',
    related: ['home-row-keys', 'how-to-learn-touch-typing', 'break-bad-typing-habits'],
  },
  {
    day: 8,
    slug: 'learn-touch-typing-as-an-adult',
    title: 'How to Learn Touch Typing as an Adult',
    seoTitle: 'How to Learn Touch Typing as an Adult',
    description:
      'Learning to touch type when you already type fast the wrong way: how to survive the slowdown, protect your working day, and rebuild technique in about six weeks.',
    lede: 'The hard part is not the keyboard. It is the fortnight where your new technique is slower than the habit you are replacing.',
    primaryKeyword: 'learn touch typing as an adult',
    secondaryKeywords: [
      'touch typing for adults', 'adult typing lessons', 'relearn typing',
      'typing practice for adults', 'learn to type as an adult',
    ],
    searchIntent: 'How-to',
    audience: 'Adults who type daily but never learned properly',
    category: 'Adults & work',
    pillar: true,
    related: ['break-bad-typing-habits', 'typing-practice-for-adults', 'learn-touch-typing-later-in-life'],
  },
  {
    day: 9,
    slug: 'science-of-touch-typing-muscle-memory',
    title: 'The Science Behind Touch Typing: How Muscle Memory Develops',
    seoTitle: 'The Science of Touch Typing and Muscle Memory',
    description:
      'What research on skilled typing actually shows: the two control loops behind fluent typing, the three stages of motor learning, and why typists cannot draw their own keyboard.',
    lede: 'Skilled typing is one of the most studied motor skills there is. What the research says is stranger, and more useful, than "practice makes perfect".',
    primaryKeyword: 'typing muscle memory',
    secondaryKeywords: [
      'science of touch typing', 'motor learning typing', 'how muscle memory works',
      'typing research', 'automaticity typing',
    ],
    searchIntent: 'Educational',
    audience: 'Curious learners, teachers and adults who want the mechanism',
    category: 'Science',
    pillar: true,
    related: ['how-your-brain-learns-to-type', 'why-repetition-makes-you-faster', 'accuracy-before-speed'],
  },
  {
    day: 10,
    slug: 'average-typing-speed',
    title: 'Average Typing Speed: How Does Your WPM Compare?',
    seoTitle: 'Average Typing Speed: How Does Your WPM Compare?',
    description:
      'What the average typing speed really is, why every quoted figure comes with a catch, and how to work out an honest comparison for your own age and typing.',
    lede: 'Everyone quotes an average. Almost nobody quotes where it came from, which is the part that decides whether it applies to you.',
    primaryKeyword: 'average typing speed',
    secondaryKeywords: [
      'average wpm', 'typical typing speed', 'average typing speed by age',
      'how fast do people type', 'typing speed comparison',
    ],
    searchIntent: 'Informational',
    audience: 'General users comparing their score',
    category: 'Speed & tests',
    related: ['what-is-a-good-typing-speed', 'what-does-wpm-mean', 'is-40-wpm-good'],
  },
  {
    day: 11,
    slug: 'how-long-to-learn-touch-typing',
    title: 'How Long Does It Take to Learn Touch Typing?',
    seoTitle: 'How Long Does It Take to Learn Touch Typing?',
    description:
      'An honest timeline for learning touch typing, stage by stage: when you stop looking down, when it stops feeling slow, and what changes the answer most.',
    lede: 'Four separate milestones, each with its own timeline. Conflating them is why the usual answers feel wrong.',
    primaryKeyword: 'how long does it take to learn touch typing',
    secondaryKeywords: [
      'learn to type timeline', 'how long to learn to type', 'touch typing how long',
      'typing practice time', 'weeks to learn typing',
    ],
    searchIntent: 'Informational',
    audience: 'Beginners deciding whether to commit',
    category: 'Touch typing',
    related: ['how-to-learn-touch-typing', 'stop-looking-at-the-keyboard', 'typing-practice-for-adults'],
  },
  {
    day: 12,
    slug: 'home-row-keys',
    title: 'Where Should Your Fingers Rest on a Keyboard? A Guide to the Home Row',
    seoTitle: 'Home Row Keys: Where Your Fingers Should Rest',
    description:
      'The home row explained: which keys your fingers rest on, what the bumps on F and J are for, and how to return to position without ever looking down.',
    lede: 'Eight keys, two bumps, and one habit that decides whether the rest of touch typing works.',
    primaryKeyword: 'home row keys',
    secondaryKeywords: [
      'home row typing', 'where do fingers rest on keyboard', 'asdf jkl',
      'f and j bumps', 'home row position',
    ],
    searchIntent: 'Informational',
    audience: 'Beginners and children learning position',
    category: 'Touch typing',
    related: ['correct-finger-placement-for-touch-typing', 'how-to-learn-touch-typing', 'stop-looking-at-the-keyboard'],
  },
  {
    day: 13,
    slug: 'typing-speed-vs-accuracy',
    title: 'Typing Speed vs Accuracy: Which Should You Improve First?',
    seoTitle: 'Typing Speed vs Accuracy: Which Comes First?',
    description:
      'Whether to train speed or accuracy first, what each error actually costs in seconds, and the accuracy band where pushing for more stops paying you back.',
    lede: 'Accuracy first, but not accuracy at any price. There is a band where chasing it further makes you slower overall.',
    primaryKeyword: 'typing speed vs accuracy',
    secondaryKeywords: [
      'accuracy or speed typing', 'typing accuracy importance', 'should i type faster or more accurately',
      'typing error cost', 'net wpm accuracy',
    ],
    searchIntent: 'Comparison',
    audience: 'Intermediate typists choosing what to train',
    category: 'Touch typing',
    related: ['accuracy-before-speed', 'improve-typing-accuracy', 'how-to-type-faster'],
  },
  {
    day: 14,
    slug: 'what-age-should-kids-learn-to-type',
    title: 'What Age Should Kids Learn to Type?',
    seoTitle: 'What Age Should Kids Learn to Type?',
    description:
      'The age to start typing depends on hand size and school demands, not a birthday. What to do at 5–6, 7–8 and 9 and up, and the one readiness test that matters.',
    lede: 'There is no magic age, but there is a readiness test, and it takes about thirty seconds to run.',
    primaryKeyword: 'what age should kids learn to type',
    secondaryKeywords: [
      'when should children learn typing', 'typing age for kids', 'best age to learn typing',
      'typing readiness', 'kids keyboard skills age',
    ],
    searchIntent: 'Informational',
    audience: 'Parents of children aged 4–10',
    category: 'Kids & parents',
    related: ['typing-for-kids-guide-for-parents', 'how-to-teach-a-child-to-type', 'typing-speed-for-kids-by-age'],
  },
  {
    day: 15,
    slug: 'how-to-test-typing-speed',
    title: 'How to Test Your Typing Speed Accurately',
    seoTitle: 'How to Test Your Typing Speed Accurately',
    description:
      'Most typing tests measure your best minute, not your typing. How to run a test that reflects real work, and the five conditions that quietly inflate a score.',
    lede: 'A typing test measures the text it gave you as much as it measures you. Here is how to get a number you can actually plan against.',
    primaryKeyword: 'how to test typing speed',
    secondaryKeywords: [
      'typing test accuracy', 'accurate typing test', 'measure typing speed',
      'typing speed test tips', 'wpm test',
    ],
    searchIntent: 'How-to',
    audience: 'General users and job applicants',
    category: 'Speed & tests',
    related: ['why-typing-speed-varies-between-tests', 'what-does-wpm-mean', 'average-typing-speed'],
  },
  {
    day: 16,
    slug: 'improve-typing-accuracy',
    title: 'How to Improve Typing Accuracy Without Slowing Down',
    seoTitle: 'How to Improve Typing Accuracy Without Slowing Down',
    description:
      'Accuracy drills that do not cost you speed: how to find the keys that cause most of your errors, and fix the transitions rather than the letters.',
    lede: 'Most errors come from a handful of transitions, not from the whole alphabet. Fixing them is a targeted job, not a general one.',
    primaryKeyword: 'how to improve typing accuracy',
    secondaryKeywords: [
      'typing accuracy tips', 'reduce typing errors', 'typing mistakes practice',
      'accurate typing', 'typing accuracy drills',
    ],
    searchIntent: 'How-to',
    audience: 'Typists whose accuracy is holding back their net speed',
    category: 'Touch typing',
    related: ['accuracy-before-speed', 'typing-speed-vs-accuracy', 'adaptive-typing-lessons'],
  },
  {
    day: 17,
    slug: 'stop-looking-at-the-keyboard',
    title: 'How to Stop Looking at the Keyboard When Typing',
    seoTitle: 'How to Stop Looking at the Keyboard When You Type',
    description:
      'A staged method for typing without looking down, from covering your hands to running full sentences blind, plus what to do when the habit creeps back.',
    lede: 'Willpower fails at this. Removing the option works. Here is the ladder, in the order that keeps you from giving up.',
    primaryKeyword: 'how to stop looking at the keyboard',
    secondaryKeywords: [
      'type without looking', 'typing without looking at keys', 'stop looking down typing',
      'blind typing practice', 'touch typing habit',
    ],
    searchIntent: 'How-to',
    audience: 'Beginners and self-taught typists',
    category: 'Touch typing',
    related: ['how-to-learn-touch-typing', 'home-row-keys', 'break-bad-typing-habits'],
  },
  {
    day: 18,
    slug: 'typing-for-students',
    title: 'Typing for Students: Why Keyboard Skills Matter',
    seoTitle: 'Typing for Students: Why Keyboard Skills Matter',
    description:
      'What typing speed changes for students: exams, note-taking, coursework and coding. Where the real benefit sits, and the speed past which it stops mattering.',
    lede: 'The benefit is not finishing essays faster. It is what your attention is free to do while your hands get on with it.',
    primaryKeyword: 'typing for students',
    secondaryKeywords: [
      'keyboard skills students', 'student typing speed', 'typing skills school',
      'typing for exams', 'note taking typing',
    ],
    searchIntent: 'Informational',
    audience: 'Secondary and university students, and their parents',
    category: 'Students & schools',
    pillar: true,
    related: ['typing-speed-for-students', 'typing-and-homework', 'typing-vs-handwriting'],
  },
  {
    day: 19,
    slug: 'typing-speed-for-kids-by-age',
    title: 'What Is a Good Typing Speed for Kids? WPM by Age',
    seoTitle: 'Good Typing Speed for Kids: WPM by Age',
    description:
      'Typing speed targets for children by age and school year, where those numbers come from, and why accuracy and technique matter far more before about age eleven.',
    lede: 'School targets are conventions, not measurements. Useful as a direction of travel, misleading as a verdict.',
    primaryKeyword: 'typing speed for kids by age',
    secondaryKeywords: [
      'good typing speed for kids', 'average wpm for children', 'kids wpm chart',
      'typing speed year 5', 'child typing benchmarks',
    ],
    searchIntent: 'Informational',
    audience: 'Parents and primary teachers',
    category: 'Kids & parents',
    related: ['typing-for-kids-guide-for-parents', 'what-age-should-kids-learn-to-type', 'what-is-a-good-typing-speed'],
  },
  {
    day: 20,
    slug: 'typing-mistakes',
    title: '10 Typing Mistakes That Are Slowing You Down',
    seoTitle: '10 Typing Mistakes That Are Slowing You Down',
    description:
      'The ten habits that cap typing speed, how to spot each one in your own typing, and the specific drill that fixes it. Most of them are invisible from the inside.',
    lede: 'Ten habits, each with the symptom you would notice and the drill that clears it.',
    primaryKeyword: 'typing mistakes',
    secondaryKeywords: [
      'common typing errors', 'bad typing habits', 'typing problems',
      'why am i a slow typist', 'typing technique mistakes',
    ],
    searchIntent: 'Informational',
    audience: 'Intermediate typists stuck at a plateau',
    category: 'Touch typing',
    related: ['break-bad-typing-habits', 'how-to-type-faster', 'improve-typing-accuracy'],
  },
  {
    day: 21,
    slug: 'typing-posture',
    title: 'The Best Sitting Position for Faster, More Comfortable Typing',
    seoTitle: 'Typing Posture: The Best Sitting Position to Type',
    description:
      'Typing posture that holds up over hours: chair and desk height, wrist and elbow angles, screen position, and the adjustments that matter most on a laptop.',
    lede: 'Posture will not make you fast. Bad posture will absolutely make you slow, and it does it gradually enough that you blame something else.',
    primaryKeyword: 'typing posture',
    secondaryKeywords: [
      'sitting position for typing', 'ergonomic typing', 'wrist position typing',
      'desk height typing', 'typing comfort',
    ],
    searchIntent: 'How-to',
    audience: 'Adults typing for hours, and anyone with wrist discomfort',
    category: 'Keyboards & ergonomics',
    related: ['mechanical-vs-membrane-keyboards', 'home-row-keys', 'typing-faster-at-work'],
  },
  {
    day: 22,
    slug: 'how-to-teach-a-child-to-type',
    title: 'How to Teach a Child to Type Without Making It Feel Like Homework',
    seoTitle: 'How to Teach a Child to Type Without the Battle',
    description:
      'A practical approach to teaching a child to type: session length, what to praise, how to handle resistance, and the rules that keep practice going past week two.',
    lede: 'The technique is the easy part. Keeping it going past the second week is the actual skill, and it is mostly about how you frame it.',
    primaryKeyword: 'how to teach a child to type',
    secondaryKeywords: [
      'teaching kids typing', 'help child learn typing', 'typing lessons for children',
      'kids typing motivation', 'teach typing at home',
    ],
    searchIntent: 'How-to',
    audience: 'Parents of children aged 6–12',
    category: 'Kids & parents',
    related: ['typing-for-kids-guide-for-parents', 'make-typing-practice-fun', 'typing-practice-for-kids-routine'],
  },
  {
    day: 23,
    slug: 'accuracy-before-speed',
    title: 'Why Typing Accuracy Should Come Before Speed',
    seoTitle: 'Why Typing Accuracy Should Come Before Speed',
    description:
      'The case for accuracy first, from motor learning: what practising an error actually trains, why speed built on shaky accuracy collapses, and how to sequence the two.',
    lede: 'Practising at a speed you cannot control does not just fail to help. It trains the mistake.',
    primaryKeyword: 'typing accuracy before speed',
    secondaryKeywords: [
      'accuracy first typing', 'why accuracy matters typing', 'typing errors practice',
      'slow down to type faster', 'typing technique accuracy',
    ],
    searchIntent: 'Educational',
    audience: 'Learners and teachers deciding how to sequence practice',
    category: 'Science',
    related: ['science-of-touch-typing-muscle-memory', 'typing-speed-vs-accuracy', 'improve-typing-accuracy'],
  },
  {
    day: 24,
    slug: 'typing-practice-for-adults',
    title: 'Typing Practice for Adults: A 15-Minute Daily Training Plan',
    seoTitle: 'Typing Practice for Adults: A 15-Minute Daily Plan',
    description:
      'A fifteen-minute daily typing plan for adults, split into warm-up, targeted drilling and real text, with a six-week progression and what to do on a bad day.',
    lede: 'Fifteen minutes, split three ways, repeated. The split matters more than the total.',
    primaryKeyword: 'typing practice for adults',
    secondaryKeywords: [
      'adult typing practice plan', 'daily typing practice', 'typing training plan',
      'typing exercises for adults', '15 minute typing practice',
    ],
    searchIntent: 'How-to',
    audience: 'Working adults improving typing around a job',
    category: 'Adults & work',
    related: ['learn-touch-typing-as-an-adult', 'best-way-to-practise-typing', 'break-bad-typing-habits'],
  },
  {
    day: 25,
    slug: 'is-40-wpm-good',
    title: 'Is 40 WPM Good? Understanding Typing Speed Benchmarks',
    seoTitle: 'Is 40 WPM Good? What That Speed Really Means',
    description:
      'What 40 WPM is enough for, what it holds back, and the three things worth checking about your typing before you decide 40 is a problem worth fixing.',
    lede: 'Forty is the speed where typing stops being the bottleneck for most everyday writing, and starts being one for a few specific jobs.',
    primaryKeyword: 'is 40 wpm good',
    secondaryKeywords: [
      '40 wpm typing speed', 'is 40 words per minute good', '40 wpm average',
      'typing speed benchmark', 'decent typing speed',
    ],
    searchIntent: 'Informational',
    audience: 'General users who just took a test',
    category: 'Speed & tests',
    related: ['is-60-wpm-good', 'average-typing-speed', 'what-is-a-good-typing-speed'],
  },
  {
    day: 26,
    slug: 'best-typing-games-for-kids',
    title: 'Best Typing Games for Kids: How Games Can Build Real Typing Skills',
    seoTitle: 'Best Typing Games for Kids That Build Real Skills',
    description:
      'How to tell a typing game that teaches from one that only entertains, the four features that matter, and how to use games alongside proper practice.',
    lede: 'The question is not whether typing games work. It is which mechanic the game rewards, because that is the habit your child will build.',
    primaryKeyword: 'typing games for kids',
    secondaryKeywords: [
      'best typing games children', 'fun typing games', 'typing practice games',
      'educational typing games', 'keyboard games for kids',
    ],
    searchIntent: 'Informational',
    audience: 'Parents and primary teachers',
    category: 'Kids & parents',
    related: ['make-typing-practice-fun', 'typing-for-kids-guide-for-parents', 'typing-practice-for-kids-routine'],
  },
  {
    day: 27,
    slug: 'how-your-brain-learns-to-type',
    title: 'How Your Brain Learns to Type Without Looking at the Keyboard',
    seoTitle: 'How Your Brain Learns to Type Without Looking',
    description:
      'How typing becomes automatic: the shift from conscious key-hunting to hierarchical control, why you cannot describe a layout you can type, and what that means for practice.',
    lede: 'Skilled typists genuinely do not know where the keys are, in the sense they could tell you. Their hands do. That gap explains a lot.',
    primaryKeyword: 'how the brain learns to type',
    secondaryKeywords: [
      'typing automaticity', 'implicit memory typing', 'typing without looking brain',
      'procedural memory keyboard', 'motor skill learning',
    ],
    searchIntent: 'Educational',
    audience: 'Curious learners and teachers',
    category: 'Science',
    related: ['science-of-touch-typing-muscle-memory', 'stop-looking-at-the-keyboard', 'why-repetition-makes-you-faster'],
  },
  {
    day: 28,
    slug: 'why-is-the-keyboard-qwerty',
    title: 'QWERTY Explained: Why Are Keyboard Letters Arranged This Way?',
    seoTitle: 'QWERTY Explained: Why Keyboards Are Arranged That Way',
    description:
      'Where QWERTY came from, what the evidence says about the jamming story, how it beat its rivals, and whether switching to Dvorak or Colemak is worth it today.',
    lede: 'The story you have heard is that QWERTY was designed to slow typists down. The evidence for that is thinner than the story suggests.',
    primaryKeyword: 'why is the keyboard qwerty',
    secondaryKeywords: [
      'qwerty history', 'who invented qwerty', 'qwerty vs dvorak',
      'keyboard layout history', 'colemak layout',
    ],
    searchIntent: 'Informational',
    audience: 'General users and the curious',
    category: 'Keyboards & ergonomics',
    related: ['mechanical-vs-membrane-keyboards', 'home-row-keys', 'correct-finger-placement-for-touch-typing'],
  },
  {
    day: 29,
    slug: 'break-bad-typing-habits',
    title: 'How to Break Bad Typing Habits You’ve Had for Years',
    seoTitle: 'How to Break Bad Typing Habits You’ve Had for Years',
    description:
      'Replacing an entrenched typing habit: why the old one keeps coming back under pressure, how to isolate a single fix, and a four-week schedule that holds.',
    lede: 'You cannot delete a habit. You can only build a stronger one and then win the situations where the old one used to fire.',
    primaryKeyword: 'break bad typing habits',
    secondaryKeywords: [
      'fix typing habits', 'unlearn hunt and peck', 'retrain typing technique',
      'bad typing form', 'correct typing habits',
    ],
    searchIntent: 'How-to',
    audience: 'Adults with years of self-taught technique',
    category: 'Adults & work',
    related: ['learn-touch-typing-as-an-adult', 'typing-mistakes', 'typing-practice-for-adults'],
  },
  {
    day: 30,
    slug: 'is-60-wpm-good',
    title: 'Is 60 WPM Good? What Your Typing Speed Says About Your Skill Level',
    seoTitle: 'Is 60 WPM Good? What That Speed Says About You',
    description:
      'What 60 WPM means in practice, what it usually implies about your technique, and the three limits that decide whether the next twenty words per minute come easily.',
    lede: 'Sixty is the speed at which technique stops being optional. Getting there by force is possible; getting past it that way is not.',
    primaryKeyword: 'is 60 wpm good',
    secondaryKeywords: [
      '60 wpm typing', 'is 60 words per minute fast', 'good typing speed 60',
      'above average typing speed', 'typing skill level',
    ],
    searchIntent: 'Informational',
    audience: 'Typists who have plateaued in the fifties or sixties',
    category: 'Speed & tests',
    related: ['is-40-wpm-good', 'how-to-reach-100-wpm', 'what-is-a-good-typing-speed'],
  },
  {
    day: 31,
    slug: 'typing-practice-for-kids-routine',
    title: 'Typing Practice for Kids: A Simple 10-Minute Daily Routine',
    seoTitle: 'Typing Practice for Kids: A 10-Minute Daily Routine',
    description:
      'A ten-minute daily typing routine for children, broken into four parts, with what to do on resistant days and how the routine changes as they improve.',
    lede: 'Ten minutes, four parts, done at the same time each day. Short enough to survive a school term, which is the only test that counts.',
    primaryKeyword: 'typing practice for kids',
    secondaryKeywords: [
      'daily typing routine children', 'kids typing exercises', '10 minute typing practice',
      'typing practice schedule', 'child typing drills',
    ],
    searchIntent: 'How-to',
    audience: 'Parents and home educators',
    category: 'Kids & parents',
    related: ['how-to-teach-a-child-to-type', 'typing-for-kids-guide-for-parents', 'make-typing-practice-fun'],
  },
  {
    day: 32,
    slug: 'adaptive-typing-lessons',
    title: 'How Adaptive Typing Lessons Can Target Your Weakest Keys',
    seoTitle: 'How Adaptive Typing Lessons Target Your Weak Keys',
    description:
      'How adaptive typing practice works: what gets measured per key and per transition, how a practice set is generated from it, and the failure modes to watch for.',
    lede: 'Adaptive practice is not a buzzword for "gets harder". It means the next exercise is built from the errors you just made.',
    primaryKeyword: 'adaptive typing lessons',
    secondaryKeywords: [
      'adaptive typing practice', 'weak key practice', 'personalised typing lessons',
      'typing algorithm', 'targeted typing drills',
    ],
    searchIntent: 'Educational',
    audience: 'Learners and teachers evaluating typing tools',
    category: 'Science',
    related: ['how-typing-apps-measure-progress', 'improve-typing-accuracy', 'best-way-to-practise-typing'],
  },
  {
    day: 33,
    slug: 'learn-touch-typing-later-in-life',
    title: 'Can You Learn Touch Typing Later in Life?',
    seoTitle: 'Can You Learn Touch Typing Later in Life?',
    description:
      'Whether adults and older learners can still learn touch typing, what genuinely changes with age, and how to adapt practice so the answer stays yes.',
    lede: 'Yes, and the reasons it is harder are not the ones people assume. Almost none of them are about the brain’s capacity to learn.',
    primaryKeyword: 'learn touch typing later in life',
    secondaryKeywords: [
      'typing for older adults', 'learn to type at 50', 'is it too late to learn typing',
      'seniors typing lessons', 'adult motor learning',
    ],
    searchIntent: 'Informational',
    audience: 'Adults over 40 and older learners',
    category: 'Adults & work',
    related: ['learn-touch-typing-as-an-adult', 'typing-practice-for-adults', 'science-of-touch-typing-muscle-memory'],
  },
  {
    day: 34,
    slug: 'kids-typing-with-two-fingers',
    title: 'How to Help Kids Stop Typing With Two Fingers',
    seoTitle: 'How to Help Kids Stop Typing With Two Fingers',
    description:
      'Why children default to two fingers, why the habit sticks, and a staged plan for replacing it without a fight or a collapse in their confidence.',
    lede: 'Two-finger typing is not laziness. It is the strategy that works fastest on day one, and children optimise for day one.',
    primaryKeyword: 'kids typing with two fingers',
    secondaryKeywords: [
      'stop hunt and peck kids', 'child types with two fingers', 'fix child typing habit',
      'children typing technique', 'teach proper typing fingers',
    ],
    searchIntent: 'How-to',
    audience: 'Parents and teachers of children aged 7–12',
    category: 'Kids & parents',
    related: ['how-to-teach-a-child-to-type', 'typing-for-kids-guide-for-parents', 'correct-finger-placement-for-touch-typing'],
  },
  {
    day: 35,
    slug: 'best-way-to-practise-typing',
    title: 'The Best Way to Practise Typing: Words, Sentences or Random Letters?',
    seoTitle: 'Words, Sentences or Random Letters? Typing Practice',
    description:
      'What each kind of typing practice material actually trains, when random letters beat real words, and how to build a session that uses all three deliberately.',
    lede: 'Each material trains something different. Choosing the wrong one is why practice can feel productive and change nothing.',
    primaryKeyword: 'best way to practise typing',
    secondaryKeywords: [
      'typing practice material', 'random words vs sentences typing', 'typing drills',
      'how to practise typing', 'typing exercises',
    ],
    searchIntent: 'Comparison',
    audience: 'Self-directed learners at any level',
    category: 'Science',
    related: ['adaptive-typing-lessons', 'why-repetition-makes-you-faster', 'typing-practice-for-adults'],
  },
  {
    day: 36,
    slug: 'touch-typing-for-programmers',
    title: 'Touch Typing for Programmers: Does Typing Speed Actually Matter?',
    seoTitle: 'Touch Typing for Programmers: Does Speed Matter?',
    description:
      'An honest answer for developers: where typing speed helps, where it genuinely does not, and why symbol fluency and never looking down matter far more than WPM.',
    lede: 'The usual answer is "typing is not the bottleneck", and it is half right. The half it misses is the one worth training.',
    primaryKeyword: 'touch typing for programmers',
    secondaryKeywords: [
      'typing speed programming', 'does typing speed matter developers', 'coding typing practice',
      'programmer typing', 'symbol typing practice',
    ],
    searchIntent: 'Informational',
    audience: 'Software developers',
    category: 'Adults & work',
    related: ['typing-faster-at-work', 'time-saved-by-typing-faster', 'how-to-reach-100-wpm'],
  },
  {
    day: 37,
    slug: 'typing-speed-for-students',
    title: 'Typing Speed for Students: What’s a Good WPM?',
    seoTitle: 'Typing Speed for Students: What’s a Good WPM?',
    description:
      'Realistic typing speed targets for secondary and university students, matched to the tasks that actually need them, and what to do if you are below them.',
    lede: 'Match the target to the task. Exam conditions, lecture notes and coursework each need a different number.',
    primaryKeyword: 'typing speed for students',
    secondaryKeywords: [
      'student wpm', 'good typing speed student', 'typing speed university',
      'note taking wpm', 'exam typing speed',
    ],
    searchIntent: 'Informational',
    audience: 'Secondary and university students',
    category: 'Students & schools',
    related: ['typing-for-students', 'typing-and-homework', 'what-is-a-good-typing-speed'],
  },
  {
    day: 38,
    slug: 'how-to-reach-100-wpm',
    title: 'How to Reach 100 WPM: A Practical Training Plan',
    seoTitle: 'How to Reach 100 WPM: A Practical Training Plan',
    description:
      'A structured plan for getting from around 70 to 100 WPM: the three limits that bind at that level, the drills for each, and a twelve-week progression.',
    lede: 'Past seventy, general practice stops working. What is left are three specific limits, and each needs its own drill.',
    primaryKeyword: 'how to reach 100 wpm',
    secondaryKeywords: [
      '100 wpm typing', 'type 100 words per minute', 'advanced typing practice',
      'typing speed plateau', 'fast typing training',
    ],
    searchIntent: 'How-to',
    audience: 'Advanced typists above roughly 70 WPM',
    category: 'Speed & tests',
    related: ['is-60-wpm-good', 'how-to-type-faster', 'best-way-to-practise-typing'],
  },
  {
    day: 39,
    slug: 'why-touch-typing-matters-for-kids',
    title: 'Why Touch Typing Is an Important Skill for Kids',
    seoTitle: 'Why Touch Typing Is an Important Skill for Kids',
    description:
      'The case for teaching children to touch type, built on what it frees up rather than on speed: attention, writing quality, and independence in assessed work.',
    lede: 'The argument for teaching it is not that children need to type fast. It is what a child stops spending attention on once they can.',
    primaryKeyword: 'why touch typing is important for kids',
    secondaryKeywords: [
      'benefits of typing for children', 'importance of typing skills', 'why kids should learn typing',
      'keyboard skills benefits', 'typing and writing quality',
    ],
    searchIntent: 'Informational',
    audience: 'Parents and educators making the case',
    category: 'Kids & parents',
    related: ['typing-for-kids-guide-for-parents', 'should-schools-teach-typing', 'typing-vs-handwriting'],
  },
  {
    day: 40,
    slug: 'why-repetition-makes-you-faster',
    title: 'Why Repetition Makes You a Faster Typist',
    seoTitle: 'Why Repetition Makes You a Faster Typist',
    description:
      'What repetition actually changes in typing, why gains shrink predictably as practice accumulates, and how to space and vary reps so they keep paying off.',
    lede: 'Repetition works, but not evenly, and not forever. Knowing the shape of the curve tells you when to change what you are repeating.',
    primaryKeyword: 'why repetition makes you faster at typing',
    secondaryKeywords: [
      'typing repetition practice', 'power law of practice', 'spaced practice typing',
      'typing drills repetition', 'deliberate practice typing',
    ],
    searchIntent: 'Educational',
    audience: 'Learners who want practice that compounds',
    category: 'Science',
    related: ['science-of-touch-typing-muscle-memory', 'best-way-to-practise-typing', 'how-your-brain-learns-to-type'],
  },
  {
    day: 41,
    slug: 'time-saved-by-typing-faster',
    title: 'How Much Time Can Faster Typing Save You at Work?',
    seoTitle: 'How Much Time Does Faster Typing Save at Work?',
    description:
      'Work out the real time saved by typing faster, using your own numbers rather than a marketing figure, and see where the saving stops being worth chasing.',
    lede: 'Do the arithmetic with your own numbers. It is smaller than the adverts claim and larger than the sceptics assume, for a reason worth understanding.',
    primaryKeyword: 'how much time does faster typing save',
    secondaryKeywords: [
      'typing speed productivity', 'time saved typing faster', 'typing efficiency work',
      'wpm productivity gain', 'typing speed roi',
    ],
    searchIntent: 'Informational',
    audience: 'Working professionals and managers',
    category: 'Adults & work',
    related: ['typing-faster-at-work', 'touch-typing-for-programmers', 'typing-practice-for-adults'],
  },
  {
    day: 42,
    slug: 'make-typing-practice-fun',
    title: 'How to Make Typing Practice Fun for Kids',
    seoTitle: 'How to Make Typing Practice Fun for Kids',
    description:
      'How to make typing practice something a child returns to: the difference between fun that motivates and fun that distracts, plus games that work at home.',
    lede: 'There is fun that carries the practice and fun that replaces it. The difference is whether the enjoyable part needs the typing.',
    primaryKeyword: 'make typing practice fun',
    secondaryKeywords: [
      'fun typing practice kids', 'typing motivation children', 'typing games home',
      'enjoyable typing lessons', 'keep kids typing',
    ],
    searchIntent: 'How-to',
    audience: 'Parents of children aged 6–12',
    category: 'Kids & parents',
    related: ['best-typing-games-for-kids', 'how-to-teach-a-child-to-type', 'typing-practice-for-kids-routine'],
  },
  {
    day: 43,
    slug: 'why-typing-speed-varies-between-tests',
    title: 'Why Your Typing Speed Changes Between Different Typing Tests',
    seoTitle: 'Why Your Typing Speed Differs Between Typing Tests',
    description:
      'Why the same typing scores differently on different tests: word difficulty, error handling, timing rules and text familiarity, and how to compare results fairly.',
    lede: 'Five design decisions separate one test from another, and each can move your score by more than a week of practice would.',
    primaryKeyword: 'why typing speed varies between tests',
    secondaryKeywords: [
      'different typing test results', 'typing test differences', 'why is my wpm different',
      'typing test comparison', 'inconsistent typing speed',
    ],
    searchIntent: 'Informational',
    audience: 'Anyone comparing scores across sites',
    category: 'Speed & tests',
    related: ['how-to-test-typing-speed', 'what-does-wpm-mean', 'how-typing-apps-measure-progress'],
  },
  {
    day: 44,
    slug: 'should-schools-teach-typing',
    title: 'Should Schools Still Teach Touch Typing?',
    seoTitle: 'Should Schools Still Teach Touch Typing?',
    description:
      'The case for and against teaching typing in schools, what changed now that assessment is often digital, and what a realistic school programme looks like.',
    lede: 'The strongest argument is not vocational any more. It is about assessment fairness, and it has become harder to dismiss.',
    primaryKeyword: 'should schools teach typing',
    secondaryKeywords: [
      'typing in schools', 'keyboarding curriculum', 'teaching typing primary school',
      'is typing still taught', 'school typing programme',
    ],
    searchIntent: 'Informational',
    audience: 'Teachers, school leaders and governors',
    category: 'Students & schools',
    related: ['typing-vs-handwriting', 'why-touch-typing-matters-for-kids', 'typing-for-homeschoolers'],
  },
  {
    day: 45,
    slug: 'typing-faster-at-work',
    title: 'Typing Faster at Work: Practical Techniques for Emails, Documents and Chat',
    seoTitle: 'Typing Faster at Work: Email, Docs and Chat',
    description:
      'Practical ways to type faster at work: the three text types that need different skills, the friction that is not typing at all, and what to actually practise.',
    lede: 'Most of what slows down a working day looks like typing and is not. Here is how to tell which part is which.',
    primaryKeyword: 'typing faster at work',
    secondaryKeywords: [
      'work typing speed', 'faster email typing', 'office typing skills',
      'typing productivity tips', 'business typing',
    ],
    searchIntent: 'How-to',
    audience: 'Office professionals',
    category: 'Adults & work',
    related: ['time-saved-by-typing-faster', 'typing-practice-for-adults', 'touch-typing-for-programmers'],
  },
  {
    day: 46,
    slug: 'mechanical-vs-membrane-keyboards',
    title: 'Mechanical vs Membrane Keyboards: Does Your Keyboard Affect Typing Speed?',
    seoTitle: 'Mechanical vs Membrane: Does Your Keyboard Matter?',
    description:
      'An honest comparison of mechanical and membrane keyboards for typing speed, accuracy and comfort, and which keyboard properties genuinely change your results.',
    lede: 'Switch type matters less than three things nobody argues about on forums: layout stability, key travel consistency and how the board sits under your hands.',
    primaryKeyword: 'mechanical vs membrane keyboard',
    secondaryKeywords: [
      'does keyboard affect typing speed', 'best keyboard for typing', 'mechanical keyboard typing',
      'membrane keyboard', 'keyboard switches typing',
    ],
    searchIntent: 'Comparison',
    audience: 'Typists choosing a keyboard',
    category: 'Keyboards & ergonomics',
    related: ['typing-posture', 'why-is-the-keyboard-qwerty', 'how-to-type-faster'],
  },
  {
    day: 47,
    slug: 'typing-and-homework',
    title: 'How Faster Typing Can Help Students With Homework and Assignments',
    seoTitle: 'How Faster Typing Helps With Homework and Essays',
    description:
      'Where typing speed genuinely changes homework and coursework outcomes, where it does not, and how a student should split practice around a full timetable.',
    lede: 'The gain is not in the minutes saved. It is in what a student can still think about while they write.',
    primaryKeyword: 'typing for homework',
    secondaryKeywords: [
      'typing speed homework', 'typing for assignments', 'student essay typing',
      'faster coursework typing', 'typing and writing quality',
    ],
    searchIntent: 'Informational',
    audience: 'Students aged 13+ and their parents',
    category: 'Students & schools',
    related: ['typing-for-students', 'typing-speed-for-students', 'typing-vs-handwriting'],
  },
  {
    day: 48,
    slug: 'how-typing-apps-measure-progress',
    title: 'How Typing Apps Measure Speed, Accuracy and Progress',
    seoTitle: 'How Typing Apps Measure Speed, Accuracy and Progress',
    description:
      'What typing software actually records, how per-key and per-transition timing works, and which metrics tell you something useful about your own progress.',
    lede: 'Under the score there are usually five separate measurements. Knowing what each one is for tells you which one to chase.',
    primaryKeyword: 'how typing apps measure progress',
    secondaryKeywords: [
      'typing metrics explained', 'typing app accuracy measurement', 'per key typing data',
      'inter key interval', 'typing consistency score',
    ],
    searchIntent: 'Educational',
    audience: 'Learners and teachers evaluating typing tools',
    category: 'Science',
    related: ['adaptive-typing-lessons', 'why-typing-speed-varies-between-tests', 'what-does-wpm-mean'],
  },
  {
    day: 49,
    slug: 'typing-for-homeschoolers',
    title: 'Typing for Homeschoolers: How to Add Keyboard Skills to Your Curriculum',
    seoTitle: 'Typing for Homeschoolers: Adding Keyboard Skills',
    description:
      'How to fit typing into a home education timetable: when to start, how much time it needs each week, how to assess it, and how to keep records that count.',
    lede: 'Typing is one of the few subjects where fifteen minutes a day genuinely beats an hour a week, which makes it easy to timetable.',
    primaryKeyword: 'typing for homeschoolers',
    secondaryKeywords: [
      'homeschool typing curriculum', 'home education keyboard skills', 'teaching typing at home',
      'homeschool computer skills', 'typing lesson plan home',
    ],
    searchIntent: 'How-to',
    audience: 'Home educators',
    category: 'Students & schools',
    related: ['should-schools-teach-typing', 'typing-practice-for-kids-routine', 'typing-for-kids-guide-for-parents'],
  },
  {
    day: 50,
    slug: 'typing-vs-handwriting',
    title: 'Typing vs Handwriting: What Does the Research Say About Learning?',
    seoTitle: 'Typing vs Handwriting: What the Research Says',
    description:
      'An honest look at the typing versus handwriting research, including the famous note-taking study, what replication attempts found, and what it means in practice.',
    lede: 'The headline finding is real, widely cited, and considerably shakier than its popularity suggests. Both halves of that matter.',
    primaryKeyword: 'typing vs handwriting',
    secondaryKeywords: [
      'handwriting vs typing notes', 'note taking research', 'is handwriting better for learning',
      'typing notes study', 'longhand vs laptop notes',
    ],
    searchIntent: 'Comparison',
    audience: 'Students, teachers and parents',
    category: 'Students & schools',
    related: ['typing-for-students', 'should-schools-teach-typing', 'why-touch-typing-matters-for-kids'],
  },
];

/** Slug → post, built once. */
const BY_SLUG = new Map(BLOG_POSTS.map((p) => [p.slug, p]));

export function postBySlug(slug: string): BlogPost | undefined {
  return BY_SLUG.get(slug);
}

/**
 * Posts whose publication date has arrived, newest first.
 *
 * The campaign is a drip, so the site must not show all fifty on day one — a
 * schedule that publishes everything at once is not a schedule. `showAll` is
 * how the development server and the blog's own preview escape that, so the
 * whole campaign is reviewable before it runs.
 */
export function publishedPosts(today: string, showAll = false): BlogPost[] {
  return BLOG_POSTS.filter((p) => showAll || dateForDay(p.day) <= today)
    .slice()
    .sort((a, b) => b.day - a.day);
}

/** Today as an ISO date, in UTC so the build and the browser agree. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
