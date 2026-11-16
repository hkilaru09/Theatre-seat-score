#include "seatscore/json_io.hpp"

#include <stdexcept>
#include <string>

#include "seatscore/scoring.hpp"

namespace seatscore {
namespace {

double number(const nlohmann::json& j, const char* key, double fallback = 0) {
  const auto it = j.find(key);
  return it == j.end() || it->is_null() ? fallback : it->get<double>();
}

std::optional<double> optionalNumber(const nlohmann::json& j, const char* key) {
  const auto it = j.find(key);
  if (it == j.end() || it->is_null()) return std::nullopt;
  return it->get<double>();
}

}  // namespace

Layout layoutFromJson(const nlohmann::json& j) {
  Layout layout;
  layout.id = j.value("id", "");
  layout.name = j.value("name", "");
  const auto& sc = j.at("screen");
  layout.screen = {sc.at("widthM").get<double>(), sc.at("heightM").get<double>(), sc.at("bottomM").get<double>()};
  layout.recommendedFovDeg = optionalNumber(j, "recommendedFovDeg");
  layout.firstRowM = j.at("firstRowM").get<double>();
  layout.rowSpacingM = j.at("rowSpacingM").get<double>();
  layout.seatWidthM = j.at("seatWidthM").get<double>();
  if (const auto it = j.find("rake"); it != j.end() && it->is_object()) {
    layout.rake = {static_cast<int>(number(*it, "frontRows")), number(*it, "frontSlopeM"), number(*it, "riserM")};
  }
  const std::string numbering = j.value("numbering", "sequential");
  if (numbering == "positional") layout.numbering = Numbering::Positional;
  else if (numbering != "sequential") throw std::invalid_argument("unknown numbering: " + numbering);
  for (const auto& row : j.at("rows")) {
    layout.rows.push_back({row.at("label").get<std::string>(), row.at("seats").get<std::string>(), number(row, "gapBeforeM"),
                           number(row, "stepM")});
  }
  if (layout.rows.empty()) throw std::invalid_argument("layout " + layout.id + " has no rows");
  return layout;
}

Prefs prefsFromJson(const nlohmann::json& j) {
  Prefs prefs;
  prefs.targetFov = optionalNumber(j, "targetFov");
  const auto& weights = j.at("weights");
  for (Factor f : kFactors) prefs.weights[index(f)] = number(weights, std::string(kFactorInfo[index(f)].key).c_str());
  return prefs;
}

nlohmann::ordered_json metricsToJson(const Metrics& m) {
  return {
      {"fov", m.fov},         {"lookUp", m.lookUp},   {"lookUpTop", m.lookUpTop}, {"offAxis", m.offAxis},
      {"mixD", m.mixD},       {"mixDist", m.mixDist}, {"mixNorm", m.mixNorm},
      {"cValue", m.cValue ? nlohmann::ordered_json(*m.cValue) : nlohmann::ordered_json(nullptr)},
  };
}

nlohmann::ordered_json factorsToJson(const FactorArray& f) {
  nlohmann::ordered_json out = nlohmann::ordered_json::object();
  for (Factor k : kFactors) out[std::string(kFactorInfo[index(k)].key)] = f[index(k)];
  return out;
}

nlohmann::ordered_json scoredSeatsToJson(const Model& model, const Scores& scores) {
  nlohmann::ordered_json seats = nlohmann::ordered_json::array();
  for (std::size_t i = 0; i < model.seats.size(); ++i) {
    const Seat& s = model.seats[i];
    const SeatScore& sc = scores[i];
    seats.push_back({
        {"id", s.id},
        {"row", s.rowLabel},
        {"number", s.number},
        {"aisle", s.aisle},
        {"kind", s.kind == SeatKind::Wheelchair ? "wheelchair" : "standard"},
        {"total", sc.total},
        {"factors", factorsToJson(sc.factors)},
        {"metrics", metricsToJson(sc.metrics)},
    });
  }
  return seats;
}

}  // namespace seatscore
