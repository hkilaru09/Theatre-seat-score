#include <gtest/gtest.h>

#include <string>

#include "helpers.hpp"

namespace seatscore {
namespace {

using test::balanced;
using test::seatIndex;
using test::tiny;

TEST(RampAndBell, RampIsOneBelowGoodZeroAboveBadLinearBetween) {
  EXPECT_EQ(ramp(0, 10, 20), 1);
  EXPECT_NEAR(ramp(15, 10, 20), 0.5, 1e-12);
  EXPECT_EQ(ramp(25, 10, 20), 0);
}

TEST(RampAndBell, BellPeaksAtTheTargetAndUsesSeparateWidthsOnEachSide) {
  EXPECT_EQ(bell(40, 40, 10, 5), 1);
  EXPECT_NEAR(bell(30, 40, 10, 5), bell(45, 40, 10, 5), 1e-12);
}

TEST(ScoreSeats, KeepsEveryLayoutBetween0And100) {
  for (const Layout& l : test::allLayouts()) {
    for (const SeatScore& s : scoreSeats(parseLayout(l), balanced())) {
      EXPECT_GE(s.total, 0) << l.id;
      EXPECT_LE(s.total, 100) << l.id;
    }
  }
}

TEST(ScoreSeats, UsesTheLayoutsRecommendedFieldOfViewUnlessTheViewerSetsOne) {
  const Model imax = parseLayout(test::layoutById("imax"));
  EXPECT_EQ(scoreSeats(imax, balanced()).front().targetFov, 60);
  Prefs custom = balanced();
  custom.targetFov = 45;
  EXPECT_EQ(scoreSeats(imax, custom).front().targetFov, 45);
}

TEST(ScoreSeats, FallsBackTo40DegreesWithoutARecommendation) {
  Layout l = tiny();
  l.recommendedFovDeg.reset();
  EXPECT_EQ(scoreSeats(parseLayout(l), balanced()).front().targetFov, kDefaultFovDeg);
}

TEST(ScoreSeats, WithOnlyTheAisleWeightSetScoresAisleSeats100AndOthers0) {
  Prefs prefs;
  prefs.weights[index(Factor::Aisle)] = 1;
  const Model m = parseLayout(tiny());
  const Scores scores = scoreSeats(m, prefs);
  for (std::size_t i = 0; i < m.seats.size(); ++i) EXPECT_EQ(scores[i].total, m.seats[i].aisle ? 100 : 0);
}

TEST(ScoreSeats, AllZeroWeightsScoreEverySeatZeroInsteadOfDividingByZero) {
  const Model m = parseLayout(tiny());
  for (const SeatScore& s : scoreSeats(m, Prefs{})) EXPECT_EQ(s.total, 0);
}

TEST(ScoreSeats, RanksMultiplexSeatsTwoThirdsBackAboveTheFrontRow) {
  const Model m = parseLayout(test::layoutById("multiplex"));
  const Scores scores = scoreSeats(m, balanced());
  EXPECT_GT(scores[seatIndex(m, "K12")].total, scores[seatIndex(m, "A11")].total + 30);
}

TEST(Presets, OnlyUseWeightsTheSlidersAllow) {
  for (const Preset& p : kPresets) {
    for (double w : p.weights) {
      EXPECT_EQ(w, static_cast<int>(w)) << p.key;
      EXPECT_GE(w, 0) << p.key;
      EXPECT_LE(w, 5) << p.key;
    }
  }
}

TEST(Presets, KofaCrowdKeepsTheFittedWeights) {
  const Preset* kofa = findPreset("kofa");
  ASSERT_NE(kofa, nullptr);
  EXPECT_EQ(kofa->label, "KOFA crowd");
  EXPECT_EQ(kofa->targetFov, 48);
  EXPECT_EQ(kofa->weights, (FactorArray{1, 2, 3, 0, 3, 1}));
  EXPECT_TRUE(kofa->note.starts_with("Fitted on KOFA data"));
  EXPECT_EQ(findPreset("nope"), nullptr);
}

TEST(Presets, KofaCrowdScoresWithIts48DegreeTargetOnEveryLayout) {
  for (const Layout& l : test::allLayouts())
    EXPECT_EQ(scoreSeats(parseLayout(l), findPreset("kofa")->prefs()).front().targetFov, 48) << l.id;
}

TEST(Presets, KofaCrowdIgnoresSoundSoMovingTheMixPositionChangesNothing) {
  const Prefs kofa = findPreset("kofa")->prefs();
  const Model m = parseLayout(tiny());
  Layout deeper = tiny();
  deeper.rows.push_back({"C", "...|...", 0, 0});  // deeper room, new mix position
  const Model shifted = parseLayout(deeper);
  const Scores a = scoreSeats(m, kofa);
  const Scores b = scoreSeats(shifted, kofa);
  for (std::size_t i = 0; i < m.seats.size(); ++i) {
    EXPECT_NE(b[i].factors[index(Factor::Sound)], a[i].factors[index(Factor::Sound)]);
    EXPECT_EQ(b[i].total, a[i].total);
  }
}

TEST(FactorKeys, RoundTrip) {
  for (Factor f : kFactors) EXPECT_EQ(factorFromKey(kFactorInfo[index(f)].key), f);
  EXPECT_FALSE(factorFromKey("comfort").has_value());
}

TEST(Explain, WritesOneSentencePerFactorWithRealUnits) {
  const Model m = parseLayout(tiny());
  const std::size_t i = seatIndex(m, "B2");
  const SeatScore s = scoreSeats(m, balanced())[i];
  for (Factor f : kFactors) EXPECT_TRUE(explain(f, s.metrics, m.seats[i], s.targetFov).ends_with('.'));
  EXPECT_NE(explain(Factor::Sightline, s.metrics, m.seats[i], s.targetFov).find("mm"), std::string::npos);
}

TEST(ToFixed, RoundsTiesUpLikeJavaScript) {
  EXPECT_EQ(toFixed(2.5, 0), "3");  // printf("%.0f") gives "2"
  EXPECT_EQ(toFixed(0.5, 0), "1");
  EXPECT_EQ(toFixed(1.25, 1), "1.3");
  EXPECT_EQ(toFixed(1.005, 2), "1.00");  // 1.005 is really 1.00499999...
  EXPECT_EQ(toFixed(9.96, 1), "10.0");
  EXPECT_EQ(toFixed(99.5, 0), "100");
  EXPECT_EQ(toFixed(-0.4, 0), "-0");
  EXPECT_EQ(toFixed(0, 1), "0.0");
}

}  // namespace
}  // namespace seatscore
