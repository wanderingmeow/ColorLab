# Color Lab

Color Lab reads colors out of a photograph and shows you what the classical color harmonies would do
to them. You drop an image on the page, mark the colors you care about, and the app lays them on a
hue wheel with the harmony's skeleton drawn through them. Each suggestion is a distance you can
see: how far this color has to turn to join the scheme, and the color it would become.

Everything happens in your browser tab. Color Lab reads pixels from the decoded image and sends
nothing anywhere, so there is no upload to undo and a reload loses the photo. What it remembers are
your settings: language, the size of the sample area, the neutral floor, how suggestions are
computed, and whether you want the mood notes.

## Run it

You need Node.js 20.19 or newer, or 22.12 or newer.

```bash
npm install
npm run dev         # http://localhost:5173
npm run build       # static files in dist/
npm run preview     # serve that build
```

`dist/` is a folder of static files, so any web host works: GitHub Pages, nginx, a shared drive.
The live site is at <https://wanderingmeow.github.io/ColorLab/>, which is why the build sets
`base` to the repo name; the dev server keeps its root, so localhost stays localhost.

## Step 1: pick your colors

Press `Suggest` and Color Lab reads the frame for you, placing 4 to 8 numbered points where the
photo holds the most distinct colors. Drag your own points anywhere you like.

A loupe follows the point and marks the patch it reads. Near an edge the loupe flips to the other
side so you can see what it is reading. `Sample area` runs from 3×3 to 32×32 and reports the
median color of that area, so one bright pixel inside a large patch cannot drag the reading. When the patch
straddles a light and dark edge the app tells you, and the patch stops at the frame instead of
sampling outside it, drawing the part outside as hatching.

The number on a point is its place in the list. Drag a number to reorder, and the dot on the
photo and the chip on the wheel take the new number at the same time. `Alt+↑/↓` moves a row one step, and
one reorder takes one `⌘Z` to undo.

Each row lets you name the color, copy its hex, read its HSL values and a color name, lock it,
ignore it, or remove it. Lock pins the harmony skeleton to that color. Ignore keeps the color in the
list while leaving it out of the analysis.

`⌘V` pastes a screenshot from your clipboard. Dropping a file on the photo replaces the photo, and
every point keeps its position and reads its new color there. The loop this tool is built for:
sample, grade the image in your editor, drop the result back, read the harmony again.

## The hue map

Both steps draw your photograph into a second, smaller wheel. The app places every pixel of the
image by its color, where the angle gives the hue and the distance from the center gives the
saturation. The colored rim uses the same model as the big wheel, so the two circles are one
coordinate system, and a dot sits on top of its own color. The map drops pixels too gray to plot,
because their hue tells you nothing you can act on.

Numbered points sit on the map at the same positions they hold on the big wheel, which lets the map
answer a question the list cannot: a cloudbody with no number in it is a color your list does not
have. Step 1 puts the map above the list, where you decide what to add. Step 2 puts it under the
thumbnail with the harmony skeleton on top, so you can check whether that scheme lives in this
photo.

The map gives no cluster a name. It works from color numbers, so it cannot tell you which cloudbody
is skin and which is sky.

## Step 2: read the harmony

The step opens on `Harmony guide`: your colors on the wheel, the skeleton drawn through them, dashed
ghost targets filled with the color being suggested, and an arrow from each dot's edge to the target
it aims at. `Natural` shows your colors at their real saturation and draws a dashed circle for the
neutral floor, and inside that circle a hue stops being trustworthy because those colors sit close to
gray. `Pure hues` flattens everything to the rim, which makes the relationships between your colors
easier to read.

The panel names the harmony it detected, scores it, and describes that harmony's mood in a
word and a sentence. `Why this number?` breaks the score into how far your colors drift and how much
of the skeleton they cover. `Adjustments` then speaks to each color: `Shift toward X` or `Big shift
toward X` with the hex to move it to, `✓ Aligned` when it already stands on an arm, or a note that
the change is too small for the eye to see. `Move` has two settings: `Match intensity` keeps the
relationships between your colors, and `Hue only` sends them to absolute hues.

Each adjustment also carries `applies to`, naming the hue band and the lightness band the move belongs
to. Editors work band by band, so that name is the part you can type in. Hover it for the matching
control in Lightroom, Camera Raw, Photoshop Hue/Saturation, or a Hue vs Hue curve in DaVinci Resolve.

Two more notes show up when they apply, under the same switch that flags invisible moves. One says a
move would carry a color away from the sky, the foliage or skin the way viewers remember them:
preference follows memory color, so a move can improve the harmony and still feel wrong. The other
reports a low-chroma, bright, cool color and the share of the frame it covers, then asks whether that
band is distance seen through air. Only you know that. If it is, leaving it off the skeleton keeps the
depth in the picture.

`Try another harmony` lists all nine: Split-Complementary, Double Split-Complementary, Tetradic,
Rectangle, Analogous, Complementary, Triadic, Monochromatic and Custom. Each button shows its own
score and mood. Color Lab disables a harmony your colors cannot fill, and its tooltip
says what is missing.

`Custom` lets you place the scheme yourself. Dragging a dot drops a target on the wheel, a dashed
ring in the target color with an arrow, while the dot stays where its real color sits. Your photo and
your intention stay apart. `Delete` or the ✕ on a target takes one back, and `Take them all back` in
the panel restores every one of them. A target you placed belongs to Custom: switch to another harmony
and the app reads your measured colors again.

## What Color Lab will not do

- **Name a harmony it cannot fill.** Tetradic, Rectangle and Double Split-Complementary need four
  different hues, and three colors cannot produce four, so Color Lab disables those buttons rather
  than claim a perfect score for a scheme you cannot reach. When a scheme has an empty arm and your
  colors can spare a duplicate, the app moves one and tells you it did.
- **Offer a change you cannot see.** Below the eye's threshold a suggestion becomes an explanation:
  this color sits close to gray, its hue is rounding noise, and raising its saturation is the move
  that would make it read as a hue.
- **Tell a locked color to move.** Two locks that contradict each other get a distance and a
  request: unlock one, or pick another harmony.
- **Volunteer Rectangle or Double Split-Complementary.** Four arms put a slot near almost every
  color, so the score looks better than the scheme is. Both stay in the picker with their honest
  score for the times you choose them yourself.
- **Show you an internal identifier.** Numbers on screen are list positions, and the dot on the
  wheel and the row in the list carry the same one.
- **Hide an action behind an icon.** Every action button carries a word next to its icon.

## Good to know

- Color names are approximate. We tuned the name table on a few known colors, so a hue sitting near
  a band edge can get its neighbor's name.
- The score ranks harmonies against each other. It cannot tell you how good a palette looks.
- A sample's weight mixes how strong its color is with how much of the frame it stands for, and that
  pushes four-arm harmonies upward. Two of them stay out of automatic detection for this reason.
- iPhone HEIC files will not load. Convert to JPEG or PNG first.
- Color Lab saves nothing about your photo. Copy the hex values you want before you close the page,
  because a reload starts you over.
