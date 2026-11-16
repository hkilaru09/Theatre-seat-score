#pragma once

#include <string>

#include "seatscore/types.hpp"

namespace seatscore::bench {

inline constexpr int kSeatsPerBlock = 12;
inline constexpr int kBlocksPerRow = 5;
inline constexpr int kSeatsPerRow = kSeatsPerBlock * kBlocksPerRow;

// A hall of `seats` seats: rows of 60 seats in blocks of 12 split by aisles.
// bench/bench_engine.ts builds the same hall.
inline Layout synthetic(int seats) {
  Layout l;
  l.id = "synthetic-" + std::to_string(seats);
  l.name = l.id;
  l.screen = {20, 8.5, 1.2};
  l.recommendedFovDeg = 45;
  l.firstRowM = 5;
  l.rowSpacingM = 1.1;
  l.seatWidthM = 0.55;
  l.rake = {2, 0.05, 0.4};
  std::string row;
  for (int b = 0; b < kBlocksPerRow; ++b) row += (b ? "|" : "") + std::string(kSeatsPerBlock, 'x');
  for (int r = 0; r < seats / kSeatsPerRow; ++r) l.rows.push_back({"R" + std::to_string(r + 1), row, 0, 0});
  return l;
}

}  // namespace seatscore::bench
