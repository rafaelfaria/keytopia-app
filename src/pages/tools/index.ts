/**
 * One import for the whole free-tools suite.
 *
 * The router and the prerenderer both need all nine components, and both are
 * long files where nine more import lines would be nine more places to forget
 * one. Adding a tool means editing the registry, this barrel and the two route
 * maps, and the tests assert that those agree.
 */

export { ToolsHubPage } from './Hub';
export { SpeedTestPage } from './SpeedTest';
export { WpmCalculatorPage } from './WpmCalculator';
export { AccuracyTestPage } from './AccuracyTest';
export { TimedChallengePage } from './TimedChallenge';
export { WeakKeysPage } from './WeakKeys';
export { DailyExercisePage } from './DailyExercise';
export { SpeedByAgePage } from './SpeedByAge';
export { ProgressTrackerPage } from './ProgressTracker';
