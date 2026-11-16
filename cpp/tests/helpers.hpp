#pragma once

#include <fstream>
#include <stdexcept>
#include <string>
#include <vector>

#include "seatscore/json_io.hpp"
#include "seatscore/seatscore.hpp"

namespace seatscore::test {

inline nlohmann::json readJson(const std::string& path) {
  std::ifstream in(path);
  if (!in) throw std::runtime_error("cannot open " + path);
  return nlohmann::json::parse(in);
}

// The sample theaters and the KOFA halls, the same list as web/src/data/layouts.ts.
inline std::vector<Layout> allLayouts() {
  std::vector<Layout> out;
  for (const char* file : {"/layouts.json", "/kofa_layouts.json"})
    for (const auto& j : readJson(std::string(SEATSCORE_DATA_DIR) + file)) out.push_back(layoutFromJson(j));
  return out;
}

inline Layout layoutById(const std::string& id) {
  for (Layout& l : allLayouts())
    if (l.id == id) return l;
  throw std::runtime_error("no layout " + id);
}

// Two rows of six seats split by a center aisle. Small enough to check by hand.
inline Layout tiny() {
  Layout l;
  l.id = "tiny";
  l.name = "Tiny";
  l.screen = {8, 3.4, 1};
  l.recommendedFovDeg = 40;
  l.firstRowM = 4;
  l.rowSpacingM = 1;
  l.seatWidthM = 0.5;
  l.rake = {1, 0, 0.4};
  l.rows = {{"A", "xxx|xxx", 0, 0}, {"B", "xxx|xxx", 0, 0}};
  return l;
}

inline std::size_t seatIndex(const Model& m, const std::string& id) {
  for (std::size_t i = 0; i < m.seats.size(); ++i)
    if (m.seats[i].id == id) return i;
  throw std::runtime_error("no seat " + id);
}

inline const Seat& seat(const Model& m, const std::string& id) { return m.seats[seatIndex(m, id)]; }

inline Prefs balanced() { return findPreset("balanced")->prefs(); }

}  // namespace seatscore::test
