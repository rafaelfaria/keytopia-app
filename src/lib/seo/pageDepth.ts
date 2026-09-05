/**
 * The second half of the audience and feature pages.
 *
 * These six pages carry the head terms the site most wants ("typing games",
 * "typing for kids", "typing for schools") and were the shortest pages on it,
 * between 443 and 550 words of unique content while the tool pages ran to two
 * thousand. The inversion was the problem: the pages competing for the hardest
 * queries were bringing the least to them.
 *
 * Nothing here is padding written to reach a word count. Every section answers
 * a question a person actually arrives with, and every claim is a fact about
 * how the product already works, taken from the curriculum, the game list, the
 * race code and the analytics engine rather than invented for the page.
 *
 * Kept separate from content.ts because that file is already the single source
 * for the copy the JSON-LD and llms.txt read, and this is page-body prose that
 * only the pages themselves render.
 */

import type { GuideSection } from './content';

/** Extra sections appended to a page body, keyed by path. */
export const PAGE_DEPTH: Record<string, GuideSection[]> = {
  '/curriculum': [
    {
      heading: 'Why the lessons are in this order',
      paragraphs: [
        'The order is decided by letter frequency and finger travel, not by the alphabet and not by '
        + 'where keys happen to sit on the board. The home row comes first because it is the '
        + 'position every other reach returns to, and because the eight home keys plus E and I '
        + 'already cover a surprising share of ordinary English. That means a learner is typing '
        + 'real words within the first few lessons rather than drilling nonsense, which matters: '
        + 'the movement you want to automate is the one you will actually use.',
        'After the home row, keys are introduced roughly in order of how much they cost you to '
        + 'lack. The strong index-finger reaches arrive next, then the common top-row letters, then '
        + 'the awkward outliers such as Q, Z, X and B that appear rarely but are almost always '
        + 'assigned to the wrong finger when people improvise. Capitals are taught with the '
        + 'opposite-hand shift from the very first capital, because same-hand shift is the single '
        + 'most common habit that has to be unlearned later, and nearly every sentence starts with '
        + 'one.',
        'The whole sequence is rebuilt for your layout. On QWERTZ, AZERTY, Dvorak or Colemak the '
        + 'letters sit under different fingers, so the frequency-first logic produces a different '
        + 'lesson order rather than the QWERTY order with the labels swapped.',
      ],
    },
    {
      heading: 'What a lesson contains',
      paragraphs: [
        'A lesson is short by design, usually a few minutes, because motor skills consolidate '
        + 'between sessions rather than during them. Practising a little on most days beats one '
        + 'long session a week, and a lesson long enough to become tiring is a lesson that ends by '
        + 'training fatigue.',
        'Each one introduces at most one new thing, then puts it straight into real words and then '
        + 'into punctuated sentences. The final lesson in a region is a check: it mixes everything '
        + 'the region taught, and it has to be cleared at the region target for accuracy before the '
        + 'next region opens. The gate is on accuracy first and speed second, deliberately. Errors '
        + 'practised are errors learned, and a learner waved through a region at 88% accuracy is '
        + 'being handed a habit to undo later.',
      ],
    },
    {
      heading: 'How long it takes',
      paragraphs: [
        'For an adult starting from hunt and peck, two to three weeks of daily practice is typical '
        + 'before you stop looking at the keyboard, and somewhere between two and six months of '
        + 'targeted practice before typing feels genuinely automatic. Children move more slowly per '
        + 'session and often faster overall, because they are not unlearning anything.',
        'The honest caveat is that these ranges are wide and individual results sit anywhere across '
        + 'them. What reliably shortens the timeline is frequency and correctness rather than hours '
        + 'logged, which is why the curriculum is built out of short lessons with a hard accuracy '
        + 'gate rather than long sessions with a speed target.',
      ],
    },
  ],

  '/typing-games': [
    {
      heading: 'What separates a training game from a distraction',
      paragraphs: [
        'The test is simple and most typing games fail it: does the mechanic reward the thing you '
        + 'are trying to learn? A game that scores raw speed rewards racing ahead of your '
        + 'controlled pace, which is the exact habit that produces plateaus. A game that requires '
        + 'watching your hands to aim structurally undoes the main skill you are building.',
      ],
      bullets: [
        'It names the skill it trains, so you can tell whether that is a skill you need.',
        'It rewards accuracy and rhythm rather than bursts of speed you cannot sustain.',
        'It does not require looking at the keyboard, or at anything that pulls your eyes off the text.',
        'Its results feed the same mastery map as the lessons, so playing is practice rather than a break from it.',
      ],
    },
    {
      heading: 'Games for children who cannot read fluently yet',
      paragraphs: [
        'Six of the games are built for pre-readers and early readers, where the task is single '
        + 'letters and short recognisable words rather than sentences. Each has an eight-level '
        + 'ladder that widens the letter set gradually, so a child who knows six letters has '
        + 'somewhere to play rather than being locked out until they know twenty-six.',
        'The design rule across all of them is that the reward follows care rather than time. A '
        + 'child cannot unlock anything by leaving a game running, and nothing in the kids track '
        + 'pays out for minutes spent. What earns progress is typing the right letter with the '
        + 'right finger, which is the only thing that transfers.',
      ],
    },
    {
      heading: 'How a game session counts as practice',
      paragraphs: [
        'Every keystroke in a game goes through the same measurement the lessons and the typing '
        + 'test use. Per-key response times and per-transition timings are recorded, the mastery '
        + 'map updates, and a key that keeps costing you time in a game will start appearing in '
        + 'your adaptive practice sets.',
        'That is the reason the games are not a separate wing of the product. A learner who only '
        + 'ever plays still gets measured, still gets their weak keys found, and still gets drills '
        + 'built from them. The games change what practice feels like without changing what it is.',
      ],
    },
  ],

  '/typing-for-kids': [
    {
      heading: 'What a child actually does in a session',
      paragraphs: [
        'A session is short, usually five to ten minutes, and has a shape a child can predict: a '
        + 'brief warm up on keys they already know, one new thing, then real words using it, then '
        + 'something they chose. Ending on the part they like is deliberate, and so is not treating '
        + 'it as the reward for surviving the rest. Framed as a bribe, the rest becomes the price of '
        + 'the fun, which is the message you least want to send about practising.',
        'The map is the spine of it. Each island is a region of the curriculum, each stop is a '
        + 'lesson, and finishing a stop visibly changes the map rather than adding a number to a '
        + 'counter. Children can see where they have been and what is next, which turns a long '
        + 'curriculum into a journey with a middle rather than a list with an end.',
      ],
    },
    {
      heading: 'How progress is shown, and what earns it',
      paragraphs: [
        'Nothing in the kids track rewards time spent. There is no daily minutes target, no streak '
        + 'that punishes a missed day, and no way to unlock anything by leaving the app open. '
        + 'Progress comes from clearing a stop at the accuracy the region asks for, which means the '
        + 'reward and the learning point are the same event.',
        'Rewards are cosmetic and collectable rather than competitive: stickers, map decorations '
        + 'and a guardian companion that travels with the explorer. There is no public leaderboard '
        + 'in the kids track, no ranking against other children, and no chat or messaging of any '
        + 'kind. Racing opponents are computer-controlled, and a private race room needs a join '
        + 'code that an adult or a teacher hands out.',
      ],
    },
    {
      heading: 'Starting before they can read',
      paragraphs: [
        'A child does not need to read fluently to start. Six starter games work at the level of '
        + 'single letters and short words, each with an eight-level ladder, so a four or five year '
        + 'old can build letter recognition and correct finger habits before any lesson asks them '
        + 'to type a sentence.',
        'Beginning early has one large advantage and one real risk. The advantage is that there is '
        + 'no two-finger habit to undo, which is the single biggest obstacle for adults. The risk is '
        + 'that a child left to improvise will build a hand-shifting habit that has to be relearned '
        + 'later, which is why covered hands and correct fingers matter more at this stage than any '
        + 'speed target.',
      ],
    },
    {
      heading: 'What a guardian sees',
      paragraphs: [
        'Up to four children share one account and one device, each with their own profile, mastery '
        + 'map and accessibility settings. The guardian view reports what was practised and what '
        + 'improved rather than how long the app was open, because minutes logged is the metric '
        + 'that is easiest to game and least connected to learning.',
        'The text a child types stays in the browser on your device. Only the finished result of an '
        + 'exercise is saved, so the words themselves never leave the machine.',
      ],
    },
  ],

  '/typing-for-schools': [
    {
      heading: 'Running it in a lesson',
      paragraphs: [
        'Pupils do not need accounts. A class can be opened with a join code, which is the whole of '
        + 'the setup for a lesson: no email addresses collected, no password resets, and no time '
        + 'lost at the start of a period to sign-in problems. Where a school does want progress to '
        + 'follow a pupil between devices, accounts exist, but the lesson works without them.',
        'A typical period runs as a short assigned lesson, then a private race room for the last '
        + 'few minutes. Race rooms are code-joined and closed: there is no public matchmaking, no '
        + 'chat, and no way for anyone outside the room to appear in it. A teacher can also assign '
        + 'a specific region rather than letting each pupil choose, which keeps a mixed class on '
        + 'the same material even when they are at different speeds within it.',
      ],
    },
    {
      heading: 'What the dashboard shows, and what it deliberately does not',
      paragraphs: [
        'The teacher view reports per-pupil accuracy, the keys and transitions each pupil is losing '
        + 'time on, and whether they cleared the region gate. It does not report minutes logged, '
        + 'because a pupil sitting in front of an open app is not evidence of anything and reporting '
        + 'it invites exactly the wrong behaviour from a class being measured on it.',
        'The two things software genuinely cannot see are the two things worth a teacher walking the '
        + 'room: whether hands are covered, and which fingers are actually moving. A pupil can reach '
        + 'a respectable speed with two or three improvised finger assignments and the software will '
        + 'not flag it, because from the outside the keystrokes look correct. That is the part of '
        + 'the lesson that stays human.',
      ],
    },
    {
      heading: 'Accessibility in a mixed class',
      paragraphs: [
        'Accessibility settings are per profile rather than per device, so a shared classroom '
        + 'machine presents each pupil their own configuration. That covers the things that decide '
        + 'whether a pupil can use the software at all: text size, contrast, reduced motion for '
        + 'pupils who find animation uncomfortable, and turning off sound entirely.',
        'Practice material stays age-appropriate as well as level-appropriate. Adaptive sets are '
        + 'generated from the weak transitions of one pupil, and a set optimised purely for weak '
        + 'transitions can drift into strings that are dense and discouraging, so the generator is '
        + 'constrained to real words at the reading level of the region.',
      ],
    },
    {
      heading: 'Data, and what leaves the school',
      paragraphs: [
        'The text a pupil types is not transmitted. Typing is processed in the browser and only the '
        + 'result of an exercise is stored, so the words themselves stay on the machine. There is no '
        + 'advertising in the product, nothing about a pupil is sold, and there is no third-party '
        + 'analytics built on what a class practises.',
        'The privacy policy sets out exactly what is held and who ever touches it, and a real person '
        + 'answers questions about it. Schools that need to review the data model before deploying '
        + 'anything are the reason that page is written to be read rather than survived.',
      ],
    },
  ],

  '/typing-races': [
    {
      heading: 'How the opponents work',
      paragraphs: [
        'The rivals are not a constant speed with a name attached. Each has a habit profile that '
        + 'behaves like a person: slow starters who settle and come back at you late, streaky '
        + 'sprinters who surge and then stall, steady typists who never spike and never fade. That '
        + 'matters for practice rather than atmosphere, because a rival that holds one exact pace '
        + 'teaches you to hold one exact pace, and real typing does not work that way.',
        'There are five fixed difficulties plus an adaptive rival that tracks your recent results '
        + 'and settles slightly above them. The adaptive one is the useful default: a race you win '
        + 'comfortably trains nothing, and a race you lose by half a screen trains you to panic.',
      ],
    },
    {
      heading: 'Racing your own previous run',
      paragraphs: [
        'You can race the ghost of your own best run on the same passage, which removes the one '
        + 'thing that makes racing an unreliable measurement: a different opponent, on a different '
        + 'passage, on a different day. Against your own ghost the passage and the conditions are '
        + 'fixed, so the difference is you.',
        'It is also the version of racing that suits a nervous learner. Nobody else sees it, there '
        + 'is nothing to lose in front of anyone, and the opponent is by definition beatable, '
        + 'because you have already done it once.',
      ],
    },
    {
      heading: 'Private rooms, and who can be in them',
      paragraphs: [
        'A room is opened with a join code and is closed to everyone without it. There is no public '
        + 'matchmaking, no lobby of strangers and no chat, in any race, ever. That is a fixed '
        + 'property of the feature rather than a setting a parent or a teacher has to find and '
        + 'switch on.',
      ],
    },
    {
      heading: 'When racing helps, and when it does not',
      paragraphs: [
        'Racing is good at one specific thing: sustaining a pace under mild pressure, which is a '
        + 'different skill from typing quickly when nothing is at stake. It is also the most '
        + 'reliable way to find out what breaks first when you are pushed, because whatever degrades '
        + 'in a race is usually the thing to drill next.',
        'It is a poor way to learn a key you do not yet own. Under pressure you revert to whatever '
        + 'is most automatic, so racing while a finger assignment is still new practises the old '
        + 'habit rather than the new one. The useful order is to build the movement in lessons and '
        + 'targeted drills, then race to find out whether it holds.',
      ],
    },
  ],

  '/typing-analytics': [
    {
      heading: 'What each number actually measures',
      paragraphs: [
        'A word in typing measurement is five characters including spaces, not an actual word, which '
        + 'is the convention that lets scores from different passages be compared at all. Gross WPM '
        + 'counts everything you typed. Net WPM subtracts the cost of errors, and it is the figure '
        + 'worth watching, because raw speed with poor accuracy is mostly a measurement of how fast '
        + 'you can create work for yourself.',
      ],
      bullets: [
        'Accuracy: the share of keystrokes correct on the first attempt, before any correction.',
        'Consistency: how even the intervals between your keystrokes are, which is the earliest signal that practice is working.',
        'Per-key response time: how long each individual key takes you, measured separately from the keys around it.',
        'Transition timing: how long each letter pair takes, which is where most lost time actually sits.',
      ],
    },
    {
      heading: 'What the population numbers actually are',
      paragraphs: [
        'The largest study of modern typing, Dhakal and colleagues at CHI 2018, recorded 136 '
        + 'million keystrokes from 168,960 people and reports a single population mean of 51.6 WPM '
        + 'with a standard deviation of 20.2. That spread is the important part: a standard '
        + 'deviation of 20 on a mean of 52 means the range of ordinary is very wide, and a number '
        + 'that sounds slow in isolation is often unremarkable.',
        'Two caveats travel with that figure, and both matter when you compare yourself to it. The '
        + 'participants were self-selected visitors to a typing-practice site, three quarters of '
        + 'them aged between eleven and thirty, so it describes people who chose to take a typing '
        + 'test rather than people in general. And the study publishes no breakdown by age, which '
        + 'is why the age tables circulating online are not traceable to it or to anything else '
        + 'comparable.',
      ],
    },
    {
      heading: 'Why transitions matter more than keys',
      paragraphs: [
        'At any reasonable speed the individual reach is rarely what is slow. The join is. Most '
        + 'people are surprised by how concentrated their slowness turns out to be, with a handful '
        + 'of letter pairs accounting for a disproportionate share of the loss, and the worst '
        + 'offenders are usually sequences that use the same finger twice in a row, where the finger '
        + 'has to travel, arrive, press and travel again with no chance to overlap the movement.',
        'This is also why an overall accuracy figure eventually stops being useful. A 97% average '
        + 'can comfortably hide 88% on four particular transitions, and those four are the entire '
        + 'reason your speed has stopped moving.',
      ],
    },
    {
      heading: 'The four-sighting minimum',
      paragraphs: [
        'No key is called weak until it has been seen at least four times. Typing data is noisy at '
        + 'small samples, and a single fumbled Z on a bad afternoon is not evidence of anything. '
        + 'Without a minimum, an analytics page confidently reports a different set of weak keys '
        + 'every session and sends you chasing noise.',
        'The same caution applies to reading a trend. Distinguishing a genuine weakness from a bad '
        + 'session realistically takes a few thousand keystrokes, which is a handful of sessions '
        + 'rather than one. The tracker compares one half of your history against the other rather '
        + 'than the last result against the previous one, for the same reason.',
      ],
    },
    {
      heading: 'Confusion pairs, and reading a plateau',
      paragraphs: [
        'Some errors are not random. When two keys are repeatedly typed for each other, that is a '
        + 'confusion pair, and it is a different fault from being slow: the movement is wrong rather '
        + 'than merely unpractised. Naming the pair matters, because the fix is to slow that '
        + 'specific pair down until the correct finger reliably wins, not to do more general '
        + 'practice.',
        'A plateau in the headline number is usually not a plateau in the underlying skill. '
        + 'Consistency generally improves before speed does, so during the weeks when WPM refuses '
        + 'to move, the variation between your keystrokes is often already tightening. That is the '
        + 'number to watch when the obvious one is flat.',
      ],
    },
  ],
  '/adaptive-practice': [
    {
      heading: 'What the engine is actually looking at',
      paragraphs: [
        'Two measurements drive everything: how long each key takes you, and how long each letter '
        + 'pair takes you. They are recorded separately because they fail separately. A key can be '
        + 'slow because the reach is unfamiliar, and a pair can be slow even when both of its keys '
        + 'are fast, because the join between them is where the hand has to reorganise.',
        'Both are noisy at small samples, so a key is not treated as weak until it has been seen at '
        + 'least four times. Without that floor the practice set would rebuild itself around one bad '
        + 'afternoon, and you would spend a week drilling a letter you were never actually slow on.',
      ],
    },
    {
      heading: 'Why frequency weighting matters',
      paragraphs: [
        'A slow, common transition costs you far more than a slow, rare one, so the two are not '
        + 'worth the same amount of practice. Weighting by how often a pattern actually occurs in '
        + 'English is what stops adaptive practice turning into a tour of your most exotic '
        + 'weaknesses while the pairs you meet in every third sentence stay slow.',
        'It is also what keeps the material readable. Practice generated purely to maximise weak '
        + 'transitions drifts towards dense, unnatural strings that are unpleasant to type and '
        + 'nothing like real writing, so the generator is constrained to real words and real '
        + 'sentences with your weak patterns concentrated inside them.',
      ],
    },
    {
      heading: 'What it cannot see',
      paragraphs: [
        'The engine measures what your hands produce, not how they produce it. Someone typing at 60 '
        + 'words per minute with two or three improvised finger assignments looks, from the outside, '
        + 'identical to someone typing correctly at 60, because the keystrokes and the timings are '
        + 'the same. Finger assignment is the one thing that has to be checked by a person, which is '
        + 'why the lessons teach it explicitly rather than leaving it to be inferred.',
      ],
    },
  ],

  '/typing-practice-modes': [
    {
      heading: 'Choosing a mode for what you are actually fixing',
      paragraphs: [
        'The modes exist because "practise more" is not a plan. Different faults need different '
        + 'material, and using the wrong material is the most common reason practice stops working: '
        + 'a person whose problem is four specific transitions can spend months on general passages '
        + 'and improve almost nothing, because those four pairs barely appear.',
      ],
      bullets: [
        'Slow on specific keys or pairs: targeted drills built from your own measurements.',
        'Accurate but not fluent: continuous prose, which is the only material that trains rhythm.',
        'Fluent on words but not on real writing: punctuation and capitals, where most people quietly lose time.',
        'Fine until you are under pressure: timed work and races, which is where habits revert.',
      ],
    },
    {
      heading: 'Why continuous prose is not interchangeable with word lists',
      paragraphs: [
        'Word lists make rhythm unnecessary and random letters make it impossible. Only continuous '
        + 'prose contains the thing that actually needs training, which is the transition between '
        + 'one word and the next, complete with the space, the capital and the punctuation that real '
        + 'writing puts there.',
        'This is also why a score on a familiar word list stops meaning much after a few attempts. '
        + 'By the fifth encounter you are partly measuring recall of the passage rather than how you '
        + 'type, which is a real measurement of something, just not of the thing you wanted.',
      ],
    },
    {
      heading: 'How long a session should be',
      paragraphs: [
        'Short and frequent beats long and occasional, because motor skills consolidate between '
        + 'sessions rather than during them. Ten minutes on most days does more than an hour once a '
        + 'week, and there is little benefit to grinding on once a session has stopped going well: '
        + 'the consolidation happens later regardless.',
      ],
    },
  ],
};
