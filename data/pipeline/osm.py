"""Every cinema in OpenStreetMap, cleaned and split by country for the web app.

Source: an Overpass export of all `amenity=cinema` nodes, ways and relations
(ways and relations come with their center point). OpenStreetMap data is
(c) OpenStreetMap contributors, ODbL, so the app credits it on every map.

Only about 6% of cinemas carry `addr:country`, so the country comes from the
point itself: a lookup against Natural Earth's 1:10m country borders, falling
back to the nearest border for cinemas on piers and coastlines.

    python -m pipeline.osm            # from data/, after downloading the raw files
"""
from __future__ import annotations

import json
import math
import re
import unicodedata
from dataclasses import asdict, dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_CINEMAS = ROOT / "raw" / "osm" / "cinemas.json"
RAW_COUNTRIES = ROOT / "raw" / "naturalearth" / "ne_10m_admin_0_countries.geojson"
WEB_OUT = ROOT.parent / "web" / "public" / "cinemas"

OVERPASS_QUERY = '[out:json][timeout:360];nwr["amenity"="cinema"];out center tags;'

# Same cinema mapped twice (say, a node and the building outline) within this distance.
DUPLICATE_M = 150
# Cinemas this close to a border (in degrees, about 20 km) count as that country.
NEAREST_MAX_DEG = 0.2


@dataclass
class Cinema:
    id: str
    name: str
    lat: float
    lon: float
    city: str | None = None
    website: str | None = None
    brand: str | None = None
    screens: int | None = None
    seats: int | None = None
    wikidata: str | None = None
    country: str | None = None


def _int(value: str | None) -> int | None:
    """First whole number in a tag such as "12", "~300" or "450 seats"."""
    if not value:
        return None
    m = re.search(r"\d+", value.replace(",", ""))
    return int(m.group()) if m else None


def _website(tags: dict) -> str | None:
    url = tags.get("website") or tags.get("contact:website") or tags.get("url")
    if not url:
        return None
    url = url.split(";")[0].strip()
    return url if url.startswith(("http://", "https://")) else f"https://{url}"


def parse_element(el: dict) -> Cinema | None:
    """One Overpass element as a Cinema, or None if it has no name or position."""
    tags = el.get("tags", {})
    name = (tags.get("name") or "").strip()
    lat = el.get("lat", el.get("center", {}).get("lat"))
    lon = el.get("lon", el.get("center", {}).get("lon"))
    if not name or lat is None or lon is None:
        return None
    seats = _int(tags.get("capacity"))
    screens = _int(tags.get("screen") or tags.get("screens"))
    return Cinema(
        id=f"{el['type'][0]}{el['id']}",
        name=name,
        lat=round(lat, 5),
        lon=round(lon, 5),
        city=tags.get("addr:city") or None,
        website=_website(tags),
        brand=tags.get("brand") or tags.get("operator") or None,
        # Screen counts above 30 and seat counts above 10,000 are tagging mistakes.
        screens=screens if screens and screens <= 30 else None,
        seats=seats if seats and seats <= 10_000 else None,
        wikidata=tags.get("wikidata") or None,
        country=(tags.get("addr:country") or "").upper() or None,
    )


def distance_m(a: Cinema, b: Cinema) -> float:
    """Great-circle distance in metres."""
    p1, p2 = math.radians(a.lat), math.radians(b.lat)
    dp, dl = p2 - p1, math.radians(b.lon - a.lon)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(h))


def _key(name: str) -> str:
    text = unicodedata.normalize("NFKD", name).casefold()
    return re.sub(r"[^\w]", "", text)


def dedupe(cinemas: list[Cinema]) -> list[Cinema]:
    """Merge cinemas with the same name mapped within DUPLICATE_M of each other.

    The first one kept wins, and it borrows any fields it is missing.
    """
    kept: dict[str, list[Cinema]] = {}
    for c in cinemas:
        same = kept.setdefault(_key(c.name), [])
        match = next((k for k in same if distance_m(k, c) <= DUPLICATE_M), None)
        if match is None:
            same.append(c)
            continue
        for field, value in asdict(c).items():
            if getattr(match, field) is None and value is not None:
                setattr(match, field, value)
    return [c for group in kept.values() for c in group]


def load_countries(path: Path = RAW_COUNTRIES):
    """(codes, names, geometries, tree) for Natural Earth's countries."""
    from shapely import STRtree
    from shapely.geometry import shape

    features = json.loads(path.read_text())["features"]
    codes, names, geoms = [], [], []
    for f in features:
        p = f["properties"]
        # ISO_A2 is -99 for France, Norway and a few others; ISO_A2_EH fills those in.
        code = p.get("ISO_A2_EH") if p.get("ISO_A2_EH") not in (None, "-99") else p.get("ISO_A2")
        if not code or code == "-99":
            continue
        codes.append(code)
        names.append(p["ADMIN"])
        geoms.append(shape(f["geometry"]))
    return codes, names, geoms, STRtree(geoms)


def assign_countries(cinemas: list[Cinema], countries) -> None:
    """Set each cinema's country from its position, keeping addr:country as a last resort."""
    from shapely import points

    codes, _, geoms, tree = countries
    pts = points([c.lon for c in cinemas], [c.lat for c in cinemas])
    inside = tree.query(pts, predicate="within")
    found = dict(zip(inside[0].tolist(), inside[1].tolist()))
    for i, c in enumerate(cinemas):
        if i in found:
            c.country = codes[found[i]]
            continue
        j = int(tree.nearest(pts[i]))
        if geoms[j].distance(pts[i]) <= NEAREST_MAX_DEG:
            c.country = codes[j]


def build(raw: Path = RAW_CINEMAS, countries_path: Path = RAW_COUNTRIES) -> tuple[list[Cinema], dict[str, str]]:
    elements = json.loads(raw.read_text())["elements"]
    cinemas = dedupe([c for c in map(parse_element, elements) if c])
    countries = load_countries(countries_path)
    assign_countries(cinemas, countries)
    return cinemas, country_names(countries)


def country_names(countries) -> dict[str, str]:
    """Code -> name, taken from each code's largest shape (France, not Clipperton Island)."""
    codes, names, geoms, _ = countries
    best: dict[str, tuple[float, str]] = {}
    for code, name, geom in zip(codes, names, geoms):
        if code not in best or geom.area > best[code][0]:
            best[code] = (geom.area, name)
    return {code: name for code, (_, name) in best.items()}


def write_web(cinemas: list[Cinema], names: dict[str, str], out: Path = WEB_OUT) -> dict:
    """One JSON file per country plus index.json, sorted so diffs stay small."""
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.json"):
        old.unlink()
    by_country: dict[str, list[Cinema]] = {}
    for c in cinemas:
        if c.country:
            by_country.setdefault(c.country, []).append(c)
    index = []
    for code, group in sorted(by_country.items()):
        group.sort(key=lambda c: (c.city or "", c.name, c.id))
        rows = [{k: v for k, v in asdict(c).items() if v is not None and k != "country"} for c in group]
        (out / f"{code}.json").write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")))
        index.append({"code": code, "name": names.get(code, code), "count": len(group)})
    summary = {
        "source": "OpenStreetMap contributors (ODbL), amenity=cinema",
        "cinemas": sum(r["count"] for r in index),
        "withSeats": sum(1 for c in cinemas if c.country and c.seats),
        "withScreens": sum(1 for c in cinemas if c.country and c.screens),
        "countries": index,
    }
    (out / "index.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1))
    return summary


if __name__ == "__main__":
    cinemas, names = build()
    summary = write_web(cinemas, names)
    unplaced = sum(1 for c in cinemas if not c.country)
    print(
        f"{summary['cinemas']:,} cinemas in {len(summary['countries'])} countries "
        f"({summary['withSeats']:,} with seat counts, {summary['withScreens']:,} with screen counts); "
        f"{unplaced} could not be placed"
    )
