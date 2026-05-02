"""Export Zotero books and movies to JSON for blog rendering.

Usage:
  uv run scripts/export_zotero.py                          # export both books and movies
  uv run scripts/export_zotero.py --books                  # books only
  uv run scripts/export_zotero.py --movies                 # movies only
  uv run scripts/export_zotero.py --collection "MyBooks"   # specific collection

Requires a local Zotero SQLite database. If Zotero is running, the script
copies the DB to a temp location first (lock-safe).
"""

import json
import os
import shutil
import sqlite3
import tempfile
from argparse import ArgumentParser
from pathlib import Path

DEFAULT_DB = Path.home() / "wenlong.com" / "D-MyLibrary" / "Zotero" / "zotero.sqlite"

# Zotero item type IDs
ITEM_BOOK = 2
ITEM_FILM = 11

# Creator type IDs
CREATOR_AUTHOR = 1
CREATOR_DIRECTOR = 8

# Field IDs
FIELD_TITLE = 110
FIELD_DATE = 14
FIELD_ABSTRACT = 90
FIELD_ISBN = 11
FIELD_PUBLISHER = 8
FIELD_NUMPAGES = 118
FIELD_RUNNINGTIME = 77

# Default collections to scan
BOOK_COLLECTIONS = ["Book", "BookList", "MyBookList", "book"]
MOVIE_COLLECTIONS = ["Movie", "film", "电影", "和未来女朋友一起看的电影"]


def open_db(db_path: Path) -> sqlite3.Connection:
    """Open Zotero DB, copying to temp if locked."""
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        conn.execute("SELECT 1 FROM items LIMIT 1")
        return conn
    except sqlite3.OperationalError:
        tmp = Path(tempfile.gettempdir()) / "zotero_export.sqlite"
        shutil.copy2(db_path, tmp)
        conn = sqlite3.connect(str(tmp))
        conn.row_factory = sqlite3.Row
        return conn


def get_collection_ids(conn: sqlite3.Connection, names: list[str]) -> list[int]:
    """Get collection IDs matching the given names."""
    placeholders = ",".join("?" for _ in names)
    rows = conn.execute(
        f"SELECT collectionID, collectionName FROM collections WHERE collectionName IN ({placeholders})",
        names,
    ).fetchall()
    print(f"  Found collections: {[(r['collectionID'], r['collectionName']) for r in rows]}")
    return [r["collectionID"] for r in rows]


def get_items_in_collections(
    conn: sqlite3.Connection,
    collection_ids: list[int],
    item_type_id: int,
) -> list[sqlite3.Row]:
    """Get items of a given type in the specified collections."""
    if not collection_ids:
        return []
    placeholders = ",".join("?" for _ in collection_ids)
    rows = conn.execute(
        f"""SELECT DISTINCT i.itemID, i.key
            FROM items i
            JOIN collectionItems ci ON i.itemID = ci.itemID
            WHERE ci.collectionID IN ({placeholders})
              AND i.itemTypeID = ?
            ORDER BY i.dateAdded DESC""",
        [*collection_ids, item_type_id],
    ).fetchall()
    return rows


def get_item_creators(
    conn: sqlite3.Connection, item_id: int, creator_type_id: int
) -> list[str]:
    """Get creator names for an item."""
    rows = conn.execute(
        """SELECT c.lastName, c.firstName
           FROM creators c
           JOIN itemCreators ic ON c.creatorID = ic.creatorID
           WHERE ic.itemID = ? AND ic.creatorTypeID = ?
           ORDER BY ic.orderIndex""",
        [item_id, creator_type_id],
    ).fetchall()
    names = []
    for r in rows:
        first = (r["firstName"] or "").strip()
        last = (r["lastName"] or "").strip()
        if first and last:
            names.append(f"{last}, {first}")
        else:
            names.append(last or first)
    return names


def get_field_value(conn: sqlite3.Connection, item_id: int, field_id: int) -> str:
    """Get a single field value for an item."""
    row = conn.execute(
        """SELECT v.value
           FROM itemData d
           JOIN itemDataValues v ON d.valueID = v.valueID
           WHERE d.itemID = ? AND d.fieldID = ?""",
        [item_id, field_id],
    ).fetchone()
    return row["value"] if row else ""


def get_item_tags(conn: sqlite3.Connection, item_id: int) -> list[str]:
    """Get all tags for an item."""
    rows = conn.execute(
        """SELECT t.name
           FROM tags t
           JOIN itemTags it ON t.tagID = it.tagID
           WHERE it.itemID = ?""",
        [item_id],
    ).fetchall()
    return [r["name"] for r in rows]


def get_rating(tags: list[str]) -> int:
    """Extract rating from tags (Zotero uses star tags like '★★★★☆')."""
    for tag in tags:
        filled = tag.count("★")
        if filled > 0:
            return filled
    return 0


def get_attachments(conn: sqlite3.Connection, item_id: int) -> list[str]:
    """Get attachment paths (covers, files)."""
    rows = conn.execute(
        """SELECT ia.path, ia.contentType
           FROM itemAttachments ia
           WHERE ia.parentItemID = ? AND ia.contentType LIKE 'image/%'""",
        [item_id],
    ).fetchall()
    return [r["path"] or "" for r in rows]


def extract_date(raw: str) -> str:
    """Normalize date to YYYY-MM-DD format."""
    if not raw:
        return ""
    raw = raw.strip()
    # Already ISO format
    if len(raw) == 10 and raw[4] == "-":
        return raw
    # Just year
    if raw.isdigit() and len(raw) == 4:
        return f"{raw}-01-01"
    return raw[:10] if len(raw) >= 10 else raw


def export_books(conn: sqlite3.Connection, collections: list[str]) -> list[dict]:
    """Export books from Zotero."""
    collection_ids = get_collection_ids(conn, collections)
    items = get_items_in_collections(conn, collection_ids, ITEM_BOOK)
    print(f"  Found {len(items)} books")

    result = []
    for item in items:
        item_id = item["itemID"]
        tags = get_item_tags(conn, item_id)
        authors = get_item_creators(conn, item_id, CREATOR_AUTHOR)
        attachments = get_attachments(conn, item_id)

        entry = {
            "title": get_field_value(conn, item_id, FIELD_TITLE),
            "author": authors[0] if authors else "",
            "cover": "",
            "date": extract_date(get_field_value(conn, item_id, FIELD_DATE)),
            "publisher": get_field_value(conn, item_id, FIELD_PUBLISHER),
            "isbn": get_field_value(conn, item_id, FIELD_ISBN),
            "pages": get_field_value(conn, item_id, FIELD_NUMPAGES),
            "rating": get_rating(tags),
            "summary": get_field_value(conn, item_id, FIELD_ABSTRACT),
            "tags": [t for t in tags if "★" not in t],
            "slug": "",
            "zotero_key": item["key"],
        }
        result.append(entry)

    return result


def export_movies(conn: sqlite3.Connection, collections: list[str]) -> list[dict]:
    """Export movies/films from Zotero."""
    collection_ids = get_collection_ids(conn, collections)
    items = get_items_in_collections(conn, collection_ids, ITEM_FILM)
    print(f"  Found {len(items)} movies")

    result = []
    for item in items:
        item_id = item["itemID"]
        tags = get_item_tags(conn, item_id)
        directors = get_item_creators(conn, item_id, CREATOR_DIRECTOR)
        attachments = get_attachments(conn, item_id)

        entry = {
            "title": get_field_value(conn, item_id, FIELD_TITLE),
            "director": directors[0] if directors else "",
            "cover": "",
            "date": extract_date(get_field_value(conn, item_id, FIELD_DATE)),
            "runningTime": get_field_value(conn, item_id, FIELD_RUNNINGTIME),
            "rating": get_rating(tags),
            "summary": get_field_value(conn, item_id, FIELD_ABSTRACT),
            "tags": [t for t in tags if "★" not in t],
            "slug": "",
            "zotero_key": item["key"],
        }
        result.append(entry)

    return result


def main():
    parser = ArgumentParser(description="Export Zotero data to JSON for blog")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB, help="Path to zotero.sqlite")
    parser.add_argument("--books", action="store_true", help="Export books only")
    parser.add_argument("--movies", action="store_true", help="Export movies only")
    parser.add_argument("--collection", action="append", dest="collections",
                        help="Specific collection name(s), can repeat")
    parser.add_argument("--out", type=Path, default=None,
                        help="Output directory (default: src/data relative to script)")

    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    out_dir = args.out or (script_dir.parent / "src" / "data")
    out_dir.mkdir(parents=True, exist_ok=True)

    if not args.db.exists():
        print(f"Error: Zotero database not found at {args.db}")
        print("Use --db to specify the path to zotero.sqlite")
        return

    conn = open_db(args.db)

    do_all = not args.books and not args.movies

    if do_all or args.books:
        print("Exporting books...")
        cols = args.collections or BOOK_COLLECTIONS
        books = export_books(conn, cols)
        out_file = out_dir / "books.json"
        out_file.write_text(json.dumps(books, ensure_ascii=False, indent=2), "utf-8")
        print(f"  → {out_file} ({len(books)} items)")

    if do_all or args.movies:
        print("Exporting movies...")
        cols = args.collections or MOVIE_COLLECTIONS
        movies = export_movies(conn, cols)
        out_file = out_dir / "movies.json"
        out_file.write_text(json.dumps(movies, ensure_ascii=False, indent=2), "utf-8")
        print(f"  → {out_file} ({len(movies)} items)")

    conn.close()


if __name__ == "__main__":
    main()
