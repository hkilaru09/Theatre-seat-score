/* SeatScore UI: renders the seat map, seat details, group finder and preferences. */
(function () {
  "use strict";

  const S = window.SeatScore;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const STORE_KEY = "seatscore:prefs:v1";

  const BANDS = [
    { min: 90, cls: "h5", label: "Best" },
    { min: 80, cls: "h4", label: "Great" },
    { min: 65, cls: "h3", label: "Good" },
    { min: 50, cls: "h2", label: "Fair" },
    { min: 0, cls: "h1", label: "Avoid" },
  ];
  const band = (score) => BANDS.find((b) => score >= b.min);

  const state = {
    layouts: [],
    index: 0,
    presetKey: "balanced",
    prefs: clonePrefs(S.PRESETS.balanced),
    groupSize: 2,
    selected: null,
    activeGroup: 0,
    editing: false,
    taken: {}, // layout id -> Set of seat ids
    seeds: {}, // layout id -> sample seed
  };

  let model = null;
  let scores = null;
  let groups = [];

  const $ = (id) => document.getElementById(id);

  function clonePrefs(p) {
    return { targetFov: p.targetFov, weights: { ...p.weights } };
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "text") node.textContent = v;
      else if (k === "class") node.className = v;
      else if (v !== false && v !== null && v !== undefined) node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c) node.append(c);
    return node;
  }

  function svg(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (saved && saved.weights) {
        state.prefs = { targetFov: saved.targetFov ?? null, weights: { ...state.prefs.weights, ...saved.weights } };
        state.presetKey = saved.presetKey || "custom";
        state.groupSize = saved.groupSize || 2;
      }
    } catch (e) {
      /* storage unavailable; defaults are fine */
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ ...state.prefs, presetKey: state.presetKey, groupSize: state.groupSize }));
    } catch (e) {
      /* ignore */
    }
  }

  // ---------- data ----------

  async function loadLayouts() {
    if (Array.isArray(window.SEATSCORE_LAYOUTS)) return window.SEATSCORE_LAYOUTS;
    const res = await fetch("data/layouts.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  function layout() {
    return state.layouts[state.index];
  }

  function takenSet() {
    const L = layout();
    if (!state.taken[L.id]) {
      // Sample bookings use the balanced preset so they don't move when preferences change.
      const base = S.scoreSeats(model, S.PRESETS.balanced);
      state.seeds[L.id] = state.seeds[L.id] || 7;
      state.taken[L.id] = S.sampleBookings(model, base, state.seeds[L.id]);
    }
    return state.taken[L.id];
  }

  function recompute() {
    scores = S.scoreSeats(model, state.prefs);
    groups = S.findGroups(model, scores, takenSet(), state.groupSize, 3);
    if (state.activeGroup >= groups.length) state.activeGroup = 0;
  }

  function bestSeat(openOnly) {
    const taken = takenSet();
    let best = null;
    for (const seat of model.seats) {
      if (openOnly && taken.has(seat.id)) continue;
      const t = scores.get(seat.id).total;
      if (!best || t > best.t || (t === best.t && Math.abs(seat.offsetCol) < Math.abs(best.seat.offsetCol))) best = { seat, t };
    }
    return best;
  }

  // ---------- render ----------

  function render() {
    renderTabs();
    renderStats();
    renderMap();
    renderGroups();
    renderDetail();
    renderPrefs();
  }

  function renderTabs() {
    const tabs = $("tabs");
    tabs.replaceChildren(
      ...state.layouts.map((L, i) => {
        const b = el("button", { class: "tab", type: "button", role: "tab", "aria-selected": String(i === state.index), text: L.name });
        b.addEventListener("click", () => selectLayout(i));
        return b;
      })
    );
  }

  function renderStats() {
    const taken = takenSet();
    const total = model.seats.length;
    const open = model.seats.filter((s) => !taken.has(s.id));
    const great = model.seats.filter((s) => scores.get(s.id).total >= 80).length;
    const best = bestSeat(false);
    const bestOpen = bestSeat(true);
    const g = groups[0];

    const stat = (label, value, sub) =>
      el("div", { class: "stat" }, [el("span", { class: "eyebrow", text: label }), el("span", { class: "value", text: value }), el("span", { class: "sub", text: sub })]);

    $("stats").replaceChildren(
      stat("Best seat", `${best.seat.id} · ${best.t}`, bestOpen && bestOpen.seat.id !== best.seat.id ? `Best open: ${bestOpen.seat.id} · ${bestOpen.t}` : "Still open"),
      stat("Seats 80 or higher", `${Math.round((100 * great) / total)}%`, `${great} of ${total} seats`),
      stat(`Best ${state.groupSize} together`, g ? `Row ${g.rowLabel} · ${g.from}–${g.to}` : "None open", g ? `Average ${Math.round(g.avg)}, lowest ${g.min}` : "Try a smaller group"),
      stat("Booked", `${total - open.length} / ${total}`, "Sample bookings")
    );
  }

  function renderMap() {
    const L = layout();
    $("map-kind").textContent = L.kind;
    $("map-meta").textContent =
      `Screen ${L.screen.widthM.toFixed(1)} × ${L.screen.heightM.toFixed(1)} m · ${model.rows.length} rows · ${model.seats.length} seats · first row ${L.firstRowM} m from the screen · ${L.note}`;

    const CELL = 22;
    const SEAT = 18;
    const ROW_H = 26;
    const LABEL_W = 30;
    const TOP = 64;
    const seatCols = model.maxCols;
    const screenCols = L.screen.widthM / L.seatWidthM;
    const cols = Math.max(seatCols, screenCols);
    const width = LABEL_W * 2 + cols * CELL;
    const height = TOP + model.rows.length * ROW_H + 18;
    const cx = width / 2;

    const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `Seat map for ${L.name}` });

    // Screen, drawn to scale with the seat columns.
    const sw = screenCols * CELL;
    const x0 = cx - sw / 2;
    const x1 = cx + sw / 2;
    root.append(svg("path", { class: "screen-glow", d: `M ${x0} 16 Q ${cx} 6 ${x1} 16 L ${x1 - sw * 0.06} 54 L ${x0 + sw * 0.06} 54 Z` }));
    root.append(svg("path", { class: "screen-line", d: `M ${x0} 16 Q ${cx} 6 ${x1} 16` }));
    const sl = svg("text", { class: "screen-label", x: cx, y: 34, "text-anchor": "middle" });
    sl.textContent = `SCREEN · ${L.screen.widthM.toFixed(1)} M`;
    root.append(sl);

    const rowY = (r) => TOP + r * ROW_H;
    const colX = (row, c) => cx + (c - (row.cells.length - 1) / 2) * CELL - SEAT / 2;

    // Mix position marker, interpolated between rows.
    const m0 = scores.get(model.seats[0].id).metrics.mixD;
    const rows = model.rows;
    let mixY = rowY(rows.length - 1) + SEAT / 2;
    for (let r = 0; r < rows.length - 1; r++) {
      if (m0 >= rows[r].dM && m0 <= rows[r + 1].dM) {
        const t = (m0 - rows[r].dM) / (rows[r + 1].dM - rows[r].dM);
        mixY = rowY(r) + SEAT / 2 + t * ROW_H;
      }
    }
    rows.forEach((row) => {
      const y = rowY(row.index);
      for (const side of [LABEL_W / 2 + (cols - seatCols) * CELL * 0.5, width - LABEL_W / 2 - (cols - seatCols) * CELL * 0.5]) {
        const t = svg("text", { class: "row-label", x: side, y: y + SEAT / 2 + 4, "text-anchor": "middle" });
        t.textContent = row.label;
        root.append(t);
      }
    });

    const taken = takenSet();
    const groupIds = new Map();
    groups.forEach((g, gi) => g.seats.forEach((id) => groupIds.set(id, gi)));

    for (const seat of model.seats) {
      const row = rows[seat.row];
      const x = colX(row, seat.col);
      const y = rowY(seat.row);
      const s = scores.get(seat.id);
      const b = band(s.total);
      const isTaken = taken.has(seat.id);
      const cls = ["seat", b.cls, isTaken ? "taken" : "", state.selected === seat.id ? "selected" : ""].join(" ");
      const g = svg("g", {
        class: cls,
        tabindex: "0",
        role: "button",
        "data-id": seat.id,
        "aria-label": `Row ${seat.rowLabel} seat ${seat.number}, score ${s.total}, ${isTaken ? "booked" : "open"}`,
      });
      const title = svg("title");
      title.textContent = `${seat.id} · ${s.total} (${b.label})${isTaken ? " · booked" : ""}`;
      g.append(title);
      g.append(svg("rect", { class: "body", x, y, width: SEAT, height: SEAT, rx: seat.kind === "wheelchair" ? 9 : 4 }));
      if (seat.kind === "wheelchair") g.append(svg("circle", { class: "wc", cx: x + SEAT / 2, cy: y + SEAT / 2, r: 3 }));
      if (isTaken) g.append(svg("path", { class: "cross", d: `M ${x + 5} ${y + 5} L ${x + SEAT - 5} ${y + SEAT - 5} M ${x + SEAT - 5} ${y + 5} L ${x + 5} ${y + SEAT - 5}` }));
      root.append(g);
    }

    // Outline each recommended group.
    groups.forEach((grp, gi) => {
      const first = model.seats.find((s) => s.id === grp.seats[0]);
      const last = model.seats.find((s) => s.id === grp.seats[grp.seats.length - 1]);
      const row = rows[first.row];
      const x = colX(row, first.col) - 3;
      const w = colX(row, last.col) + SEAT + 3 - x;
      root.append(svg("rect", { class: "group-box" + (gi === state.activeGroup ? " active" : ""), x, y: rowY(first.row) - 3, width: w, height: SEAT + 6, rx: 6 }));
    });

    // Mix position crosshair sits on top of the seats but ignores clicks.
    root.append(svg("circle", { class: "mix-mark", cx, cy: mixY, r: 13 }));
    root.append(svg("path", { class: "mix-mark", d: `M ${cx - 20} ${mixY} H ${cx + 20} M ${cx} ${mixY - 20} V ${mixY + 20}` }));

    $("map").replaceChildren(root);

    $("legend").replaceChildren(
      ...BANDS.slice()
        .reverse()
        .map((bd, i, arr) => {
          const next = arr[i + 1];
          const range = next ? `${bd.min}–${next.min - 1}` : `${bd.min}+`;
          return el("span", {}, [el("i", { class: "swatch " + bd.cls }), document.createTextNode(`${bd.label} ${range}`)]);
        }),
      el("span", {}, [el("i", { class: "swatch taken" }), document.createTextNode("Booked")]),
      el("span", {}, [el("i", { class: "swatch sel" }), document.createTextNode("Selected")]),
      el("span", {}, [el("i", { class: "swatch mix" }), document.createTextNode("Mix position (sound sweet spot)")])
    );

    $("booked-count").textContent = state.editing ? "Click seats to book or free them." : "";
    $("edit-toggle").setAttribute("aria-pressed", String(state.editing));
  }

  function renderGroups() {
    $("group-size").textContent = state.groupSize;
    $("group-label").textContent = state.groupSize === 1 ? "person" : "people";
    $("group-minus").disabled = state.groupSize <= 1;
    $("group-plus").disabled = state.groupSize >= 10;
    const list = $("results");
    if (!groups.length) {
      list.replaceChildren(el("li", {}, el("p", { class: "empty", text: `No ${state.groupSize} open seats sit side by side. Try a smaller group or clear some bookings.` })));
      return;
    }
    list.replaceChildren(
      ...groups.map((g, i) => {
        const b = el("button", { class: "result", type: "button", "aria-pressed": String(i === state.activeGroup) }, [
          el("span", { class: "rank", text: String(i + 1) }),
          el("span", {}, [
            el("span", { class: "where", text: `Row ${g.rowLabel}, seats ${g.from}${g.to !== g.from ? "–" + g.to : ""}` }),
            el("br"),
            el("span", { class: "detail", text: `Lowest seat ${g.min}` }),
          ]),
          el("span", { class: "avg", text: String(Math.round(g.avg)) }),
        ]);
        b.addEventListener("click", () => {
          state.activeGroup = i;
          state.selected = g.seats[Math.floor(g.seats.length / 2)];
          renderMap();
          renderGroups();
          renderDetail();
        });
        return el("li", {}, b);
      })
    );
  }

  function renderDetail() {
    const panel = $("detail");
    const seat = model.seats.find((s) => s.id === state.selected);
    if (!seat) return;
    const s = scores.get(seat.id);
    const b = band(s.total);
    const isTaken = takenSet().has(seat.id);
    const kind = seat.kind === "wheelchair" ? "Wheelchair space" : seat.aisle ? "Aisle seat" : "Standard seat";

    const factors = S.FACTORS.map((f) => {
      const w = state.prefs.weights[f.key] || 0;
      const v = s.factors[f.key];
      return el("li", { class: "factor" + (w === 0 ? " off" : "") }, [
        el("div", { class: "top" }, [el("b", { text: f.label }), el("span", { class: "num", text: `${Math.round(v * 100)} · weight ${w}` })]),
        el("div", { class: "bar" }, el("i", { style: `width:${Math.round(v * 100)}%` })),
        el("div", { class: "why", text: S.explain(f.key, s.metrics, seat, s.targetFov) }),
      ]);
    });

    panel.replaceChildren(
      el("div", { class: "seat-head" }, [
        el("div", {}, [
          el("span", { class: "eyebrow", text: "Selected seat" }),
          el("h3", { id: "detail-title", text: `Row ${seat.rowLabel}, seat ${seat.number}` }),
          el("span", { class: "kind", text: `${kind} · ${seat.dM.toFixed(1)} m from the screen` }),
        ]),
        el("div", { class: "score" }, [
          el("span", { class: "big num", text: String(s.total) }),
          isTaken ? el("span", { class: "pill taken", text: "Booked" }) : el("span", { class: "pill " + b.cls, text: b.label }),
        ]),
      ]),
      el("ul", { class: "factors" }, factors),
      el("div", { class: "section-view" }, sectionView(seat)),
      el("p", { class: "caption", text: `Side view of row ${seat.rowLabel}, drawn to scale. Red lines run from your eyes to the top and bottom of the screen; the grey dot is the head in front.` })
    );
  }

  // Side elevation of the room for the selected seat's row.
  function sectionView(seat) {
    const L = layout();
    const rows = model.rows;
    const last = rows[rows.length - 1];
    const depth = last.dM + 1.2;
    const topM = L.screen.bottomM + L.screen.heightM;
    const tall = Math.max(topM, last.eyeM + 0.4) + 0.6;
    const W = 340;
    const scale = W / (depth + 0.8);
    const H = Math.round(tall * scale) + 18;
    const X = (d) => 8 + d * scale;
    const Y = (h) => H - 14 - h * scale;

    const root = svg("svg", { viewBox: `0 0 ${W + 16} ${H}`, role: "img", "aria-label": "Side view of the sight lines" });

    // Stepped floor.
    let d = `M ${X(0)} ${Y(0)}`;
    rows.forEach((row, i) => {
      const start = i === 0 ? 0 : row.dM - L.rowSpacingM / 2;
      d += ` L ${X(start)} ${Y(row.floorM)} L ${X(row.dM + L.rowSpacingM / 2)} ${Y(row.floorM)}`;
    });
    d += ` L ${X(depth)} ${Y(last.floorM)} L ${X(depth)} ${Y(0)} Z`;
    root.append(svg("path", { class: "sv-floor", d }));

    root.append(svg("line", { class: "sv-screen", x1: X(0), y1: Y(L.screen.bottomM), x2: X(0), y2: Y(topM) }));

    const row = rows[seat.row];
    const ex = X(row.dM);
    const ey = Y(row.eyeM);
    root.append(svg("line", { class: "sv-ray", x1: ex, y1: ey, x2: X(0), y2: Y(topM) }));
    root.append(svg("line", { class: "sv-ray dash", x1: ex, y1: ey, x2: X(0), y2: Y(L.screen.bottomM) }));

    const front = rows[seat.row - 1];
    if (front) {
      root.append(svg("circle", { class: "sv-head", cx: X(front.dM), cy: Y(front.eyeM + 0.05), r: Math.max(3, 0.11 * scale) }));
    }
    root.append(svg("circle", { class: "sv-eye", cx: ex, cy: ey, r: 3.5 }));

    const label = svg("text", { class: "sv-text", x: X(0) + 6, y: Y(topM) + 10 });
    label.textContent = `screen ${L.screen.heightM.toFixed(1)} m tall`;
    root.append(label);
    const dl = svg("text", { class: "sv-text", x: Math.min(ex, W - 60), y: H - 2, "text-anchor": "middle" });
    dl.textContent = `${row.dM.toFixed(1)} m`;
    root.append(dl);
    return root;
  }

  function renderPrefs() {
    $("presets").replaceChildren(
      ...Object.entries(S.PRESETS).map(([key, p]) => {
        const c = el("button", { class: "chip", type: "button", "aria-pressed": String(state.presetKey === key), text: p.label });
        c.addEventListener("click", () => {
          state.presetKey = key;
          state.prefs = clonePrefs(p);
          update();
        });
        return c;
      })
    );

    const sliders = $("sliders");
    if (!sliders.childElementCount) {
      for (const f of S.FACTORS) {
        const id = "w-" + f.key;
        const input = el("input", { type: "range", id, min: "0", max: "5", step: "1", title: f.hint });
        const out = el("output", { for: id, id: id + "-out" });
        input.addEventListener("input", () => {
          state.prefs.weights[f.key] = Number(input.value);
          state.presetKey = "custom";
          update();
        });
        sliders.append(el("div", { class: "slider" }, [el("label", { for: id, text: f.label, title: f.hint }), input, out]));
      }
    }
    for (const f of S.FACTORS) {
      $("w-" + f.key).value = state.prefs.weights[f.key];
      $("w-" + f.key + "-out").textContent = state.prefs.weights[f.key];
    }

    const target = scores.get(model.seats[0].id).targetFov;
    $("fov").value = target;
    $("fov-out").textContent = `${target}°${state.prefs.targetFov ? "" : " (screen default)"}`;
    $("fov-auto").hidden = !state.prefs.targetFov;
  }

  // ---------- actions ----------

  function update(opts = {}) {
    recompute();
    if (opts.reselect || !state.selected) {
      const g = groups[state.activeGroup];
      state.selected = g ? g.seats[Math.floor(g.seats.length / 2)] : bestSeat(true).seat.id;
    }
    savePrefs();
    render();
  }

  function selectLayout(i) {
    state.index = i;
    model = S.parseLayout(layout());
    state.selected = null;
    state.activeGroup = 0;
    update({ reselect: true });
  }

  function onSeat(id) {
    if (state.editing) {
      const t = takenSet();
      if (t.has(id)) t.delete(id);
      else t.add(id);
      state.selected = id;
      update();
    } else {
      state.selected = id;
      renderMap();
      renderDetail();
    }
  }

  function bind() {
    $("map").addEventListener("click", (e) => {
      const g = e.target.closest(".seat");
      if (g) onSeat(g.dataset.id);
    });
    $("map").addEventListener("keydown", (e) => {
      const g = e.target.closest(".seat");
      if (g && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onSeat(g.dataset.id);
        const again = $("map").querySelector(`[data-id="${g.dataset.id}"]`);
        if (again) again.focus();
      }
    });
    $("group-minus").addEventListener("click", () => {
      state.groupSize = Math.max(1, state.groupSize - 1);
      state.activeGroup = 0;
      update({ reselect: true });
    });
    $("group-plus").addEventListener("click", () => {
      state.groupSize = Math.min(10, state.groupSize + 1);
      state.activeGroup = 0;
      update({ reselect: true });
    });
    $("edit-toggle").addEventListener("click", () => {
      state.editing = !state.editing;
      renderMap();
    });
    $("randomize").addEventListener("click", () => {
      const L = layout();
      state.seeds[L.id] = (state.seeds[L.id] || 7) + 1;
      delete state.taken[L.id];
      update({ reselect: true });
    });
    $("clear").addEventListener("click", () => {
      state.taken[layout().id] = new Set();
      update({ reselect: true });
    });
    $("fov").addEventListener("input", (e) => {
      state.prefs.targetFov = Number(e.target.value);
      state.presetKey = "custom";
      update();
    });
    $("fov-auto").addEventListener("click", () => {
      state.prefs.targetFov = null;
      update();
    });
  }

  async function start() {
    loadPrefs();
    bind();
    try {
      state.layouts = await loadLayouts();
    } catch (err) {
      const main = document.querySelector(".main");
      main.replaceChildren(
        el("section", { class: "panel error" }, [
          el("h2", { text: "Couldn't load the theater layouts" }),
          el("p", { text: "Browsers block data/layouts.json when the page is opened straight from disk. Run python3 -m http.server in the project folder and open http://localhost:8000." }),
        ])
      );
      return;
    }
    selectLayout(0);
  }

  start();
})();
