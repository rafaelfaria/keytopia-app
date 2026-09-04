/**
 * The written content for the free tools.
 *
 * Kept as data rather than as JSX for the same reason the rest of
 * src/lib/seo/content.ts is: the page, the FAQPage structured data and
 * llms-full.txt all render from one source, so they cannot end up answering
 * the same question three different ways.
 *
 * The rule for what goes in here: it has to be worth reading by somebody who
 * already used the tool. Text that only exists to repeat the page title back
 * at a search engine makes the page worse for the person who landed on it, and
 * search engines have been able to tell the difference for years.
 */

import type { Faq, GuideSection } from './content';

export interface ToolContent {
  /** 50–120 words under the H1, above the tool. */
  intro: string;
  /** The supporting article, below the interactive part. */
  sections: GuideSection[];
  faqs: Faq[];
  /** Blog articles this tool genuinely leads on to. */
  reading: { path: string; label: string }[];
}

const HOW_WPM_WORKS: GuideSection = {
  heading: 'How WPM is calculated here',
  paragraphs: [
    'A "word" in words per minute is not a word. It is five characters, spaces included, which is the convention every typing test has used since typewriter-era research needed a unit that did not punish you for writing long words. So the formula is characters divided by five, divided by the number of minutes you spent.',
    'Every KeyTopia tool separates two versions of that. Gross WPM (also called raw) counts every keystroke you made, mistakes included. Net WPM counts only the characters that ended up inside a correctly typed word, which is the same rule the rest of KeyTopia scores lessons and races with. The gap between the two is the most useful number on the page: it is exactly what your mistakes cost you, in the units you care about.',
    'Accuracy is separate again. It is the share of keystrokes that hit their target on the first attempt, before any backspacing. A run can finish at 100% correct text and 91% accuracy, and that pairing tells you something specific: you are catching your errors, but you are paying for them twice, once to make them and once to fix them.',
  ],
};

const TRUSTWORTHY_RESULT: GuideSection = {
  heading: 'What makes a result trustworthy',
  paragraphs: [
    'Short tests flatter people. A fifteen-second sprint measures your burst speed on whichever words happened to come up, and burst speed runs well above the pace anyone holds for a paragraph. If you want a number that predicts how fast you actually work, use sixty seconds or longer, and take the median of three runs rather than the best of ten.',
    'Pasting is disabled in every typing field in this suite, and a run that receives a block of text at once is discarded rather than scored. That is not there to catch cheats, since there is no leaderboard to cheat on. It is there so that an accidental paste, or a browser autofilling a field, cannot silently hand you a result that is not yours.',
    'The clock starts on your first real keystroke, not when the page loads, and it stops the moment the time expires. Nothing you type after that changes the score. Timing comes from a monotonic clock rather than the wall clock, so a background tab or a laptop going to sleep cannot inflate or deflate the elapsed time.',
  ],
};

export const TOOLS_HUB_INTRO =
  'Eight free typing tools that actually run in your browser: speed tests, an accuracy test, a per-key weakness analysis, a WPM calculator, age benchmarks, a daily exercise and a progress tracker. No sign-up, no limit on attempts, no result hidden behind an email box. They share one typing engine and one definition of WPM, so a number from one of them means the same thing in all of them.';

export const TOOLS_HUB_SECTIONS: GuideSection[] = [
  {
    heading: 'Why these are free, and what the catch is',
    paragraphs: [
      'KeyTopia is a typing tutor. These tools are the measuring half of that, split out and given their own addresses because a measurement is useful on its own and because most people arrive wanting to know one number rather than wanting to enrol in anything.',
      'The catch, stated plainly: every tool ends by pointing at KeyTopia. Nothing is withheld to make that pointer more attractive. You get the full result, every time, with no attempt limit and no account, and if you never click through, the tool still did the thing it said it would.',
    ],
  },
  {
    heading: 'They share one engine',
    paragraphs: [
      'The eight tools are one typing engine with eight different questions asked of it. That matters more than it sounds: it is why the speed test and the timed challenge cannot disagree about your WPM, why the accuracy test and the weak-key analysis count a mistake the same way, and why a result saved from any of them fits in the same progress chart.',
      'It is the same engine the lessons, the games and the races run on, which is why a result you record here is directly comparable with what you see once you start practising properly.',
    ],
  },
  {
    heading: 'Where your results are kept',
    paragraphs: [
      'In your browser, and nowhere else. Results are stored in local storage on the device you typed on, as summaries: a date, a speed, an accuracy, a duration and a mistake count. The text you typed is never stored and never transmitted.',
      'That has an obvious limitation and one hidden benefit. The limitation is that clearing site data clears your history, and a result from your laptop will not appear on your phone. The benefit is that there is nothing to leak, nothing to sell, and nothing to ask you for an email address in order to unlock.',
    ],
  },
];

export const TOOLS_HUB_FAQS: Faq[] = [
  {
    question: 'Are these typing tools really free?',
    answer:
      'Yes, all of them, with no account, no attempt limit, no advertising and no paid tier. KeyTopia itself is free as well, so there is no upgrade being held back.',
  },
  {
    question: 'Do I need to sign in to see my results?',
    answer:
      'No. Every tool gives you the complete result immediately. Signing in is only useful if you want your typing history to follow you between devices, and even then the tools work exactly the same without it.',
  },
  {
    question: 'Do these tools work on a phone or tablet?',
    answer:
      'They run and they work, but a typing-speed result from an on-screen keyboard is not comparable with one from a physical keyboard, and the tools say so when they detect a touchscreen. The WPM calculator, the age benchmarks and the progress tracker are fully useful on any device.',
  },
  {
    question: 'Which tool should I start with?',
    answer:
      'The typing speed test, at sixty seconds. It gives you the number most people are looking for, and every other tool in the suite can pick that result up from there: the age benchmark will prefill it, the progress tracker will chart it, and the weak-key analysis will tell you which letters produced it.',
  },
  {
    question: 'How accurate are the results?',
    answer:
      'The measurement itself is exact: characters are counted, the clock is monotonic, and the arithmetic is one shared function. What varies is you. Typing speed swings by five to ten WPM between runs depending on the passage, your posture and how recently you last typed, which is why the tools encourage several runs and a median rather than treating one result as your speed.',
  },
];

export const TOOL_CONTENT: Record<string, ToolContent> = {
  '/tools/typing-speed-test': {
    intro:
      'A free typing speed test that runs in your browser. Choose 15, 30, 60 or 120 seconds, start typing, and get your words per minute, your accuracy, the number of characters you typed and the mistakes you left behind. There is no sign-up, no attempt limit, and the result never leaves your device. Sixty seconds is the default because it is the shortest test that produces a number worth quoting.',
    sections: [
      HOW_WPM_WORKS,
      {
        heading: 'Which duration to choose',
        paragraphs: [
          'Fifteen seconds measures burst speed. It is fun, it flatters, and it is the least predictive of how fast you work. Thirty seconds is a reasonable compromise when you are testing repeatedly and want to see change. Sixty seconds is the standard, and the length almost every published figure you will compare yourself against was measured over. Two minutes starts to measure endurance, which is a different skill and usually a slower number.',
          'If you are testing to track improvement, pick one duration and stay with it. Comparing a fifteen-second result in January against a two-minute result in March tells you nothing about either.',
        ],
      },
      TRUSTWORTHY_RESULT,
      {
        heading: 'What a typing test cannot tell you',
        paragraphs: [
          'It cannot tell you whether you are touch typing. Plenty of people reach forty or fifty WPM looking at the keyboard with four fingers, and the score looks identical to a trained typist at the same speed. The difference shows up in what happens next: the four-finger typist plateaus, because the strategy has a ceiling, while the touch typist keeps climbing.',
          'It cannot tell you why you are slow. A test reports the outcome; it does not separate "I do not know where the keys are" from "I know where they are and I hesitate" from "I am fast but I fix constant errors". Those three problems have three different fixes, and picking the wrong one wastes months. That is what the weak-key analysis and the accuracy test are for.',
          'And retaking it will not make you faster. Testing measures a skill without changing it. Fifteen focused minutes a day on the specific keys that are slow will move this number far more in two weeks than fifty more tests will.',
        ],
      },
    ],
    faqs: [
      {
        question: 'What is a good typing speed?',
        answer:
          'The largest study of modern typing, covering 168,960 people, measured an average of 51.6 words per minute. Around 40 WPM is comfortable for everyday work, 60 to 70 is fast, and above 90 is the territory of trained touch typists at full pace. Accuracy matters more than any of those numbers: 45 WPM at 98% beats 60 WPM at 88% for real work, because the second typist spends the difference on corrections.',
      },
      {
        question: 'How long should a typing test be?',
        answer:
          'Sixty seconds. It is long enough that a lucky run of easy words cannot dominate the score, and it is the duration most published averages were measured over, so your result is comparable with them.',
      },
      {
        question: 'Why is my typing speed different every time?',
        answer:
          'Because typing speed genuinely varies by five to ten WPM run to run, depending on the words that come up, how warmed up your hands are, and how much attention you are giving it. Take three tests and use the middle result rather than the best one.',
      },
      {
        question: 'Does this typing test work without an account?',
        answer:
          'Yes. There is no sign-up and no limit on attempts. Your result is stored in your own browser so the other tools in the suite can use it, and you can delete it from the progress tracker at any time.',
      },
      {
        question: 'Can I use this typing test on a phone?',
        answer:
          'You can, but the result is not comparable with a physical-keyboard result. Touchscreen typing uses one or two thumbs and a predictive keyboard, which measures something else entirely. Use a real keyboard for a number you want to compare or track.',
      },
    ],
    reading: [
      { path: '/blog/what-is-a-good-typing-speed', label: 'What is a good typing speed?' },
      { path: '/blog/how-to-type-faster', label: 'How to type faster' },
      { path: '/blog/what-does-wpm-mean', label: 'What does WPM mean?' },
      { path: '/blog/why-typing-speed-varies-between-tests', label: 'Why typing speed varies between tests' },
    ],
  },

  '/tools/wpm-calculator': {
    intro:
      'Work out words per minute from figures you already have. Enter a number of words or characters and how long it took, in seconds or minutes, and get gross WPM, net WPM and characters per minute, with the formula shown next to the answer. Useful when you are checking somebody else\'s result, converting a CPM figure, or working out what a target speed would mean in practice. It calculates instantly, with no sign-up.',
    sections: [
      {
        heading: 'The formula, in full',
        paragraphs: [
          'Gross WPM is characters divided by five, divided by minutes. If you are counting whole words rather than characters, the calculator multiplies your word count by five first, so the two routes give the same answer for the same typing.',
          'Net WPM subtracts a penalty of one word per uncorrected error per minute: net = gross minus (errors divided by minutes). This is the classic correction used in typing examinations, and it is deliberately harsh, because an error left in a document costs somebody else time to find. It is a different calculation from the net WPM the typing tests on this site report, which scores whole words off the finished text instead. Both are stated wherever they appear, and neither is quietly substituted for the other.',
          'Characters per minute is simply characters divided by minutes, with no division by five. CPM is common outside English-speaking countries and in typing tests for languages where five characters is a poor proxy for a word.',
        ],
      },
      {
        heading: 'Converting between the units you will meet',
        paragraphs: [
          'To go from CPM to WPM, divide by five. To go the other way, multiply by five. A 250 CPM result is 50 WPM, which is almost exactly the measured population average.',
          'Keystrokes per hour, which appears in data-entry job listings, is CPM multiplied by sixty. A commonly quoted 10,000 KPH requirement is about 167 CPM, or 33 WPM: below average for general typing, because data entry is usually numeric and measured differently.',
        ],
      },
      {
        heading: 'Why five characters, and not actual words',
        paragraphs: [
          'Counting real words would make your score depend on your vocabulary rather than on your typing. A minute spent on "the cat sat on the mat" is seven words; a minute spent on "internationalisation requires considerable administrative coordination" is five, despite being more than twice the keystrokes. Typing tests would then measure how short your words were.',
          'Five characters, spaces included, is the compromise the field settled on decades ago, and it is close to the mean word length of English prose once the space is counted. It is imperfect for other languages, which is why characters per minute is the more common unit in much of Europe, and it is why any WPM comparison across languages should be treated with suspicion.',
          'It also means the arithmetic is reversible, which is what makes this page possible. Any WPM figure can be turned back into a character count, any character count into a WPM figure, and a CPM result into either, without needing to know what was typed.',
        ],
      },
      {
        heading: 'When the calculator is the wrong tool',
        paragraphs: [
          'A number you calculated from a stopwatch and a word count is only as good as those two inputs. If you counted words by eye and started the timer with your other hand, the error bars are wider than the difference you are probably trying to detect.',
          'For anything you want to compare or track, take the actual test instead. It counts characters exactly, starts the clock on your first keystroke, and reports accuracy alongside speed, which a word count on its own cannot give you.',
        ],
      },
    ],
    faqs: [
      {
        question: 'How do you calculate words per minute?',
        answer:
          'Divide the number of characters you typed by five to get "words", then divide by the number of minutes you spent. Five characters is the standard definition of a word in typing measurement, so long words do not unfairly lower your score.',
      },
      {
        question: 'What is the difference between gross and net WPM?',
        answer:
          'Gross WPM counts everything you typed. Net WPM applies a penalty for errors. The classic penalty, used here, is one word per uncorrected error per minute, so ten errors in a two-minute test costs five WPM.',
      },
      {
        question: 'How do I convert CPM to WPM?',
        answer:
          'Divide characters per minute by five. 300 CPM is 60 WPM. To convert keystrokes per hour, divide by sixty to get CPM first, then by five.',
      },
      {
        question: 'Why does this calculator refuse zero or negative values?',
        answer:
          'Because dividing by zero minutes produces infinity, and a negative word count has no meaning. Rather than printing a nonsense number, the calculator tells you which field needs fixing.',
      },
    ],
    reading: [
      { path: '/blog/what-does-wpm-mean', label: 'What does WPM mean?' },
      { path: '/blog/how-to-test-typing-speed', label: 'How to test typing speed properly' },
      { path: '/blog/average-typing-speed', label: 'Average typing speed' },
    ],
  },

  '/tools/typing-accuracy-test': {
    intro:
      'A typing test where accuracy is the score and speed is the footnote. You type a passage of real sentences, with capitals, commas and apostrophes, as carefully as you can. The result reports your accuracy, how many characters landed, how many did not, how many corrections you made, and which specific keys produced the errors. Free, no sign-up, and no time limit pressuring you into mistakes.',
    sections: [
      {
        heading: 'Why accuracy is measured before speed',
        paragraphs: [
          'Every keystroke you make is a repetition, and repetitions build habits whether or not they were correct. Practising at 88% accuracy is practising the wrong movement roughly one time in eight, and those repetitions do not cancel out: they compete with the correct ones for the same motor pattern. This is why the standard advice is to slow down until accuracy recovers, and why it feels so counterproductive while you are doing it.',
          'The economics are also plainly in accuracy\'s favour. Every uncorrected error you go back for costs a backspace, a re-type and the pause where you noticed. A mistake is rarely worth one character; it is usually worth three or four, plus the interruption. That is why a careful typist at 45 WPM regularly finishes real work faster than a fast one at 60.',
        ],
      },
      {
        heading: 'What the numbers on this page mean',
        paragraphs: [
          'Accuracy is the share of keystrokes that were correct on the first attempt. Backspacing to fix something does not restore the accuracy figure, because the mistake still happened; it only restores the text.',
          'Corrections counts the backspaces you used. Read it against accuracy: high accuracy with many corrections means you are second-guessing text that was already right. Low accuracy with few corrections means errors are getting through into the finished text, which is the more expensive failure.',
          'Speed is reported, quietly, at the bottom. It is there so you can see the trade you made, not because it is what this page is for. Expect it to be lower than your speed-test result. That is the test working.',
        ],
      },
      {
        heading: 'Where accuracy usually breaks first',
        paragraphs: [
          'Almost nobody loses accuracy on the home row. It goes on the reaches: the top-row stretch to P and Q, the bottom-row drop to B and N, and above all anything that needs a shift. The little fingers do the most awkward work on a keyboard and get the least practice, which is why a capital letter at the start of a sentence is one of the most commonly fumbled keystrokes there is.',
          'The second place it goes is at speed changes. A word you know well comes out as a single burst, and the word after it needs a reach you have to think about. The error usually lands in the gap, on the first character of the harder word, because the hand was still travelling at the pace of the easy one. This is why an even rhythm is worth more to accuracy than raw care is.',
        ],
      },
      {
        heading: 'How to raise your accuracy',
        paragraphs: [
          'Slow down by about ten per cent, not by half. The goal is the slowest pace at which you still feel fluent, because dropping to a crawl teaches a different, equally unhelpful rhythm.',
          'Stop looking at the keyboard, even though it will make things worse for a week. Accuracy that depends on visual checking has a hard ceiling, because your eyes cannot be on the screen and the keys at once, and every glance is a pause you are paying for.',
          'Then work on the specific keys rather than on "accuracy" in general. The error report below your result names them. Three letters practised deliberately for a week will do more than a month of typing carefully in general and hoping.',
        ],
      },
    ],
    faqs: [
      {
        question: 'What is a good typing accuracy?',
        answer:
          '95% is the working threshold: below it, practice is reinforcing errors as much as correcting them. 98% and above is strong, and roughly matches the finished-text accuracy measured in large-scale typing research, where the average uncorrected error rate was 1.17%.',
      },
      {
        question: 'Should I fix my mistakes or type through them?',
        answer:
          'In a test, fix them: it reflects what you would do in real work, and the corrections themselves are a measurement worth having. In practice drills, it depends on the drill. What matters is being consistent, because a run where you ignored errors is not comparable with one where you fixed them.',
      },
      {
        question: 'Why is my accuracy lower here than on a speed test?',
        answer:
          'Because this passage has capitals, commas and apostrophes in it. A test made of lowercase common words never asks your little fingers to reach for a shifted key, which is exactly where most people\'s accuracy actually falls apart.',
      },
      {
        question: 'Does accuracy really matter more than speed?',
        answer:
          'For getting work done, yes, up to about 98%. Beyond that the returns flatten and speed becomes the thing worth working on. Below 95%, speed practice is close to wasted, because you are getting faster at making the same mistakes.',
      },
    ],
    reading: [
      { path: '/blog/improve-typing-accuracy', label: 'How to improve typing accuracy' },
      { path: '/blog/accuracy-before-speed', label: 'Why accuracy comes before speed' },
      { path: '/blog/typing-speed-vs-accuracy', label: 'Typing speed vs accuracy' },
      { path: '/blog/stop-looking-at-the-keyboard', label: 'How to stop looking at the keyboard' },
    ],
  },

  '/tools/timed-typing-challenge': {
    intro:
      'Pick a clock, from fifteen seconds to five minutes, and type until it runs out. The countdown is on screen, the score locks the moment time expires, and you get WPM, accuracy, correct words, characters typed and mistakes, plus a one-line result you can copy and send to somebody. Free, unlimited attempts, no account. There is no global leaderboard here, and no invented one either.',
    sections: [
      {
        heading: 'How the clock behaves',
        paragraphs: [
          'It starts on your first real keystroke, not when the page loads, so reading the passage first costs you nothing. It runs on a monotonic clock, which means it cannot be shifted by the system time changing or by the tab being backgrounded. When it hits zero the run finishes on whatever you had typed at that instant, and nothing typed afterwards can change the score.',
          'A word still in progress when the clock stops still earns credit for the characters that landed correctly, so a timer expiring mid-word does not silently discard the work.',
        ],
      },
      {
        heading: 'Picking a challenge length',
        paragraphs: [
          'Fifteen and thirty seconds are sprints. They measure how fast your hands can go when nothing has had time to tire, and they are the lengths where a personal best is most likely to happen. Sixty seconds is the honest one. Two and five minutes measure something the shorter runs cannot see at all: whether your accuracy holds up once concentration starts to cost effort.',
          'The five-minute challenge is worth doing occasionally even if you hate it. Most people\'s accuracy falls by two or three points somewhere in the fourth minute, and knowing where your own drop-off is tells you more about your real working speed than any sprint.',
        ],
      },
      TRUSTWORTHY_RESULT,
      {
        heading: 'Why there is no leaderboard on this page',
        paragraphs: [
          'A public leaderboard on an anonymous browser tool is not a ranking of typists. It is a ranking of people willing to script a browser, and everyone who has ever run one has watched it fill up with impossible numbers within a week.',
          'KeyTopia does have real boards, inside the app, where results come from accounts and are scoped to a division. If you want to race, the private rooms with a join code are the honest version of this: a real opponent, in real time, who you actually know.',
        ],
      },
    ],
    faqs: [
      {
        question: 'What is the best duration for a typing challenge?',
        answer:
          'Sixty seconds for a result you want to compare with published figures or your own history. Fifteen or thirty for a personal best. Five minutes when you want to know whether your accuracy survives sustained typing, which is the number that predicts real work.',
      },
      {
        question: 'Can I share my result?',
        answer:
          'Yes. The result panel has a copy button that puts a one-line summary of your score on the clipboard. Nothing is uploaded, and no link to a hosted result page is created, because that would mean storing your result on a server.',
      },
      {
        question: 'Is there a leaderboard?',
        answer:
          'Not on this page, deliberately. An anonymous public board with no accounts behind it cannot be defended against automation, and a fake one would be worse. KeyTopia has real leaderboards inside the app, and private race rooms you can open with a join code.',
      },
      {
        question: 'What happens if I stop typing partway through?',
        answer:
          'The clock keeps running, because that is what makes it a timed challenge. Your WPM will fall accordingly. If you want to stop and restart, the restart button resets the clock and gives you a new passage.',
      },
    ],
    reading: [
      { path: '/blog/how-to-type-faster', label: 'How to type faster' },
      { path: '/blog/how-to-test-typing-speed', label: 'How to test typing speed properly' },
      { path: '/blog/is-60-wpm-good', label: 'Is 60 WPM good?' },
    ],
  },

  '/tools/weak-key-analysis': {
    intro:
      'Most typing tests tell you a number. This one tells you which keys produced it. You type a passage built so that every letter of the alphabet appears several times, including the rare ones that ordinary English text barely uses, and the analysis reports the accuracy and response time of each key individually, which keys you confused with which, and then generates a practice drill aimed at the ones that cost you. Free, no sign-up.',
    sections: [
      {
        heading: 'Why the passage looks the way it does',
        paragraphs: [
          'Ordinary English is a terrible test of a keyboard. The letter E turns up about a hundred and twenty times more often than Z, so a normal passage will have measured your E thoroughly and your Z not at all. If a report on that basis stayed silent about Z, it would be leaving out the letter most likely to be your problem.',
          'So the passage here is weighted: real words, chosen so that the rare letters each appear several times, shuffled in with common ones so it still reads as typing rather than as a spelling list. It is not a pangram, which only guarantees one appearance of each letter, and one appearance proves nothing.',
        ],
      },
      {
        heading: 'What counts as a weak key',
        paragraphs: [
          'A key must be seen at least four times before this tool will say anything about it, and the count is printed next to every verdict so you can weigh it yourself. Below that threshold the arithmetic is not meaningful: one miss out of one appearance is a 0% accuracy that means nothing at all, and telling somebody their R is weak on that basis sends them off to practise the wrong thing for a fortnight.',
          'Two things can mark a key as weak. The obvious one is errors: you pressed something else. The quieter one is hesitation, where you hit the key correctly but consistently took much longer to find it than you took for your other keys. The second is often the more useful finding, because it is invisible in an accuracy score and it is exactly what disappears when a key finally becomes automatic.',
          'Keys the run did not see often enough are listed separately rather than dropped, so you can tell "this key was fine" apart from "this key was not tested".',
        ],
      },
      {
        heading: 'Confusions, and why the pair matters more than the key',
        paragraphs: [
          'When the analysis can identify which key you pressed instead of the right one, it reports the pair. This is a genuinely different diagnosis. Missing R at random suggests you do not know where R is. Typing E where R was wanted, repeatedly, suggests your right index finger is anchoring one key to the left, which is a posture problem with a posture fix and nothing to do with knowing the alphabet.',
          'The most common confusions are neighbours on the same finger, and mirror pairs across the two hands. Both are fixed by re-establishing the home-row anchor rather than by drilling the individual letter.',
        ],
      },
      {
        heading: 'The drill this produces',
        paragraphs: [
          'The follow-up exercise is generated from your own weakest keys, using real words that contain them, with short repetition chunks between the words for the reps. You can run it immediately on the same page, as many times as you like.',
          'This is a smaller version of what KeyTopia does continuously. Inside the app, the same per-key map is kept across every session you ever type, so the practice text is rebuilt from thousands of keystrokes instead of one passage, and it updates as keys move from weak to reliable. The tool here is the same idea with a much shorter memory.',
        ],
      },
    ],
    faqs: [
      {
        question: 'How many mistakes make a key "weak"?',
        answer:
          'It is a rate, not a count, and it needs at least four sightings of the key before any judgement is made. One miss out of one appearance is not evidence. The tool prints the attempt count next to every key so you can see how much weight the verdict deserves.',
      },
      {
        question: 'Why do I keep hitting the wrong key in the same place?',
        answer:
          'Usually because a finger has drifted off its home-row anchor, so every reach from it lands one key out. The confusion list on your result names the specific pair. Re-anchoring on the F and J bumps, and then re-typing the pair slowly, fixes it faster than drilling the letter on its own.',
      },
      {
        question: 'Can a key be weak if I never get it wrong?',
        answer:
          'Yes, and it is common. If you hit a key correctly but take twice as long to find it as your other keys, it is not automatic yet. That hesitation is invisible in an accuracy score and is often the single biggest thing holding a speed back.',
      },
      {
        question: 'How long does the analysis take?',
        answer:
          'The passage is about ninety words, so two to four minutes for most people. It is untimed on purpose: rushing it produces errors caused by hurry rather than by the keys, which is the opposite of what the analysis is trying to see.',
      },
      {
        question: 'Does this work on a Dvorak or Colemak layout?',
        answer:
          'The analysis works on any layout, because it reports on characters rather than on physical key positions. The confusion pairs are still meaningful, though the "neighbouring key" interpretation assumes QWERTY. KeyTopia proper is layout-aware and adjusts its lessons for QWERTY, QWERTZ, AZERTY, Dvorak and Colemak.',
      },
    ],
    reading: [
      { path: '/blog/correct-finger-placement-for-touch-typing', label: 'Correct finger placement for touch typing' },
      { path: '/blog/improve-typing-accuracy', label: 'How to improve typing accuracy' },
      { path: '/blog/stop-looking-at-the-keyboard', label: 'How to stop looking at the keyboard' },
      { path: '/blog/home-row-keys', label: 'The home row keys' },
    ],
  },

  '/tools/daily-typing-exercise': {
    intro:
      'One typing exercise a day, the same one for everybody who opens the page on that date, and a new one tomorrow. It takes three to ten minutes depending on how fast you type, and it mixes common words, full sentences with punctuation, and the letter combinations people habitually fumble. Your results and your streak are kept in your own browser, with no account and no server involved.',
    sections: [
      {
        heading: 'How the same exercise reaches everyone',
        paragraphs: [
          'The date is the seed. The exercise is generated from the calendar day by a deterministic function, so every browser that asks for the fourth of September produces character-for-character the same passage, without a database, an API call or anything stored anywhere. Tomorrow the seed changes and so does the exercise.',
          'This is not merely an implementation detail. It means the page works offline once loaded, it cannot be slow because a server is slow, and there is no request recording that you turned up.',
        ],
      },
      {
        heading: 'Why daily beats long',
        paragraphs: [
          'Typing is a motor skill, and motor skills consolidate between sessions rather than during them. The research on distributed practice is unusually consistent: the same total number of minutes produces substantially more improvement spread across many short sessions than concentrated into a few long ones. Ten minutes a day genuinely outperforms seventy minutes on a Sunday.',
          'There is a second reason, less scientific and more practical. Ten minutes is short enough that you will actually do it on a bad day, and the sessions you do on bad days are what turn practice into a habit rather than a project.',
        ],
      },
      {
        heading: 'About the streak',
        paragraphs: [
          'The streak counts consecutive days on which you finished the exercise, and it lives in your browser. Yesterday still counts as a live streak, because the day is not over yet and a counter that resets at midnight punishes you for the clock rather than for skipping.',
          'Only your best run of a given day is kept, so a second attempt can never make the day look worse than the first one did. And when you break a streak, nothing is taken away from you: the results stay in the tracker, because they happened.',
        ],
      },
      {
        heading: 'What to do with the ten minutes',
        paragraphs: [
          'The best time is whenever you are already at the keyboard for something else. A practice session that requires you to sit down specially is one you will negotiate with; one that happens in the first ten minutes of work you were doing anyway is one you will still be doing in March.',
          'Type the exercise once at a comfortable pace, and look at the accuracy figure before the speed one. If it is below 95%, run it again about ten per cent slower rather than trying again harder. If it is above 98%, run it again slightly faster than feels safe. That single decision, made daily, is most of what deliberate practice means here.',
          'Once a week, take the weak-key analysis instead and let it tell you what to aim the next few days at.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Is the daily exercise the same for everyone?',
        answer:
          'Yes. It is generated from the calendar date, so every visitor on the same day gets the same passage. It changes at local midnight.',
      },
      {
        question: 'How long should I practise typing each day?',
        answer:
          'Ten to fifteen minutes, daily, beats an hour once a week by a wide margin. Motor skills consolidate between practice sessions, so the number of sessions matters more than the length of each one.',
      },
      {
        question: 'Do I lose my streak if I miss a day?',
        answer:
          'The streak resets, but nothing else does. Your recorded results stay in the progress tracker, because you did type them. The streak is a nudge, not a scoring system.',
      },
      {
        question: 'Can I do yesterday\'s exercise?',
        answer:
          'No, and that is the point of a daily. If you want unlimited practice text, the typing speed test generates a fresh passage every run, and KeyTopia proper builds practice text from your own weak keys on demand.',
      },
      {
        question: 'Does the streak sync between my devices?',
        answer:
          'No. It is stored in the browser you typed in. Cross-device history is what a KeyTopia account is for, and it is free.',
      },
    ],
    reading: [
      { path: '/blog/best-way-to-practise-typing', label: 'The best way to practise typing' },
      { path: '/blog/typing-practice-for-adults', label: 'Typing practice for adults' },
      { path: '/blog/why-repetition-makes-you-faster', label: 'Why repetition makes you faster' },
      { path: '/blog/typing-practice-for-kids-routine', label: 'A typing practice routine for kids' },
    ],
  },

  '/tools/typing-speed-by-age': {
    intro:
      'Compare a typing speed against what has actually been measured and what schools actually aim at, with the two kept firmly apart. Enter a WPM figure, or use the result from a test you took here, choose an age, and see how it sits. Every number on this page carries its source, and where reliable data for an age group does not exist, the page says so rather than inventing a figure to fill the gap.',
    sections: [
      {
        heading: 'Why there is no simple table',
        paragraphs: [
          'Search for "average typing speed by age" and you will find neat tables running from six years old to sixty, quoted confidently and usually without a source. Almost none of them trace back to a measurement. They are recycled from each other, and several trace back eventually to a single vendor\'s instructional guidance restated as though it were a research finding.',
          'The largest study of modern typing ever conducted, Dhakal and colleagues at CHI 2018, recorded 136 million keystrokes from 168,960 people. It reports one population mean, 51.6 WPM with a standard deviation of 20.2, and it does not publish a breakdown by age. Its participants were also self-selected visitors to a typing-practice site, three quarters of them aged between eleven and thirty. It is the best evidence there is, and it still cannot tell you what a typical forty-five-year-old types at.',
          'So this page shows three separate kinds of thing, labelled: what a study measured, what an educator recommends aiming at, and what is in wide circulation as a rule of thumb. They are not the same, and presenting them as though they were is how the tidy fictional tables get made in the first place.',
        ],
      },
      {
        heading: 'What the evidence does support',
        paragraphs: [
          'Adults, in aggregate, average around 50 WPM, and formal training moves that surprisingly little: 54.4 for people reporting training against 49.0 for those without. How much you type matters more than whether anybody taught you.',
          'Children get faster with age and practice in a way that is well documented in direction if not in precise magnitude. A pilot study of American schoolchildren measured roughly 9 WPM in fifth grade and roughly 18 in eighth, which is a doubling over three years and a useful shape even though the sample was small.',
          'And there is one threshold with a genuine rationale behind it rather than a round number: about 10 WPM, which is roughly the speed a child of primary-school age writes by hand. Below it, typing is the bottleneck and a child composes worse on a keyboard than on paper. Above it, the keyboard stops getting in the way. That is a far more useful target for a nine-year-old than any average.',
        ],
      },
      {
        heading: 'How to talk to a child about their result',
        paragraphs: [
          'A benchmark is not a mark. A child comparing themselves against a recommended target is looking at a number an adult chose for a curriculum, on a skill they are in the middle of acquiring, and the honest reading of any result below it is "not yet", never "behind".',
          'The guidance for children under about nine is explicitly to set no speed expectation at all and to work only on technique and accuracy. If your child is in that bracket, the speed figure is genuinely not the thing to look at, and this page will say that rather than showing them a gap.',
          'The comparison worth making is with the same child last month, which is what the progress tracker is for.',
        ],
      },
    ],
    faqs: [
      {
        question: 'What is the average typing speed?',
        answer:
          'The largest measurement available, covering 168,960 people, found a mean of 51.6 words per minute with a standard deviation of 20.2. That sample skewed young and self-selected, so treat it as the best available figure rather than a population census.',
      },
      {
        question: 'What is a good typing speed for a 10-year-old?',
        answer:
          'There is no reliable measured average for a specific age. A commonly recommended target for that age is around 17 WPM, and a pilot study of fifth graders measured around 9 to 10. The more useful goal is about 10 WPM, the speed at which typing stops being slower than handwriting for a child.',
      },
      {
        question: 'Does typing speed decline with age?',
        answer:
          'Less than people expect. Research on older typists found they compensate for slower reaction times by reading further ahead in the text, so overall speed holds up better than raw tapping speed would predict. Precise averages by decade are not something the large studies publish.',
      },
      {
        question: 'Why do other sites show a typing speed chart by age and this one does not?',
        answer:
          'Because the data for it does not exist. Building the chart would mean inventing numbers or restating somebody\'s instructional guidance as though it were a measurement, and both would make this page confidently wrong rather than usefully honest.',
      },
      {
        question: 'At what age should a child start learning to type?',
        answer:
          'Guidance generally suggests the second half of primary school, around eight or nine, once handwriting is established, with no speed expectation before then and a focus on technique instead. Hand size and the reach across the keyboard are the practical constraint.',
      },
    ],
    reading: [
      { path: '/blog/typing-speed-for-kids-by-age', label: 'Typing speed for kids by age' },
      { path: '/blog/average-typing-speed', label: 'Average typing speed' },
      { path: '/blog/typing-speed-for-students', label: 'Typing speed for students' },
      { path: '/blog/what-age-should-kids-learn-to-type', label: 'What age should kids learn to type?' },
    ],
  },

  '/tools/typing-progress-tracker': {
    intro:
      'A record of your typing results over time, kept in your browser. Results from the tests on this site are saved here with one click, and you can add results from anywhere else by hand. It shows your latest and best speed, your average, how many sessions you have logged and whether your recent runs are actually faster than your older ones. Free, no account, and you can delete any of it at any time.',
    sections: [
      {
        heading: 'Reading the trend rather than the last run',
        paragraphs: [
          'A single typing result carries a lot of noise. Speed genuinely swings by five to ten WPM between runs depending on the passage, your posture and how warmed up you are, which means the difference between today and yesterday is usually telling you nothing at all.',
          'The trend figure here deliberately does not compare your first result with your last. It compares the average of your older half against the average of your newer half, which is far harder for one fluke run to distort in either direction. It stays hidden until you have six results, because below that the comparison would be two runs against two runs.',
        ],
      },
      {
        heading: 'What a realistic improvement curve looks like',
        paragraphs: [
          'Beginners improve fastest and most visibly: going from 20 to 35 WPM can happen in a few weeks of daily practice, because most of the gain is simply learning where the keys are. From 40 to 60 is slower, usually a few months, and the gains come from consistency rather than hand speed. Past 70 the curve flattens hard, and progress arrives in one or two WPM increments over months.',
          'Plateaus are normal and are not a sign that practice has stopped working. The usual cause of a long one is that speed practice has been substituted for accuracy work, and the ceiling being hit is the error rate rather than the hands. Checking your accuracy trend against your speed trend on this page will usually show it.',
        ],
      },
      {
        heading: 'Keeping a record that is worth keeping',
        paragraphs: [
          'Use one test duration. A sixty-second result and a fifteen-second result are not the same measurement, and mixing them produces a chart that mostly records which button you pressed.',
          'Log the middling run, not the best one. A personal-best chart only ever records your luckiest days and will convince you that you have stopped improving the moment you have an unlucky month.',
          'And record accuracy alongside speed, which this tracker does automatically. Speed rising while accuracy falls is not progress; it is a trade, and usually a bad one.',
        ],
      },
      {
        heading: 'Your data, and its limits',
        paragraphs: [
          'Everything on this page lives in your browser\'s local storage on this device. Nothing is uploaded. That means clearing site data clears it, a private window will not see it, and a result from your laptop will not appear on your phone.',
          'A free KeyTopia account removes those limits by syncing history across devices, and it also keeps far more than this page does: per-key mastery across every session, rhythm analysis, records and a practice calendar. But nothing on this page requires it.',
        ],
      },
    ],
    faqs: [
      {
        question: 'Where are my typing results stored?',
        answer:
          'In your browser\'s local storage, on the device you typed on. They are never uploaded. Only summaries are kept: date, speed, accuracy, duration and mistake count. The text you typed is never stored.',
      },
      {
        question: 'How often should I test my typing speed?',
        answer:
          'Once or twice a week is plenty. Testing daily mostly measures the noise between runs, and it tempts you into practising tests instead of practising typing.',
      },
      {
        question: 'How fast should I expect to improve?',
        answer:
          'From a beginner start, 10 to 15 WPM in the first month of daily practice is common. From 40 upwards, a few WPM a month is a good rate. Above 70, progress is measured in single WPM over months.',
      },
      {
        question: 'Can I add results from another typing site?',
        answer:
          'Yes. There is a form for entering a date, speed, accuracy and duration by hand, so a history from elsewhere can live alongside your results from this site.',
      },
      {
        question: 'How do I delete my typing history?',
        answer:
          'Every row has a delete button, and there is a button to clear everything at once. Both take effect immediately, and since nothing was ever uploaded there is no second copy anywhere to ask about.',
      },
    ],
    reading: [
      { path: '/blog/how-typing-apps-measure-progress', label: 'How typing apps measure progress' },
      { path: '/blog/how-long-to-learn-touch-typing', label: 'How long does it take to learn touch typing?' },
      { path: '/blog/why-typing-speed-varies-between-tests', label: 'Why typing speed varies between tests' },
    ],
  },
};

export function contentForPath(path: string): ToolContent {
  const c = TOOL_CONTENT[path];
  if (!c) throw new Error(`No tool content registered for ${path}`);
  return c;
}
