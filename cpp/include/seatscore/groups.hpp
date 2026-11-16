#pragma once

#include <string>
#include <vector>

#include "seatscore/types.hpp"

namespace seatscore {

// Best blocks of `size` adjacent open seats.
//
// Seats are adjacent when they are next to each other in the same row with no
// aisle or booked seat between them. For each run of open seats a sliding
// window keeps the running sum, and a monotonic deque keeps the window
// minimum, so the whole search is O(seats) plus a sort of the candidates.
//
// Blocks are ranked by 0.75 * average + 0.25 * lowest seat, so one bad seat
// drags a block down more than a plain average would. Results never overlap.
std::vector<GroupBlock> findGroups(const Model& model, const Scores& scores, const Taken& taken, std::size_t size,
                                   std::size_t limit = 3);

// Seat ids of a block, for output.
std::vector<std::string> seatIds(const Model& model, const GroupBlock& block);

}  // namespace seatscore
