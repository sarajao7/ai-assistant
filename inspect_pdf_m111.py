import sys
from pypdf import PdfReader
import re

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

pdf_path = "documents/IL (2).pdf"
reader = PdfReader(pdf_path)
print(f"Total pages in {pdf_path}: {len(reader.pages)}")

# Search for M111 and M115 across pages
m111_pages = []
m115_pages = []

for i, p in enumerate(reader.pages, start=1):
    txt = p.extract_text() or ""
    if "M111" in txt:
        m111_pages.append(i)
    if "M115" in txt:
        m115_pages.append(i)

print(f"Pages mentioning M111: {m111_pages}")
print(f"Pages mentioning M115: {m115_pages}")

if m111_pages:
    print("\n--- SAMPLE PAGE M111 (Page", m111_pages[0], ") ---")
    print(reader.pages[m111_pages[0]-1].extract_text()[:1200])

if len(m111_pages) > 1:
    print("\n--- SAMPLE PAGE M111 (Page", m111_pages[1], ") ---")
    print(reader.pages[m111_pages[1]-1].extract_text()[:1200])

if m115_pages:
    print("\n--- SAMPLE PAGE M115 (Page", m115_pages[0], ") ---")
    print(reader.pages[m115_pages[0]-1].extract_text()[:1200])
