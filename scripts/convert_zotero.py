"""从 Better BibTeX API 拉取数据并转换为 blog 格式。

Zotero 中配置两个搜索文件夹后，运行此脚本即可自动同步：
  - 搜索文件夹 "Zotero_books"  → books.json
  - 搜索文件夹 "Zotero_movies" → movies.json

前置条件：Zotero 运行中，Better BibTeX 插件已安装。

Usage:
    # 从 BBT API 拉取并转换（默认，需 Zotero 运行中）
    uv run scripts/convert_zotero.py --fetch

    # 从本地缓存文件转换（不拉取）
    uv run scripts/convert_zotero.py

    # 全量覆盖（默认 --merge 保留封面/评分/tags）
    uv run scripts/convert_zotero.py --fetch --no-merge
"""

import json
import sys
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "src/data"
BOOKS_INPUT = DATA_DIR / "Zotero_books.json"
MOVIES_INPUT = DATA_DIR / "Zotero_movies.json"
BOOKS_OUTPUT = DATA_DIR / "books.json"
MOVIES_OUTPUT = DATA_DIR / "movies.json"

# Better BibTeX local API
BBT_API = "http://127.0.0.1:23119/better-bibtex/export/collection"


def fetch_from_bbt(collection_name: str, dest: Path) -> bool:
    """Fetch a collection from Better BibTeX local API."""
    import urllib.request
    import urllib.error

    url = f"{BBT_API}?collectionName={collection_name}&format=bettercsljson"
    try:
        req = urllib.request.Request(url)
        req.add_header("Accept", "application/json")
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
        dest.write_bytes(data)
        items = json.loads(data)
        print(f"Fetched {collection_name}: {len(items) if isinstance(items, list) else '?'} items → {dest}")
        return True
    except urllib.error.URLError as e:
        print(f"BBT API unreachable for {collection_name}: {e}")
        return False
    except Exception as e:
        print(f"Error fetching {collection_name}: {e}")
        return False


def _parse_extra(extra: str) -> dict:
    """Parse Zotero extra field (key: value per line)."""
    result = {}
    if not extra:
        return result
    for line in extra.split("\n"):
        if ":" in line:
            key, _, value = line.partition(":")
            result[key.strip()] = value.strip()
    return result


def _extract_tags(tags: list) -> list:
    """Extract tag strings from Zotero [{tag: '...'}] format."""
    if not tags:
        return []
    result = []
    for t in tags:
        if isinstance(t, dict):
            tag = t.get("tag", "")
        else:
            tag = str(t)
        if tag:
            result.append(tag)
    return result


def _extract_cover(attachments: list) -> str:
    """Try to find a Douban cover image from attachments."""
    if not attachments:
        return ""
    for att in attachments:
        url = att.get("url", "")
        if "doubanio.com" in url or "douban.com" in url:
            return url
    return ""


def _extract_creators(creators: list, role: str) -> str:
    """Extract creators of a specific type (e.g. 'director', 'author')."""
    if not creators:
        return ""
    names = [c.get("name", "") for c in creators if c.get("creatorType") == role]
    return ", ".join(names)


def map_book(item: dict) -> dict | None:
    """Convert Zotero book item to blog format."""
    title = item.get("title", "")
    if not title:
        return None

    extra = _parse_extra(item.get("extra", ""))
    tags = _extract_tags(item.get("tags", []))

    return {
        "title": title,
        "author": _extract_creators(item.get("creators", []), "author"),
        "cover": _extract_cover(item.get("attachments", [])),
        "date": item.get("date", ""),
        "publisher": item.get("publisher", ""),
        "isbn": item.get("ISBN", ""),
        "pages": str(item.get("numPages", "")),
        "rating": 0,
        "summary": item.get("abstractNote", ""),
        "remark": extra.get("remark", ""),
        "tags": tags,
        "url": item.get("url", ""),
        "zotero_key": item.get("key", ""),
    }


def map_movie(item: dict) -> dict | None:
    """Convert Zotero movie item to blog format."""
    title = item.get("title", "")
    if not title:
        return None

    extra = _parse_extra(item.get("extra", ""))
    tags = _extract_tags(item.get("tags", []))

    return {
        "title": title,
        "director": _extract_creators(item.get("creators", []), "director"),
        "cover": _extract_cover(item.get("attachments", [])),
        "date": item.get("date", ""),
        "runningTime": item.get("runningTime", ""),
        "rating": 0,
        "summary": item.get("abstractNote", ""),
        "remark": extra.get("remark", ""),
        "tags": tags,
        "url": item.get("url", ""),
        "zotero_key": item.get("key", ""),
    }



def process_books(input_path: Path, merge: bool = True) -> None:
    """Convert Zotero_books.json → books.json."""
    if not input_path.exists():
        print(f"Books input not found: {input_path}")
        return

    items = json.loads(input_path.read_text())
    if not isinstance(items, list):
        items = [items]

    # All items in Zotero_books are books
    books = [b for b in (map_book(i) for i in items) if b]
    print(f"Books: {len(books)} from {os.path.basename(input_path)}")

    if merge:
        _merge(BOOKS_OUTPUT, books, "title")
    else:
        _write(BOOKS_OUTPUT, books)


def process_movies(input_path: Path, merge: bool = True) -> None:
    """Convert Zotero_movies.json → movies.json."""
    if not input_path.exists():
        print(f"Movies input not found: {input_path}")
        return

    items = json.loads(input_path.read_text())
    if not isinstance(items, list):
        items = [items]

    movies = [m for m in (map_movie(i) for i in items) if m]
    print(f"Movies: {len(movies)} from {os.path.basename(input_path)}")

    if merge:
        _merge(MOVIES_OUTPUT, movies, "title")
    else:
        _write(MOVIES_OUTPUT, movies)


def _write(path: Path, items: list) -> None:
    path.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {path} ({len(items)} items)")


def _merge(path: Path, new_items: list, key: str) -> None:
    """Merge new items into existing JSON, preserving covers and manual edits."""
    if not path.exists():
        _write(path, new_items)
        return

    existing = json.loads(path.read_text())
    existing_map = {item[key]: item for item in existing if item.get(key)}

    for new_item in new_items:
        k = new_item.get(key)
        if not k:
            continue
        if k in existing_map:
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
    _write(path, merged)
    print(f"  Preserved covers/ratings/tags from existing data")


if __name__ == "__main__":
    args = sys.argv[1:]

    books_in = BOOKS_INPUT
    movies_in = MOVIES_INPUT
    merge = "--no-merge" not in args
    do_fetch = "--fetch" in args

    # Custom input paths
    for i, arg in enumerate(args):
        if arg == "--books" and i + 1 < len(args):
            books_in = Path(args[i + 1])
        if arg == "--movies" and i + 1 < len(args):
            movies_in = Path(args[i + 1])

    if do_fetch:
        books_in.parent.mkdir(parents=True, exist_ok=True)
        movies_in.parent.mkdir(parents=True, exist_ok=True)
        fetch_from_bbt("Zotero_books", books_in)
        fetch_from_bbt("Zotero_movies", movies_in)

    print("=" * 40)
    process_books(books_in, merge=merge)
    print()
    process_movies(movies_in, merge=merge)
