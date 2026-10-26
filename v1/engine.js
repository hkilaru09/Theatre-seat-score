/*
 * SeatScore engine: turns a theater layout into per-seat viewing scores
 * and finds the best block of adjacent seats for a group.
 *
 * Pure functions only, no DOM. Runs in the browser (window.SeatScore)
 * and in Node (require("./engine.js")) so it can be unit tested.
 *
 * Units: metres and degrees. Distances are measured from the screen plane.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SeatScore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEG = 180 / Math.PI;
  const EYE_HEIGHT_M = 1.12; // seated eye height above the floor
  const IDEAL_C_VALUE_M = 0.12; // eye line clears the head in front by 120 mm
  const DEFAULT_FOV_DEG = 40;

  const FACTORS = [
    { key: "immersion", label: "Immersion", hint: "How much of your view the screen fills" },
    { key: "neck", label: "Neck comfort", hint: "How far you look up to the picture" },
    { key: "centering", label: "Centering", hint: "How far you sit off the centerline" },
    { key: "sound", label: "Sound", hint: "Distance from the mix position" },
    { key: "sightline", label: "Clear view", hint: "Clearance over the head in front" },
    { key: "aisle", label: "Aisle access", hint: "A seat next to an aisle" },
  ];

  const PRESETS = {
    balanced: { label: "Balanced", targetFov: null, weights: { immersion: 3, neck: 3, centering: 2, sound: 2, sightline: 3, aisle: 0 } },
    picture: { label: "Picture first", targetFov: null, weights: { immersion: 5, neck: 3, centering: 4, sound: 1, sightline: 4, aisle: 0 } },
    sound: { label: "Sound first", targetFov: null, weights: { immersion: 2, neck: 2, centering: 2, sound: 5, sightline: 2, aisle: 0 } },
    close: { label: "Front-row fan", targetFov: 60, weights: { immersion: 5, neck: 1, centering: 2, sound: 1, sightline: 2, aisle: 0 } },
    exit: { label: "Easy exit", targetFov: null, weights: { immersion: 2, neck: 2, centering: 1, sound: 1, sightline: 2, aisle: 5 } },
  };

  function clamp(x, lo, hi) {
    return Math.min(hi, Math.max(lo, x));
  }

  // 1 at or below `good`, 0 at or above `bad`, linear in between.
  function ramp(x, good, bad) {
    return clamp((bad - x) / (bad - good), 0, 1);
  }

  // Bell curve around `target`, with separate widths below and above it.
  function bell(x, target, sigmaLow, sigmaHigh) {
    const s = x < target ? sigmaLow : sigmaHigh;
    return Math.exp(-0.5 * ((x - target) / s) ** 2);
  }

  // Floor height of row r. Front rows sit on a gentle slope, the rest on stadium risers.
  function floorHeight(rake, r) {
    const front = rake.frontRows || 0;
    const slope = rake.frontSlopeM || 0;
    if (r < front) return r * slope;
    return front * slope + (r - front + 1) * (rake.riserM || 0);
  }

  /*
   * Row strings, one character per seat-width column, centered on the screen:
   *   x = seat, w = wheelchair space, | = aisle, . = no seat
   */
  function parseLayout(layout) {
    const seats = [];
    const rows = layout.rows.map((row, r) => {
      const dM = layout.firstRowM + r * layout.rowSpacingM;
      const floorM = floorHeight(layout.rake || {}, r);
      return { index: r, label: row.label, cells: row.seats, dM, floorM, eyeM: floorM + EYE_HEIGHT_M };
    });

    rows.forEach((row) => {
      const cells = row.cells;
      const mid = (cells.length - 1) / 2;
      let number = 0;
      let block = 0;
      for (let c = 0; c < cells.length; c++) {
        const ch = cells[c];
        if (ch !== "x" && ch !== "w") {
          block++;
          continue;
        }
        number++;
        const left = cells[c - 1];
        const right = cells[c + 1];
        const isEdge = (n) => n === undefined || n === "|";
        seats.push({
          id: row.label + number,
          row: row.index,
          rowLabel: row.label,
          number,
          col: c,
          offsetCol: c - mid,
          block: row.label + ":" + block,
          kind: ch === "w" ? "wheelchair" : "standard",
          xM: (c - mid) * layout.seatWidthM,
          dM: row.dM,
          floorM: row.floorM,
          eyeM: row.eyeM,
          aisle: isEdge(left) || isEdge(right),
        });
      }
    });

    const maxCols = Math.max(...rows.map((r) => r.cells.length));
    return { layout, rows, seats, maxCols };
  }

  // Raw geometry for one seat, in degrees and metres.
  function measure(seat, model) {
    const { layout, rows } = model;
    const sc = layout.screen;
    const d = seat.dM;
    const centerM = sc.bottomM + sc.heightM / 2;
    const topM = sc.bottomM + sc.heightM;

    const fov = 2 * Math.atan(sc.widthM / 2 / d) * DEG;
    const lookUp = Math.atan((centerM - seat.eyeM) / d) * DEG;
    const lookUpTop = Math.atan((topM - seat.eyeM) / d) * DEG;
    const offAxis = Math.atan(Math.abs(seat.xM) / d) * DEG;

    // Mix position: about two thirds of the way back, on the centerline.
    const depth = rows[rows.length - 1].dM + 1;
    const mixD = (2 / 3) * depth;
    const halfWidth = (model.maxCols / 2) * layout.seatWidthM;
    const mixDist = Math.hypot(d - mixD, seat.xM);
    const mixNorm = Math.hypot((d - mixD) / (depth / 2), seat.xM / halfWidth);

    // C-value: how far the sight line to the bottom of the screen passes
    // above the eyes of the person one row ahead.
    let cValue = null;
    const front = rows[seat.row - 1];
    if (front) {
      const t = (d - front.dM) / d;
      const lineAtFront = seat.eyeM + (sc.bottomM - seat.eyeM) * t;
      cValue = lineAtFront - front.eyeM;
    }

    return { fov, lookUp, lookUpTop, offAxis, mixD, mixDist, mixNorm, cValue };
  }

  function factorScores(m, seat, targetFov) {
    return {
      immersion: bell(m.fov, targetFov, 14, 12),
      neck: ramp(m.lookUp, 12, 32) * ramp(m.lookUpTop, 30, 48) * ramp(-m.lookUp, 10, 25),
      centering: ramp(m.offAxis, 4, 28),
      sound: Math.exp(-1.5 * m.mixNorm ** 2),
      sightline: m.cValue === null ? 1 : clamp((m.cValue + 0.02) / (IDEAL_C_VALUE_M + 0.02), 0, 1),
      aisle: seat.aisle ? 1 : 0,
    };
  }

  function explain(key, m, seat, targetFov) {
    const f = (n, digits = 0) => n.toFixed(digits);
    switch (key) {
      case "immersion":
        return `Screen fills ${f(m.fov)}° of your view (target ${f(targetFov)}°).`;
      case "neck":
        return m.lookUp >= 0
          ? `You look up ${f(m.lookUp)}° to the center and ${f(m.lookUpTop)}° to the top edge.`
          : `You look down ${f(-m.lookUp)}° to the center of the picture.`;
      case "centering":
        return m.offAxis < 1 ? "On the centerline." : `${f(m.offAxis)}° off the centerline.`;
      case "sound":
        return `${f(m.mixDist, 1)} m from the mix position (${f(m.mixD, 1)} m back, centered).`;
      case "sightline":
        if (m.cValue === null) return "Front row: nobody in front of you.";
        if (m.cValue >= IDEAL_C_VALUE_M) return `Eye line clears the head in front by ${f(m.cValue * 1000)} mm.`;
        if (m.cValue >= 0) return `Only ${f(m.cValue * 1000)} mm of clearance. Tall heads will cut into the bottom of the picture.`;
        return `Eye line is ${f(-m.cValue * 1000)} mm below the eyes in front. The bottom of the picture is blocked.`;
      case "aisle":
        return seat.aisle ? "Next to an aisle or row end." : "Inside the row.";
      default:
        return "";
    }
  }

  // Score every seat. Returns a Map of seat id -> { total, factors, metrics }.
  function scoreSeats(model, prefs) {
    const targetFov = prefs.targetFov || model.layout.recommendedFovDeg || DEFAULT_FOV_DEG;
    const weights = prefs.weights;
    const weightSum = FACTORS.reduce((s, f) => s + (weights[f.key] || 0), 0) || 1;
    const out = new Map();
    for (const seat of model.seats) {
      const metrics = measure(seat, model);
      const factors = factorScores(metrics, seat, targetFov);
      let total = 0;
      for (const f of FACTORS) total += (weights[f.key] || 0) * factors[f.key];
      total = Math.round((100 * total) / weightSum);
      out.set(seat.id, { total, factors, metrics, targetFov });
    }
    return out;
  }

  /*
   * Best blocks of `size` adjacent open seats.
   *
   * Seats are adjacent when they are next to each other in the same row with
   * no aisle or booked seat between them. For each run of open seats a sliding
   * window keeps the running sum, and a monotonic deque keeps the window
   * minimum, so the whole search is O(seats) plus a sort of the candidates.
   *
   * Blocks are ranked by 0.75 * average + 0.25 * lowest seat, so one bad seat
   * drags a block down more than a plain average would.
   */
  function findGroups(model, scores, taken, size, limit = 3) {
    const candidates = [];
    const byRow = new Map();
    for (const seat of model.seats) {
      if (!byRow.has(seat.row)) byRow.set(seat.row, []);
      byRow.get(seat.row).push(seat);
    }

    for (const rowSeats of byRow.values()) {
      let run = [];
      const flush = () => {
        if (run.length >= size) slide(run);
        run = [];
      };
      for (const seat of rowSeats) {
        const prev = run[run.length - 1];
        const contiguous = prev && prev.block === seat.block && seat.col === prev.col + 1;
        if (taken.has(seat.id)) {
          flush();
          continue;
        }
        if (prev && !contiguous) flush();
        run.push(seat);
      }
      flush();
    }

    function slide(run) {
      const s = run.map((seat) => scores.get(seat.id).total);
      const deque = []; // indexes with increasing scores
      let sum = 0;
      for (let i = 0; i < s.length; i++) {
        sum += s[i];
        while (deque.length && s[deque[deque.length - 1]] >= s[i]) deque.pop();
        deque.push(i);
        const start = i - size + 1;
        if (start < 0) continue;
        if (deque[0] < start) deque.shift();
        const avg = sum / size;
        const min = s[deque[0]];
        candidates.push({
          seats: run.slice(start, i + 1).map((x) => x.id),
          rowLabel: run[start].rowLabel,
          from: run[start].number,
          to: run[i].number,
          avg,
          min,
          rank: 0.75 * avg + 0.25 * min,
        });
        sum -= s[start];
      }
    }

    candidates.sort((a, b) => b.rank - a.rank);
    const picked = [];
    const used = new Set();
    for (const c of candidates) {
      if (c.seats.some((id) => used.has(id))) continue;
      picked.push(c);
      c.seats.forEach((id) => used.add(id));
      if (picked.length === limit) break;
    }
    return picked;
  }

  // Small seeded PRNG so sample bookings are repeatable.
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Sample bookings: better seats are more likely to be gone already.
  function sampleBookings(model, scores, seed) {
    const rand = mulberry32(seed);
    const taken = new Set();
    for (const seat of model.seats) {
      const q = scores.get(seat.id).total / 100;
      if (rand() < 0.1 + 0.55 * q * q) taken.add(seat.id);
    }
    return taken;
  }

  return {
    EYE_HEIGHT_M,
    IDEAL_C_VALUE_M,
    FACTORS,
    PRESETS,
    parseLayout,
    measure,
    scoreSeats,
    findGroups,
    sampleBookings,
    explain,
    _internal: { ramp, bell, floorHeight, mulberry32 },
  };
});
