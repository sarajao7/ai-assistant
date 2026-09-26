from database import Database
db = Database()
conn = db.get_connection()
cur = conn.cursor()
cur.execute("""
    SELECT chunk_index, LEFT(content, 300)
    FROM chunks
    WHERE document_name = 'IL (2).pdf'
      AND content ILIKE '%M111%'
      AND content ILIKE '%Algorithme%'
    LIMIT 5
""")
rows = cur.fetchall()
print(f"Found: {len(rows)}")
for chunk_index, preview in rows:
    print(f"\n--- chunk {chunk_index} ---\n{preview}")
cur.close()
conn.close()