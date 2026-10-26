# SeatScore data

Two datasets:

- **Every cinema in the world** from OpenStreetMap, for the app's "Find your cinema" search.
- **Seat-level bookings** from Cinematheque KOFA, the Korean Film Archive's cinema in Seoul. They're used to compare SeatScore's geometry score with the seats people actually choose.

## Worldwide cinemas

All `amenity=cinema` nodes, ways and relations in OpenStreetMap (© OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright)), downloaded through the Overpass API. Countries come from each cinema's position, using [Natural Earth](https://www.naturalearthdata.com/)'s 1:10m country borders (public domain), because only about 6% of cinemas are tagged with a country.

```bash
mkdir -p raw/osm raw/naturalearth
curl -A "Theatre-seat-score (github.com/hkilaru09/Theatre-seat-score)" -o raw/osm/cinemas.json \
  https://overpass-api.de/api/interpreter \
  --data-urlencode 'data=[out:json][timeout:360];nwr["amenity"="cinema"];out center tags;'
curl -L -o raw/naturalearth/ne_10m_admin_0_countries.geojson \
  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_countries.geojson
.venv/bin/python -m pipeline.osm
```

`pipeline/osm.py` drops unnamed cinemas, merges duplicates (the same name mapped twice within 150 m), assigns countries and writes `web/public/cinemas/`: one JSON file per country plus `index.json`. The October 2026 export has 31,639 elements, which become 29,085 cinemas in 212 countries. Only 1,389 list a seat count and 6,852 a screen count, and none has a seat plan, so the app only shows real seat plans where they've been mapped (KOFA for now).

## KOFA bookings

Korean Film Archive, *시네마테크KOFA 예매내역* ([data.go.kr dataset 15129428](https://www.data.go.kr/data/15129428/fileData.do)). It has 613,406 bookings from Oct 2017 to Jul 2026 and is updated yearly. It is listed with no restrictions on use. The raw file is not committed.

## Setup

```bash
cd data
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
mkdir -p raw
curl -L -o raw/kofa_reservations.csv "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003669516&fileDetailSn=1&insertDataPrcus=N"
```

The download link is the one in the dataset page's metadata. It changes when the yearly update is published.

```bash
.venv/bin/pytest -q pipeline        # pipeline tests (no raw data needed)
.venv/bin/jupyter lab notebooks/    # open the notebooks
```

## Layout

```
pipeline/osm.py         OpenStreetMap cinemas: parse, dedupe, assign countries, write per-country JSON
pipeline/test_osm.py
pipeline/kofa.py        load_raw, parse_seats, seat_bookings, inferred_rows
pipeline/test_kofa.py   pytest suite on a small CP949 sample
pipeline/layouts.py     KOFA Hall 1 and Hall 2 as SeatScore layouts, with sources for every dimension
pipeline/test_layouts.py
notebooks/01_explore    encoding, seat format, cancellations, inferred layouts, first heatmap, distancing check
notebooks/02_layouts    official seat maps vs bookings, aisles, row S, dimension estimates; writes web/src/data/kofa_layouts.json
notebooks/03_preference SeatScore vs real choices: presets, single factors, weight fitting with time and hall holdouts, sensitivity, disagreements
pipeline/engine.py      calls the web app's TypeScript engine (web/scripts/score.ts) so scores always match the app; needs Node 22.18+
pipeline/preference.py  booking rate, early-pick rate, booking order; split-half reliability; fast grid search over slider weights
raw/                    downloaded CSV (gitignored)
processed/              kofa_seat_bookings.csv.gz, one row per booked seat (gitignored)
```

## What we know about the file

| Topic | Finding |
|---|---|
| Encoding | CP949, no BOM (not UTF-8) |
| Seat text | `O열 1번` (row O, seat 1); `(1층) H-16` from 2022; `휠체어석` for wheelchair spaces; several seats separated by `,` |
| Cancellations | Drop every booking with `cancelled > 0`. Before 2022 their seats are still listed, and from 2022 partial cancellations list only the cancelled seats |
| Multi-ticket bookings | Before 2022 they usually list only the first seat (`seats_complete = False`) |
| Hall 1 | 321 positions (317 seats + 4 wheelchair spaces). Blocks 1–6, 7–15 and 16–21. Rows A–J, then S (behind a cross aisle), then K–O. Screen 12.64 × 5.40 m |
| Hall 2 | 150 positions (148 seats + 2 wheelchair spaces). Blocks 1–2, 3–10 and 11–12. Screen 8.60 × 4.65 m |
| Popularity | Row S is Hall 1's most-booked row. Seats beside inner aisles are booked more than seats inside a block, and wall-end seats least |
| Estimates | Row spacing, first-row distance, screen height and rake are typical values, not measured |

## Does SeatScore match real choices? (notebook 03)

| Result | Hall 1 | Hall 2 |
|---|---|---|
| Ceiling: split-half reliability of early-pick rate | 0.99 | 0.99 |
| Balanced preset vs early-pick rate (Spearman ρ) | 0.58 | 0.73 |
| Balanced preset vs booking rate | 0.75 | 0.75 |
| Fitted weights, all data (in-sample) | 0.70 | 0.87 |
| Held-out years (fit 2017–20, test 2022–26): Balanced → fitted | 0.49 → 0.57 | 0.69 → 0.75 |

* Every near-best fit keeps centering and clear view at 2 or more, aisle access at 1–3, immersion at 3 or less, and a ~48° picture target. Sound and neck comfort aren't identifiable because the factors overlap.
* The results hold up to most dimension estimates. The exceptions are row S's step (the data supports a big one) and first-row distance, which trades off against the preferred picture size.
* Early bookers favor one side of each hall (Hall 1 seat 15: 29% early picks vs seat 7: 7%). Symmetric geometry can't explain this.
| Distancing | Seat neighbors almost disappear from late 2020 to early 2022. Exclude Apr 2020 – Sep 2022 from preference analysis |
