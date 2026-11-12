#!/usr/bin/env python3
"""Summarise your iMessage history for Donkey. Mac only.

Usage:  python3 scripts/export_imessage.py > imessage.json

Writes one row per phone number or email: message counts and the date of the
latest message. It never reads or outputs message text. Terminal needs Full
Disk Access (System Settings > Privacy & Security) to read the Messages
database. Pass a path as the first argument to read a different chat.db.
"""
import json
import os
import shutil
import sqlite3
import sys
import tempfile
from datetime import datetime, timezone

APPLE_EPOCH = 978307200  # 2001-01-01 in Unix seconds

QUERY = """
SELECT h.id, COUNT(*), COALESCE(SUM(m.is_from_me), 0), MAX(m.date)
FROM message m JOIN handle h ON m.handle_id = h.ROWID
GROUP BY h.id
"""


def to_day(raw):
    # Newer macOS stores nanoseconds since 2001, older versions store seconds.
    seconds = raw / 1e9 if raw > 1e11 else raw
    return datetime.fromtimestamp(seconds + APPLE_EPOCH, tz=timezone.utc).astimezone().strftime("%Y-%m-%d")


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/Library/Messages/chat.db")
    with tempfile.TemporaryDirectory() as tmp:
        # Work on a copy: Messages keeps the live database locked.
        dst = os.path.join(tmp, "chat.db")
        try:
            shutil.copy2(src, dst)
        except PermissionError:
            sys.exit("Cannot read the Messages database. Give Terminal Full Disk Access and try again.")
        for ext in ("-wal", "-shm"):
            if os.path.exists(src + ext):
                shutil.copy2(src + ext, dst + ext)
        con = sqlite3.connect(dst)
        rows = [
            {"handle": handle, "total": total, "sent": sent, "last": to_day(last)}
            for handle, total, sent, last in con.execute(QUERY)
            if last
        ]
        con.close()
    json.dump(sorted(rows, key=lambda r: -r["total"]), sys.stdout, indent=1)


if __name__ == "__main__":
    main()
