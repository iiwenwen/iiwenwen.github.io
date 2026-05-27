#!/usr/bin/env python3
"""跨平台日常输入脚本。用法: uv run scripts/daily.py "今天的内容"

支持:
- 命令行参数直接输入
- 无参数时交互式输入
- Termux / macOS / Linux 通用
"""

import sys
import os
from datetime import datetime
from pathlib import Path


REPO_DIR = Path(__file__).resolve().parent.parent
POSTS_DIR = REPO_DIR / "src" / "content" / "posts"


def create_daily(text: str) -> Path:
    now = datetime.now()
    ts = now.strftime('%Y-%m-%dT%H-%M-%S')
    filename = f"{ts}.md"
    filepath = POSTS_DIR / filename

    title = text.split("\n")[0][:30].strip() or "随记"
    frontmatter = f"""---
title: "{title}"
date: {now.strftime('%Y-%m-%d %H:%M')}
category: daily
---

{text.strip()}
"""
    POSTS_DIR.mkdir(parents=True, exist_ok=True)
    filepath.write_text(frontmatter, encoding="utf-8")
    return filepath


def main():
    if len(sys.argv) > 1:
        text = " ".join(sys.argv[1:])
    else:
        print("输入日常内容（输入空行结束）：")
        lines = []
        while True:
            try:
                line = input()
                if line == "":
                    break
                lines.append(line)
            except EOFError:
                break
        text = "\n".join(lines)

    if not text.strip():
        print("内容为空，取消。")
        sys.exit(1)

    filepath = create_daily(text)
    print(f"✓ 已创建: {filepath.relative_to(REPO_DIR)}")

    # 自动 git 操作
    os.chdir(REPO_DIR)
    os.system(f"git add {filepath}")
    os.system(f'git commit -m "daily: {text[:40]}" 2>/dev/null')
    os.system("git push origin main 2>/dev/null")
    print("✓ 已推送")


if __name__ == "__main__":
    main()
