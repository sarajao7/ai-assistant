"""
Pre-flight check for the ingest.py chunking edits (steps 1.1 - 1.15).

Run this BEFORE `python ingest.py documents`. It exercises build_document_chunks()
directly: no database, no embeddings, no model download, ~1 second.

    python test_chunking.py

Expected output:

    M111 None
    M115 M115_2

If you get an exception here, fix ingest.py before re-ingesting.
"""

from ingest import build_document_chunks

PAGES = [
    {
        "page": 1,
        "text": "\n".join([
            "Code du module : M111",
            "Intitulé du module : ALGORITHMES ET POO EN JAVA",
            "Semestre de programmation du module : 1",
            "5. DESCRIPTION DU CONTENU DU MODULE",
            "Algorithmes de tri, complexité, java",
            "Prérequis : voir module M115_2 Systèmes d'exploitation",
            "Le module M353 est un prérequis.",
        ]),
    },
    {
        "page": 2,
        "text": "\n".join([
            "N° d'ordre du module M115_2",
            "Intitulé du module : SYSTEMES D'EXPLOITATION",
            "EL BICHRI Fadila | Professeur | 46",
        ]),
    },
]

chunks = build_document_chunks(PAGES, "TEST.pdf")

for chunk in chunks:
    print(chunk["module_code"], chunk["element_code"])