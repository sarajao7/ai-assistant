import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from database import Database
from embedder import Embedder
from llm_client import LLMClient
from reranker import Reranker
from rag_chatbot import RAGChatbot, analyze_query

QUESTIONS = [
    "Qui est le professeur du module M115_2 ?",
    "Quels sont les enseignants du module M351 ?",
    "Quels sont les sujets abordés dans le module M111 ?",
    "Quels sont les modules enseignés par le professeur EL BICHRI et quel est le volume horaire total ?",
    "Quel est le professeur du module M111 et quel est le volume horaire ?",
    "Quelles sont les modalités d'évaluation du module M121 et quelle est la date d'examen ?",
    "Quels sont les crédits ECTS du semestre S2 de la filière IL et quelles sont les dates de rattrapage ?",
]

database = Database()
bot = RAGChatbot(database, Embedder(), LLMClient(), Reranker())

for question in QUESTIONS:
    analysis = analyze_query(question)

    print("=" * 90)
    print("Q:", question)
    print("analysis:", analysis)

    search_query, results = bot.retrieve(question, 999)

    print("evidence:", bot.has_evidence(analysis, results))
    print("ids:", [r[0] for r in results])

    for result in results[:3]:
        meta = result[4] or {}

        print(f"  id={result[0]} src={result[3]} p={meta.get('page')} "
              f"module={meta.get('module_code')} element={meta.get('element_code')}")
        print("    " + result[1][:150].replace("\n", " "))
