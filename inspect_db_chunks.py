import sys
import json
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
from database import Database

db = Database()
conn = db.get_connection()
cur = conn.cursor()

targets = ["M111", "M115", "M115_2", "M351", "EL BICHRI", "M121", "M127"]

for target in targets:
    cur.execute("""
        SELECT id, document_name, chunk_index, metadata, content
        FROM chunks
        WHERE content ILIKE %s OR metadata::text ILIKE %s;
    """, (f"%{target}%", f"%{target}%"))
    rows = cur.fetchall()
    print(f"\n=======================================================")
    print(f"TARGET: {target} -> Found {len(rows)} chunks")
    print(f"=======================================================")
    for r in rows[:3]:
        meta = r[3] if isinstance(r[3], dict) else json.loads(r[3] or '{}')
        print(f"Chunk ID: {r[0]} | Doc: {r[1]} | Page: {meta.get('page')} | Filiere: {meta.get('filiere')} | Module: {meta.get('module_code')}")
        snippet = r[4][:250].replace('\n', ' ')
        print(f"  Snippet: {snippet}...\n")

cur.close()
conn.close()
