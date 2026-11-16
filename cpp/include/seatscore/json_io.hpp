#pragma once

#include <nlohmann/json.hpp>

#include "seatscore/types.hpp"

namespace seatscore {

// Layout and Prefs use the same JSON shape as the TypeScript engine.
Layout layoutFromJson(const nlohmann::json& j);
Prefs prefsFromJson(const nlohmann::json& j);

nlohmann::ordered_json metricsToJson(const Metrics& m);
nlohmann::ordered_json factorsToJson(const FactorArray& f);

// Seats with their scores, in the shape web/scripts/score.ts writes:
// [{ id, row, number, aisle, kind, total, factors, metrics }]
nlohmann::ordered_json scoredSeatsToJson(const Model& model, const Scores& scores);

}  // namespace seatscore
