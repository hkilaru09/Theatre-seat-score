#pragma once

#include <array>
#include <optional>
#include <string>
#include <string_view>

#include "seatscore/types.hpp"

namespace seatscore {

// The eye line clears the head in front by 120 mm.
inline constexpr double kIdealCValueM = 0.12;
inline constexpr double kDefaultFovDeg = 40;

inline constexpr std::array<FactorInfo, kFactorCount> kFactorInfo = {{
    {"immersion", "Immersion", "How much of your view the screen fills"},
    {"neck", "Neck comfort", "How far you look up to the picture"},
    {"centering", "Centering", "How far you sit off the centerline"},
    {"sound", "Sound", "Distance from the mix position"},
    {"sightline", "Clear view", "Clearance over the head in front"},
    {"aisle", "Aisle access", "A seat next to an aisle"},
}};

struct Preset {
  std::string_view key;
  std::string_view label;
  std::optional<double> targetFov;
  // immersion, neck, centering, sound, sightline, aisle
  FactorArray weights;
  // Where the weights come from, shown when the preset is active.
  std::string_view note;

  constexpr Prefs prefs() const { return {targetFov, weights}; }
};

inline constexpr std::array<Preset, 6> kPresets = {{
    {"balanced", "Balanced", std::nullopt, {3, 3, 2, 2, 3, 0}, ""},
    {"picture", "Picture first", std::nullopt, {5, 3, 4, 1, 4, 0}, ""},
    {"sound", "Sound first", std::nullopt, {2, 2, 2, 5, 2, 0}, ""},
    {"close", "Front-row fan", 60.0, {5, 1, 2, 1, 2, 0}, ""},
    {"exit", "Easy exit", std::nullopt, {2, 2, 1, 1, 2, 5}, ""},
    // Best fit to early seat picks at Cinematheque KOFA (data/notebooks/03_preference).
    {"kofa", "KOFA crowd", 48.0, {1, 2, 3, 0, 3, 1},
     "Fitted on KOFA data: the weights that best match which seats Cinematheque KOFA viewers in Seoul booked "
     "first, 2017–2026 (2020–22 distancing period left out)."},
}};

// The preset with this key, or nullptr.
const Preset* findPreset(std::string_view key);

// The factor with this key ("immersion", ...), if there is one.
std::optional<Factor> factorFromKey(std::string_view key);

double clamp(double x, double lo, double hi);

// 1 at or below `good`, 0 at or above `bad`, linear in between.
double ramp(double x, double good, double bad);

// Bell curve around `target`, with separate widths below and above it.
double bell(double x, double target, double sigmaLow, double sigmaHigh);

FactorArray factorScores(const Metrics& m, const Seat& seat, double targetFov);

// Score every seat on a 0-100 scale as the weighted average of its factor scores.
// The result lines up with model.seats.
Scores scoreSeats(const Model& model, const Prefs& prefs);

// One plain-language sentence explaining a factor score.
std::string explain(Factor factor, const Metrics& m, const Seat& seat, double targetFov);

// Number.prototype.toFixed: the closest decimal with `digits` places, ties going up.
std::string toFixed(double x, int digits);

}  // namespace seatscore
