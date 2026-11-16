#pragma once

#include <cstdint>

#include "seatscore/types.hpp"

namespace seatscore {

// Small seeded PRNG so sample bookings are repeatable. Same sequence as the
// TypeScript mulberry32, which works in 32-bit integers via Math.imul and >>>.
class Mulberry32 {
 public:
  explicit Mulberry32(std::uint32_t seed) : state_(seed) {}

  double operator()() {
    state_ += 0x6d2b79f5u;
    std::uint32_t t = (state_ ^ (state_ >> 15)) * (1u | state_);
    t = (t + (t ^ (t >> 7)) * (61u | t)) ^ t;
    return static_cast<double>(t ^ (t >> 14)) / 4294967296.0;
  }

 private:
  std::uint32_t state_;
};

// Sample bookings: better seats are more likely to be gone already.
Taken sampleBookings(const Model& model, const Scores& scores, std::uint32_t seed);

}  // namespace seatscore
