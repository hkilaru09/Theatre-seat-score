#include <gtest/gtest.h>

#include "helpers.hpp"

namespace seatscore {
namespace {

TEST(Mulberry32, MatchesTheTypeScriptSequenceForSeed11) {
  const auto golden = test::readJson(std::string(SEATSCORE_GOLDEN_DIR) + "/mulberry32.json");
  Mulberry32 rand(golden.at("seed").get<std::uint32_t>());
  for (const auto& want : golden.at("values")) EXPECT_EQ(rand(), want.get<double>());
}

TEST(Mulberry32, StaysInZeroToOne) {
  Mulberry32 rand(1);
  for (int i = 0; i < 100000; ++i) {
    const double x = rand();
    ASSERT_GE(x, 0);
    ASSERT_LT(x, 1);
  }
}

TEST(SampleBookings, IsRepeatableForASeedAndChangesWithIt) {
  const Model m = parseLayout(test::layoutById("multiplex"));
  const Scores scores = scoreSeats(m, test::balanced());
  EXPECT_EQ(sampleBookings(m, scores, 7), sampleBookings(m, scores, 7));
  EXPECT_NE(sampleBookings(m, scores, 7), sampleBookings(m, scores, 8));
}

TEST(SampleBookings, BooksBetterSeatsMoreOften) {
  const Model m = parseLayout(test::layoutById("imax"));
  const Scores scores = scoreSeats(m, test::balanced());
  double goodTaken = 0, good = 0, poorTaken = 0, poor = 0;
  for (std::uint32_t seed = 1; seed <= 50; ++seed) {
    const Taken taken = sampleBookings(m, scores, seed);
    for (std::size_t i = 0; i < m.seats.size(); ++i) {
      if (scores[i].total >= 70) good += 1, goodTaken += taken[i];
      if (scores[i].total < 30) poor += 1, poorTaken += taken[i];
    }
  }
  ASSERT_GT(good, 0);
  ASSERT_GT(poor, 0);
  EXPECT_GT(goodTaken / good, poorTaken / poor + 0.15);
}

}  // namespace
}  // namespace seatscore
