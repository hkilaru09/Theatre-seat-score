#pragma once

#include "seatscore/types.hpp"

namespace seatscore {

// Seated eye height above the floor.
inline constexpr double kEyeHeightM = 1.12;

// Floor height of row r. Front rows sit on a gentle slope, the rest on stadium risers.
double floorHeight(const Rake& rake, std::size_t r);

Model parseLayout(const Layout& layout);

// Raw geometry for one seat, in degrees and metres.
Metrics measure(const Seat& seat, const Model& model);

}  // namespace seatscore
