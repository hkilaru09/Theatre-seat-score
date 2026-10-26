import json

import pytest

from pipeline import osm


def square(code, name, x0, y0, x1, y1, iso="ISO_A2"):
    props = {"ISO_A2": code if iso == "ISO_A2" else "-99", "ISO_A2_EH": code, "ADMIN": name}
    ring = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]
    return {"type": "Feature", "properties": props, "geometry": {"type": "Polygon", "coordinates": [ring]}}


@pytest.fixture
def borders(tmp_path):
    path = tmp_path / "countries.geojson"
    features = [
        square("AA", "Alpha", 0, 0, 10, 10),
        # ISO_A2 is -99 here, as it is for France in Natural Earth.
        square("BB", "Beta", 20, 0, 30, 10, iso="EH"),
        square("BB", "Beta Islet", 40, 0, 40.5, 0.5),
    ]
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
    return path


def node(id, name, lat, lon, **tags):
    return {"type": "node", "id": id, "lat": lat, "lon": lon, "tags": {"amenity": "cinema", "name": name, **tags}}


def test_parse_reads_tags_and_way_centers():
    way = {"type": "way", "id": 7, "center": {"lat": 1.234567, "lon": 2.0}, "tags": {"name": "Rex", "website": "rex.example", "capacity": "~450 seats", "screen": "3"}}
    c = osm.parse_element(way)
    assert (c.id, c.lat, c.website, c.seats, c.screens) == ("w7", 1.23457, "https://rex.example", 450, 3)


def test_parse_skips_unnamed_and_drops_impossible_counts():
    assert osm.parse_element(node(1, "", 1, 1)) is None
    c = osm.parse_element(node(2, "Mega", 1, 1, capacity="50000", screen="99"))
    assert c.seats is None and c.screens is None


def test_dedupe_merges_nearby_duplicates_only():
    a = osm.parse_element(node(1, "Ciné Rex", 5.0, 5.0))
    b = osm.parse_element(node(2, "CINE REX", 5.0005, 5.0, capacity="300"))  # about 55 m away
    far = osm.parse_element(node(3, "Ciné Rex", 6.0, 5.0))  # about 111 km away
    kept = osm.dedupe([a, b, far])
    assert [c.id for c in kept] == ["n1", "n3"]
    assert kept[0].seats == 300


def test_countries_from_position_with_coastal_fallback(borders):
    countries = osm.load_countries(borders)
    cinemas = [
        osm.parse_element(node(1, "Inside A", 5, 5)),
        osm.parse_element(node(2, "Inside B", 5, 25)),
        osm.parse_element(node(3, "Pier", 5, 10.1)),  # 0.1 degrees off A's coast
        osm.parse_element(node(4, "Mid-ocean", 5, 15, **{"addr:country": "zz"})),
    ]
    osm.assign_countries(cinemas, countries)
    assert [c.country for c in cinemas] == ["AA", "BB", "AA", "ZZ"]
    assert osm.country_names(countries)["BB"] == "Beta"


def test_build_and_write(tmp_path, borders):
    raw = tmp_path / "cinemas.json"
    elements = [node(1, "Zeta", 5, 5, **{"addr:city": "Town"}), node(2, "Alpha", 5, 6), node(3, "Beta Kino", 5, 25), node(4, "", 5, 5)]
    raw.write_text(json.dumps({"elements": elements}))
    cinemas, names = osm.build(raw, borders)
    out = tmp_path / "web"
    summary = osm.write_web(cinemas, names, out)
    assert summary["cinemas"] == 3
    assert [r["code"] for r in summary["countries"]] == ["AA", "BB"]
    rows = json.loads((out / "AA.json").read_text())
    assert [r["name"] for r in rows] == ["Alpha", "Zeta"]
    assert "country" not in rows[0] and rows[1]["city"] == "Town"
