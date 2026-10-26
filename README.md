# SeatScore

SeatScore scores every seat in a movie theater for picture, sound and sightlines, then finds the best open seats for you or your group.

**Live site:** https://hkilaru09.github.io/Theatre-seat-score/ (the original static version is at [/v1/](https://hkilaru09.github.io/Theatre-seat-score/v1/))

It models the room's real geometry: screen size and height, distance to each row, row rise and seat position. It scores each seat against cinema design guidelines, then lets you reweight what matters to you.

## Features

- **Find your cinema:** search 29,085 cinemas in 212 countries from OpenStreetMap by name, city or chain, on a map. Cinemas with a real seat plan open it in the explorer.
- **Heatmap seat map** for five theaters: a stadium multiplex, an IMAX hall, a flat-floored arthouse room and the two halls of Cinematheque KOFA in Seoul, mapped from real seat plans.
- **Per-seat breakdown** with the real numbers behind each score (degrees of view, neck angle, millimetres of clearance), plus a to-scale side view of the sight lines.
- **Group finder** that returns the best blocks of 1–10 adjacent open seats and never splits a group across an aisle.
- **Preferences**: presets (Balanced, Picture first, Sound first, Front-row fan, Easy exit, and KOFA crowd, fitted on 613K real bookings), a 0–5 weight per factor and a target screen size.
- **Bookings**: random sample bookings, and a mode where you click seats to book or free them.

## How the score works

Each seat gets six factor scores from 0 to 1. The total is their weighted average on a 0–100 scale.

| Factor | Measured as | Full score when |
|---|---|---|
| Immersion | Horizontal angle the screen fills, `2·atan(W / 2d)` | Close to the target. The default is 40° (THX recommends about 36–40°, SMPTE at least 30°); IMAX uses 60° |
| Neck comfort | Upward angle to screen center and top edge | ≤ 12° to center and ≤ 30° to top |
| Centering | Angle off the screen's centerline | ≤ 4° |
| Sound | Distance from the mix position, ⅔ of the room depth on the centerline | At the mix position |
| Clear view | C-value: how far your sight line to the bottom of the screen passes above the eyes one row ahead | ≥ 120 mm |
| Aisle access | Seat at an aisle or row end | Yes |

### Group search

For each row, the search splits seats into runs of open seats that sit next to each other with no aisle between them. It slides a window of the group's size along each run. A running sum gives the average, and a monotonic deque gives the window minimum, so each run takes O(n) time. Blocks are ranked by `0.75 × average + 0.25 × lowest seat` so that nobody gets a bad seat. The top results can't overlap.

## Project layout

```
v1/                          static site (deployed under /v1/)
  index.html, styles.css     page shell and theme tokens
  engine.js                  scoring and group search, pure functions (browser and Node)
  app.js                     UI: seat map, details, group finder, preferences
  data/layouts.json          sample theaters
  tests/engine.test.js       unit tests (node --test v1/tests/*.test.js)
  scripts/build_single.py    bundles v1 into one HTML file
web/                         v2: React + TypeScript + Vite (deployed at the site root)
  src/engine/                typed port of the engine: geometry, scoring, groups, bookings
  src/engine/*.test.ts       engine tests, including a parity test against v1
  src/components/            SeatMap, SeatDetail, SideView, GroupFinder, Preferences, StatsStrip, ...
  src/state.ts               app state as a reducer, plus saved preferences
  src/App.test.tsx           component tests that click through the UI (Testing Library + jsdom)
  src/data/layouts.json      sample theaters
  src/components/CinemaFinder.tsx  worldwide cinema search, list and map (Leaflet)
  public/cinemas/            one JSON file per country, built by data/pipeline/osm.py
data/                        Python pipeline (pandas, shapely, pytest) and notebooks; see data/README.md
.github/workflows/pages.yml  type-check, lint, test and build, then deploy v2 (and v1 under /v1/)
```

### Version 2 (web/)

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest
npm run typecheck  # tsc, strict mode
npm run build
```

The engine is split into `geometry.ts` (layout parsing, angles, C-value), `scoring.ts` (factor scores, presets, explanations), `groups.ts` (group search) and `bookings.ts` (seeded sample bookings). `parity.test.ts` runs both engines on every sample layout and preset and checks that scores, metrics, bookings and group results are identical.

### Layout format

Each row is a string with one character per seat-width column, centered on the screen:

```
x = seat   w = wheelchair space   | = aisle   . = no seat
```

```json
{
  "id": "multiplex",
  "screen": { "widthM": 10.0, "heightM": 4.18, "bottomM": 1.2 },
  "recommendedFovDeg": 40,
  "firstRowM": 4.0,
  "rowSpacingM": 1.05,
  "seatWidthM": 0.56,
  "rake": { "frontRows": 3, "frontSlopeM": 0.06, "riserM": 0.4 },
  "rows": [{ "label": "A", "seats": ".xxxxx|xxxxxxxxxxxx|xxxxx." }]
}
```

## Run locally

The page loads `data/layouts.json` with `fetch`, so it needs a local server; opening the file directly won't work.

```bash
python3 -m http.server 8000 --directory v1
```

Then open http://localhost:8000.

Run the tests (Node 18 or later):

```bash
node --test v1/tests/*.test.js
```

Build a single self-contained HTML file in `v1/dist/seatscore.html`:

```bash
python3 v1/scripts/build_single.py
```

## Deploy

Every push to `main` runs the tests (v1, data pipeline, type-check, lint, Vitest) and the build, then publishes to GitHub Pages. In a fork, set **Settings → Pages → Source** to **GitHub Actions** first.

## Roadmap

- **Estimated layouts for every cinema:** generate a typical layout from a screen's seat count and format (standard, stadium, IMAX, recliner), always labeled as an estimate.
- **Real layouts from users:** a layout editor and a FastAPI + Postgres backend for submitting and reviewing real seat plans, which replace the estimates.
- **A choice model** that learns preference weights from the order in which seats were booked.

## Data

- Cinemas: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, ODbL. Countries from [Natural Earth](https://www.naturalearthdata.com/) (public domain).
- Bookings: Korean Film Archive, Cinematheque KOFA reservations ([data.go.kr 15129428](https://www.data.go.kr/data/15129428/fileData.do)).

## Assumptions

Seated eye height is 1.12 m. Sample theaters are modeled on typical room dimensions, not specific venues. Sample bookings are random, weighted so that better seats are more likely to be taken.
