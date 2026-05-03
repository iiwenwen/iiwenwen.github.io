"""从豆瓣移动端 API 同步观影/读书记录到 blog 数据文件。

实现 koobai-style 闭环：豆瓣标记"看过/读过" → CI 自动同步 → 博客更新。

Usage:
    uv run --with httpx,Pillow scripts/sync_douban.py

环境变量:
    DOUBAN_ID      - 豆瓣用户 ID（必需），设置后可在豆瓣主页 URL 中找到
    DOUBAN_APIKEY  - 豆瓣 API v2 密钥（可选，用于补充元数据）
"""

import json
import os
import re
import sys
import time
import random
from pathlib import Path
from io import BytesIO

import httpx
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "src/data"
COVERS_DIR = ROOT / "public/covers"
BOOKS_FILE = DATA_DIR / "books.json"
MOVIES_FILE = DATA_DIR / "movies.json"

DOUBAN_ID = os.environ.get("DOUBAN_ID", "")
APIKEY = os.environ.get("DOUBAN_APIKEY", "0ab215a8b1977939201640fa14c66bab")

# Flags (set before importing this module or via CLI)
FULL_SYNC = "--full" in sys.argv
SKIP_COVERS = "--no-covers" in sys.argv

MOBILE_API = "https://m.douban.com/rexxar/api/v2/user"
API_V2 = "https://api.douban.com/v2"

HEADERS_MOBILE = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    "Accept": "application/json",
}
HEADERS_API = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
}
HEADERS_IMG = HEADERS_API | {"Referer": "https://book.douban.com/"}


def fetch_interests(item_type: str, status: str = "done") -> list[dict]:
    """Fetch all interests from Douban mobile API with pagination."""
    all_items = []
    start = 0
    count = 50

    headers = HEADERS_MOBILE | {
        "Referer": f"https://m.douban.com/people/{DOUBAN_ID}/interests"
    }

    while True:
        url = f"{MOBILE_API}/{DOUBAN_ID}/interests?type={item_type}&status={status}&start={start}&count={count}"
        try:
            resp = httpx.get(url, headers=headers, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            interests = data.get("interests", [])
            if not interests:
                break
            all_items.extend(interests)
            start += count
            time.sleep(random.uniform(1.0, 2.0))
        except Exception as e:
            print(f"  Fetch error at start={start}: {e}")
            break

    return all_items


def enrich_movie(douban_id: str, mapped: dict) -> dict:
    """Add details from Douban API v2."""
    if not APIKEY:
        return mapped
    try:
        resp = httpx.post(
            f"{API_V2}/movie/{douban_id}",
            headers=HEADERS_API,
            json={"apikey": APIKEY},
            timeout=15,
        )
        if resp.status_code == 200:
            d = resp.json()
            mapped["summary"] = d.get("summary", "") or mapped.get("summary", "")
            durations = d.get("durations", [])
            if durations:
                mapped["runningTime"] = durations[0] if isinstance(durations, list) else str(durations)
            genres = d.get("genres", [])
            if genres:
                mapped["tags"] = list(set(mapped.get("tags", []) + genres))
    except Exception:
        pass
    return mapped


def enrich_book(douban_id: str, mapped: dict) -> dict:
    """Add ISBN, publisher, pages, summary from Douban API v2."""
    if not APIKEY:
        return mapped
    try:
        resp = httpx.post(
            f"{API_V2}/book/{douban_id}",
            headers=HEADERS_API,
            json={"apikey": APIKEY},
            timeout=15,
        )
        if resp.status_code == 200:
            d = resp.json()
            mapped["isbn"] = d.get("isbn13", "") or d.get("isbn10", "")
            mapped["publisher"] = d.get("publisher", "") or ", ".join(d.get("press", []))
            mapped["pages"] = d.get("pages", "") or ""
            mapped["summary"] = d.get("summary", "") or mapped.get("summary", "")
            # Use intro as fallback for summary
            if not mapped["summary"]:
                mapped["summary"] = d.get("intro", "") or ""
    except Exception:
        pass
    return mapped


def map_movie(item: dict) -> dict:
    """Map Douban mobile API movie item to blog format."""
    subject = item.get("subject", {})
    rating_data = item.get("rating", {})
    rating = rating_data.get("value", 0) if isinstance(rating_data, dict) else int(rating_data or 0)
    pic = subject.get("pic", {}) or {}
    cover_url = pic.get("large", "") or pic.get("normal", "")

    directors = subject.get("directors", [])
    director_str = ", ".join(d.get("name", "") for d in directors)
    pubdate = subject.get("pubdate", [])
    date_str = pubdate[0] if pubdate else (subject.get("year", "") or "")

    return {
        "title": subject.get("title", ""),
        "director": director_str,
        "cover": "",
        "date": date_str,
        "runningTime": "",
        "rating": rating,
        "summary": "",
        "remark": item.get("comment", ""),
        "tags": ["/done"],
        "url": subject.get("url", ""),
        "douban_id": str(subject.get("id", "")),
        "create_time": item.get("create_time", ""),
        "_cover_url": cover_url,
    }


def map_book(item: dict) -> dict:
    """Map Douban mobile API book item to blog format."""
    subject = item.get("subject", {})
    rating_data = item.get("rating", {})
    rating = rating_data.get("value", 0) if isinstance(rating_data, dict) else int(rating_data or 0)
    pic = subject.get("pic", {}) or {}
    cover_url = pic.get("large", "") or pic.get("normal", "")

    authors = subject.get("author", []) or []
    if isinstance(authors, list):
        author_str = ", ".join(
            a.get("name", "") if isinstance(a, dict) else str(a)
            for a in authors
        )
    else:
        author_str = str(authors)

    pubdate = subject.get("pubdate", [])
    date_str = pubdate[0] if pubdate else (subject.get("year", "") or "")

    return {
        "title": subject.get("title", ""),
        "author": author_str,
        "cover": "",
        "date": date_str,
        "publisher": ", ".join(subject.get("press", [])) or "",
        "isbn": "",
        "pages": "",
        "rating": rating,
        "summary": subject.get("intro", "") or "",
        "remark": item.get("comment", ""),
        "tags": ["/done"],
        "url": subject.get("url", ""),
        "douban_id": str(subject.get("id", "")),
        "create_time": item.get("create_time", ""),
        "_cover_url": cover_url,
    }


def download_cover(url: str, dest: Path) -> bool:
    """Download cover and convert to WebP. Returns True on success."""
    if not url or dest.exists():
        return bool(url)
    try:
        resp = httpx.get(url, headers=HEADERS_IMG, timeout=30)
        resp.raise_for_status()
        img = Image.open(BytesIO(resp.content))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGBA")
        if img.width > 400:
            ratio = 400 / img.width
            img = img.resize((400, int(img.height * ratio)), Image.LANCZOS)
        img.save(dest, "WEBP", quality=82)
        print(f"    Cover saved: {dest.name} ({dest.stat().st_size // 1024}KB)")
        return True
    except Exception as e:
        print(f"    Cover download failed: {e}")
        return False


def slugify(title: str) -> str:
    slug = re.sub(r"[^\w\u4e00-\u9fff\-]", "", title)[:20]
    return slug or "cover"


def sync(item_type: str, output_path: Path, map_fn) -> int:
    """Sync one type (movie/book). Returns count of new items."""
    print(f"\n{'='*40}")
    print(f"Syncing {item_type}s for user: {DOUBAN_ID}")

    # Load existing (skip in full-sync mode)
    existing = []
    if not FULL_SYNC and output_path.exists():
        existing = json.loads(output_path.read_text())

    # Build lookup: douban_id -> item, title -> item
    by_id = {m.get("douban_id", ""): m for m in existing if m.get("douban_id")}
    by_title = {m.get("title", ""): m for m in existing}

    # Fetch from Douban
    interests = fetch_interests(item_type)
    print(f"  Fetched {len(interests)} total from Douban")

    # Detect new items (stop at first existing in incremental mode)
    new_items = []
    for item in interests:
        subject = item.get("subject", {})
        douban_id = str(subject.get("id", ""))
        title = subject.get("title", "")

        if not FULL_SYNC and (douban_id in by_id or title in by_title):
            break

        mapped = map_fn(item)

        # Enrich with API v2 details (ISBN, publisher, summary, etc.)
        if APIKEY:
            if item_type == "book":
                mapped = enrich_book(douban_id, mapped)
            else:
                mapped = enrich_movie(douban_id, mapped)

        new_items.append(mapped)
        by_id[douban_id] = mapped

    if not new_items:
        print("  No new items")
        return 0

    print(f"  New items: {len(new_items)}")

    # Download covers (skip with --no-covers for initial bulk sync)
    if not SKIP_COVERS:
        COVERS_DIR.mkdir(parents=True, exist_ok=True)
        downloaded = 0
        for i, m in enumerate(new_items):
            cover_url = m.pop("_cover_url", "")
            if cover_url:
                fname = f"{slugify(m['title'])}.webp"
                dest = COVERS_DIR / fname
                if download_cover(cover_url, dest):
                    m["cover"] = f"/covers/{fname}"
                    downloaded += 1
            # Progress indicator for large syncs
            if (i + 1) % 20 == 0:
                print(f"    Cover progress: {i+1}/{len(new_items)}")
        if downloaded > 0:
            print(f"    Covers downloaded: {downloaded}/{len(new_items)}")

    # Prepend new items to existing (newest first)
    merged = new_items + existing
    output_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n")
    print(f"  Wrote {output_path} ({len(merged)} total)")

    return len(new_items)


if __name__ == "__main__":
    if not DOUBAN_ID:
        print("Error: DOUBAN_ID environment variable is required.")
        print("Example: DOUBAN_ID=jnnsu uv run --with httpx,Pillow scripts/sync_douban.py")
        sys.exit(1)

    print(f"Douban Sync for user: {DOUBAN_ID}")
    n_movies = sync("movie", MOVIES_FILE, map_movie)
    n_books = sync("book", BOOKS_FILE, map_book)

    print(f"\nDone: {n_movies} new movies, {n_books} new books")

    # Signal GitHub Actions
    github_env = os.environ.get("GITHUB_ENV")
    if github_env:
        has_new = "true" if (n_movies + n_books > 0) else "false"
        with open(github_env, "a") as f:
            f.write(f"HAS_NEW_DATA={has_new}\n")
