"""Migrate old hexo-style frontmatter to Astro blog schema.

Usage:
  uv run scripts/migrate_frontmatter.py           # dry-run, show what would change
  uv run scripts/migrate_frontmatter.py --write   # apply changes
"""

import re
from argparse import ArgumentParser
from datetime import datetime
from pathlib import Path

BLOG_DIR = Path(__file__).resolve().parent.parent / "src" / "content" / "blog"

# Map old hexo categories to new category enum
CATEGORY_MAP = {
    "日常": "daily",
    "周报": "daily",
    "年终总结": "daily",
    "随笔": "article",
    "博客": "article",
    "写作": "article",
    "小技巧": "article",
    "读书笔记": "article",
    "诗歌": "article",
    "歌词": "article",
    "编程": "article",
}


def parse_frontmatter(text: str) -> tuple[str, dict, str]:
    """Parse YAML frontmatter from markdown text. Returns (frontmatter_str, data, body)."""
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)", text, re.DOTALL)
    if not m:
        return "", {}, text
    return m.group(1), _parse_simple_yaml(m.group(1)), m.group(2)


def _parse_simple_yaml(yaml_str: str) -> dict:
    """Parse simple YAML key: value pairs (enough for our frontmatter)."""
    result = {}
    current_key = None
    current_array = []
    in_array = False

    for line in yaml_str.split("\n"):
        # Detect array item: "  - value" or "- value"
        stripped = line.strip()
        if stripped.startswith("- ") and in_array and current_key:
            current_array.append(stripped[2:].strip().strip("'\""))
            continue

        # Key: Value
        kv = re.match(r"^(\w+):\s*(.*)", line)
        if kv:
            if in_array and current_key:
                result[current_key] = current_array
                current_array = []
                in_array = False

            key = kv.group(1)
            value = kv.group(2).strip()

            if value.startswith("[") and value.endswith("]"):
                # Inline array: categories: [随笔, 博客]
                inner = value[1:-1]
                items = [x.strip().strip("'\"") for x in inner.split(",") if x.strip()]
                result[key] = items
            else:
                if not value:
                    # Empty value, next lines might be array items
                    current_key = key
                    in_array = True
                    current_array = []
                else:
                    result[key] = value.strip("'\"")

    if in_array and current_key:
        result[current_key] = current_array

    return result


def format_frontmatter(data: dict) -> str:
    """Format dict back to YAML frontmatter string."""
    lines = ["---"]
    for key, value in data.items():
        if value is None or value == "":
            lines.append(f"{key}:")
        elif isinstance(value, list):
            if not value:
                lines.append(f"{key}: []")
            else:
                lines.append(f"{key}:")
                for item in value:
                    lines.append(f"  - {item}")
        elif isinstance(value, bool):
            lines.append(f"{key}: {'true' if value else 'false'}")
        else:
            lines.append(f"{key}: {value}")
    lines.append("---")
    return "\n".join(lines)


def extract_date(raw: str) -> str:
    """Extract and normalise YYYY-MM-DD from various date formats."""
    if not raw:
        return ""
    raw = raw.strip().strip("'\"")

    # Try to parse with datetime first (handles various formats)
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y-%m-%d %H:%M", "%Y-%#m-%#d"]:
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Fallback: try regex extraction
    parts = raw[:10].strip().split("-")
    if len(parts) == 3:
        try:
            return f"{int(parts[0]):04d}-{int(parts[1]):02d}-{int(parts[2]):02d}"
        except ValueError:
            pass

    return raw[:10]


def extract_tags(tags_value) -> list:
    """Normalize tags to a clean list."""
    if tags_value is None:
        return []
    if isinstance(tags_value, list):
        return [t for t in tags_value if t.strip()]
    if isinstance(tags_value, str) and tags_value.strip():
        return [tags_value.strip()]
    return []


def migrate_file(filepath: Path, write: bool = False) -> str | None:
    """Migrate a single markdown file. Returns change description or None."""
    text = filepath.read_text("utf-8")
    fm_str, data, body = parse_frontmatter(text)

    if not data:
        return None

    changes = []

    # 1. Add pubDate from date field
    if "pubDate" not in data and "date" in data:
        pub = extract_date(str(data["date"]))
        if pub:
            data["pubDate"] = pub
            changes.append(f"  + pubDate: {pub}")

    # 2. Add category from old categories field
    if "category" not in data and "categories" in data:
        old_cats = data["categories"]
        if isinstance(old_cats, list):
            old_cats = old_cats
        elif isinstance(old_cats, str):
            old_cats = [old_cats]
        else:
            old_cats = []

        mapped = None
        if old_cats:
            mapped = CATEGORY_MAP.get(old_cats[0], "article")
        else:
            mapped = "article"

        data["category"] = mapped
        changes.append(f"  + category: {mapped}")

    # 3. Ensure category field exists
    if "category" not in data:
        data["category"] = "article"
        changes.append("  + category: article (default)")

    # 4. Clean up tags
    if "tags" in data:
        tags = extract_tags(data.get("tags"))
        data["tags"] = tags
        if tags:
            changes.append(f"  ~ tags: {tags}")
        else:
            data["tags"] = []
            changes.append("  ~ tags: [] (was empty)")

    # 5. Ensure title is a string (not None)
    if "title" not in data or not data["title"]:
        return None  # skip, invalid post

    if not changes:
        return None

    if write:
        new_fm = format_frontmatter(data)
        filepath.write_text(f"{new_fm}\n{body}", "utf-8")

    return f"{filepath.name}: {' | '.join(changes)}"


def main():
    parser = ArgumentParser(description="Migrate frontmatter to Astro schema")
    parser.add_argument("--write", action="store_true", help="Apply changes (default: dry-run)")
    args = parser.parse_args()

    files = sorted(BLOG_DIR.glob("*.md"))
    changed = 0
    skipped = 0

    for fp in files:
        result = migrate_file(fp, write=args.write)
        if result:
            print(result)
            changed += 1
        else:
            skipped += 1

    mode = "Applied" if args.write else "Would apply (dry-run)"
    print(f"\n{mode}: {changed} changes, {skipped} skipped")


if __name__ == "__main__":
    main()
