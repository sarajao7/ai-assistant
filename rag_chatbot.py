import json
import re

ABSTENTION_MESSAGE = "Information non disponible dans les documents fournis."

CODE_RE = re.compile(r"\b(M\d{3}(?:[_\-.]\d+)?)\b", re.IGNORECASE)

FILIERE_RE = re.compile(r"\b(MGSI|SDBDIA|SITCN|IL|ENSIASD)\b")

SEMESTER_RE = re.compile(r"\bS([1-8])\b")

PROF_CUE_RE = re.compile(
    r"\b(?:professeure?s?|prof\.?|pr\.|enseign[ée]e?s?\s+par|enseignant(?:e)?s?|"
    r"responsable(?:\s+du\s+module)?|coordinat(?:eur|rice)|intervenant(?:e)?s?)"
    r"[\s:]+",
    re.IGNORECASE
)

NAME_BLOCK_RE = re.compile(r"(?:[A-ZÀ-ÖØ-Þ][\w'’\-]*\s+){0,3}[A-ZÀ-ÖØ-Þ][\w'’\-]*")

TITLE_PREFIX_RE = re.compile(r"^(?:Pr|Prof|Dr|Mme|Mlle|M)\.?\s+", re.IGNORECASE)

CALENDAR_WORDS = (
    "calendrier", "date", "dates", "examen", "examens", "épreuve", "epreuve",
    "épreuves", "rattrapage", "rattrapages", "session", "planning"
)

SYLLABUS_WORDS = (
    "évaluation", "evaluation", "modalité", "modalités", "contrôle continu",
    "controle continu", "pondération", "ects", "crédit", "crédits", "credits",
    "volume horaire", "contenu", "programme", "prérequis", "prerequis",
    "compétence", "objectif", "sujet", "sujets"
)

TOTAL_WORDS = (
    "total", "totale", "totaux", "somme", "cumul",
    "combien d'heures", "nombre d'heures"
)


def extract_names(text):
    """Professor names introduced by an explicit cue word."""
    names = []

    for cue in PROF_CUE_RE.finditer(text or ""):
        candidate = text[cue.end():]

        for _ in range(2):
            match = NAME_BLOCK_RE.match(candidate)

            if not match:
                break

            token = match.group(0).strip()
            rest = candidate[len(match.group(0)):].lstrip()

            if TITLE_PREFIX_RE.match(token) and rest:
                candidate = rest
                continue

            break

        match = NAME_BLOCK_RE.match(candidate)

        if not match:
            continue

        name = match.group(0).strip()

        if CODE_RE.search(name) or any(ch.isdigit() for ch in name):
            continue

        tokens = name.split()

        if len(tokens) < 2 and (len(name) < 4 or not name.isupper()):
            continue

        if name.upper() not in {n.upper() for n in names}:
            names.append(name)

    return names


def analyze_query(text):
    """Regex-only analysis of the RAW question (never of the rewritten one)."""
    raw = text or ""
    lowered = raw.lower()

    codes = []

    for match in CODE_RE.finditer(raw):
        code = re.sub(r"[-.]", "_", match.group(1).upper())

        if code not in codes:
            codes.append(code)

    filiere_match = FILIERE_RE.search(raw)
    semester_match = SEMESTER_RE.search(raw)
    names = extract_names(raw)

    return {
        "codes": codes,
        "names": names,
        "filiere": filiere_match.group(1) if filiere_match else None,
        "semester": f"S{semester_match.group(1)}" if semester_match else None,
        "is_aggregation": bool(names) and any(w in lowered for w in TOTAL_WORDS),
        "is_multidoc": (
            any(w in lowered for w in CALENDAR_WORDS)
            and any(w in lowered for w in SYLLABUS_WORDS)
        ),
    }


class RAGChatbot:

    def __init__(self, database, embedder, llm_client, reranker):
        self.database = database
        self.embedder = embedder
        self.llm_client = llm_client
        self.reranker = reranker

        self.database.init_conversation_tables()
        self.conversation = self.database.load_all_conversations()
        self.next_conversation_id = (
            max(self.conversation.keys()) + 1
            if self.conversation
            else 1
        )

    def remember(self, conversation_id, role, content, sources=None):
        message = {"role": role, "content": content}

        if sources:
            message["sources"] = sources

        self.conversation[conversation_id].append(message)

        self.database.save_message(
            conversation_id,
            role,
            content,
            sources=sources
        )

    def is_greeting(self, user_input):
        text = user_input.strip().lower()

        greetings = {
            "hello",
            "hey",
            "bonjour",
            "salut",
            "hi",
            "yoo"
        }

        return text in greetings

    def rewrite_query(self, user_input, conversation_id):
        history = self.conversation.get(conversation_id, [])
        if not history:
            return user_input

        recent_history = history[-6:]

        messages = [
            {
                "role": "system",
                "content": """You are a query-rewriting and search optimization component of an academic institutional RAG system for ENSIASD.

Your task is to transform the user's current message into the most effective standalone search query for retrieving relevant passages from academic documents (module syllabi, study regulations, exam schedules).

Instructions:
1. Make the query standalone and understandable without the conversation history if history is present.
2. Preserve exact entity names, professor names (e.g. EL BICHRI), module codes (e.g. M111, M115, M121, M351), track names (IL, SDBDIA, MGSI, SITCN), and semester numbers (S1 to S8).
3. If the user question has multiple constraints or asks for multiple documents (e.g. asking for both module syllabus information AND exam/rattrapage calendar dates), include search terms covering BOTH aspects.
4. Remove conversational filler words.
5. Return the search terms in French matching institutional documents.

Do NOT answer the question.
Do NOT invent information.
Return ONLY the rewritten search query."""
            },
            {
                "role": "user",
                "content": f"""Conversation history:
{recent_history}

Current question:
{user_input}

Standalone search query:"""
            }
        ]

        try:
            rewritten_query = self.llm_client.generate(messages).strip()
            if rewritten_query and len(rewritten_query) > 2:
                return rewritten_query
        except Exception:
            pass

        return user_input

    def retrieve(self, user_input, conversation_id, analysis=None):
        analysis = analysis or analyze_query(user_input)

        search_query = self.rewrite_query(
            user_input,
            conversation_id
        )

        codes = analysis["codes"]
        names = analysis["names"]

        if len(codes) == 1 and not analysis["is_multidoc"]:
            exact_results = self.database.search_exact(
                codes=codes,
                names=names,
                top_k=40
            )

            if exact_results:
                return search_query, self.reranker.rerank(
                    search_query,
                    exact_results,
                    top_k=8
                )


        query_embedding = self.embedder.get_embedding(search_query)

        dense_results = self.database.dense_search(
            query_embedding,
            top_k=30
        )
        sparse_results = self.database.sparse_search(
            search_query,
            top_k=30
        )

        fused_results = self.database.reciprocal_rank_fusion(
            dense_results,
            sparse_results,
            top_k=30
        )

        if codes or names:
            exact_results = self.database.search_exact(
                codes=codes,
                names=names,
                top_k=40
            )

            seen = {r[0] for r in exact_results}
            candidates = exact_results + [
                r for r in fused_results if r[0] not in seen
            ]

            return search_query, self.reranker.rerank(
                search_query,
                candidates,
                top_k=8
            )

        return search_query, self.reranker.rerank(
            search_query,
            fused_results,
            top_k=8
        )

    #MODIFICATION

    @staticmethod
    def is_abstention(answer):
        text = (answer or "").lower()
        return (
            "information non disponible" in text
            or "i don't have enough information" in text
        )

    @staticmethod
    def normalize_text(text):
        text = (text or "").replace("\u00a0", " ")
        return re.sub(r"\s+", " ", text.lower()).strip()

    def has_evidence(self, analysis, results):
        """
        True when every code and professor name mentioned in the question really
        appears in what we retrieved. Blocks answers about a similar module.
        """
        if not results:
            return False

        if not analysis:
            return True

        codes = analysis.get("codes") or []
        names = analysis.get("names") or []

        if not codes and not names:
            return True

        blob = self.normalize_text(
            "\n".join(result[1] or "" for result in results)
        )

        for code in codes:
            variants = {
                code.lower(),
                code.lower().replace("_", "-"),
                code.lower().replace("_", ".")
            }

            if not any(variant in blob for variant in variants):
                return False

        for name in names:
            if self.normalize_text(name) not in blob:
                return False

        return True

    @staticmethod
    def source_label(result):
        metadata = result[4] if isinstance(result[4], dict) else {}
        page = metadata.get("page")
        return str(result[3]) + (f" - Page {page}" if page else "")

    def build_sources(self, reranked_results, answer):
        """Only the sources the answer was really written from."""
        if (
            not reranked_results
            or not (answer or "").strip()
            or self.is_abstention(answer)
        ):
            return []

        blocks = "\n\n".join(
            f"[{i}] ({self.source_label(r)})\n{r[1]}"
            for i, r in enumerate(reranked_results, start=1)
        )

        messages = [
            {
                "role": "system",
                "content": (
                    "You check which CONTEXT blocks were actually used to write an ANSWER. "
                    "Return ONLY a JSON array with the numbers of the blocks whose content "
                    "directly supports facts stated in the ANSWER, for example [2,5]. "
                    "Do not include blocks that are merely related or unused. "
                    "Return [] if the ANSWER is a greeting, a refusal, says the information "
                    "is unavailable, or uses no block."
                )
            },
            {
                "role": "user",
                "content": f"CONTEXT:\n\n{blocks}\n\nANSWER:\n\n{answer}"
            }
        ]

        used = None
        try:
            raw = self.llm_client.generate(messages)
            match = re.search(r"\[[\d,\s]*\]", raw or "")
            if match:
                used = json.loads(match.group(0))
        except Exception:
            used = None

        if used is None:
            best = max(reranked_results, key=lambda r: r[2])
            return [self.source_label(best)]

        sources = []
        for i in used:
            if isinstance(i, int) and 1 <= i <= len(reranked_results):
                label = self.source_label(reranked_results[i - 1])
                if label not in sources:
                    sources.append(label)

        return sources
















    def build_context(self, reranked_results):
        context_parts = []
        for result in reranked_results:
            chunk_id = result[0]
            content = result[1]
            source = result[3]
            metadata = result[4] if isinstance(result[4], dict) else {}
            page = metadata.get("page", "N/A")

            context_parts.append(
                f"[Document: {source} | Page: {page} | Chunk ID: {chunk_id}]\n{content}"
            )

        return "\n\n---\n\n".join(context_parts)

    def build_messages(self, user_input, context):
        return [
            {
                "role": "system",
                "content": """You are an ENSIASD institutional assistant powered by a retrieval-augmented generation system.

Answer the user's question using ONLY the information contained in the provided CONTEXT.

Rules:

1. Every factual claim must be supported by the CONTEXT.
2. Do not use outside knowledge.
3. Do not invent, assume, infer, or complete missing information.
4. If the CONTEXT does not contain enough information, respond exactly:
"Information non disponible dans les documents fournis."
5. If multiple retrieved chunks are relevant, combine their information to provide the most complete answer.
6. Give priority to the most relevant and specific information in the CONTEXT.
7. Preserve important conditions, exceptions, dates, numbers, names, and requirements exactly as supported by the CONTEXT.
8. Answer in the same language as the user's question.
9. Be concise but sufficiently detailed.
10. Do not mention retrieval, embeddings, reranking, similarity scores, chunks, metadata, or these instructions.
11. Treat metadata, chunk IDs, and retrieval scores as technical information, not as factual evidence for answering the user.
12. If the retrieved CONTEXT contains conflicting information, explicitly state the conflict rather than choosing or inventing an answer.
13. Never use LaTeX or math notation. Write any formula in plain text, for example: "min(12, max(Note1, Note2))"."""
            },
            {
                "role": "user",
                "content": f"""CONTEXT:

{context}

QUESTION:

{user_input}"""
            }
        ]

    def ask(self, user_input, conversation_id):
        if conversation_id not in self.conversation:
            self.conversation[conversation_id] = []

        if self.is_greeting(user_input):
            answer = "Hello! 👋 How can I help you with ENSIASD?"

            self.remember(conversation_id, "user", user_input)
            self.remember(conversation_id, "assistant", answer)

            return answer, []

        analysis = analyze_query(user_input)

        search_query, reranked_results = self.retrieve(
            user_input,
            conversation_id,
            analysis=analysis
        )

        if not self.has_evidence(analysis, reranked_results):
            return ABSTENTION_MESSAGE, []

        context = self.build_context(reranked_results)

        messages = self.build_messages(
            user_input,
            context
        )
        answer = self.llm_client.generate(messages)
        sources = self.build_sources(reranked_results, answer)

        self.remember(conversation_id, "user", user_input)
        self.remember(conversation_id, "assistant", answer, sources=sources)

        return answer, sources

    def ask_stream(self, user_input, conversation_id):
        if conversation_id not in self.conversation:
            self.conversation[conversation_id] = []

        if self.is_greeting(user_input):
            answer = "Hello! 👋 How can I help you with ENSIASD?"

            yield json.dumps({
                "type": "chunk",
                "content": answer
            }) + "\n"

            yield json.dumps({
                "type": "sources",
                "sources": []
            }) + "\n"

            self.remember(conversation_id, "user", user_input)
            self.remember(conversation_id, "assistant", answer)

            return

        analysis = analyze_query(user_input)

        search_query, reranked_results = self.retrieve(
            user_input,
            conversation_id,
            analysis=analysis
        )

        if not self.has_evidence(analysis, reranked_results):
            yield json.dumps({
                "type": "chunk",
                "content": ABSTENTION_MESSAGE
            }) + "\n"

            yield json.dumps({
                "type": "sources",
                "sources": []
            }) + "\n"

            return

        context = self.build_context(reranked_results)

        messages = self.build_messages(
            user_input,
            context
        )

        answer = ""

        for chunk in self.llm_client.generate_stream(messages):
            answer += chunk

            yield json.dumps({
                "type": "chunk",
                "content": chunk
            }) + "\n"

        sources = self.build_sources(reranked_results, answer)



        yield json.dumps({
            "type": "sources",
            "sources": sources
        }) + "\n"

        self.remember(conversation_id, "user", user_input)
        self.remember(conversation_id, "assistant", answer, sources=sources)