#include "seatscore/geometry.hpp"

#include <algorithm>
#include <cmath>
#include <numbers>
#include <string>

namespace seatscore {
namespace {

constexpr double kDeg = 180 / std::numbers::pi;

bool isSeat(char ch) { return ch == 'x' || ch == 'w'; }

// Columns past either end of the row count as an edge, like an aisle.
bool isEdge(const std::string& cells, int c) {
  return c < 0 || c >= static_cast<int>(cells.size()) || cells[static_cast<std::size_t>(c)] == '|';
}

}  // namespace

double floorHeight(const Rake& rake, std::size_t r) {
  const auto front = static_cast<std::size_t>(std::max(rake.frontRows, 0));
  if (r < front) return static_cast<double>(r) * rake.frontSlopeM;
  return static_cast<double>(front) * rake.frontSlopeM + static_cast<double>(r - front + 1) * rake.riserM;
}

Model parseLayout(const Layout& layout) {
  Model model{layout, {}, {}, 0};
  model.rows.reserve(layout.rows.size());
  double extraD = 0;
  double extraRise = 0;
  for (std::size_t r = 0; r < layout.rows.size(); ++r) {
    const RowSpec& spec = layout.rows[r];
    extraD += spec.gapBeforeM;
    extraRise += spec.stepM;
    const double dM = layout.firstRowM + static_cast<double>(r) * layout.rowSpacingM + extraD;
    const double floorM = floorHeight(layout.rake, r) + extraRise;
    model.rows.push_back({r, spec.label, spec.seats, dM, floorM, floorM + kEyeHeightM});
  }

  const bool positional = layout.numbering == Numbering::Positional;
  int wheelchairs = 0;
  for (const Row& row : model.rows) {
    const std::string& cells = row.cells;
    const int width = static_cast<int>(cells.size());
    const double mid = (width - 1) / 2.0;
    int number = 0;
    int block = 0;
    for (int c = 0; c < width; ++c) {
      const char ch = cells[static_cast<std::size_t>(c)];
      if (positional && ch != '|') ++number;
      if (!isSeat(ch)) {
        ++block;
        continue;
      }
      if (!positional) ++number;
      const bool wheelchair = ch == 'w';
      if (wheelchair) ++wheelchairs;
      // Positional numbering names wheelchair spaces W1, W2... across the hall.
      const bool wId = positional && wheelchair;
      model.seats.push_back({
          .id = wId ? "W" + std::to_string(wheelchairs) : row.label + std::to_string(number),
          .row = row.index,
          .rowLabel = row.label,
          .number = wId ? wheelchairs : number,
          .col = c,
          .offsetCol = c - mid,
          .block = block,
          .kind = wheelchair ? SeatKind::Wheelchair : SeatKind::Standard,
          .xM = (c - mid) * layout.seatWidthM,
          .dM = row.dM,
          .floorM = row.floorM,
          .eyeM = row.eyeM,
          .aisle = isEdge(cells, c - 1) || isEdge(cells, c + 1),
      });
    }
    model.maxCols = std::max(model.maxCols, width);
  }
  return model;
}

Metrics measure(const Seat& seat, const Model& model) {
  const Screen& sc = model.layout.screen;
  const double d = seat.dM;
  const double centerM = sc.bottomM + sc.heightM / 2;
  const double topM = sc.bottomM + sc.heightM;

  Metrics m;
  m.fov = 2 * std::atan(sc.widthM / 2 / d) * kDeg;
  m.lookUp = std::atan((centerM - seat.eyeM) / d) * kDeg;
  m.lookUpTop = std::atan((topM - seat.eyeM) / d) * kDeg;
  m.offAxis = std::atan(std::abs(seat.xM) / d) * kDeg;

  // Mix position: about two thirds of the way back, on the centerline.
  const double depth = model.rows.back().dM + 1;
  m.mixD = (2.0 / 3) * depth;
  const double halfWidth = (model.maxCols / 2.0) * model.layout.seatWidthM;
  m.mixDist = std::hypot(d - m.mixD, seat.xM);
  m.mixNorm = std::hypot((d - m.mixD) / (depth / 2), seat.xM / halfWidth);

  // C-value: how far the sight line to the bottom of the screen passes
  // above the eyes of the person one row ahead.
  if (seat.row > 0) {
    const Row& front = model.rows[seat.row - 1];
    const double t = (d - front.dM) / d;
    const double lineAtFront = seat.eyeM + (sc.bottomM - seat.eyeM) * t;
    m.cValue = lineAtFront - front.eyeM;
  }
  return m;
}

}  // namespace seatscore
