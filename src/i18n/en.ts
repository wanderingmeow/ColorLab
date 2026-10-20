/**
 * English dictionary — the shape of this object IS the type of every other locale.
 * Keys are grouped by where they appear. `{{ token }}` placeholders are resolved by
 * i18n.resolveTemplate.
 */
import type { HarmonyType } from '../lib/harmonies.ts';

/**
 * Per-harmony copy must cover every harmony. Without this, `Dict = typeof dict` only
 * describes whatever happens to be written here, so forgetting a harmony in English is
 * silent — and the UI prints the raw key instead of a name.
 */
const forHarmonies = <T,>(rows: Record<HarmonyType, T>): Record<HarmonyType, T> => rows;

export const dict = {
  meta: {
    name: 'The Colour Lab',
    langName: 'English',
    htmlLang: 'en',
    title: 'The Colour Lab — find the harmony in a photo',
  },

  top: {
    helpTitle: 'How this works',
    switchLang: 'Language',
    helpAria: 'Help',
  },

  upload: {
    dropHere: 'Drop a photo here or tap to upload',
    busy: 'Reading…',
    pasteTipA: 'Tip: screenshot the photo, then press ',
    pasteTipB: ' to paste it.',
    pasteKey: '⌘V',
    errorFallback: 'Something went wrong.',
    aria: 'Drop a photo here or tap to upload',
  },

  map: {
    title: 'Hue map',
    noteSampling:
      'Every dot is a pixel of your photograph, in its own colour. A cluster with no numbered '
      + 'point on it is a colour the list does not hold.',
    noteHarmony:
      'The same cloud with the harmony’s skeleton over it — the scheme has to live inside what '
      + 'the photograph holds, not beside it.',
    dotAria: 'Sample {{n}}, {{hex}}, on the hue map',
    noHues: 'This photograph holds almost no chroma — there is no hue to plot.',
  },

  sample: {
    title: 'Sampled colours',
    suggest: 'Suggest',
    suggestWaiting: 'Still reading the photograph — this waits a moment on a large file',
    suggestTitle:
      'One representative point for every colour the frame still holds — four at least, eight at '
      + 'most, and it stops early once nothing is left to add.',
    undo: 'Undo',
    undoTitle: 'Undo the last change (⌘Z)',
    clear: 'Clear',
    clearTitle: 'Remove all points — ⌘Z brings them back',
    sizeLabel: 'Sample area',
    sizeHint:
      'How much of the photo each point reads. A small area is precise but picks up noise '
      + 'and grain; a large area gives the colour of a region — sky, skin, water — and averages '
      + 'past edges. The reading is the middle value of the area, so one bright speck cannot drag '
      + 'it. Points already placed keep the colour they were given; drag one to re-read it.',
    empty: 'No points yet. Click anywhere on the photo, or press “Suggest 8”.',
    namePlaceholder: 'name this colour (optional)',
    nameAria: 'Name for sample {{n}}',
    reorder: 'Drag to reorder — the numbers follow. Alt+↑/↓ moves one step.',
    reorderAria: 'Reorder sample {{n}} — drag, or Alt+arrow',
    copyHex: 'Copy hex',
    copied: 'copied',
    neutral: 'neutral',
    neutralTitle: 'Almost no chroma — its hue is not trustworthy',
    lock: 'Lock — anchor the harmony on this colour',
    unlock: 'Unlock — stop anchoring the harmony',
    ignore: 'Ignore in the analysis',
    include: 'Include in the analysis',
    del: 'Delete',
    unnamed: 'unnamed',
    coverage: 'coverage · shadows {{s}} · midtones {{m}} · highlights {{h}}',
    noHighlights: 'Nothing sampled in the highlights — bright areas are usually tinted.',
    noShadows: 'Nothing sampled in the shadows — dark areas are usually tinted.',
    analyze: 'Analyse on the wheel',
    more: 'Add {{n}} more to continue.',
  },

  stage: {
    groupAria: 'Sample points on the photo',
    preparing: 'Reading the photo…',
    dropReplace: 'Drop to replace this photo',
    edge: 'on an edge',
    edgeHint:
      'The 5×5 area under the cursor spans two different colours, so this reading blends '
      + 'them into a colour that is not actually in the photo. Move onto a flat area.',
    dotAria: 'Sample {{n}}: {{label}}',
  },

  wheel: {
    tabNatural: 'Natural',
    tabPure: 'Pure hues',
    tabGuide: 'Harmony guide',
    valuesTitle: 'Colour values',
    valuesHint: 'Tap a hex to copy it.',
    captionNatural: 'Showing colours at their actual saturation. The dashed circle is the neutral floor.',
    captionPure: 'Pure hues — every dot at the rim. The angles between them reveal the harmony.',
    captionGuide: 'Each dashed ring is painted with the colour a dot should move to; arrows run from the dot to its target.',
    captionCustom: 'Drag a dot to place a target on the rim. Closest match: {{type}} ({{score}}%)',
    nearNeutral: ' · near-neutral',
    dotAria: 'Sample {{n}}, {{hue}}, hue {{h}} degrees',
    dotMovedAria: 'Sample {{n}}, {{hue}}, hue {{h}} degrees, target placed at {{to}} degrees',
    clearMoveAria: 'Take back this target',
    movesTo: ' · target {{to}}° ({{hex}})',
  },

  harmony: {
    detected: 'Detected harmony',
    yours: 'Your harmony',
    backToDetected: 'back to detected',
    needArms: 'Needs {{n}} distinct hues (one arm may be a move away) — this photo has {{have}}',
    degenerate: 'This needs {{n}} distinct hues; the photo offers {{have}}. The skeleton can be drawn, but there is no harmony to fit.',
    needDots: 'Needs {{n}} points so every arm ends with its own colour — you have {{have}}.',
    // a colour that may be distance rather than a surface, said as a possibility
    // no "may be": the numbers are the hedge, and only the user knows if that band is distance
    aerialNote:
      'Low chroma, bright, cool, {{share}}% of the frame. If this is distance seen through air, making it one arm of the skeleton flattens that distance. Consider ignoring it.',
    builtAround: 'Built around: {{list}}',
    feelingLabel: 'Feeling',
    /** explains the H/S/L delta read-out on every suggestion */
    why: 'Why this number?',
    drift: 'weighted drift',
    slots: 'slots covered',
    worst: 'worst offender',
    weights: 'weights',
    weightsValue: 'chroma + frame area',
    ignoredRow: 'ignored',
    ignoredValue: '{{byYou}} by you · {{neutral}} near-neutral',
    agreementValue:
      'People agree about colour combinations only about half the time (52%; 81% inside one group '
      + 'of similar viewers). This number describes structure, not beauty.',
    harmonyScoreLabel: 'Harmony',
    separationLabel: 'Separation',
    separationHint: 'Another axis, not a second score.',
    separationNote:
      'Contrast makes a subject stand out; similarity reads as harmony. They run opposite — pick one.',
    warmCoolLabel: 'Warm–cool spread',
    lightnessLabel: 'Lightness contrast',
    warmCoolValue: 'warmest {{warm}} · coolest {{cool}}',
    lightnessValue: 'darkest {{dark}} · lightest {{light}}',
    adjustments: 'Adjustments',
    aligned: '✓ Aligned',
    ignored: 'Ignored',
    shift: 'Shift',
    bigShift: 'Big shift',
    toward: 'toward {{hue}}',
    degrees: '({{deg}}°)',
    suggested: 'Suggested:',
    neutralHint:
      'Near-neutral (S {{s}}%). A hue move here is invisible — if you want this colour to read as ' +
      '{{hue}}, raise its saturation instead.',
    inertNote:
      'Below what an eye can separate (ΔE {{de}}). At {{s}}% saturation its hue is rounding noise rather '
      + 'than a colour, so there is nothing here to move. If this area should read as {{hue}}, add saturation instead.',
    tryAnother: 'Try another harmony',
    customNote:
      'Drag a dot to build your own. The dot stays where its colour is and leaves a target on the ' +
      'rim — painted with the colour you are taking it to, so the photo and the plan stay ' +
      'distinguishable. ✕ (or Delete) takes a target back. The read-out under the wheel says what ' +
      'you have landed on.',
    moves: '{{n}} placed',
    restoreMoves: 'Take them all back',
    lockedHint:
      'You locked this colour, so nothing here asks you to move it. It still sits {{deg}}° off this '
      + 'skeleton, which means the locks contradict each other — unlock one, or try another harmony.',
    flagInvisible: 'flag invisible moves',
    /** how the suggested colour is computed once the target hue is known */
    moveLabel: 'Move',
    moveHue: 'Hue only',
    moveRelative: 'Match intensity',
    moveHueNote:
      'Suggested colours keep HSL saturation and lightness exactly where they are, so only the hue slider '
      + 'moves. That is all the wheel itself can express.',
    moveRelativeNote:
      'HSL saturation is not uniform: 80% orange is loud, 80% cyan is not. This mode keeps each colour’s '
      + 'lightness and its intensity for its own hue — which is why the saturation and lightness numbers are '
      + 'no longer zero.',
  },

  adj: {
    aligned: 'Aligned',
    ignored: 'Ignored',
    /** the move exists in hue space but no eye can see it */
    inert: 'No visible move',
    /** you pinned it; the skeleton is what has to give */
    locked: 'Locked — not moved',
    shift: 'Shift toward {{hue}}',
    bigShift: 'Big shift toward {{hue}}',
    // a suggestion is not actionable until it says which band to drag
    scope: 'applies to',
    scopeTip:
      'Editors work band by band: the {{band}} slider in Lightroom, Camera Raw and Photoshop Hue/Saturation, or the {{band}} end of a Hue vs Hue curve in DaVinci Resolve. {{light}} is where this colour sits by brightness.',
    memory: 'This leaves the memory colour for {{what}}.',
    memoryWhy:
      'Preference follows memory colour: viewers hold a colour for the sky, foliage and skin, so a move away can read as wrong even when the harmony improves.',
  },

  // the eight hue sliders editors expose, named the way they name them
  hueBand: {
    reds: 'Reds', oranges: 'Oranges', yellows: 'Yellows', greens: 'Greens',
    aquas: 'Aquas', blues: 'Blues', purples: 'Purples', magentas: 'Magentas',
  },
  lightBand: { shadows: 'Shadows', midtones: 'Midtones', highlights: 'Highlights' },
  // subjects with a memory colour, named by the thing rather than by the hue
  memory: { sky: 'the sky', foliage: 'foliage', skin: 'skin' },

  app: {
    step1Eyebrow: 'Step 01 — Sampling',
    h1a: 'Place dots on your photo to ',
    h1Accent: 'extract the colours',
    h1b: ' you want to analyse.',
    step1Lead:
      'Touch and drag on the image to place a sample point. Drag existing dots to refine. ' +
      'Sample the colours you actually need information about — highlights, shadows, and the ' +
      'colours that carry the story.',
    reanalyse:
      'Re-analysis: this photo replaced the previous one, and the {{n}} sample points kept their ' +
      'places and were read again from this render.',
    editedWarn:
      'This image already carries a strong {{cast}} cast or heavy contrast. The analysis reads the ' +
      'render you gave it, not the scene — export a neutral JPEG from your raw if you want the ' +
      'starting palette.',
    castWarm: 'warm',
    castCool: 'cool',
    step2Eyebrow: 'Step 02 — Reading the harmony',
    h2a: 'Each colour, plotted by its ',
    h2Accent: 'true position',
    h2b: ' in the spectrum.',
    step2Lead:
      'Switch between Natural saturation, Pure hues and the Harmony guide. Lock a colour to anchor ' +
      'the harmony around it. Use Custom to drag the dots wherever you like.',
    backToSampling: 'back to sampling',
    yourPhoto: 'Your photo',
    noPhotoThumb: 'No photo yet — the wheel fills in once you place sample points.',
    wheelViewAria: 'Wheel view',
    helpTitle: 'How it works',
    closeHelp: 'Close help',
  },

  help: {
    eyebrow: 'Four steps. Every photo.',
    s1t: 'Intention',
    s1d: 'Decide the story and the feeling before you touch a slider. This tool cannot do this part — and it should not. Your answer is what turns a harmony into a style.',
    s2t: 'Analysis',
    s2d: 'Sample the colours that are really in the photo. Almost nothing is pure white or black: highlights and shadows are tinted, and you cannot see how much by eye. Five points is the minimum; six to nine is usually right.',
    s3t: 'Colour choice',
    s3d: 'Pick the harmony that supports the story. The tool ranks the mathematical matches, you make the call. Want nostalgia? Analogous usually carries it. Want energy? Complementary or square.',
    s4t: 'Transformation',
    s4d: 'Make the edit on purpose, in your own software. Work locally with masks — curves per channel, colour balance, colour mixer — nudging each colour toward the slot you chose, one at a time.',
    wheelTitle: 'Reading the wheel',
    wNatural: 'Natural',
    wNaturalD: 'plots every dot at its real saturation. Most dots pile up near the centre — that is the honest picture, and the dashed circle marks the point where a colour has too little chroma for its hue to mean anything.',
    wPure: 'Pure hues',
    wPureD: 'pushes every dot to the rim so the angles between them — the actual harmony — become readable.',
    wGuide: 'Harmony guide',
    wGuideD: 'shows the target positions as dashed circles and draws an arrow from each dot that is off.',
    knowing: 'Things worth knowing',
    know1: 'A colour at 1% saturation has no trustworthy hue. The tool will still show you an arrow, but the flag under it tells you the move is invisible — use saturation or lightness instead.',
    know2: 'Locking a dot pins the harmony skeleton onto that colour. Use it when one colour is non-negotiable.',
    know3: 'Ignoring a dot removes it from the scoring entirely.',
    know4: 'Weights combine chroma with how much of the frame a colour covers, so a big sky outvotes one small flower.',
    shortcuts: 'Shortcuts',
    scPaste: 'paste a screenshot as the photo',
    scUndo: 'undo the last dot change',
    scNudge: 'nudge the focused dot (⇧ for bigger steps)',
    scDelete: 'delete the focused dot',
    scEsc: 'deselect / close this panel',
    privacy:
      'Nothing is uploaded. The image is decoded into a canvas in this tab, read pixel by pixel, and ' +
      'thrown away when you close it — nothing about the photo is stored anywhere, not even across a ' +
      'refresh. Only preferences are kept in this browser: language, hints, how suggestions are computed, sample size.',
  },


  /** the three numbers an editor's sliders ask for */
  hsl: {
    h: 'Hue', s: 'Sat', l: 'Light',
    /** tooltip for one cell of the delta read-out: current → target (delta) */
    cell: 'Current {{from}}{{unit}}, target {{to}}{{unit}} — move {{delta}}{{unit}}.',
    none: 'no change',
  },

  harmonyFeeling: {
    short: forHarmonies({
      'split-complementary': 'restrained',
      'double-split-complementary': 'full',
      tetradic: 'busy',
      rectangle: 'layered',
      analogous: 'quiet',
      complementary: 'direct',
      triadic: 'bright',
      monochromatic: 'spare',
      custom: 'yours',
    }),
    long: forHarmonies({
      'split-complementary':
        'Tension kept under control: the opposite colour is approached from both sides, so the image ' +
        'stays vivid without ever squaring off. Good for work that should feel considered, not loud.',
      'double-split-complementary':
        'Both sides of the wheel split instead of clashing: near-complements on either side, so the ' +
        'image stays vivid and high-contrast without a single head-on collision. The loudest of the ' +
        'four-arm schemes and the easiest to keep glossy.',
      tetradic:
        'Four families pulling four ways — playful, toylike, busy. It reads as abundance, and it is the ' +
        'easiest harmony to overdo: keep one slot dominant and the rest small.',
      rectangle:
        'Two complementary pairs, one of them leading: four colours that arrive with a hierarchy ' +
        'already built in. Richer than a pair, calmer than a square of four equals.',
      analogous:
        'One mood, almost no friction. The classic way to make a photograph feel remembered rather than ' +
        'observed; nostalgia, weather, memory.',
      complementary:
        'Two families facing each other head-on. Immediate, high contrast, unmistakably arranged — use it ' +
        'when the picture is about a clash, not about atmosphere.',
      triadic:
        'Three balanced accents: bright, graphic, more even-handed than square and far less confrontational ' +
        'than complementary. Suits colour as subject.',
      monochromatic:
        'A single hue. Calm, austere, slightly melancholic, and the fastest way to hand the story to light ' +
        'and texture instead of colour.',
      custom:
        'Whatever you built. The read-out tells you which structure you landed on; the feeling is yours to ' +
        'decide.',
    }),
  },

  /** hue buckets — the English values are the display form of the canonical keys */
  hue: {
    red: 'red',
    'red-orange': 'red-orange',
    orange: 'orange',
    yellow: 'yellow',
    'yellow-green': 'yellow-green',
    green: 'green',
    'teal-green': 'teal-green',
    cyan: 'cyan',
    turquoise: 'turquoise',
    'sky-blue': 'sky blue',
    azure: 'azure',
    blue: 'blue',
    indigo: 'indigo',
    violet: 'violet',
    purple: 'purple',
    magenta: 'magenta',
    pink: 'pink',
  },

  harmonyName: forHarmonies({
    'split-complementary': 'Split-Complementary',
    'double-split-complementary': 'Double Split-Complementary',
    tetradic: 'Tetradic',
    rectangle: 'Rectangle',
    analogous: 'Analogous',
    complementary: 'Complementary',
    triadic: 'Triadic',
    monochromatic: 'Monochromatic',
    custom: 'Custom',
  }),
};

/** Shape every other locale must satisfy. */
export type Dict = typeof dict;
