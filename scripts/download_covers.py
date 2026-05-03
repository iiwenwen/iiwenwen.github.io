"""Download book/movie covers from Douban API v2 and convert to WebP.

Usage: uv run --with httpx,Pillow scripts/download_covers.py
"""

import json
import re
import time
import sys
from pathlib import Path

import httpx
from PIL import Image
from io import BytesIO

ROOT = Path(__file__).resolve().parent.parent
BOOKS_FILE = ROOT / "src/data/books.json"
MOVIES_FILE = ROOT / "src/data/movies.json"
COVERS_DIR = ROOT / "public/covers"

API = "https://api.douban.com/v2"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
}
APIKEY = "0ab215a8b1977939201640fa14c66bab"

client = httpx.Client(headers=HEADERS, timeout=30)


def search_book(isbn: str) -> dict | None:
    """Fetch book from Douban by ISBN via POST."""
    resp = client.post(
        f"{API}/book/isbn/{isbn}",
        json={"apikey": APIKEY},
    )
    if resp.status_code != 200:
        return None
    return resp.json()


def search_movie(title: str) -> dict | None:
    """Search Douban for a movie by title."""
    resp = client.post(
        f"{API}/movie/search",
        json={"apikey": APIKEY, "q": title, "count": 1},
    )
    if resp.status_code != 200:
        return None
    data = resp.json()
    subjects = data.get("subjects", [])
    return subjects[0] if subjects else None


def download_and_convert(url: str, dest: Path) -> bool:
    """Download an image and convert to WebP."""
    if dest.exists():
        print(f"  Already exists: {dest.name}")
        return True
    try:
        img_headers = HEADERS | {"Referer": "https://book.douban.com/"}
        resp = client.get(url, headers=img_headers)
        resp.raise_for_status()
        img = Image.open(BytesIO(resp.content))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGBA")
        if img.width > 400:
            ratio = 400 / img.width
            img = img.resize((400, int(img.height * ratio)), Image.LANCZOS)
        img.save(dest, "WEBP", quality=82)
        print(f"  Saved: {dest.name} ({dest.stat().st_size // 1024}KB)")
        return True
    except Exception as e:
        print(f"  Download error: {e}")
        return False


def slugify(title: str) -> str:
    slug = re.sub(r"[^\w\u4e00-\u9fff\-]", "", title)[:20]
    return slug or "cover"


def process_books(dry_run: bool = False) -> None:
    books = json.loads(BOOKS_FILE.read_text())
    updated = 0
    skipped = 0

    for i, book in enumerate(books):
        title = book["title"]
        isbn = book.get("isbn", "")
        if book.get("cover") or not isbn:
            skipped += 1
            continue

        print(f"[{i+1}/{len(books)}] {title}")
        if dry_run:
            continue

        result = search_book(isbn)
        if not result:
            print("  Not found")
            continue

        cover_url = result.get("images", {}).get("large") or result.get("image", "")
        if not cover_url:
            print("  No cover URL")
            continue

        fname = f"{slugify(title)}.webp"
        dest = COVERS_DIR / fname
        if download_and_convert(cover_url, dest):
            book["cover"] = f"/covers/{fname}"
            updated += 1

        time.sleep(0.5)

    print(f"\nBooks: {updated} downloaded, {skipped} skipped")
    if updated > 0:
        BOOKS_FILE.write_text(json.dumps(books, ensure_ascii=False, indent=2) + "\n")


def process_movies(dry_run: bool = False) -> None:
    movies = json.loads(MOVIES_FILE.read_text())
    updated = 0
    skipped = 0

    for i, movie in enumerate(movies):
        title = movie["title"]
        if movie.get("cover"):
            skipped += 1
            continue

        print(f"[{i+1}/{len(movies)}] {title}")
        if dry_run:
            continue

        result = search_movie(title)
        if not result:
            print("  Not found")
            continue

        cover_url = result.get("images", {}).get("large", "")
        if not cover_url:
            print("  No cover URL")
            continue

        fname = f"{slugify(title)}.webp"
        dest = COVERS_DIR / fname
        if download_and_convert(cover_url, dest):
            movie["cover"] = f"/covers/{fname}"
            updated += 1

        time.sleep(0.5)

    print(f"\nMovies: {updated} downloaded, {skipped} skipped")
    if updated > 0:
        MOVIES_FILE.write_text(json.dumps(movies, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("=== DRY RUN ===\n")

    COVERS_DIR.mkdir(parents=True, exist_ok=True)

    print("--- Books ---")
    process_books(dry_run)

    print("\n--- Movies ---")
    process_movies(dry_run)
