# SeatScore C++ engine

A C++20 port of the SeatScore engine in `web/src/engine/`, built as a library, a command-line tool, a test suite and a benchmark. The TypeScript engine is the reference: on every sample layout and preset, the C++ engine gives the same seat ids, the same integer scores, the same sample bookings, the same group results and the same explanation sentences.

```
include/seatscore/   types, geometry, scoring, bookings, groups, json_io (public headers)
src/                 the library, about 800 lines with the CLI
tools/
  seatscore_cli.cpp  drop-in replacement for web/scripts/score.ts
  gen_golden.ts      runs the TypeScript engine and writes tests/golden/
tests/               GoogleTest: geometry, scoring, bookings, groups, parity
  golden/            reference output from the TypeScript engine (committed)
bench/
  bench_engine.cpp   Google Benchmark
  bench_engine.ts    the same workload in Node
```

## Build and test

Needs CMake 3.24+, Ninja and a C++20 compiler (Apple Clang 15+ or GCC 13+). nlohmann/json, GoogleTest and Google Benchmark are fetched by CMake, so there's nothing else to install.

```bash
cd cpp
cmake --preset release && cmake --build --preset release && ctest --preset release
cmake --preset asan && cmake --build --preset asan && ctest --preset asan   # AddressSanitizer + UBSan
```

The library builds with `-Wall -Wextra -Wpedantic -Wconversion -Wshadow -Werror`. CI (`.github/workflows/cpp.yml`) runs the release build on Ubuntu (GCC) and macOS (Apple Clang), the sanitizer build on Ubuntu, the parity tests against golden files freshly generated from the TypeScript engine, and the data pipeline's tests against the C++ CLI.

### Use it from the data pipeline

`seatscore_cli` reads the same JSON on stdin and writes the same JSON on stdout as `web/scripts/score.ts`, so the notebooks can switch engines:

```bash
cd data
pytest pipeline --engine cpp           # or SEATSCORE_ENGINE=cpp for the notebooks
```

### Regenerate the golden files

After any change to the TypeScript engine or the layouts:

```bash
node cpp/tools/gen_golden.ts           # from the repo root, Node 22.18+
```

## Parity

`tests/golden/` holds the TypeScript engine's output for 5 layouts (1,357 seats) × 6 presets: every seat's geometry, metrics, factor scores and total; the seat-11 sample bookings; the top 5 blocks for each group size from 1 to 10; and the explanation sentences for every seventh seat. `test_parity.cpp` checks:

- seat ids, numbers, blocks and kinds identical, in the same order;
- totals identical on all 8,142 seat × preset scores;
- metrics and factor scores within 1e-9 (in practice the largest gap is about 1e-14);
- bookings identical;
- 300 group searches (5 layouts × 6 presets × 10 sizes) giving the same blocks in the same order with the same ranks;
- explanation sentences identical, character for character.

Running the CLI and `score.ts` on the same 10 jobs gives the same keys, ids and totals, with a largest float difference of 1.4e-14.

## Design decisions

- **Value types.** `Seat`, `Row`, `Metrics` and `SeatScore` are plain structs. `Model` owns its rows and seats in `std::vector`s. There is no `new` or `delete` anywhere.
- **Optional fields.** `cValue` (none in the front row), `targetFov` and `recommendedFovDeg` are `std::optional<double>`. Optional layout fields such as `gapBeforeM`, `stepM` and `rake` default to zero, which is what `?? 0` does in the TypeScript.
- **Enums, not strings.** `Factor` and `SeatKind` are `enum class`. Weights and factor scores are a `std::array<double, 6>` indexed by `Factor`. Strings only appear at the JSON boundary.
- **Indexes instead of id lookups.** The TypeScript keys scores by seat id in a `Map`. Here scores are a `std::vector` aligned with `model.seats`, and booked seats are a `std::vector<uint8_t>`. Ids are only for input and output, so the hot loops never hash a string.
- **Runs are ranges.** Seats are stored row by row, left to right, so a run of adjacent open seats is a contiguous range of `model.seats`. The group search passes start and length around instead of copying slices (`run.slice(...)` in the TypeScript), and a candidate block is just its first seat.
- **A real O(1) deque.** The window minimum uses `std::deque`. The TypeScript version calls `Array.shift()`, which is O(k) in JavaScript; `pop_front` is O(1), so the sliding window is truly O(n).
- **No full sort of candidates.** The TypeScript sorts every candidate block, which is O(n log n). The C++ version builds a heap in O(n) and pops only until it has `limit` non-overlapping blocks. Ties break on scan order, which is exactly the order a stable sort gives, so results match. The whole group search is linear.
- **const-correctness.** Every engine function takes `const Model&` and returns a new value. Nothing changes its input.
- **Presets are `constexpr`.** `kPresets` is a `constexpr std::array`, and `explain()` builds its sentence with `std::format`.

## Parity traps

| Trap | TypeScript | C++ |
|---|---|---|
| Rounding totals | `Math.round` rounds halves up | `std::floor(x + 0.5)`, safe because totals are never negative |
| `mulberry32` | 32-bit math via `Math.imul`, `>>>` and `\| 0` | `uint32_t` throughout, where multiplication wraps the same way. The first 10 values for seed 11 match exactly |
| Sort ties | `Array.prototype.sort` is stable | Heap ordered by (rank, scan order), equivalent to a stable sort |
| `toFixed` in explanations | Rounds exact ties up: `(2.5).toFixed(0)` is `"3"` | `printf` rounds ties to even and gives `"2"`, so `toFixed()` rounds the full decimal expansion by hand |
| Row edges | `cells[c - 1]` is `undefined` at the edge, which counts as an aisle | Bounds-checked: out of range counts as an edge |
| Positional numbering | Gaps and wheelchair spaces use up numbers; wheelchair ids are `W1, W2...` across the hall | Ported as is. The KOFA layouts use it |
| `limit = 0` | The check runs after a push, so 0 means no limit | Same order of checks |
| Floating point | `Math.atan`, `Math.hypot`, `Math.exp` | Libm can differ in the last bit, so metrics are compared within 1e-9 and integer totals exactly |

## Benchmarks

Synthetic halls of 300 to 300,000 seats (rows of 60 seats in blocks of 12 between aisles, the same hall in both languages), Balanced preset, seat-11 bookings. Median of 5 repetitions in C++ (Google Benchmark) and 7 timed batches in Node. Release build (`-O2`), Apple M2, Apple Clang 21, Node 26.12.

| Benchmark | Seats | TypeScript | C++ | Speedup | C++ ns per seat |
|---|---:|---:|---:|---:|---:|
| `scoreSeats` | 300 | 70.4 µs | 11.5 µs | 6.1× | 38.3 |
| `scoreSeats` | 3,000 | 654.5 µs | 112.8 µs | 5.8× | 37.6 |
| `scoreSeats` | 30,000 | 10.96 ms | 1.12 ms | 9.8× | 37.5 |
| `scoreSeats` | 300,000 | 129.54 ms | 11.26 ms | 11.5× | 37.5 |
| `findGroups` (2) | 300 | 51.6 µs | 2.5 µs | 21.0× | 8.2 |
| `findGroups` (2) | 3,000 | 456.3 µs | 18.5 µs | 24.6× | 6.2 |
| `findGroups` (2) | 30,000 | 7.15 ms | 291.9 µs | 24.5× | 9.7 |
| `findGroups` (2) | 300,000 | 146.35 ms | 4.77 ms | 30.7× | 15.9 |
| `findGroups` (4) | 300 | 33.8 µs | 2.0 µs | 16.9× | 6.7 |
| `findGroups` (4) | 3,000 | 261.5 µs | 12.0 µs | 21.8× | 4.0 |
| `findGroups` (4) | 30,000 | 5.24 ms | 221.6 µs | 23.6× | 7.4 |
| `findGroups` (4) | 300,000 | 77.04 ms | 3.76 ms | 20.5× | 12.5 |
| `findGroups` (8) | 300 | 18.2 µs | 1.1 µs | 16.6× | 3.7 |
| `findGroups` (8) | 3,000 | 143.5 µs | 6.9 µs | 20.7× | 2.3 |
| `findGroups` (8) | 30,000 | 2.75 ms | 127.0 µs | 21.7× | 4.2 |
| `findGroups` (8) | 300,000 | 44.08 ms | 1.94 ms | 22.7× | 6.5 |

What the numbers show:

- **`scoreSeats` is exactly linear:** 37.5 ns per seat from 3,000 to 300,000 seats. It does a fixed amount of trigonometry per seat, so time per seat stays flat and the speedup comes from compiled math and contiguous structs.
- **`findGroups` does linear work, but cache effects show at scale.** Time per seat rises from about 6 ns at 3,000 seats to 16 ns at 300,000, because the seat and score arrays (about 77 MB at 300,000 seats) no longer fit in cache. A separate warm-cache timing loop measured about 15 ns per seat at 3,000, 30,000 and 300,000 seats alike. Part of the 20–30× speedup is the heap replacing the full sort, not only the language.
- Sizes 300 and 3,000 cover every real hall. The larger sizes are there to measure scaling.

To reproduce:

```bash
./build/release/seatscore_bench --benchmark_repetitions=5 --benchmark_report_aggregates_only=true
node bench/bench_engine.ts             # from cpp/
```
