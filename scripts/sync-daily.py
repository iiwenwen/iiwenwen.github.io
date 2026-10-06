#!/usr/bin/env python3
"""从 Obsidian Vault 同步公开日常到博客仓库。

用法:
  uv run scripts/sync-daily.py /path/to/obsidian/vault

逻辑:
  - 扫描 Obsidian Vault 下所有 .md 文件
  - 跳过有 private: true 的笔记
  - 复制其余文件到 src/content/mur/
  - 提交并推送
"""

import sys
import os
import shutil
from datetime import datetime
from pathlib import Path
import re


REPO_DIR = Path(__file__).resolve().parent.parent
DAILY_DIR = REPO_DIR / "src" / "content" / "mur"


def is_private(filepath: Path) -> bool:
    """检查文件 frontmatter 是否有 private: true"""
    content = filepath.read_text(encoding="utf-8")
    match = re.match(r'^---\n([\s\S]*?)\n---', content)
    if match:
        return bool(re.search(r'^\s*private:\s*true', match.group(1), re.MULTILINE))
    return False


def normalize_frontmatter(filepath: Path, text: str) -> str:
    """确保 frontmatter 含 mur schema 必需的 title 与 pubDate。

    缺失 title 时取正文第一个非空行；缺失 pubDate 时取文件名前缀
    YYYY-MM-DD，否则用文件修改日期。
    """
    now = datetime.fromtimestamp(filepath.stat().st_mtime)
    default_date = now.strftime('%Y-%m-%d')

    match = re.match(r'^---\n([\s\S]*?)\n---', text)
    if not match:
        title = next((line.strip().lstrip('#').strip() for line in text.splitlines()
                      if line.strip() and not line.strip().startswith('#')), "随记")
        return f"---\ntitle: \"{title}\"\npubDate: {default_date}\n---\n\n{text.strip()}\n"

    frontmatter = match.group(1)

    def set_field(frontmatter: str, field: str, value: str) -> str:
        pattern = re.compile(rf'^{re.escape(field)}:.*$', re.MULTILINE)
        if pattern.search(frontmatter):
            return pattern.sub(f"{field}: {value}", frontmatter)
        return f"{frontmatter}\n{field}: {value}"

    if not re.search(r'^title:.*$', frontmatter, re.MULTILINE):
        first_line = next((line.strip().lstrip('#').strip() for line in text.splitlines()
                           if line.strip() and not line.strip().startswith('#')), "随记")
        frontmatter = set_field(frontmatter, "title", f'"{first_line}"')

    if not re.search(r'^pubDate:.*$', frontmatter, re.MULTILINE):
        file_date = re.match(r'^(\d{4}-\d{2}-\d{2})', filepath.name)
        frontmatter = set_field(frontmatter, "pubDate", file_date.group(1) if file_date else default_date)

    return f"---\n{frontmatter}\n---\n\n{text[match.end():].lstrip()}\n"


def sync(vault_path: str):
    vault = Path(vault_path).resolve()
    if not vault.is_dir():
        print(f"错误: {vault} 不是有效目录")
        sys.exit(1)

    DAILY_DIR.mkdir(parents=True, exist_ok=True)

    synced = 0
    for md_file in vault.rglob("*.md"):
        # 跳过隐藏文件和模板
        if md_file.name.startswith(".") or md_file.name.startswith("_") or md_file.name.startswith("template"):
            continue

        if is_private(md_file):
            print(f"  [跳过私密] {md_file.name}")
            continue

        dest = DAILY_DIR / md_file.name
        source_text = md_file.read_text(encoding="utf-8")
        if dest.exists() and dest.read_text(encoding="utf-8") == source_text:
            continue  # 内容相同，跳过

        dest.write_text(normalize_frontmatter(md_file, source_text), encoding="utf-8")
        print(f"  [已同步] {md_file.name}")
        synced += 1

    if synced == 0:
        print("没有新内容需要同步。")
        return

    # Git 操作
    os.chdir(REPO_DIR)
    os.system("git add src/content/mur/")
    os.system(f'git commit -m "sync: {synced} 条日常" 2>/dev/null')
    os.system("git push origin main 2>/dev/null")
    print(f"\n✓ 已同步 {synced} 条日常并推送")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: uv run scripts/sync-daily.py /path/to/obsidian/vault")
        sys.exit(1)
    sync(sys.argv[1])
