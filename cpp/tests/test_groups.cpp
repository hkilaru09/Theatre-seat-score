#include <gtest/gtest.h>

#include <algorithm>
#include <cmath>
#include <limits>
#include <set>

#include "helpers.hpp"

namespace seatscore {
namespace {

using test::balanced;
using test::seatIndex;
using test::tiny;

// Try every window in every row. Slow but obviously correct.
double bruteForceBest(const Model& m, const Scores& scores, const Taken& taken, std::size_t size) {
  double best = -std::numeric_limits<double>::infinity();
  for (std::size_t i = 0; i + size <= m.seats.size(); ++i) {
    bool ok = true;
    int sum = 0, low = 100;
    for (std::size_t j = i; j < i + size && ok; ++j) {
      const Seat& s = m.seats[j];
      ok = !taken[j] && s.row == m.seats[i].row && s.block == m.seats[i].block && (j == i || s.col == m.seats[j - 1].col + 1);
      sum += scores[j].total;
      low = std::min(low, scores[j].total);
    }
    if (ok) best = std::max(best, 0.75 * sum / static_cast<double>(size) + 0.25 * low);
  }
  return best;
}

Taken none(const Model& m) { return Taken(m.seats.size(), 0); }

class Tiny : public ::testing::Test {
 protected:
  Model m = parseLayout(tiny());
  Scores scores = scoreSeats(m, balanced());
};

TEST_F(Tiny, NeverCrossesAnAisleOrABookedSeat) {
  Taken taken = none(m);
  taken[seatIndex(m, "A2")] = taken[seatIndex(m, "B5")] = 1;
  for (const GroupBlock& g : findGroups(m, scores, taken, 2, 10)) {
    std::set<int> blocks;
    for (std::size_t i = g.first; i < g.first + g.size; ++i) {
      EXPECT_FALSE(taken[i]);
      blocks.insert(m.seats[i].block);
    }
    EXPECT_EQ(blocks.size(), 1u);
  }
}

TEST_F(Tiny, ReturnsNothingWhenTheGroupIsWiderThanAnyBlock) {
  EXPECT_TRUE(findGroups(m, scores, none(m), 4).empty());
}

TEST_F(Tiny, ReturnsBlocksThatDontOverlapBestFirst) {
  const auto groups = findGroups(m, scores, none(m), 2, 10);
  std::set<std::size_t> seen;
  std::size_t count = 0;
  for (const GroupBlock& g : groups)
    for (std::size_t i = g.first; i < g.first + g.size; ++i) seen.insert(i), ++count;
  EXPECT_EQ(seen.size(), count);
  for (std::size_t i = 1; i < groups.size(); ++i) EXPECT_GE(groups[i - 1].rank, groups[i].rank);
}

TEST_F(Tiny, ReportsTheWindowMinimumCorrectly) {
  for (const GroupBlock& g : findGroups(m, scores, none(m), 3, 10)) {
    int low = 100;
    for (std::size_t i = g.first; i < g.first + g.size; ++i) low = std::min(low, scores[i].total);
    EXPECT_EQ(g.min, low);
  }
}

TEST_F(Tiny, ReturnsNothingWhenEverySeatIsTaken) {
  EXPECT_TRUE(findGroups(m, scores, Taken(m.seats.size(), 1), 1).empty());
}

TEST_F(Tiny, SizeOneReturnsTheBestSingleSeats) {
  const auto groups = findGroups(m, scores, none(m), 1, 3);
  ASSERT_EQ(groups.size(), 3u);
  const int best = std::max_element(scores.begin(), scores.end(), [](auto& a, auto& b) { return a.total < b.total; })->total;
  EXPECT_EQ(groups[0].avg, best);
  for (const GroupBlock& g : groups) EXPECT_EQ(g.from, g.to);
}

TEST_F(Tiny, SizeZeroReturnsNothing) { EXPECT_TRUE(findGroups(m, scores, none(m), 0).empty()); }

TEST_F(Tiny, ReportsSeatIdsAndNumbers) {
  const auto groups = findGroups(m, scores, none(m), 3, 1);
  ASSERT_EQ(groups.size(), 1u);
  const auto ids = seatIds(m, groups[0]);
  EXPECT_EQ(ids.size(), 3u);
  EXPECT_EQ(groups[0].to - groups[0].from, 2);
  EXPECT_EQ(ids.front(), groups[0].rowLabel + std::to_string(groups[0].from));
}

TEST(FindGroups, ARunBrokenByAnAisleNeverJoinsAcrossIt) {
  Layout l = tiny();
  l.rows = {{"A", "xxxxx|xxxxx", 0, 0}};
  const Model m = parseLayout(l);
  const Scores scores = scoreSeats(m, balanced());
  EXPECT_EQ(findGroups(m, scores, none(m), 5, 10).size(), 2u);
  EXPECT_TRUE(findGroups(m, scores, none(m), 6).empty());
}

TEST(FindGroups, AGapInTheRowBreaksARunToo) {
  Layout l = tiny();
  l.rows = {{"A", "xx.xx", 0, 0}};
  const Model m = parseLayout(l);
  EXPECT_TRUE(findGroups(m, scoreSeats(m, balanced()), none(m), 3).empty());
}

TEST(FindGroups, SizeTenFitsOnlyInWideBlocks) {
  Layout l = tiny();
  l.rows = {{"A", "xxxxxxxxxx|xxxx", 0, 0}};
  const Model m = parseLayout(l);
  const auto groups = findGroups(m, scoreSeats(m, balanced()), none(m), 10, 5);
  ASSERT_EQ(groups.size(), 1u);
  EXPECT_EQ(groups[0].from, 1);
  EXPECT_EQ(groups[0].to, 10);
}

TEST(FindGroups, KeepsTheFirstOfEqualRanksLikeAStableSort) {
  // Only the aisle weight: every seat in a run inside the row scores 0, so
  // all inner pairs tie and the leftmost one must come first.
  Layout l = tiny();
  l.rows = {{"A", "xxxxxxxx", 0, 0}};
  const Model m = parseLayout(l);
  Prefs prefs;
  prefs.weights[index(Factor::Aisle)] = 1;
  const auto groups = findGroups(m, scoreSeats(m, prefs), none(m), 2, 10);
  ASSERT_EQ(groups.size(), 4u);
  // Edge pairs score 0.75*50 + 0.25*0 = 37.5 and come first, left before right.
  EXPECT_EQ(groups[0].from, 1);
  EXPECT_EQ(groups[1].from, 7);
  EXPECT_EQ(groups[2].from, 3);
  EXPECT_EQ(groups[3].from, 5);
}

TEST(FindGroups, LimitZeroReturnsEveryNonOverlappingBlockLikeTheTypeScriptVersion) {
  const Model m = parseLayout(tiny());
  EXPECT_EQ(findGroups(m, scoreSeats(m, balanced()), none(m), 3, 0).size(), 4u);
}

TEST(FindGroups, MatchesBruteForceOnEveryLayout) {
  for (const Layout& l : test::allLayouts()) {
    const Model m = parseLayout(l);
    const Scores scores = scoreSeats(m, balanced());
    for (std::size_t size : {1u, 3u, 6u}) {
      for (std::uint32_t seed : {1u, 2u, 3u}) {
        const Taken taken = sampleBookings(m, scores, seed);
        const auto best = findGroups(m, scores, taken, size, 1);
        const double want = bruteForceBest(m, scores, taken, size);
        if (std::isinf(want)) {
          EXPECT_TRUE(best.empty()) << l.id;
        } else {
          ASSERT_EQ(best.size(), 1u) << l.id;
          EXPECT_NEAR(best[0].rank, want, 1e-9) << l.id << " size " << size << " seed " << seed;
        }
      }
    }
  }
}

}  // namespace
}  // namespace seatscore
