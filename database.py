import psycopg2
from psycopg2.extras import Json
import json
import re
from sklearn.metrics.pairwise import cosine_similarity
import bcrypt


class Database:

    def __init__(self):
        self.host = "localhost"
        self.database = "ai_assistant"
        self.user = "postgres"
        self.password = "123"

    def get_connection(self):
        return psycopg2.connect(
            host=self.host,
            database=self.database,
            user=self.user,
            password=self.password
        )

    def init_conversation_tables(self):
        conn = self.get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS conversations (
                id SERIAL PRIMARY KEY,
                created_at TIMESTAMP DEFAULT NOW()
            )
            """
        )

        # Migration-safe: ties every conversation to the user who owns it.
        # Existing rows created before this column existed will have
        # user_id = NULL and are treated as orphaned/inaccessible.
        cur.execute(
            """
            ALTER TABLE conversations
            ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
                role TEXT NOT NULL,
                content TEXT,
                sources JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            )
            """
        )

        conn.commit()
        cur.close()
        conn.close()

    def create_conversation_row(self, user_id):
        conn = self.get_connection()
        cur = conn.cursor()

        cur.execute(
            "INSERT INTO conversations (user_id) VALUES (%s) RETURNING id",
            (user_id,)
        )
        conversation_id = cur.fetchone()[0]

        conn.commit()
        cur.close()
        conn.close()

        return conversation_id

    def get_conversation_owner(self, conversation_id):
        conn = self.get_connection()
        cur = conn.cursor()

        cur.execute(
            "SELECT user_id FROM conversations WHERE id = %s",
            (conversation_id,)
        )
        row = cur.fetchone()

        cur.close()
        conn.close()

        return row[0] if row else None

    def get_conversation_ids_for_user(self, user_id):
        conn = self.get_connection()
        cur = conn.cursor()

        cur.execute(
            "SELECT id FROM conversations WHERE user_id = %s ORDER BY id",
            (user_id,)
        )
        conversation_ids = [row[0] for row in cur.fetchall()]

        cur.close()
        conn.close()

        return conversation_ids

    def save_message(self, conversation_id, role, content, sources=None):
        conn = self.get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO messages (conversation_id, role, content, sources)
            VALUES (%s, %s, %s, %s)
            """,
            (
                conversation_id,
                role,
                content,
                Json(sources) if sources else None,
            ),
        )

        conn.commit()
        cur.close()
        conn.close()

    def load_all_conversations(self):
        conn = self.get_connection()
        cur = conn.cursor()

        cur.execute("SELECT id FROM conversations ORDER BY id")
        conversation_ids = [row[0] for row in cur.fetchall()]

        conversations = {}

        for conversation_id in conversation_ids:
            cur.execute(
                """
                SELECT role, content, sources
                FROM messages
                WHERE conversation_id = %s
                ORDER BY id
                """,
                (conversation_id,),
            )

            messages = []

            for role, content, sources in cur.fetchall():
                message = {"role": role, "content": content}

                if sources:
                    message["sources"] = sources

                messages.append(message)

            conversations[conversation_id] = messages

        cur.close()
        conn.close()

        return conversations

    def insert_chunk(
        self,
        document_id,
        document_name,
        chunk_index,
        content,
        embedding,
        source,
        metadata=None
    ):
        embedding_json = json.dumps(embedding)

        conn = self.get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO chunks
            (
                document_id,
                document_name,
                chunk_index,
                content,
                embedding,
                source,
                metadata
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                document_id,
                document_name,
                chunk_index,
                content,
                embedding_json,
                source,
                json.dumps(metadata or {})
            )
        )

        conn.commit()
        cur.close()
        conn.close()

    def search_similar(self, query_embedding, query_text, top_k=5):
        conn = self.get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT content, embedding, source, metadata
            FROM chunks;
            """
        )

        rows = cur.fetchall()

        query_words = set(
            re.findall(r'\b\w+\b', query_text.lower())
        )

        results = []

        important_phrases = [
            "débouchés",
            "conditions d'accès",
            "conditions et modalités d’accès",
            "passerelles",
            "prérequis",
            "validation",
            "stage",
            "pfe",
            "admission"
        ]

        query_lower = query_text.lower()

        for row in rows:
            content = row[0]
            doc_embedding = json.loads(row[1])
            source = row[2]
            metadata = row[3] or {}

            if len(doc_embedding) != len(query_embedding):
                continue

            semantic_score = cosine_similarity(
                [query_embedding],
                [doc_embedding]
            )[0][0]

            content_words = set(
                re.findall(r'\b\w+\b', content.lower())
            )

            common_words = query_words.intersection(content_words)

            keyword_score = (
                len(common_words) / len(query_words)
                if query_words
                else 0
            )

            content_lower = content.lower()

            phrase_score = 0

            for phrase in important_phrases:
                if phrase in query_lower and phrase in content_lower:
                    phrase_score += 0.3

            combined_score = (
                0.60 * semantic_score
                + 0.25 * keyword_score
                + 0.15 * min(phrase_score, 1.0)
            )

            results.append(
                (
                    content,
                    combined_score,
                    source,
                    metadata
                )
            )

        results.sort(
            key=lambda x: x[1],
            reverse=True
        )

        print("\n--- RETRIEVAL RESULTS ---")

        for result in results[:10]:
            print(
                f"Score: {result[1]:.4f} | "
                f"Source: {result[2]} | "
                f"Page: {result[3].get('page')} | "
                f"Content: {result[0][:200]}"
            )

        print("-------------------------\n")

        cur.close()
        conn.close()

        return results[:top_k]

    def delete_document_chunks(self, document_id):
        conn = self.get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            DELETE FROM chunks
            WHERE document_id = %s;
            """,
            (document_id,)
        )

        conn.commit()
        cur.close()
        conn.close()

    def dense_search(self, query_embedding, top_k=30):
        conn = self.get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT id, content, embedding, source, metadata
            FROM chunks;
            """
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()

        results = []
        for row in rows:
            doc_embedding = json.loads(row[2])
            if len(doc_embedding) != len(query_embedding):
                continue
            dense_score = cosine_similarity([query_embedding], [doc_embedding])[0][0]

            results.append((
                row[0],
                row[1],
                float(dense_score),
                row[3],
                row[4] or {}
            ))

        results.sort(
            key=lambda x: x[2],
            reverse=True
        )
        return results[:top_k]

    def sparse_search(self, query_text, top_k=30):
        if not query_text or not query_text.strip():
            return []

        conn = self.get_connection()
        cur = conn.cursor()

        # Extract alphanumeric words, codes (e.g. M111, M351, M115_2), acronyms
        terms = re.findall(r'[A-Za-zÀ-ÿ0-9_]+', query_text)

        stop_words = {
            "le", "la", "les", "un", "une", "des", "du", "de", "d", "l", "en", "et", "ou",
            "a", "au", "aux", "par", "pour", "dans", "sur", "avec", "sans", "sous",
            "qui", "que", "quoi", "dont", "où", "quel", "quelle", "quels", "quelles",
            "est", "sont", "ont", "avoir", "etre", "fait", "ce", "cette", "ces",
            "mon", "ton", "son", "notre", "votre", "leur", "the", "is", "at", "which"
        }

        filtered_terms = [t for t in terms if t.lower() not in stop_words and len(t) > 1]

        if filtered_terms:
            or_query = " | ".join(filtered_terms)
        else:
            or_query = " | ".join(terms) if terms else query_text

        sql = """
        SELECT
            id,
            content,
            ts_rank_cd(
                to_tsvector('simple', content),
                to_tsquery('simple', %s)
            ) AS sparse_score,
            source,
            metadata
        FROM chunks
        WHERE
            to_tsvector('simple', content) @@ to_tsquery('simple', %s)
            OR content ILIKE %s
        ORDER BY sparse_score DESC
        LIMIT %s;
        """

        first_kw = filtered_terms[0] if filtered_terms else query_text[:15]
        like_pattern = f"%{first_kw}%"

        try:
            cur.execute(sql, (or_query, or_query, like_pattern, top_k))
            rows = cur.fetchall()
        except Exception:
            conn.rollback()
            cur.execute(
                """
                SELECT id, content,
                       ts_rank(to_tsvector('simple', content), plainto_tsquery('simple', %s)) AS sparse_score,
                       source, metadata
                FROM chunks
                WHERE to_tsvector('simple', content) @@ plainto_tsquery('simple', %s)
                ORDER BY sparse_score DESC LIMIT %s;
                """,
                (query_text, query_text, top_k)
            )
            rows = cur.fetchall()

        results = []
        for row in rows:
            results.append((
                row[0],
                row[1],
                float(row[2]) if row[2] is not None else 0.0,
                row[3],
                row[4] or {}
            ))

        cur.close()
        conn.close()
        return results

    def search_exact(self, codes=None, names=None, top_k=40):
        """
        Exact channel driven by the metadata tags written by ingest.py.
        codes and names are OR-ed: a chunk matching either family is kept.
        """
        codes = [c for c in (codes or []) if c]
        names = [n for n in (names or []) if n]

        if not codes and not names:
            return []

        any_sql = []
        any_params = []

        for code in codes:
            base = code.split("_")[0]

            any_sql.append(
                "(metadata->>'module_code' = %s"
                " OR metadata->>'element_code' = %s"
                " OR content ~* %s)"
            )
            any_params.extend([
                base,
                code,
                r"\y" + re.escape(code) + r"\y"
            ])

        for name in names:
            any_sql.append("content ~* %s")
            any_params.append(
                r"\y" + r"\W+".join(re.escape(p) for p in name.split()) + r"\y"
            )

        sql = f"""
        SELECT id, content, 1.0 AS exact_score, source, metadata
        FROM chunks
        WHERE {' OR '.join(any_sql)}
        ORDER BY source NULLS LAST, id
        LIMIT %s;
        """

        params = any_params + [top_k]
        conn = self.get_connection()
        cur = conn.cursor()

        try:
            cur.execute(sql, params)
            rows = cur.fetchall()
        finally:
            cur.close()
            conn.close()

        return [
            (row[0], row[1], float(row[2]), row[3], row[4] or {})
            for row in rows
        ]

    def reciprocal_rank_fusion(self, dense_results, sparse_results, top_k=30):
        k = 60
        rrf_scores = {}
        chunks = {}

        for rank, result in enumerate(dense_results, start=1):
            chunk_id = result[0]
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + (1.0 / (k + rank))
            chunks[chunk_id] = result

        for rank, result in enumerate(sparse_results, start=1):
            chunk_id = result[0]
            # Lexical boost for exact keyword matches (codes / names)
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + (1.2 / (k + rank))
            chunks[chunk_id] = result

        ranked = sorted(
            rrf_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )

        results = []
        for chunk_id, rrf_score in ranked[:top_k]:
            result = chunks[chunk_id]
            results.append((
                result[0],   # id
                result[1],   # content
                rrf_score,   # score
                result[3],   # source
                result[4]    # metadata
            ))

        return results
    

    
    def get_admin_stats(self):
        conn = self.get_connection()
        cur = conn.cursor()

        cur.execute("SELECT COUNT(*) FROM chunks;")
        total_chunks = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(DISTINCT document_id)
            FROM chunks;
        """)
        total_documents = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM queries;")
        total_queries = cur.fetchone()[0]

        cur.execute("""
            SELECT COALESCE(AVG(latency_ms), 0)
            FROM queries
            WHERE latency_ms IS NOT NULL;
        """)
        average_latency_ms = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(*)
            FROM feedback
            WHERE rating = 1;
        """)
        positive_feedback = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(*)
            FROM feedback
            WHERE rating = 0;
        """)
        negative_feedback = cur.fetchone()[0]

        cur.close()
        conn.close()

        return {
            "total_documents": total_documents,
            "total_chunks": total_chunks,
            "total_queries": total_queries,
            "average_latency_ms": float(average_latency_ms),
            "positive_feedback": positive_feedback,
            "negative_feedback": negative_feedback
        }

    def get_admin_analytics(self):
        conn = self.get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT DATE(created_at) AS date, COUNT(*) AS count
            FROM queries
            GROUP BY DATE(created_at)
            ORDER BY date;
        """)
        queries_over_time = cur.fetchall()

        cur.execute("""
            SELECT topic, COUNT(*) AS count
            FROM queries
            WHERE topic IS NOT NULL
            GROUP BY topic
            ORDER BY count DESC;
        """)
        top_topics = cur.fetchall()

        cur.execute("""
            SELECT filiere, COUNT(*) AS count
            FROM queries
            WHERE filiere IS NOT NULL
            GROUP BY filiere
            ORDER BY count DESC;
        """)
        top_filieres = cur.fetchall()

        cur.execute("""
            SELECT rating, COUNT(*) AS count
            FROM feedback
            GROUP BY rating
            ORDER BY rating;
        """)
        feedback_distribution = cur.fetchall()

        cur.close()
        conn.close()

        return {
            "queries_over_time": queries_over_time,
            "top_topics": top_topics,
            "top_filieres": top_filieres,
            "feedback_distribution": feedback_distribution
        }

    def get_chunks(self, document_id=None, filiere=None, limit=100):
        conn = self.get_connection()
        cur = conn.cursor()

        query = """
            SELECT
                id,
                document_id,
                document_name,
                chunk_index,
                content,
                embedding,
                source,
                metadata
            FROM chunks
            WHERE 1=1
        """

        params = []

        if document_id:
            query += " AND document_id = %s"
            params.append(document_id)

        if filiere:
            query += " AND metadata::jsonb->>'filiere' = %s"
            params.append(filiere)

        query += """
            ORDER BY document_name, chunk_index
            LIMIT %s;
        """

        params.append(limit)

        cur.execute(query, tuple(params))
        rows = cur.fetchall()

        chunks = []

        for row in rows:
            metadata = row[7] or {}

            if isinstance(metadata, str):
                metadata = json.loads(metadata)

            chunks.append({
                "id": row[0],
                "document_id": row[1],
                "document_name": row[2],
                "chunk_index": row[3],
                "content": row[4],
                "source": row[6],
                "metadata": metadata,
                "page": metadata.get("page"),
                "filiere": metadata.get("filiere"),
                "semester": metadata.get("semester"),
                "module": metadata.get("module"),
                "heading": metadata.get("heading")
            })

        cur.close()
        conn.close()

        return chunks





    
    def save_query(self, query_text, topic=None, filiere=None, latency_ms=None):
        conn = self.get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO queries (query_text, topic, filiere, latency_ms)
            VALUES (%s, %s, %s, %s)
            RETURNING id;
            """,
            (query_text, topic, filiere, latency_ms)

        )

        query_id = cur.fetchone()[0]

        conn.commit()
        cur.close()
        conn.close()

        return query_id


    def save_feedback(self, query_id, rating):
        if rating not in (0, 1):
            raise ValueError("Rating must be 0 or 1")

        conn = self.get_connection()
        cur = conn.cursor()

        cur.execute(
            """
            INSERT INTO feedback (query_id, rating)
            VALUES (%s, %s);

            """,
            (query_id, rating)
        )


        conn.commit()
        cur.close()
        conn.close()


    def create_user(self, name, email, password_hash, role):
        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute("""
        INSERT INTO users(name, email, password_hash, role) VALUES (%s, %s, %s, %s) RETURNING id;
        """, (name, email, password_hash, role))
        new_user_id = cur.fetchone()[0]

        conn.commit()
        cur.close()
        conn.close()

        return new_user_id


    def get_user_by_email(self, email):
        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute("""
        SELECT id, name, email, password_hash, role, created_at
        FROM users
        WHERE email = %s
        """, (email,))
        user = cur.fetchone()
        
        cur.close()
        conn.close()
        return user


    def get_user_by_id(self, user_id):
        conn = self.get_connection()
        cur = conn.cursor()
        cur.execute("""
        SELECT id, name, email, password_hash, role, created_at
        FROM users
        WHERE id = %s;
        """, (user_id,))
        user = cur.fetchone()

       
        cur.close()
        conn.close()
        return user






    def update_user(self, user_id, name, email, role):
        conn = self.get_connection()
        cur = conn.cursor()

        cur.execute("""
            UPDATE users
            SET name = %s,
                email = %s,
                role = %s
            WHERE id = %s;
        """, (name, email, role, user_id))

        conn.commit()
        cur.close()
        conn.close()

        return True

    def hash_password(self, password):
        password_bytes = password.encode("utf-8")
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password_bytes, salt)

        return hashed.decode("utf-8")


    def verify_password(self, password, password_hash):
        password_bytes = password.encode("utf-8")
        hash_bytes = password_hash.encode("utf-8")

        return bcrypt.checkpw(password_bytes, hash_bytes)

    def update_password(self, user_id, password_hash):
        conn = self.get_connection()
        cur = conn.cursor()

        cur.execute("""
        UPDATE users
        SET password_hash = %s
        WHERE id = %s;""",(password_hash, user_id))

        conn.commit()
        cur.close()
        conn.close()
        return True


