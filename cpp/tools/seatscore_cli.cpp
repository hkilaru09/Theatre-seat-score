// Score layouts from the command line, for the data notebooks. Same contract as
// web/scripts/score.ts:
// Reads JSON on stdin: { "jobs": [{ "key": any, "layout": Layout, "prefs": Prefs }] }
// Writes JSON on stdout: { "results": [{ "key", "seats": [{ id, row, number, aisle, kind, total, factors, metrics }] }] }
// Run: seatscore_cli < jobs.json
#include <exception>
#include <iostream>

#include "seatscore/json_io.hpp"
#include "seatscore/seatscore.hpp"

int main() {
  using namespace seatscore;
  try {
    const nlohmann::json input = nlohmann::json::parse(std::cin);
    nlohmann::ordered_json results = nlohmann::ordered_json::array();
    for (const auto& job : input.at("jobs")) {
      const Model model = parseLayout(layoutFromJson(job.at("layout")));
      const Scores scores = scoreSeats(model, prefsFromJson(job.at("prefs")));
      results.push_back({{"key", nlohmann::ordered_json::parse(job.value("key", nlohmann::json()).dump())},
                         {"seats", scoredSeatsToJson(model, scores)}});
    }
    std::cout << nlohmann::ordered_json{{"results", std::move(results)}}.dump();
  } catch (const std::exception& e) {
    std::cerr << "seatscore_cli: " << e.what() << '\n';
    return 1;
  }
  return 0;
}
