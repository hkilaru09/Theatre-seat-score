#include "seatscore/bookings.hpp"

namespace seatscore {

Taken sampleBookings(const Model& model, const Scores& scores, std::uint32_t seed) {
  Mulberry32 rand(seed);
  Taken taken(model.seats.size(), 0);
  for (std::size_t i = 0; i < model.seats.size(); ++i) {
    const double q = scores[i].total / 100.0;
    if (rand() < 0.1 + 0.55 * q * q) taken[i] = 1;
  }
  return taken;
}

}  // namespace seatscore
