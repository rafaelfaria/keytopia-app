/** Articles for days 36-40. */
export const DAYS_36_40: Record<string, string> = {
  'touch-typing-for-programmers': `
Typing speed is not what makes you a better programmer, and the usual dismissal, "typing isn't the bottleneck, thinking is", is half right. The half it misses is that for a developer the valuable skill is not words per minute at all. It is symbol fluency and never looking down, because code is dense in punctuation and because looking away from the screen breaks something more expensive than time.

## Why the standard answer is incomplete

The familiar argument goes: programmers spend most of their time reading, thinking and debugging, not typing, so typing speed is irrelevant.

The premise is right. The conclusion does not follow, because it treats typing as a single quantity measured in words per minute. For prose that is a reasonable simplification. For code it is not, and here is why.

**Code is punctuation-dense.** Brackets, braces, semicolons, angle brackets, underscores, arrows, dollar signs, backticks, quotation marks. A line of code can be a third symbols. Those live on the outer columns and the top row, reached by the weakest fingers, and almost nobody drills them.

**Editing is not composing.** A large part of programming is small, precise edits inside existing code, change this argument, rename that variable, move this block. These are short bursts of high-accuracy typing interleaved with navigation, not sustained prose.

**Looking down costs context, not seconds.** When you glance at your hands, you leave the screen, and the screen is holding the state you were reasoning about. The cost is the reload, not the second.

So the useful question is not "does typing speed matter" but "which typing skills matter", and the answers are different from prose.

## What actually matters

In order:

### 1. Not looking at the keyboard

The single most valuable typing skill for a developer, and it has nothing to do with speed.

Programming involves holding a lot in your head: what this function does, what you were about to change, why the test is failing. Every time your eyes go to your hands you drop some of that, and picking it back up costs more than the keystroke did.

If you look down while typing, that is the thing to fix, and it is worth more than everything else in this article combined. [How to stop looking at the keyboard](/blog/stop-looking-at-the-keyboard) has the method.

### 2. Symbol fluency

Being able to type the punctuation without hesitation.

Most typing training is lowercase letters, so most typists, including fast ones, have a small stall on every bracket. In prose that happens rarely. In code it happens constantly, and it disrupts a line you were composing as one thought.

The specific offenders, on a UK or US QWERTY layout: braces and square brackets on the right little finger, the angle brackets that require shift, the underscore, the pipe, the backtick and the tilde. All little-finger territory, all shifted, all rarely practised.

This is drillable in about two weeks and almost nobody does it.

### 3. Accuracy

Higher stakes than in prose, for an obvious reason: a typo in a sentence is a typo, and a typo in code is a bug, sometimes one that compiles.

Modern tooling catches a lot of it, which has quietly lowered everyone's accuracy. That is mostly fine and occasionally expensive: the errors your linter cannot see are the ones that matter, and those are the semantic ones a careless typist makes more of.

### 4. Editor navigation

Not typing at all, and probably worth more than any of the above.

Word-wise movement, line movement, jump-to-definition, multiple cursors, search and replace, and whatever your editor's equivalent of "select this block" is. A developer who navigates fluently and types at 55 words per minute will out-produce one who types at 90 and arrows around.

This is the honest answer to "should I train typing speed": train navigation first.

### 5. Raw words per minute

Last, and genuinely last. Past about 60 words per minute, prose speed is almost never what is slowing a developer down.

## Where speed does show up

Three places, and they are worth naming because the blanket dismissal is also wrong.

**Writing tests and boilerplate.** There is genuinely a lot of typing here and comparatively little thinking, and it goes faster if you type faster.

**Documentation, commit messages, pull request descriptions and code review comments.** This is prose, there is a lot of it, and this is where ordinary typing speed applies directly.

**Communicating while thinking.** Chat, incident channels, pairing. Being able to type at conversational speed without it costing attention changes how much you contribute while also doing something else.

Note that two of those three are prose, not code. For most developers, general typing speed pays off in the writing *around* the code rather than in the code.

## Does an alternative layout help?

Usually not, and there is a programming-specific reason to be cautious.

Layouts like Dvorak and Colemak are optimised for English prose letter frequencies. Code has different frequencies and, more importantly, a great deal of punctuation that these layouts either move or leave alone somewhat arbitrarily. The optimisation target is not your workload.

Against that, you lose: every other machine you sit at, and, significantly, your editor's keybindings, which are placed for QWERTY and scatter under Dvorak. Vim users in particular find hjkl meaningless on a rearranged layout.

The evidence for large speed gains from alternative layouts is weak even for prose, as [QWERTY explained](/blog/why-is-the-keyboard-qwerty) sets out. For code it is weaker still.

## Does a mechanical keyboard help?

It may make typing more pleasant, which over eight hours a day is a real benefit and not one to dismiss.

It will not make you meaningfully faster. What genuinely affects typing performance is layout stability, consistent key travel and a comfortable position, not switch type. [Mechanical versus membrane keyboards](/blog/mechanical-vs-membrane-keyboards) goes through what the evidence supports.

The one keyboard property that does matter for programming: **do not switch between keyboards with different layouts of the symbol keys.** Moving between a UK and a US layout, or between a full-size and a compact board that relocates the brackets, is a genuine and recurring cost.

## A two-week plan for a developer

If you already touch type prose at a reasonable speed:

**Week 1: symbols.** Ten minutes a day drilling the punctuation you actually use. Write out a line of the symbols from your own codebase and type it repeatedly at a controlled pace. Pay attention to which finger presses each one, and use the opposite-hand shift.

**Week 2: real code.** Type out code from a file you know, deliberately, watching for hesitations. The hesitations are your list. Do not fix them by typing more code; drill the specific sequences.

**Ongoing: navigation.** Pick one editor movement you do not currently use and force yourself to use it for a week. Repeat. This compounds far faster than typing practice.

If you do not yet touch type, do that first. It is a six-week project and it is worth more than everything above. [How to learn touch typing](/blog/how-to-learn-touch-typing) is the sequence.

## Common questions

### Do I need to type fast to be a good programmer?

No. There is no meaningful relationship between prose typing speed and programming ability past a basic threshold. What does help is not looking at your hands, because that costs context rather than time.

### What is a good typing speed for a programmer?

Around 60 words per minute on prose is comfortably enough for everything, including the documentation and communication that surround the code. Above that the returns are small. [What is a good typing speed](/blog/what-is-a-good-typing-speed) has the general picture.

### Should I practise typing code specifically?

Yes, for symbols, that is the part general typing practice never covers. Practising whole programs is less useful than it sounds, because you end up practising your own idioms rather than the transitions you are slow on.

### Does autocomplete make typing speed irrelevant?

It reduces the volume, not the value of fluency. You still type the trigger, still navigate the suggestions, and still write the prose around the code. It has also made accuracy matter slightly less for syntax and slightly more for the things tooling cannot see.

### Is it worth learning if I have ten years of two-finger habits?

Yes, if you spend your day at a keyboard, but for the attention benefit rather than the speed. Expect three weeks of being slower. [Breaking bad typing habits](/blog/break-bad-typing-habits) covers replacing an entrenched habit one at a time.

## What to do

Type a line of real code from your own project and notice where you hesitate. It will almost certainly be a symbol, and almost certainly one reached by a little finger.

That is your practice list, and it is a two-week job, considerably smaller than "learn to type faster", and considerably more useful for what you actually do.

KeyTopia has a code-oriented practice mode built around exactly this material, and its [typing test](/typing-test) reports per-key timing, which will show you the symbol stalls you have stopped noticing.
`,

  'typing-speed-for-students': `
For most student work, 40 words per minute is workable and 50 to 60 is comfortable. The number that matters depends on the task: essays and coursework need less than people assume, while live lecture notes need more than most students have. Above about 70, typing has stopped being what limits you, and further practice buys comfort rather than capability.

## Targets by task

| Task | Workable | Comfortable | Why |
|---|---|---|---|
| Homework, short assignments | 30 wpm | 40 wpm | You have time; typing is rarely the constraint |
| Essays and coursework | 40 wpm | 55 wpm | Long, but self-paced, thinking dominates |
| Timed written exams | 45 wpm | 60 wpm | Fixed clock, so speed converts directly into content |
| Live lecture or meeting notes | 50 wpm | 65 wpm | You cannot pause the input |
| Transcribing a recording | 60 wpm | 75 wpm | Continuous, unfamiliar, no thinking time |
| Programming coursework | 40 wpm | 55 wpm | Symbol fluency matters more than speed |

Two things stand out. **The numbers are lower than typing articles usually imply**, 60 words per minute covers essentially everything a student does. And there is no row where 100 is required.

## Why lecture notes are the hard case

Live note-taking is the most demanding common keyboard task there is, and it is worth understanding why.

You are doing three things at once: listening, deciding what is worth writing, and typing. The input does not stop and you cannot rewind it. If typing takes any of your attention, it comes out of the other two.

Below about 40 words per minute this is close to unworkable. You fall behind and then have to choose between listening and catching up. Around 50 to 60 it becomes viable. Above that you can be selective rather than desperate, which is when notes become genuinely useful rather than a transcript you never reread.

Worth noting: there is a real debate about whether typing notes is better than handwriting them, and the popular version of that debate is more settled than the evidence. [Typing versus handwriting](/blog/typing-vs-handwriting) covers what the studies actually found. The point here is narrower, if you are going to type notes, being slow at it is the worst of both worlds.

## Why essays need less speed than students expect

For a 2,000-word essay, the difference between 40 and 60 words per minute is roughly seventeen minutes of typing.

That is real, and it is small compared with the time spent reading, planning, deciding what to say and revising. Essays are not typing-bound; they are thinking-bound.

Where speed does help with long writing is subtler: **revision cost**. If typing is cheap for you, rewriting a paragraph is cheap, so you do it more. Most of the quality in a long piece comes from revision, and students who type fluently tend to revise more simply because it costs them less.

That is a real benefit and it is not captured by "minutes saved".

## Accuracy matters more than the headline number

A student typing 65 words per minute at 88% accuracy is slower in practice than one typing 50 at 97%, because every error costs four to six keystrokes plus a broken rhythm.

In an exam it is worse than slow: an uncorrected error is a mark. And accuracy is the first thing to collapse under time pressure, which is exactly when you need it.

If your raw speed is well above your net speed, accuracy is your constraint and it is the faster fix, typically visible within two weeks. See [typing speed versus accuracy](/blog/typing-speed-vs-accuracy).

## Check three things before deciding you are too slow

**Are you looking at the keyboard?** If so, your current number is not your ceiling as a typist. It is the ceiling of a method. Visually guided typing tops out around 35 to 40 for almost everyone and does not improve much with practice. This is the single most important thing to know about your own speed.

**Is your accuracy above 95%?** If not, you are a faster typist with an error problem, which is a different and cheaper fix.

**Can you hold it for five minutes?** A fifteen-second test result is a burst extrapolated. Exam conditions are minutes long. Take a two-minute test and see what happens to the number.

## What to practise, around a full timetable

Students have less spare time than almost anyone, so the plan has to be small and finite.

**Fifteen minutes a day for six weeks, then stop.** Typing is one of the few skills where a short project genuinely finishes. Once it is automatic it stays.

**Practise in term time, not the holidays.** Motor skills consolidate between sessions, so daily practice during a busy term beats a concentrated week off, and the daily habit is easier to attach to an existing routine.

**Practise with punctuation from day one.** Academic writing is full of commas, semicolons, brackets, quotation marks and apostrophes. Word-list practice contains none of them, which is why so many students' test scores look fine and their essays feel slow.

**Learn four keyboard shortcuts** rather than chasing ten more words per minute: word-delete, jump-by-word, select-word, and your reference manager's insert-citation. These save more time in a long essay than the speed would.

The session structure that works is in [typing practice for adults](/blog/typing-practice-for-adults). The plan is the same regardless of age.

## When not to start

**Do not begin learning touch typing three months before finals.**

Replacing your typing method makes you temporarily slower for two to three weeks, and you do not want that during revision. Use whatever you have, and start in the summer.

The same applies to a heavy coursework term. The dip is short but real, and it should land somewhere it does not cost you.

## Common questions

### What typing speed do I need for university?

Around 50 to 60 words per minute covers everything comfortably, including lecture notes. Below 40 you will feel it during timed work and live note-taking.

### Is 40 wpm enough for a student?

For homework and essays, yes. For live lecture notes and timed exams, it is tight. [Is 40 WPM good](/blog/is-40-wpm-good) goes into where it binds.

### Will typing faster improve my grades?

Not directly, and it would be dishonest to suggest otherwise. What it does is remove a constraint on tasks where attention is scarce, timed exams and live notes especially, and make revision cheaper. Those are worth something without being a grade improvement.

### Should I type or handwrite in exams?

Whichever you are allowed and faster at. If your institution permits typed answers and you type at 50 while handwriting at 20, that is a large practical difference. Check the arrangements early rather than assuming.

### I type 80 wpm. Should I keep practising?

Not for academic reasons. At 80 your typing is not what limits any student task. If you enjoy it, that is a perfectly good reason, see [how to reach 100 WPM](/blog/how-to-reach-100-wpm), but it will not help your degree.

### How fast should I type in secondary school?

Around 40 by the end of secondary school puts you in a comfortable position for coursework and exams. More useful than the number is whether you touch type, because that is what keeps improving.

## Find out where you are

Take a two-minute test on unfamiliar prose with full punctuation, not a word list, at your ordinary pace. Note your net speed, your accuracy, and whether your eyes went to your hands.

If you looked down, that is your project and it is worth six weeks. If you did not and your accuracy is above 96%, your speed is your speed, and whether to improve it is a question about your workload rather than about your typing.

KeyTopia's [typing test](/typing-test) reports all three, and the wider case for keyboard skills at school and university is in [typing for students](/blog/typing-for-students).
`,

  'how-to-reach-100-wpm': `
Getting to 100 words per minute is a genuine training project, not a by-product of typing a lot. Past about 70, general practice stops working, because your typing is no longer uniformly slow. It is fast almost everywhere and stalls in a small number of specific places. Three limits bind at this level, each needs its own drill, and the whole thing takes something like three to six months of deliberate work.

## First: is it worth it?

Worth asking honestly before spending three months on it.

Above roughly 80 words per minute, typing is not what slows you down at any ordinary task. Writing is thinking-bound; code is thinking-bound; email is thinking-bound. The practical return on the last twenty words per minute is close to zero for most jobs.

The reasons to do it anyway are legitimate: long writing sessions are less tiring when typing costs less effort, the improvement is genuinely satisfying, and if you write for a living the marginal gains compound over years.

What is not a good reason is the assumption that it will transform your productivity. [How much time faster typing saves at work](/blog/time-saved-by-typing-faster) does the arithmetic, and at this level the answer is small.

Proceed as a hobby with benefits, not as an efficiency project.

## The three limits at this level

Everything below follows from these. Diagnose which one is binding before choosing a drill.

### 1. Same-finger and awkward transitions

At 70 words per minute your individual reaches are fine. What is slow is a small number of **letter pairs**.

The expensive ones are sequences that use the same finger twice in a row. The finger has to travel, arrive, press, and travel again, with no opportunity to overlap. Compare "minimum" with "problem": one of them stacks work on individual fingers and the other distributes it.

Also expensive: awkward rolls across one hand, and sequences that require a long reach immediately followed by a return.

**The drill:** measure per-transition timing, take your slowest ten pairs, and type each as a short repeated string at a pace where it is correct. Then embed each in five real words. Five minutes a day.

This is the single highest-yield activity at this level, and it is impossible without measurement. You cannot feel a 40-millisecond difference, but you type those pairs thousands of times a day.

### 2. Rhythm, not peak speed

Two typists can both average 70 while one types evenly and the other alternates 110 with stalls. The bursty typist's average is dragged down by the stalls, not limited by their top speed.

The relevant measure is **consistency**, the variation in your inter-key intervals. At this level, raising your average by removing stalls is far more achievable than raising your ceiling.

**The drill:** type to a steady beat, slower than your top speed, one keystroke per beat. Evenness is the target. This feels unproductive and works well, particularly for the transposition errors that come from one hand arriving early.

Consistency usually improves before average speed does, which makes it a useful signal during the weeks when the headline number refuses to move.

### 3. Reading ahead

The largest single difference between a fast typist and a very fast one.

At 100 words per minute you cannot read a word, type it, then read the next. There is not time. Your eyes have to be one to two words ahead of your fingers, feeding the sequence continuously.

This reflects how skilled typing is organised: one process works out *what* to type while a lower one executes the keystrokes, and the upper one needs to stay ahead. [How your brain learns to type](/blog/how-your-brain-learns-to-type) covers the research.

**The drill:** read a whole phrase before typing any of it, then type it while reading the next. Deliberately uncomfortable at first. Continuous prose is the only material that trains this. Word lists make it unnecessary and random letters make it impossible.

## The other things that cap people at this level

Less fundamental, but common:

**Punctuation and capitals.** If your score on word lists is 85 and on real prose is 65, this is your answer. Same-hand shift is the usual culprit. Nearly every sentence starts with a capital, so the cost is paid constantly.

**Numbers.** Long reaches, rarely drilled, and they appear in real text often enough to matter.

**Endurance.** A one-minute peak of 95 and a five-minute average of 72 is an endurance problem, usually tension or posture rather than technique. If accuracy falls off at the four-minute mark, [typing posture](/blog/typing-posture) is where to look before more practice.

**Key force.** Pressing harder than necessary slows the return stroke, and the return is half of every keystroke. At 100 words per minute you are making around ten keystrokes a second; a few milliseconds each is the whole difference.

## A twelve-week progression

| Weeks | Focus | Session shape (20 min) |
|---|---|---|
| 1–2 | Measure and diagnose | Test on prose, word lists and punctuated text. Find which of the three limits binds. |
| 3–5 | Transitions | 8 min slowest pairs, 8 min prose, 4 min punctuation |
| 6–8 | Rhythm | 6 min metronome work, 10 min prose, 4 min transitions |
| 9–10 | Reading ahead | 15 min continuous prose, phrase-at-a-time, 5 min transitions |
| 11–12 | Endurance and consolidation | 10 min continuous, 5 min bursts, 5 min re-measure |

Twenty minutes a day rather than fifteen, because at this level the sessions have more components. Re-measure in weeks 1, 5 and 11, not daily, which shows noise.

## What progress looks like

Slow, and that is normal rather than a problem.

Skill improvement follows a decelerating curve: steep early, progressively flatter. Getting from 30 to 60 might take two months; getting from 70 to 100 takes considerably longer for a considerably smaller absolute gain. This pattern is regular enough that it is often described as a power law of practice, and knowing it prevents mistaking the normal shape of learning for a plateau. [Why repetition makes you faster](/blog/why-repetition-makes-you-faster) covers the curve.

Expect a few words per minute a month, unevenly, with occasional jumps when something becomes automatic.

## What does not help

**More general practice.** The thing that got you to 70. It spreads effort evenly across a problem that is concentrated.

**Daily speed tests.** Typing above your controlled pace rehearses whatever breaks. Useful as a weekly diagnostic, harmful as a diet.

**A new keyboard.** Comfort matters over long sessions and switch type does not meaningfully change speed. [Mechanical versus membrane](/blog/mechanical-vs-membrane-keyboards) covers the evidence.

**A new layout.** Months of being slow for an uncertain gain, and you will be slow on every machine that is not yours. See [QWERTY explained](/blog/why-is-the-keyboard-qwerty).

**Practising only your weak pairs.** Do this exclusively and you become good at ten transitions while losing the endurance and rhythm that only come from continuous text. Targeted work is a component, not the session.

## Common questions

### How long does it take to reach 100 wpm from 70?

Three to six months of deliberate, targeted practice for most people, and some people find it takes considerably longer or does not arrive. It is a real project with an uncertain endpoint, unlike the 30-to-60 range which almost anyone reaches with consistent practice.

### Can anyone reach 100 wpm?

Most people can get close with sustained deliberate practice. Whether everyone can pass it is not something anyone has established, and individual variation at the top end is large. Treat it as a target to work towards rather than an entitlement.

### Is 100 wpm useful?

Rarely, practically. It is pleasant, it makes long sessions less tiring, and it is a legitimate thing to want for its own sake. It will not change your working day much.

### What accuracy should I hold at 100?

The same band as at any speed: 96 to 98% at your working pace. At 100 words per minute an error costs proportionally more, because you have further to unwind before your rhythm recovers.

### Do I need a mechanical keyboard for 100 wpm?

No. Consistency of key travel and a comfortable position matter; switch type does not, beyond personal preference. Plenty of very fast typists use ordinary keyboards.

### Should I use word lists or prose to train?

Both, for different limits. Word lists for transition drills and speed bursts; continuous prose for rhythm, reading ahead, punctuation and endurance, and prose is where the reading-ahead skill can only be built. [Words, sentences or random letters](/blog/best-way-to-practise-typing) covers the split.

## Start with the diagnosis

Take three tests this week: one on common word lists, one on real prose with full punctuation, and one lasting five minutes.

The differences between them tell you which of the three limits is binding. A big gap between word lists and prose is punctuation. A big drop over five minutes is endurance. Similar scores across all three, with uneven timing, is rhythm.

KeyTopia's [typing test](/typing-test) reports consistency and per-transition timing alongside the headline figure, which at this level is the only part that tells you what to do next.
`,

  'why-touch-typing-matters-for-kids': `
The case for teaching children to touch type is not that they need to type quickly. It is that a child who does not have to think about typing has more attention left for what they are writing. That difference shows up most in exactly the situations that matter, writing at length, working under time pressure, and any task where the keyboard is between a child and the thing they are actually being assessed on.

## The attention argument

Working memory is limited, and writing already uses a lot of it: holding an idea, choosing words, remembering what you have already said, keeping to the point.

If typing also requires attention, it competes for the same limited resource. A child hunting for letters is repeatedly interrupting the thought to handle the mechanics, and the interruption costs the thread of the sentence, not just the second it took to find the key.

When typing becomes automatic, that competition disappears. This is why the benefit is largest for demanding writing rather than short tasks, and why it is easy to underestimate if you only think about words per minute.

It is also why the honest version of this argument is not "your child will write faster". It is "your child will find writing less tiring, and will have more left over for the writing itself".

## Why two fingers is a ceiling, not a stage

The most common reason parents hesitate is that their child seems to be managing fine with two fingers.

They probably are, for now. The problem is what happens next.

**Two-finger typing tops out around 35 to 40 words per minute** for almost everyone, because the hands travel further and the eyes have to guide each landing.

**It stops improving.** This is the part that surprises people. Because each keystroke is visually guided, more hours mostly produce a faster searcher rather than an automatic movement. Touch typists keep improving for years; two-finger typists usually plateau within months and stay there.

**It requires looking down**, which is the attention cost above, paid on every single letter.

So a nine year old typing 30 words per minute with two fingers is not ahead of one typing 20 with correct technique. They are at their limit, and the other child is not.

## Where it actually shows up

Being specific is more useful than general claims about the future of work.

**Extended writing.** Stories, projects, reports. The tasks where a child has something to say and the mechanics are in the way.

**Assessed work produced on a keyboard.** Increasingly common, and this is the strongest version of the argument, a child being marked on their thinking should not be limited by their hands. That is a fairness point rather than a vocational one, and it is covered in [should schools still teach touch typing](/blog/should-schools-teach-typing).

**Note-taking**, from secondary school onwards. The most demanding common keyboard task, and one that is close to impossible below about 40 words per minute.

**Exam access arrangements.** Where a child is entitled to type rather than handwrite, that entitlement is worth much more if they can actually type.

**Anything where their writing is compared with their speech.** Children who find typing effortful often produce written work that is markedly less sophisticated than what they can say out loud. Removing the mechanical cost narrows that gap.

## Where the argument is weaker

Worth stating, because overselling this is how it stops being credible.

**It will not make them better writers.** It removes a constraint. What they do with the freed-up attention is a separate question.

**Speed itself matters very little before about eleven.** A child's typing is usually limited by their reading speed, not their fingers. Measuring words per minute at eight is mostly measuring decoding.

**Voice input is genuinely good now.** It is excellent for first drafts and messages, and poor for editing, unusable in a classroom, and irrelevant for anything with structure. It reduces the amount of typing without removing the need.

**Phones are not practice.** Thumb typing on a touchscreen is a different skill and does not transfer to a keyboard. Children who type a great deal on phones are often surprisingly slow on a keyboard.

## What "matters" means at each age

| Age | What matters | What does not |
|---|---|---|
| 4–6 | The keyboard being familiar and unremarkable | Technique, speed, finger assignment |
| 6–7 | The idea that each hand has its own side | Speed |
| 7–9 | Correct fingers, hands covered, accuracy | Words per minute |
| 9–11 | Not looking; capitals and punctuation | Comparison with classmates |
| 11–14 | Sustained typing; real work at length | Peak speed on short tests |
| 14+ | Exam and coursework conditions | Getting past about 50 wpm |

The right-hand column matters as much as the left. Most of the pressure parents feel is about the things that do not matter.

## The window

Ages **seven to nine** is where this is cheapest, for two reasons that pull together: hands are usually big enough to span the home row, and a two-finger habit is months old rather than years old.

The physical precondition is worth checking rather than assuming. Ask them to hold the home row and reach up to E with the finger on D. If their whole hand slides, they are not ready, and practising anyway teaches a hand-shifting habit that will have to be removed later. [What age should kids learn to type](/blog/what-age-should-kids-learn-to-type) has the test.

Later is still very much worth doing. It just takes two to three weeks longer and meets more resistance, because by then they have a working method and an opinion about it.

## What it costs

Ten minutes a day for about three months, with a visibly worse fortnight in the middle.

That fortnight is the whole difficulty. Their typing genuinely gets worse before it gets better, because they are replacing a method that works. Naming it in advance, "it goes slower first, that's how it works", converts week two from evidence of failure into the thing you predicted.

Practical structure is in [typing practice for kids](/blog/typing-practice-for-kids-routine), and the framing that keeps it going is in [how to teach a child to type](/blog/how-to-teach-a-child-to-type).

## Common questions

### Will typing still matter when they grow up?

Keyboards have outlasted several confident predictions of their obsolescence, and every widely used replacement so far, touchscreens, voice, has turned out to complement them rather than displace them for extended or precise text. Beyond that, nobody knows, and it is worth being honest that this is a bet rather than a certainty. It is a cheap bet: ten minutes a day for three months.

### Is it worth it if their school does not teach it?

Most schools do not teach it, which is precisely why it falls to parents. The work children are asked to produce on keyboards has increased considerably faster than the instruction in how to use one.

### My child is fast with two fingers. Should I still change it?

Yes, and the sooner the better. Fast two-finger typing is the case that looks like success and is actually a ceiling reached early. [Helping kids stop typing with two fingers](/blog/kids-typing-with-two-fingers) has the plan.

### Does it help with spelling?

There is a plausible mechanism, typing a word repeatedly builds a motor pattern for its letter sequence, but the evidence that typing practice improves spelling generally is not strong, and it would be overclaiming to promise it. Treat it as a possible side benefit rather than a reason.

### How much does it actually help academically?

Honestly: it removes a constraint rather than adding an ability, and the size of that effect depends entirely on how much keyboard work the child does. For a child who writes at length on a computer, it is substantial. For one who rarely does, it is small.

## Where to start

Watch them type for one minute without commenting. Note two things: whether their eyes go down, and how many fingers are moving.

If the answer is "eyes down, two fingers", you have found the thing worth ten minutes a day. Cover their hands, start on the home row, and warn them about week two.

KeyTopia's [children's world](/typing-for-kids) is built around this, accuracy reported ahead of speed, age-appropriate words, and short quests rather than drills, and the full parent's guide is in [typing for kids](/blog/typing-for-kids-guide-for-parents).
`,

  'why-repetition-makes-you-faster': `
Repetition works, but not evenly and not indefinitely. Improvement on a practised skill is steep at first and progressively slower, in a pattern regular enough that it has been described as a power law of practice. Knowing the shape of that curve is genuinely useful: it tells you when more repetition will pay, when it will not, and what to change when it stops.

## What repetition actually changes

Not your muscles. The phrase "muscle memory" is convenient and wrong. Muscles do not store anything. What changes is in the nervous system, as a movement shifts from being assembled step by step to being represented as a single automatic sequence.

Three things happen as a movement is repeated:

**It becomes faster.** The individual reach takes less time, and, more importantly, the *gaps* between movements shrink, because the next movement can be prepared while the current one is still finishing.

**It becomes more consistent.** Early repetitions vary a lot; later ones are nearly identical. This matters more than it sounds: consistency is what allows the next movement in a sequence to be prepared reliably.

**It requires less attention.** The end state is a movement that runs while you think about something else, which for typing is the entire goal.

The standard framework for this is Paul Fitts and Michael Posner's three stages: a **cognitive** stage where you work out what to do, an **associative** stage where you refine it, and an **autonomous** stage where it runs itself. Repetition is what moves you between them.

## The shape of the curve

Improvement decelerates, and it does so predictably.

- Your first ten hours of typing practice produce a dramatic change.
- Your second ten produce a smaller one.
- Your tenth ten produce a change you may not notice week to week.

This pattern was characterised for a manual skill by George Snoddy in the 1920s and given its general form by Allan Newell and Paul Rosenbloom in the 1980s. It shows up across a wide range of skills.

Two practical consequences follow, and they matter more than the mathematics:

**Do not quit when progress slows.** A flattening curve is what learning looks like, not what failure looks like. People who expect linear progress interpret month three as a plateau and stop.

**Undirected repetition eventually stops paying.** This is the important one. Once you are on the flat part of the curve, typing more of the same produces very little, not because repetition has stopped working, but because you are repeating things you are already good at.

## Why more practice stops working

In your first month, everything is slow, so typing anything improves everything.

By month three that is no longer true. Your typing is fast almost everywhere and slow in perhaps a dozen specific places, particular keys, and more often particular letter pairs. General practice distributes effort evenly across the alphabet, which means most of it goes to sequences that are already automatic.

This is the mechanism behind most typing plateaus. The practice is real and it is going to the wrong places.

The fix is not more repetition but **more targeted** repetition: find the specific slow transitions and drill those. Which requires measurement, because you cannot identify them by feel. Research on skilled typing has found that typists detect their own errors without being able to report what went wrong. [Adaptive typing lessons](/blog/adaptive-typing-lessons) covers how that measurement works.

## Repetition of what, exactly

A distinction that changes how you practise.

**Repeating a passage** produces fast, visible gains, and most of them are memory. By the fifth run you are partly recalling rather than reading, and the score rises for a reason that will not transfer to new text.

**Repeating a sequence**, a difficult letter pair, an awkward word, builds the motor pattern properly, because the pattern is what is being repeated rather than the whole passage.

So: repeat sequences, not passages. Drill "minimum" thirty times if that is a word that stalls you. Do not type the same paragraph twenty times and treat the improving number as progress.

## Repetition of errors

The uncomfortable half of the principle.

The nervous system strengthens whatever movement is repeated, and it has no access to your intentions. Practise at a pace where you make regular errors and you are running two patterns, the correct one and the mistaken one, and both accumulate repetitions. The mistaken one does not fade because you disapproved of it.

This is why "type fast and accuracy will follow" fails so reliably, and why the useful practice pace is around 80% of your top speed rather than at it. The full argument is in [why typing accuracy should come before speed](/blog/accuracy-before-speed).

## Spacing: the same repetitions, better arranged

Two findings from motor learning translate directly into a schedule.

**Distributed practice beats massed practice.** The same total time produces better retention spread across more sessions. Fifteen minutes daily beats an hour and three quarters weekly, and the difference is not small.

**Consolidation continues after practice stops.** Motor skills keep stabilising in the hours after a session, including during sleep. This is why something awkward yesterday is sometimes easy today with no intervening practice.

Both point the same way: short, frequent sessions with rest between them. It also means there is no benefit to grinding on once a session has stopped going well. The consolidation happens later regardless.

## Variability: why identical repetition is not ideal

A refinement worth knowing.

Repeating exactly the same thing produces fast improvement on that thing and comparatively poor transfer to anything else. Practice with some variation, the same target transitions appearing in different words, different contexts, different surrounding letters, tends to produce slower apparent progress during the session and better retention afterwards.

This is a reasonably well supported finding in motor learning, and it has a practical form for typing: drill your weak pair as a repeated string to build the movement, then **immediately embed it in five different real words**. The string builds it; the varied context makes it stick.

## What to do at each stage

| Where you are | What repetition should look like |
|---|---|
| Learning the keys | Slow, deliberate, identical. Correctness above all. |
| Building fluency (30–60 wpm) | Real words and prose, at 80% pace, daily |
| Plateaued (60–80 wpm) | Targeted: your slowest transitions, then varied contexts |
| Advanced (80+ wpm) | Rhythm work, reading ahead, endurance, plus targeted pairs |

Notice that the amount of repetition does not increase down the table. What changes is what is being repeated.

## Common questions

### How many repetitions does it take to learn a key?

There is no fixed number, and the popular figures attached to habit formation are not about motor sequences. What is reliable is the shape: rapid early improvement, then diminishing returns, with consolidation between sessions doing a substantial part of the work.

### Is it better to practise a lot in one day or a little every day?

A little every day, clearly. Motor skills consolidate between sessions, so more sessions means more consolidations for the same total time.

### Why did I get worse after a break?

Short breaks often *help*. People frequently return better than they left, which is consolidation. Longer breaks cost some speed, which returns quickly. If you got worse after a day off, it is more likely day-to-day variation than lost skill.

### I practise every day and I am not improving. Why?

Most likely you are on the flat part of the curve and practising generally rather than specifically. Measure per-key and per-transition timing, and drill the slowest. If your accuracy is below 95%, that is the answer instead. See [how to improve typing accuracy](/blog/improve-typing-accuracy).

### Does typing at work count as practice?

It maintains the skill and rarely improves it, because you type your own vocabulary at a comfortable pace with no feedback and no targeting. It is repetition without the conditions that make repetition productive.

## Use the curve

If you are early in learning, repeat a lot and repeat correctly. The returns are enormous right now and what you lay down is what everything later refines.

If you have been practising for months with little to show, the problem is almost certainly not the amount. Measure which transitions are slow, drill those specifically, then put them into varied real words.

KeyTopia's [typing test](/typing-test) reports per-key and per-transition timing, and its [adaptive practice](/adaptive-practice) does exactly the drill-then-vary pattern described above, which is the shape of repetition that keeps paying once the general kind has stopped.
`,
};
