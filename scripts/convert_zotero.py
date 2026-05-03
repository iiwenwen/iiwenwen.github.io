"""Convert Better BibTeX JSON export to blog books.json / movies.json format.

Usage:
    # Full replacement
    uv run scripts/convert_zotero.py export.json

    # Only books or only movies
    uv run scripts/convert_zotero.py export.json --books
    uv run scripts/convert_zotero.py export.json --movies

    # Merge with existing (update covers, keep manually edited fields)
    uv run scripts/convert_zotero.py export.json --merge
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOKS_FILE = ROOT / "src/data/books.json"
MOVIES_FILE = ROOT / "src/data/movies.json"

# CSL JSON field mapping
def map_item(item: dict) -> dict | None:
    """Convert a CSL JSON item to blog format, or return None if unsupported."""
    item_type = item.get("type", "")
    title = item.get("title", "")

    if not title:
        return None

    if item_type in ("book", "manuscript"):
        authors = item.get("author", [])
        author_str = ", ".join(
            a.get("family", "") or a.get("literal", "") for a in authors
        )
        return {
            "title": title,
            "author": author_str,
            "cover": "",
            "date": _format_date(item.get("issued", {}).get("date-parts", [[]])[0]),
            "publisher": item.get("publisher", ""),
            "isbn": item.get("ISBN", ""),
            "pages": str(item.get("number-of-pages", "")),
            "rating": 0,
            "summary": item.get("abstract", ""),
            "tags": [],
        }

    if item_type in ("motion_picture", "video"):
        directors = item.get("director", []) or item.get("author", [])
        director_str = ", ".join(
            d.get("family", "") or d.get("literal", "") for d in directors
        )
        return {
            "title": title,
            "director": director_str,
            "cover": "",
            "date": _format_date(item.get("issued", {}).get("date-parts", [[]])[0]),
            "runningTime": item.get("dimensions", ""),
            "rating": 0,
            "summary": item.get("abstract", ""),
            "tags": [],
        }

    return None


def _format_date(parts: list) -> str:
    if not parts:
        return ""
    parts = [str(p).zfill(2) for p in parts[:3]]
    if len(parts) == 3:
        return f"{parts[0]}-{parts[1]}-{parts[2]}"
    if len(parts) == 2:
        return f"{parts[0]}-{parts[1]}-00"
    return f"{parts[0]}-00-00"


def convert(input_path: str, books_only: bool = False, movies_only: bool = False,
            merge: bool = False) -> None:
    with open(input_path) as f:
        items = json.load(f)

    # Handle Better BibTeX array export
    if not isinstance(items, list):
        items = [items]

    books, movies = [], []
    for item in items:
        result = map_item(item)
        if result is None:
            continue
        if "author" in result:
            books.append(result)
        elif "director" in result:
            movies.append(result)

    print(f"Parsed: {len(books)} books, {len(movies)} movies")

    if merge:
        _merge(BOOKS_FILE, books, "title")
        _merge(MOVIES_FILE, movies, "title")
    else:
        if not movies_only:
            BOOKS_FILE.write_text(json.dumps(books, ensure_ascii=False, indent=2) + "\n")
            print(f"Wrote {BOOKS_FILE}")
        if not books_only:
            MOVIES_FILE.write_text(json.dumps(movies, ensure_ascii=False, indent=2) + "\n")
            print(f"Wrote {MOVIES_FILE}")


def _merge(path: Path, new_items: list, key: str) -> None:
    """Merge new items into existing JSON, preserving covers and manual edits."""
    if not path.exists():
        path.write_text(json.dumps(new_items, ensure_ascii=False, indent=2) + "\n")
        print(f"Created {path} with {len(new_items)} items")
        return

    existing = json.loads(path.read_text())
    existing_map = {item[key]: item for item in existing if item.get(key)}

    for new_item in new_items:
        k = new_item.get(key)
        if not k:
            continue
        if k in existing_map:
            # Preserve cover, slug, rating, tags from existing
            old = existing_map[k]
            new_item["cover"] = old.get("cover", "")
            new_item["rating"] = old.get("rating", 0)
            new_item["summary"] = old.get("summary") or new_item.get("summary", "")
            if old.get("slug"):
                new_item["slug"] = old["slug"]
            if old.get("tags"):
                new_item["tags"] = old["tags"]
        existing_map[k] = new_item

    merged = list(existing_map.values())
    path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n")
    print(f"Merged into {path}: {len(merged)} items")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    input_path = sys.argv[1]
    convert(
        input_path,
        books_only="--books" in sys.argv,
        movies_only="--movies" in sys.argv,
        merge="--merge" in sys.argv,
    )
