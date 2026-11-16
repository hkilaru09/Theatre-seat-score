// The C++ engine must match the TypeScript engine on every layout and preset.
// tests/golden/ is written by tools/gen_golden.ts from web/src/engine.
#include <gtest/gtest.h>

#include <string>

#include "helpers.hpp"

namespace seatscore {
namespace {

constexpr double kTol = 1e-9;
constexpr std::uint32_t kSeed = 11;

void expectMetrics(const Metrics& m, const nlohmann::json& g, const std::string& where) {
  EXPECT_NEAR(m.fov, g.at("fov").get<double>(), kTol) << where;
  EXPECT_NEAR(m.lookUp, g.at("lookUp").get<double>(), kTol) << where;
  EXPECT_NEAR(m.lookUpTop, g.at("lookUpTop").get<double>(), kTol) << where;
  EXPECT_NEAR(m.offAxis, g.at("offAxis").get<double>(), kTol) << where;
  EXPECT_NEAR(m.mixD, g.at("mixD").get<double>(), kTol) << where;
  EXPECT_NEAR(m.mixDist, g.at("mixDist").get<double>(), kTol) << where;
  EXPECT_NEAR(m.mixNorm, g.at("mixNorm").get<double>(), kTol) << where;
  ASSERT_EQ(m.cValue.has_value(), !g.at("cValue").is_null()) << where;
  if (m.cValue) EXPECT_NEAR(*m.cValue, g.at("cValue").get<double>(), kTol) << where;
}

class Parity : public ::testing::TestWithParam<std::string> {};

TEST_P(Parity, MatchesTheTypeScriptEngine) {
  const auto golden = test::readJson(std::string(SEATSCORE_GOLDEN_DIR) + "/" + GetParam() + ".json");
  const Model m = parseLayout(test::layoutById(GetParam()));

  // Seats: same ids in the same order, same numbering and geometry.
  const auto& seats = golden.at("seats");
  ASSERT_EQ(m.seats.size(), seats.size());
  for (std::size_t i = 0; i < m.seats.size(); ++i) {
    const Seat& s = m.seats[i];
    const auto& g = seats[i];
    ASSERT_EQ(s.id, g.at("id").get<std::string>()) << i;
    EXPECT_EQ(s.rowLabel, g.at("rowLabel").get<std::string>()) << s.id;
    EXPECT_EQ(s.number, g.at("number").get<int>()) << s.id;
    EXPECT_EQ(s.col, g.at("col").get<int>()) << s.id;
    EXPECT_EQ(s.block, g.at("block").get<int>()) << s.id;
    EXPECT_EQ(s.aisle, g.at("aisle").get<bool>()) << s.id;
    EXPECT_EQ(s.kind == SeatKind::Wheelchair, g.at("kind") == "wheelchair") << s.id;
    EXPECT_NEAR(s.xM, g.at("xM").get<double>(), kTol) << s.id;
    EXPECT_NEAR(s.dM, g.at("dM").get<double>(), kTol) << s.id;
    EXPECT_NEAR(s.eyeM, g.at("eyeM").get<double>(), kTol) << s.id;
    expectMetrics(measure(s, m), golden.at("metrics")[i], s.id);
  }

  for (const Preset& preset : kPresets) {
    const std::string key(preset.key);
    const auto& g = golden.at("presets").at(key);
    const Scores scores = scoreSeats(m, preset.prefs());

    // Totals are integers and must match exactly.
    std::size_t totalsEqual = 0;
    for (std::size_t i = 0; i < m.seats.size(); ++i) {
      EXPECT_EQ(scores[i].total, g.at("totals")[i].get<int>()) << key << " " << m.seats[i].id;
      totalsEqual += scores[i].total == g.at("totals")[i].get<int>();
      EXPECT_EQ(scores[i].targetFov, g.at("targetFov").get<double>()) << key;
      for (std::size_t f = 0; f < kFactorCount; ++f)
        EXPECT_NEAR(scores[i].factors[f], g.at("factors")[i][f].get<double>(), kTol) << key << " " << m.seats[i].id;
    }
    RecordProperty(key + "_totals_equal", std::to_string(totalsEqual) + "/" + std::to_string(m.seats.size()));

    // Bookings: the same seats, in seat order.
    const Taken taken = sampleBookings(m, scores, kSeed);
    std::vector<std::string> booked;
    for (std::size_t i = 0; i < m.seats.size(); ++i)
      if (taken[i]) booked.push_back(m.seats[i].id);
    EXPECT_EQ(booked, g.at("bookings").get<std::vector<std::string>>()) << key;

    // Groups of 1 to 10: the same blocks in the same order.
    for (const auto& [size, want] : g.at("groups").items()) {
      const auto got = findGroups(m, scores, taken, std::stoul(size), 5);
      ASSERT_EQ(got.size(), want.size()) << key << " size " << size;
      for (std::size_t k = 0; k < got.size(); ++k) {
        const std::string where = key + " size " + size + " #" + std::to_string(k);
        EXPECT_EQ(seatIds(m, got[k]), want[k].at("seats").get<std::vector<std::string>>()) << where;
        EXPECT_EQ(got[k].rowLabel, want[k].at("rowLabel").get<std::string>()) << where;
        EXPECT_EQ(got[k].from, want[k].at("from").get<int>()) << where;
        EXPECT_EQ(got[k].to, want[k].at("to").get<int>()) << where;
        EXPECT_EQ(got[k].avg, want[k].at("avg").get<double>()) << where;
        EXPECT_EQ(got[k].min, want[k].at("min").get<double>()) << where;
        EXPECT_EQ(got[k].rank, want[k].at("rank").get<double>()) << where;
      }
    }

    // Explanations: the same sentences, character for character.
    for (const auto& e : g.at("explain")) {
      const std::size_t i = test::seatIndex(m, e.at("seat").get<std::string>());
      const Factor f = *factorFromKey(e.at("factor").get<std::string>());
      EXPECT_EQ(explain(f, scores[i].metrics, m.seats[i], scores[i].targetFov), e.at("text").get<std::string>()) << key;
    }
  }
}

INSTANTIATE_TEST_SUITE_P(AllLayouts, Parity, ::testing::Values("multiplex", "imax", "arthouse", "kofa1", "kofa2"));

}  // namespace
}  // namespace seatscore
