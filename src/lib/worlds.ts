import { WORLD_SPINE, type WorldSpine } from './curriculum';

/**
 * Presentation registry for the two journeys (docs/two-worlds-plan.md §3–4).
 * The spine (curriculum.ts) says what a world *is*; this file says what it
 * *looks like* — an island for kids, an expedition leg for grown-ups.
 * Adding a future world (w6+) = one spine entry + one skin entry.
 */

export interface IslandSkin {
  kidName: string;
  landmark: string;
  guardian: number;               // PIXEL_PALS index
  /**
   * This island's own outline, and its own route from the beach to the peak.
   *
   * They used to be shared: one silhouette and one set of ten node positions
   * for all five worlds, repainted in a different palette each time. A child
   * who has walked one island has walked the shape of all of them, and the
   * fifth world looked like the first with the colour swapped, which is the
   * fastest way to make a journey feel like a treadmill.
   *
   * So each island now has its own land and its own path across it: a long low
   * beach, a round hill climbed in switchbacks, a harbour wrapped round a bay,
   * a shard of rock with a route that weaves between its peaks, and finally no
   * island at all, just clouds you hop between.
   */
  shape: string;
  nodes: [number, number][];
  /** Where the landmark stands on this particular island. */
  landmarkAt: [number, number];
  sky: [string, string];
  sea: [string, string];
  grass: string;
  grassLight: string;
  sand: string;
  road: string;                   // dirt-trail colour on this terrain
  decor: 'meadow' | 'forest' | 'harbor' | 'cavern' | 'sky';
  blurb: string;                  // one kid-worded line for the sea chart
}

export interface LegSkin {
  adultName: string;
  blurb: string;                  // one line for the elevation strip / guide
}

export interface WorldDef extends WorldSpine {
  kid: IslandSkin;
  adult: LegSkin;
}

/** Bright node colours cycled along every road. */
export const LAND_COLORS = ['#ff8fa3', '#ffb26b', '#ffd166', '#7dd8a0', '#5fc9e0', '#8b9cf5', '#c99cf5', '#f59cd8', '#66d9c2'];

const KID_SKINS: Record<string, IslandSkin> = {
  w1: {
    kidName: 'Meadow Isle', landmark: 'The Great Oak', guardian: 0,
    sky: ['#aee3f7', '#d9f2fb'], sea: ['#9edbf2', '#7fc9e8'],
    grass: '#97d67f', grassLight: '#b1e39b', sand: '#eddc9e', road: '#e7d5a4',
    shape:
      'M 45,392 C 34,332 78,286 138,272 C 205,257 268,264 335,250 C 402,236 455,238 520,228 '
      + 'C 585,218 640,220 700,202 C 755,186 800,172 842,148 C 872,130 892,96 926,90 '
      + 'C 958,86 972,132 968,196 C 982,276 968,338 938,384 C 898,428 802,442 700,440 '
      + 'C 560,450 420,448 300,441 C 185,436 66,438 45,392 Z',
    nodes: [[90, 372], [210, 320], [330, 368], [450, 300], [565, 345], [665, 268], [775, 305], [850, 225], [895, 165], [935, 118]],
    landmarkAt: [933, 84],
    decor: 'meadow', blurb: 'Where every explorer begins',
  },
  w2: {
    kidName: 'Treetop Isle', landmark: 'The Canopy Bridge', guardian: 1,
    sky: ['#93cfae', '#d3eedd'], sea: ['#77c0ab', '#58a893'],
    grass: '#5fae6a', grassLight: '#7dc487', sand: '#d9c98f', road: '#cdb98a',
    shape:
      'M 250,424 C 178,416 138,368 160,314 C 180,264 236,246 296,244 C 336,192 396,146 470,136 '
      + 'C 548,126 614,166 650,228 C 706,240 768,266 790,318 C 812,370 776,418 706,428 '
      + 'C 604,444 352,442 250,424 Z',
    nodes: [[224, 392], [346, 410], [470, 402], [598, 390], [700, 352], [636, 300], [498, 296], [364, 288], [402, 214], [470, 172]],
    landmarkAt: [470, 128],
    decor: 'forest', blurb: 'A forest with letters in its leaves',
  },
  w3: {
    kidName: 'Lantern Harbor', landmark: 'The Lighthouse', guardian: 2,
    sky: ['#ffd9a8', '#ffbfa8'], sea: ['#7fa8e8', '#5f88c8'],
    grass: '#a8c97f', grassLight: '#c0db97', sand: '#f0dcae', road: '#e8d3a2',
    shape:
      'M 70,332 C 58,248 132,202 224,204 C 306,206 356,242 386,300 C 416,356 470,372 520,344 '
      + 'C 572,314 592,250 664,224 C 746,194 838,212 888,268 C 938,324 926,396 852,424 '
      + 'C 760,458 556,460 396,452 C 246,444 90,422 70,332 Z',
    nodes: [[132, 300], [204, 258], [286, 268], [356, 332], [452, 396], [560, 394], [660, 328], [730, 262], [820, 276], [868, 338]],
    landmarkAt: [876, 244],
    decor: 'harbor', blurb: 'A seaside town of words and lights',
  },
  w4: {
    kidName: 'Crystal Caverns', landmark: 'The Geode Gate', guardian: 3,
    sky: ['#4d4670', '#6a6094'], sea: ['#4f6aa8', '#3d5488'],
    grass: '#8a7fb8', grassLight: '#a598cc', sand: '#6d6494', road: '#8d84ad',
    shape:
      'M 58,384 L 148,296 L 212,342 L 302,232 L 374,300 L 470,210 L 562,290 L 642,192 '
      + 'L 732,266 L 822,176 L 902,250 L 952,212 L 968,332 L 900,424 L 700,448 L 400,450 L 148,438 Z',
    nodes: [[112, 392], [202, 366], [300, 300], [400, 332], [500, 268], [590, 320], [680, 250], [772, 302], [862, 240], [918, 282]],
    landmarkAt: [922, 200],
    decor: 'cavern', blurb: 'Numbers and glyphs glow in the dark',
  },
  w5: {
    kidName: 'Cloud Castle', landmark: 'The Cloud Castle', guardian: 4,
    sky: ['#9ed4fa', '#ffe9c4'], sea: ['#ffffff', '#dceefa'],
    grass: '#b3e39b', grassLight: '#cdeeb5', sand: '#ffe9b8', road: '#f0dcae',
    shape:
      'M 92,402 C 70,360 112,330 172,332 C 232,334 262,364 248,398 C 234,432 122,438 92,402 Z '
      + 'M 330,354 C 306,310 358,276 426,280 C 494,284 522,316 504,354 C 486,392 360,400 330,354 Z '
      + 'M 560,302 C 540,258 598,228 666,234 C 734,240 758,272 738,308 C 718,344 590,350 560,302 Z '
      + 'M 788,238 C 770,196 826,164 890,170 C 954,176 974,210 956,246 C 938,282 814,286 788,238 Z',
    nodes: [[128, 366], [204, 362], [302, 338], [372, 314], [442, 310], [522, 320], [604, 270], [674, 266], [828, 208], [898, 202]],
    landmarkAt: [890, 150],
    decor: 'sky', blurb: 'The island above the clouds',
  },
};

const ADULT_SKINS: Record<string, LegSkin> = {
  w1: { adultName: 'The Valley', blurb: 'Trailhead by the river. Anchors and the home row' },
  w2: { adultName: 'The Forest', blurb: 'Switchbacks under tall trees. The full alphabet' },
  w3: { adultName: 'The Ridgeline', blurb: 'Open views. Capitals, punctuation, real sentences' },
  w4: { adultName: 'The Glacier', blurb: 'Technical terrain. Numbers, symbols and code' },
  w5: { adultName: 'The Summit Push', blurb: 'Thin air. Rhythm, endurance and mastery' },
};

export const WORLDS: WorldDef[] = WORLD_SPINE.map((w) => ({
  ...w,
  kid: KID_SKINS[w.id],
  adult: ADULT_SKINS[w.id],
}));

export function worldDef(id: string): WorldDef {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0];
}
