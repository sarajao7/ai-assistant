import json
import re


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

    def retrieve(self, user_input, conversation_id):
        search_query = self.rewrite_query(
            user_input,
            conversation_id
        )

        query_embedding = self.embedder.get_embedding(
            search_query
        )

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
        reranked_results = self.reranker.rerank(
            search_query,
            fused_results,
            top_k=8
        )

        return search_query, reranked_results

    #MODIFICATION

    @staticmethod
    def is_abstention(answer):
        text = (answer or "").lower()
        return (
            "information non disponible" in text
            or "i don't have enough information" in text
        )

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
"I don't have enough information to answer this question based on the available documents."
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

        search_query, reranked_results = self.retrieve(
            user_input,
            conversation_id
        )

        if not reranked_results:
            answer = (
                "I don't have enough information to answer this question "
                "based on the available documents."
            )

            return answer, []

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

        search_query, reranked_results = self.retrieve(
            user_input,
            conversation_id
        )

        if not reranked_results:
            answer = (
                "I don't have enough information to answer this question "
                "based on the available documents."
            )

            yield json.dumps({
                "type": "chunk",
                "content": answer
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