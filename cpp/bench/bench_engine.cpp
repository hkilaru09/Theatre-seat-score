// Same workload as bench/bench_engine.ts, for the C++ vs TypeScript table in README.md.
#include <benchmark/benchmark.h>

#include "seatscore/seatscore.hpp"
#include "synthetic.hpp"

namespace seatscore {
namespace {

const Prefs& balanced() {
  static const Prefs prefs = findPreset("balanced")->prefs();
  return prefs;
}

void BM_ScoreSeats(benchmark::State& state) {
  const Model m = parseLayout(bench::synthetic(static_cast<int>(state.range(0))));
  for (auto _ : state) benchmark::DoNotOptimize(scoreSeats(m, balanced()));
  state.SetItemsProcessed(state.iterations() * static_cast<std::int64_t>(m.seats.size()));
  state.SetComplexityN(static_cast<benchmark::ComplexityN>(m.seats.size()));
}

void BM_FindGroups(benchmark::State& state) {
  const Model m = parseLayout(bench::synthetic(static_cast<int>(state.range(0))));
  const Scores scores = scoreSeats(m, balanced());
  const Taken taken = sampleBookings(m, scores, 11);
  const auto size = static_cast<std::size_t>(state.range(1));
  for (auto _ : state) benchmark::DoNotOptimize(findGroups(m, scores, taken, size));
  state.SetItemsProcessed(state.iterations() * static_cast<std::int64_t>(m.seats.size()));
  state.SetComplexityN(static_cast<benchmark::ComplexityN>(m.seats.size()));
}

BENCHMARK(BM_ScoreSeats)->Arg(300)->Arg(3000)->Arg(30000)->Arg(300000)->Unit(benchmark::kMicrosecond)->Complexity();
BENCHMARK(BM_FindGroups)
    ->ArgsProduct({{300, 3000, 30000, 300000}, {2, 4, 8}})
    ->Unit(benchmark::kMicrosecond);

}  // namespace
}  // namespace seatscore

BENCHMARK_MAIN();
