#!/usr/bin/env python3
"""从 Obsidian Vault 同步公开日常到博客仓库。

用法:
  uv run scripts/sync-daily.py /path/to/obsidian/vault

逻辑:
  - 扫描 Obsidian Vault 下所有 .md 文件
  - 跳过有 private: true 的笔记
  - 复制其余文件到 src/content/posts/
  - 提交并推送
"""

import sys
import os
import shutil
from pathlib import Path
import re


REPO_DIR = Path(__file__).resolve().parent.parent
DAILY_DIR = REPO_DIR / "src" / "content" / "daily"


def is_private(filepath: Path) -> bool:
    """检查文件 frontmatter 是否有 private: true"""
    content = filepath.read_text(encoding="utf-8")
    match = re.match(r'^---\n([\s\S]*?)\n---', content)
    if match:
        return bool(re.search(r'^\s*private:\s*true', match.group(1), re.MULTILINE))
    return False


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
        if dest.exists() and dest.read_text() == md_file.read_text():
            continue  # 内容相同，跳过

        shutil.copy2(md_file, dest)
        print(f"  [已同步] {md_file.name}")
        synced += 1

    if synced == 0:
        print("没有新内容需要同步。")
        return

    # Git 操作
    os.chdir(REPO_DIR)
    os.system("git add src/content/posts/")
    os.system(f'git commit -m "sync: {synced} 条日常" 2>/dev/null')
    os.system("git push origin main 2>/dev/null")
    print(f"\n✓ 已同步 {synced} 条日常并推送")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: uv run scripts/sync-daily.py /path/to/obsidian/vault")
        sys.exit(1)
    sync(sys.argv[1])
