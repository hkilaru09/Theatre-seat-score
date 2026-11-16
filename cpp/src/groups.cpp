#include "seatscore/groups.hpp"

#include <algorithm>
#include <deque>
#include <span>

namespace seatscore {
namespace {

// A window found by the slide. The block is model.seats[first, first + size).
struct Candidate {
  std::size_t first;
  double avg;
  double min;
  double rank;
};

// Slide a window of `size` over one run of open seats, model.seats[runStart, runStart + length).
void slide(const Scores& scores, std::size_t runStart, std::size_t length, std::size_t size, std::deque<std::size_t>& deque,
           std::vector<Candidate>& out) {
  deque.clear();  // run positions with increasing scores
  const auto total = [&](std::size_t i) { return scores[runStart + i].total; };
  long sum = 0;
  for (std::size_t i = 0; i < length; ++i) {
    sum += total(i);
    while (!deque.empty() && total(deque.back()) >= total(i)) deque.pop_back();
    deque.push_back(i);
    if (i + 1 < size) continue;
    const std::size_t start = i + 1 - size;
    // pop_front is O(1); the TypeScript version's Array.shift() is not.
    if (deque.front() < start) deque.pop_front();
    const double avg = static_cast<double>(sum) / static_cast<double>(size);
    const double min = total(deque.front());
    out.push_back({runStart + start, avg, min, 0.75 * avg + 0.25 * min});
    sum -= total(start);
  }
}

}  // namespace

std::vector<GroupBlock> findGroups(const Model& model, const Scores& scores, const Taken& taken, std::size_t size,
                                   std::size_t limit) {
  std::vector<GroupBlock> picked;
  if (size == 0) return picked;
  const std::span<const Seat> seats(model.seats);
  std::vector<Candidate> candidates;
  std::deque<std::size_t> deque;

  // Seats come row by row, left to right, so each run of adjacent open seats is
  // a contiguous range [runStart, runStart + runLength).
  std::size_t runStart = 0;
  std::size_t runLength = 0;
  const auto flush = [&] {
    if (runLength >= size) slide(scores, runStart, runLength, size, deque, candidates);
    runLength = 0;
  };
  for (std::size_t i = 0; i < seats.size(); ++i) {
    if (taken[i]) {
      flush();
      continue;
    }
    if (runLength > 0) {
      const Seat& prev = seats[i - 1];
      const Seat& seat = seats[i];
      if (!(prev.row == seat.row && prev.block == seat.block && seat.col == prev.col + 1)) flush();
    }
    if (runLength == 0) runStart = i;
    ++runLength;
  }
  flush();

  // Take candidates best first, in the order a stable sort by rank would give
  // (equal ranks keep their scan order, like Array.prototype.sort). A heap
  // builds in O(n) and only pops until `limit` blocks are found, so the search
  // stays linear instead of paying O(n log n) to sort every candidate.
  // Heap entries carry their rank so comparisons don't chase into `candidates`.
  struct Entry {
    double rank;
    std::size_t index;
  };
  std::vector<Entry> heap;
  heap.reserve(candidates.size());
  for (std::size_t i = 0; i < candidates.size(); ++i) heap.push_back({candidates[i].rank, i});
  const auto worse = [](const Entry& a, const Entry& b) { return a.rank < b.rank || (a.rank == b.rank && a.index > b.index); };
  std::make_heap(heap.begin(), heap.end(), worse);

  std::vector<std::uint8_t> used(seats.size(), 0);
  while (!heap.empty()) {
    std::pop_heap(heap.begin(), heap.end(), worse);
    const Candidate& c = candidates[heap.back().index];
    heap.pop_back();
    const auto first = used.begin() + static_cast<std::ptrdiff_t>(c.first);
    const auto last = first + static_cast<std::ptrdiff_t>(size);
    if (std::any_of(first, last, [](std::uint8_t u) { return u != 0; })) continue;
    std::fill(first, last, std::uint8_t{1});
    const Seat& a = seats[c.first];
    picked.push_back({c.first, size, a.rowLabel, a.number, seats[c.first + size - 1].number, c.avg, c.min, c.rank});
    if (picked.size() == limit) break;
  }
  return picked;
}

std::vector<std::string> seatIds(const Model& model, const GroupBlock& block) {
  std::vector<std::string> ids;
  ids.reserve(block.size);
  for (std::size_t i = block.first; i < block.first + block.size; ++i) ids.push_back(model.seats[i].id);
  return ids;
}

}  // namespace seatscore
