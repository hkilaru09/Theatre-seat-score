#include <gtest/gtest.h>

#include <cmath>
#include <numbers>
#include <set>

#include "helpers.hpp"

namespace seatscore {
namespace {

using test::seat;
using test::tiny;

std::vector<std::string> ids(const Model& m, auto pred) {
  std::vector<std::string> out;
  for (const Seat& s : m.seats)
    if (pred(s)) out.push_back(s.id);
  return out;
}

TEST(ParseLayout, CountsSeatsAndNumbersThemLeftToRightSkippingAisles) {
  const Model m = parseLayout(tiny());
  EXPECT_EQ(m.seats.size(), 12u);
  std::vector<int> numbers;
  for (const Seat& s : m.seats)
    if (s.rowLabel == "A") numbers.push_back(s.number);
  EXPECT_EQ(numbers, (std::vector<int>{1, 2, 3, 4, 5, 6}));
}

TEST(ParseLayout, MarksSeatsBesideAnAisleOrRowEndAsAisleSeats) {
  const Model m = parseLayout(tiny());
  EXPECT_EQ(ids(m, [](const Seat& s) { return s.row == 0 && s.aisle; }), (std::vector<std::string>{"A1", "A3", "A4", "A6"}));
}

TEST(ParseLayout, PutsSeatsOnEitherSideOfAnAisleInDifferentBlocks) {
  const Model m = parseLayout(tiny());
  EXPECT_NE(seat(m, "A3").block, seat(m, "A4").block);
  EXPECT_EQ(seat(m, "A1").block, seat(m, "A3").block);
}

TEST(ParseLayout, ParsesWheelchairSpaces) {
  Layout l = tiny();
  l.rows = {{"A", "xw|wx", 0, 0}};
  const Model m = parseLayout(l);
  std::vector<SeatKind> kinds;
  for (const Seat& s : m.seats) kinds.push_back(s.kind);
  EXPECT_EQ(kinds, (std::vector<SeatKind>{SeatKind::Standard, SeatKind::Wheelchair, SeatKind::Wheelchair, SeatKind::Standard}));
}

TEST(ParseLayout, CentersEveryRowOnTheScreen) {
  const Model m = parseLayout(tiny());
  EXPECT_NEAR(seat(m, "A1").xM, -seat(m, "A6").xM, 1e-12);
}

TEST(ParseLayout, SeatsAtTheVeryEdgeOfARowAreAisleSeats) {
  Layout l = tiny();
  l.rows = {{"A", "x", 0, 0}};
  const Model m = parseLayout(l);
  ASSERT_EQ(m.seats.size(), 1u);
  EXPECT_TRUE(m.seats[0].aisle);
}

class Positional : public ::testing::Test {
 protected:
  static Layout layout() {
    Layout l = tiny();
    l.numbering = Numbering::Positional;
    l.rows = {{"A", ".x|ww..xx|x.", 0, 0}, {"B", "xx|xxxxxx|.w", 1, 0.3}};
    return l;
  }
  Model m = parseLayout(layout());
};

TEST_F(Positional, CountsGapsAndWheelchairColumnsTowardPrintedSeatNumbers) {
  EXPECT_EQ(ids(m, [](const Seat& s) { return s.row == 0; }), (std::vector<std::string>{"A2", "W1", "W2", "A7", "A8", "A9"}));
}

TEST_F(Positional, NumbersWheelchairSpacesAcrossTheWholeHall) {
  EXPECT_EQ(ids(m, [](const Seat& s) { return s.kind == SeatKind::Wheelchair; }), (std::vector<std::string>{"W1", "W2", "W3"}));
}

TEST_F(Positional, AddsARowsCrossAisleGapAndExtraStepToItAndEveryRowBehind) {
  const Layout t = tiny();
  EXPECT_NEAR(m.rows[1].dM, t.firstRowM + t.rowSpacingM + 1, 1e-12);
  EXPECT_NEAR(m.rows[1].floorM - floorHeight(t.rake, 1), 0.3, 1e-12);
}

TEST(FloorHeight, UsesTheFrontSlopeThenAddsOneRiserPerRow) {
  const Rake rake{2, 0.05, 0.4};
  EXPECT_NEAR(floorHeight(rake, 0), 0, 1e-12);
  EXPECT_NEAR(floorHeight(rake, 1), 0.05, 1e-12);
  EXPECT_NEAR(floorHeight(rake, 2), 0.5, 1e-12);
  EXPECT_NEAR(floorHeight(rake, 3), 0.9, 1e-12);
}

TEST(Measure, ComputesFieldOfViewAsTwiceAtanOfHalfWidthOverDistance) {
  const Model m = parseLayout(tiny());
  // Screen half-width 4 m at 4 m distance: 2 x 45 degrees = 90 degrees.
  EXPECT_NEAR(measure(seat(m, "A1"), m).fov, 90, 1e-9);
}

TEST(Measure, ComputesTheUpwardAngleToScreenCenterFromSeatedEyeHeight) {
  const Model m = parseLayout(tiny());
  const Layout t = tiny();
  const double centerM = t.screen.bottomM + t.screen.heightM / 2;
  const double want = std::atan((centerM - kEyeHeightM) / 4) * 180 / std::numbers::pi;
  EXPECT_NEAR(measure(seat(m, "A1"), m).lookUp, want, 1e-12);
}

TEST(Measure, HasNoCValueInTheFrontRowAndAClearViewBehindARiser) {
  const Model m = parseLayout(tiny());
  EXPECT_FALSE(measure(seat(m, "A2"), m).cValue.has_value());
  EXPECT_GT(*measure(seat(m, "B2"), m).cValue, 0.12);
}

TEST(Measure, GivesTheArthouseRoomsFlatFloorPoorClearance) {
  const Model m = parseLayout(test::layoutById("arthouse"));
  EXPECT_LT(*measure(seat(m, "F3"), m).cValue, 0.12);
}

TEST(SampleLayouts, HaveRowsOfEqualWidthAndOnlyKnownCharacters) {
  for (const Layout& l : test::allLayouts()) {
    std::set<std::size_t> widths;
    for (const RowSpec& r : l.rows) {
      widths.insert(r.seats.size());
      EXPECT_EQ(r.seats.find_first_not_of("xw|."), std::string::npos) << l.id << " row " << r.label;
    }
    EXPECT_EQ(widths.size(), 1u) << l.id;
  }
}

}  // namespace
}  // namespace seatscore
