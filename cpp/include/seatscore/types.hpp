// Units: metres and degrees. Distances are measured from the screen plane.
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace seatscore {

struct Screen {
  double widthM = 0;
  double heightM = 0;
  // Height of the bottom edge of the picture above the front floor.
  double bottomM = 0;
};

struct Rake {
  // Rows at the front that sit on a gentle slope instead of risers.
  int frontRows = 0;
  double frontSlopeM = 0;
  double riserM = 0;
};

struct RowSpec {
  std::string label;
  // One character per seat-width column, centered on the screen:
  // x = seat, w = wheelchair space, | = aisle, . = no seat
  std::string seats;
  // Extra distance in front of this row, such as a cross aisle.
  double gapBeforeM = 0;
  // Extra rise at this row on top of the regular rake.
  double stepM = 0;
};

// How seats get their numbers.
//   Sequential: seats count 1, 2, 3... left to right, skipping aisles and gaps.
//   Positional: every non-aisle column counts, so a gap or wheelchair space uses
//     up numbers. Wheelchair spaces get ids W1, W2... in reading order.
enum class Numbering { Sequential, Positional };

struct Layout {
  std::string id;
  std::string name;
  Screen screen;
  std::optional<double> recommendedFovDeg;
  double firstRowM = 0;
  double rowSpacingM = 0;
  double seatWidthM = 0;
  Rake rake;
  Numbering numbering = Numbering::Sequential;
  std::vector<RowSpec> rows;
};

struct Row {
  std::size_t index = 0;
  std::string label;
  std::string cells;
  double dM = 0;
  double floorM = 0;
  double eyeM = 0;
};

enum class SeatKind { Standard, Wheelchair };

struct Seat {
  std::string id;
  std::size_t row = 0;
  std::string rowLabel;
  // Seat number within the row, counting left to right and skipping aisles.
  int number = 0;
  int col = 0;
  double offsetCol = 0;
  // Seats share a block when no aisle or gap separates them. Unique within a row.
  int block = 0;
  SeatKind kind = SeatKind::Standard;
  double xM = 0;
  double dM = 0;
  double floorM = 0;
  double eyeM = 0;
  bool aisle = false;
};

struct Model {
  Layout layout;
  std::vector<Row> rows;
  std::vector<Seat> seats;
  int maxCols = 0;
};

struct Metrics {
  // Horizontal angle the screen fills.
  double fov = 0;
  // Upward angle to the center of the screen (negative = looking down).
  double lookUp = 0;
  double lookUpTop = 0;
  double offAxis = 0;
  // Distance of the mix position from the screen.
  double mixD = 0;
  double mixDist = 0;
  double mixNorm = 0;
  // Clearance over the eyes one row ahead; empty in the front row.
  std::optional<double> cValue;
};

enum class Factor { Immersion, Neck, Centering, Sound, Sightline, Aisle };

inline constexpr std::size_t kFactorCount = 6;
inline constexpr std::array<Factor, kFactorCount> kFactors = {
    Factor::Immersion, Factor::Neck, Factor::Centering, Factor::Sound, Factor::Sightline, Factor::Aisle};

// Weights and factor scores, indexed by Factor.
using FactorArray = std::array<double, kFactorCount>;

constexpr std::size_t index(Factor f) { return static_cast<std::size_t>(f); }

struct FactorInfo {
  std::string_view key;
  std::string_view label;
  std::string_view hint;
};

struct Prefs {
  // Target horizontal field of view; empty uses the layout's recommendation.
  std::optional<double> targetFov;
  FactorArray weights{};
};

struct SeatScore {
  int total = 0;
  FactorArray factors{};
  Metrics metrics;
  double targetFov = 0;
};

// One score per seat, aligned with Model::seats.
using Scores = std::vector<SeatScore>;

// Booked seats, aligned with Model::seats.
using Taken = std::vector<std::uint8_t>;

struct GroupBlock {
  // The block is model.seats[first] through model.seats[first + size - 1].
  std::size_t first = 0;
  std::size_t size = 0;
  std::string rowLabel;
  int from = 0;
  int to = 0;
  double avg = 0;
  double min = 0;
  double rank = 0;
};

}  // namespace seatscore
