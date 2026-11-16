#include "seatscore/scoring.hpp"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <format>

#include "seatscore/geometry.hpp"

namespace seatscore {

const Preset* findPreset(std::string_view key) {
  for (const Preset& p : kPresets)
    if (p.key == key) return &p;
  return nullptr;
}

std::optional<Factor> factorFromKey(std::string_view key) {
  for (Factor f : kFactors)
    if (kFactorInfo[index(f)].key == key) return f;
  return std::nullopt;
}

double clamp(double x, double lo, double hi) { return std::min(hi, std::max(lo, x)); }

double ramp(double x, double good, double bad) { return clamp((bad - x) / (bad - good), 0, 1); }

double bell(double x, double target, double sigmaLow, double sigmaHigh) {
  const double s = x < target ? sigmaLow : sigmaHigh;
  const double z = (x - target) / s;
  return std::exp(-0.5 * (z * z));
}

FactorArray factorScores(const Metrics& m, const Seat& seat, double targetFov) {
  FactorArray f{};
  f[index(Factor::Immersion)] = bell(m.fov, targetFov, 14, 12);
  f[index(Factor::Neck)] = ramp(m.lookUp, 12, 32) * ramp(m.lookUpTop, 30, 48) * ramp(-m.lookUp, 10, 25);
  f[index(Factor::Centering)] = ramp(m.offAxis, 4, 28);
  f[index(Factor::Sound)] = std::exp(-1.5 * (m.mixNorm * m.mixNorm));
  f[index(Factor::Sightline)] = m.cValue ? clamp((*m.cValue + 0.02) / (kIdealCValueM + 0.02), 0, 1) : 1;
  f[index(Factor::Aisle)] = seat.aisle ? 1 : 0;
  return f;
}

Scores scoreSeats(const Model& model, const Prefs& prefs) {
  const double targetFov = prefs.targetFov.value_or(model.layout.recommendedFovDeg.value_or(kDefaultFovDeg));
  double weightSum = 0;
  for (double w : prefs.weights) weightSum += w;
  if (weightSum == 0) weightSum = 1;

  Scores out;
  out.reserve(model.seats.size());
  for (const Seat& seat : model.seats) {
    const Metrics metrics = measure(seat, model);
    const FactorArray factors = factorScores(metrics, seat, targetFov);
    double total = 0;
    for (std::size_t i = 0; i < kFactorCount; ++i) total += prefs.weights[i] * factors[i];
    // Math.round rounds halves up; totals are never negative, so floor(x + 0.5) matches it.
    const int rounded = static_cast<int>(std::floor((100 * total) / weightSum + 0.5));
    out.push_back({rounded, factors, metrics, targetFov});
  }
  return out;
}

std::string toFixed(double x, int digits) {
  // Print far more digits than needed, then round the decimal string by hand:
  // printf rounds exact ties to even, while toFixed picks the larger number.
  char buf[512];
  std::snprintf(buf, sizeof buf, "%.80f", std::abs(x));
  std::string s = buf;
  const std::size_t dot = s.find('.');
  const std::size_t keep = dot + (digits > 0 ? static_cast<std::size_t>(digits) + 1 : 0);
  const bool up = s[dot + static_cast<std::size_t>(digits) + 1] >= '5';
  s.resize(keep);
  if (up) {
    std::size_t i = s.size();
    while (i-- > 0) {
      if (s[i] == '.') continue;
      if (s[i] != '9') {
        ++s[i];
        break;
      }
      s[i] = '0';
      if (i == 0) s.insert(s.begin(), '1');
    }
  }
  const bool negative = std::signbit(x) && x != 0;
  return negative ? "-" + s : s;
}

std::string explain(Factor factor, const Metrics& m, const Seat& seat, double targetFov) {
  const auto f = [](double n, int digits = 0) { return toFixed(n, digits); };
  switch (factor) {
    case Factor::Immersion:
      return std::format("Screen fills {}° of your view (target {}°).", f(m.fov), f(targetFov));
    case Factor::Neck:
      return m.lookUp >= 0
                 ? std::format("You look up {}° to the center and {}° to the top edge.", f(m.lookUp), f(m.lookUpTop))
                 : std::format("You look down {}° to the center of the picture.", f(-m.lookUp));
    case Factor::Centering:
      return m.offAxis < 1 ? "On the centerline." : std::format("{}° off the centerline.", f(m.offAxis));
    case Factor::Sound:
      return std::format("{} m from the mix position ({} m back, centered).", f(m.mixDist, 1), f(m.mixD, 1));
    case Factor::Sightline: {
      if (!m.cValue) return "Front row: nobody in front of you.";
      const double c = *m.cValue;
      if (c >= kIdealCValueM) return std::format("Eye line clears the head in front by {} mm.", f(c * 1000));
      if (c >= 0) return std::format("Only {} mm of clearance. Tall heads will cut into the bottom of the picture.", f(c * 1000));
      return std::format("Eye line is {} mm below the eyes in front. The bottom of the picture is blocked.", f(-c * 1000));
    }
    case Factor::Aisle:
      return seat.aisle ? "Next to an aisle or row end." : "Inside the row.";
  }
  return {};
}

}  // namespace seatscore
