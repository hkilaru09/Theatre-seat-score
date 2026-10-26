"""Bundle SeatScore into one self-contained HTML file.

Inlines styles.css, engine.js, app.js and data/layouts.json so the page works
anywhere a single file can be hosted (a gist, an email, a static host).

  python3 scripts/build_single.py            # full document -> dist/seatscore.html
  python3 scripts/build_single.py --fragment # body-only fragment for embedding in another page
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def read(name):
    return (ROOT / name).read_text(encoding="utf-8")


def between(text, start, end):
    m = re.search(re.escape(start) + r"(.*?)" + re.escape(end), text, re.S)
    if not m:
        sys.exit(f"marker {start} not found in index.html")
    return m.group(1).strip()


def main():
    fragment = "--fragment" in sys.argv
    html = read("index.html")
    head = between(html, "<!-- artifact:head-start -->", "<!-- artifact:head-end -->")
    body = between(html, "<!-- artifact:body-start -->", "<!-- artifact:body-end -->")

    head = head.replace('<link rel="stylesheet" href="styles.css">', "<style>\n" + read("styles.css") + "\n</style>")
    layouts = json.dumps(json.loads(read("data/layouts.json")), separators=(",", ":"))
    scripts = (
        f"<script>window.SEATSCORE_LAYOUTS = {layouts};</script>\n"
        f"<script>\n{read('engine.js')}\n</script>\n"
        f"<script>\n{read('app.js')}\n</script>"
    )

    if fragment:
        out = f"{head}\n{body}\n{scripts}\n"
    else:
        out = (
            '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            f"{head}\n</head>\n<body>\n{body}\n{scripts}\n</body>\n</html>\n"
        )

    target = pathlib.Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else ROOT / "dist" / "seatscore.html"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(out, encoding="utf-8")
    print(f"wrote {target} ({len(out) // 1024} KB)")


if __name__ == "__main__":
    main()
