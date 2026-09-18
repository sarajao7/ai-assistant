from fastapi import FastAPI, HTTPException
import time
import json
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from reranker import Reranker
from jose import jwt
from datetime import datetime, timedelta
from fastapi import Header
from jose import JWTError
from fastapi import Depends
from fastapi.security import OAuth2PasswordRequestForm
import secrets


load_dotenv()

from database import Database
from embedder import Embedder
from llm_client import LLMClient
from rag_chatbot import RAGChatbot
from fastapi import FastAPI, HTTPException, UploadFile, File
from ingest import ingest_file, ingest_web
from pathlib import Path
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
SECRET_KEY = "SA34KS"
ALGORITHM = "HS256"
reset_tokens={}



app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

database = Database()
embedder = Embedder()
llm_client = LLMClient()
reranker = Reranker()

chatbot = RAGChatbot(
    database,
    embedder,
    llm_client,
    reranker
)


class ChatRequest(BaseModel):
    question: str
    conversation_id: int

class FeedbackRequest(BaseModel):
    query_id: int
    rating: int


@app.get("/")
def home():
    return {
        "message": "ENSIASD Assistant API is running"
    }


@app.post("/chat")
def chat(request: ChatRequest):

    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty"
        )

    if request.conversation_id not in chatbot.conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    try:
        #start measuring latency
        start_time = time.perf_counter()

        answer, sources = chatbot.ask(
            request.question,
            request.conversation_id
        )
        #calculate latency in ms
        latency_ms = int((time.perf_counter() - start_time) * 1000)

        #save the query in database
        query_id = database.save_query(
            query_text=request.question,
            topic=None,
            filiere=None,
            latency_ms=latency_ms
        )

        return {
            "answer": answer,
            "sources": sources,
            "query_id": query_id,
            "latency_ms": latency_ms
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Chatbot error: {type(e).__name__}: {str(e)}"
        )


@app.post("/chat/stream")
def chat_stream(request: ChatRequest):

    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty"
        )

    if request.conversation_id not in chatbot.conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    try:
        start_time = time.perf_counter()
        def generate():
            try:
                for chunk in chatbot.ask_stream(
                    request.question,
                    request.conversation_id
                ):
                    yield chunk
                latency_ms = int((time.perf_counter() - start_time)*1000)
                #save the query
                query_id = database.save_query(query_text=request.question, topic=None, filiere=None, latency_ms=latency_ms)

                print(f"analytics saved: query_id ={query_id},"
                      f"latency={latency_ms}ms")
                yield json.dumps({
                    "type": "metadata",
                    "query_id": query_id,
                    "latency_ms": latency_ms
                }) + "\n"
            except Exception as e:
                print(
                    f"Streaming error: {type(e).__name__}: {str(e)}"
                )
                raise
                

        return StreamingResponse(
            generate(),
            media_type="application/x-ndjson"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Streaming error: {type(e).__name__}: {str(e)}"
        )


@app.get("/history")
def history():
    return {
        "history": chatbot.conversation
    }


@app.get("/conversations/{id}")
def history_conversation(id: int):

    if id not in chatbot.conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    return {
        "conversation_id": id,
        "history": chatbot.conversation[id]
    }


@app.post("/conversations")
def create_conversation():
    conversation_id = chatbot.next_conversation_id

    chatbot.conversation[conversation_id] = []

    chatbot.next_conversation_id += 1

    return {
        "conversation_id": conversation_id
    }

@app.post("/admin/documents/upload")
async def upload_document(file: UploadFile = File(...)):

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file provided"
        )

    if not file.filename.lower().endswith((".pdf", ".docx")):
        raise HTTPException(
            status_code=400,
            detail="File must be PDF or Word"
        )

    # Create permanent documents directory
    documents_dir = Path("documents")
    documents_dir.mkdir(exist_ok=True)

    # Prevent paths such as ../../file.pdf
    filename = Path(file.filename).name
    file_path = documents_dir / filename

    try:
        # Save uploaded file permanently
        file_content = await file.read()

        if not file_content:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty"
            )

        with open(file_path, "wb") as buffer:
            buffer.write(file_content)

        # Get file size
        file_size_bytes = file_path.stat().st_size

        # Get page count
        if file_path.suffix.lower() == ".pdf":
            from pypdf import PdfReader

            try:
                reader = PdfReader(str(file_path))
                page_count = len(reader.pages)
            except Exception:
                page_count = 0
        else:
            # Current ingest.py treats DOCX as one logical page
            page_count = 1

        # Ingest document
        chunks_inserted = ingest_file(file_path)

        if not chunks_inserted:
            raise HTTPException(
                status_code=500,
                detail="Document ingestion failed"
            )

        # Detect filiere from stored chunk metadata
        filiere = None

        conn = database.get_connection()
        cur = conn.cursor()

        try:
            cur.execute(
                """
                SELECT metadata
                FROM chunks
                WHERE document_id = %s
                  AND metadata IS NOT NULL
                LIMIT 1;
                """,
                (file_path.stem,)
            )

            row = cur.fetchone()

            if row and row[0]:
                metadata = row[0]

                if isinstance(metadata, str):
                    import json
                    metadata = json.loads(metadata)

                filiere = metadata.get("filiere")

        finally:
            cur.close()
            conn.close()

        # Return complete upload information
        return {
            "success": True,
            "filename": filename,
            "size": file_size_bytes,
            "size_mb": round(file_size_bytes / (1024 * 1024), 2),
            "pages": page_count,
            "filiere": filiere,
            "chunks_inserted": chunks_inserted,
            "status": "Indexed"
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Document upload failed: {type(e).__name__}: {str(e)}"
        )

class WebPageRequest(BaseModel):
    url: str

@app.post("/admin/documents/url")
async def upload_web_page(request: WebPageRequest):

    if not request.url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")
    chunks_inserted = ingest_web(request.url)

    return {
        "success": True,
        "url": request.url,
        "chunks_inserted": chunks_inserted
    }

@app.get("/admin/documents")
def list_documents():

    documents_dir = Path("documents")
    documents_dir.mkdir(exist_ok=True)

    documents = []

    #get all uploaded files

    files = list(documents_dir.glob("*.pdf")) + list(documents_dir.glob("*.docx"))

    conn = database.get_connection()
    cur = conn.cursor()

    try:
        for file_path in files:

            document_id = file_path.stem
            filename = file_path.name

            #informations about the file
            file_size_bytes = file_path.stat().st_size

            #Page count
            if file_path.suffix.lower() == ".pdf":
                try:
                    from pypdf import PdfReader

                    reader = PdfReader(str(file_path))
                    page_count = len(reader.pages)

                except Exception:
                    page_count = 0

            else:
                page_count = 1

            #get chunks informations from postgresql
            cur.execute(
                """
                SELECT metadata
                FROM chunks
                WHERE document_id = %s
                ORDER BY chunk_index ASC;
                """,
                (document_id,)
            )

            rows = cur.fetchall()

            chunks_count = len(rows)

            filiere = None
            pages_from_chunks = []

            #get metadata from the first avaible chunk
            for row in rows:

                metadata = row[0]

                if not metadata:
                    continue

                if isinstance(metadata, str):
                    import json
                    metadata = json.loads(metadata)

                if filiere is None:
                    filiere = metadata.get("filiere")

                chunk_pages = metadata.get("pages", [])

                if chunk_pages:
                    pages_from_chunks.extend(chunk_pages)

            #remove duplicate pages
            pages_from_chunks = sorted(set(pages_from_chunks))
            #determine indexing status
            if chunks_count > 0:
                status = "Indexed"
            else:
                status = "Not indexed"

            documents.append({
                "id": document_id,
                "filename":filename,
                "size": file_size_bytes,
                "size_mb": round( file_size_bytes/(1024 * 1024),2),
                "pages" : page_count,
                "filiere": filiere,
                "chunks": chunks_count,
                "status": status
            })
    finally:
        cur.close()
        conn.close()

    return {
        "success": True,
        "documents": documents,
        "total": len(documents)
    }

@app.delete("/admin/documents/{document_id}")
def delete_document(document_id: str):
    try:
        # 1. documents folder
        documents_dir = Path("documents")

        # 2. Find PDF or DOCX
        pdf_path = documents_dir / f"{document_id}.pdf"
        docx_path = documents_dir / f"{document_id}.docx"

        if pdf_path.exists():
            file_path = pdf_path
        elif docx_path.exists():
            file_path = docx_path

        else:
            raise HTTPException(
                        status_code=404,
                        detail="No file provided pdf or docx"
                    )

        

        # 4. Delete database chunks
        database.delete_document_chunks(document_id)

        #5. Delete physical file
        file_path.unlink()

        return{
        "success": True,
        "message":"Document deleted successfully",
        "document_id": document_id
        }
    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Document deletion failed: {type(e).__name__}: {str(e)}"
        )

@app.post("/admin/documents/upload")
async def upload_documents(file: UploadFile = File(...)):

    try:
        #check file
        if not file.filename:
            raise HTTPException(
                status_code=400,
                detail="No file provided"
            )
        if not file.filename.lower().endswith((".pdf", ".docx")):
            raise HTTPException(
                status_code=400,
                detail="File must be pdf or Word"
            )

        #documents folder
        documents_dir = Path("documents")
        documents_dir.mkdir(exist_ok=True)

        #get filename
        filename = Path(file.filename).name
        file_path = documents_dir /filename

        #read uploaded file

        file_content = await file.read()

        if not file_content:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty"
            
            )
        #save/overwrite the file

        with open(file_path, "wb") as buffer:
            buffer.write(file_content)

        #get file information

        file_size_bytes = file_path.stat().st_size

        if file_path.suffix.lower()==".pdf":
            from pypdf import PdfReader
            try:
                reader = PdfReader(str(file_path))
                page_count = len(reader.pages)
            except Exception:
                page_count = 0

        else:
            page_count = 1

        #Reindex the document :ingest_file auto delete old chunks
        chunks_inserted = ingest_file(file_path)

        if not chunks_inserted:
            raise HTTPException(
                status_code=500,
                detail="Document ingestion failed"
            )
        #get filiere from metadata
        filiere = None
        conn = database.get_connection()
        cur = conn.cursor()

        try:
            cur.execute(
                """
                SELECT metadata
                FROM chunks
                WHERE document_id = %s
                  AND metadata IS NOT NULL
                LIMIT 1;
                """,
                (file_path.stem,)
            )

            row = cur.fetchone()

            if row and row[0]:
                metadata = row[0]

                if isinstance(metadata, str):
                    import json
                    metadata = json.loads(metadata)

                filiere = metadata.get("filiere")

        finally:
            cur.close()
            conn.close()

        #return result
        return{
            "success":True,
            "filename": filename,
            "size" : file_size_bytes,
            "size_mb": round(file_size_bytes /(1024 * 1024),2),
            "pages": page_count,
            "filiere": filiere,
            "chunks_inserted": chunks_inserted,
            "status": "Indexed"
        }
    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Document upload failed: {type(e).__name__}: {str(e)}"
        )

@app.post("/admin/documents/{document_id}/reindex")
def reindex_document(document_id: str):

    documents_dir = Path("documents")

    pdf_path = documents_dir / f"{document_id}.pdf"
    docx_path = documents_dir / f"{document_id}.docx"

    if pdf_path.exists():
        file_path = pdf_path

    elif docx_path.exists():
        file_path = docx_path

    else:
        raise HTTPException(
            status_code=404,
            detail="Document not found"
        )

    try:
        chunks_inserted = ingest_file(file_path)

        if not chunks_inserted:
            raise HTTPException(
                status_code=500,
                detail="Document reindexing failed"
            )

        return {
            "success": True,
            "document_id": document_id,
            "filename": file_path.name,
            "chunks_inserted": chunks_inserted,
            "status": "Indexed"
        }
    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Document reindexing failed: {type(e).__name__}: {str(e)}"
        )


@app.get("/admin/stats")
def get_admin_stats():
    db = Database()

    stats = db.get_admin_stats()

    return stats


@app.post("/feedback")
def submit_feedback(request: FeedbackRequest):
    try:
        database.save_feedback(
            query_id=request.query_id,
            rating=request.rating
        )

        return{
            "message":"Feedback saved successfully"
        }
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Feedback error:  {type(e).__name__}: {str(e)}"
        )

@app.get("/admin/chunks")
def get_admin_chunks(
    document_id: str = None,
    filiere: str = None,
    limit: int= 100
):
    try:
        chunks = database.get_chunks(
            document_id=document_id,
            filiere=filiere,
            limit=limit
        )

        return {
            "success": True,
            "chunks":chunks,
            "total": len(chunks)


        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve chunks: {type(e).__name__}: {str(e)}"
        )

@app.get("/admin/analytics")
def get_admin_analytics():
    try:
        return database.get_admin_analytics()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retreive analytics:  {type(e).__name__}: {str(e)}"
        )


class RegisterRequest(BaseModel):
    name:  str
    email: str
    password: str
    role: str




@app.post("/auth/register")
def register(request: RegisterRequest):
    db = Database()
    #check if email already exist
    existing_user = db.get_user_by_email(request.email)
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registred"

        )

    #hash the password
    password_hash = db.hash_password(request.password)

    #create the user
    user_id = db.create_user(request.name, request.email, password_hash, request.role)


    #return success
    return {
        "message":"user registred successfully",
        "user_id":user_id
    }


@app.post("/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    db = Database()
    # username contains the email
    email = form_data.username
    password = form_data.password
    #find the user by email
    user = db.get_user_by_email(email)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )
    #verify the password
    if not db.verify_password(password, user[3]) :
        raise HTTPException(
            status_code =401,
            detail = "Invalid email or password"
        )

    payload = {
        "sub": str(user[0]),
        "role": user[4],
        "exp": datetime.utcnow() + timedelta(hours =1)

    }

    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return {
        "access_token": token,
        "token_type": "bearer"
    }



def get_current_user(token: str = Depends(oauth2_scheme)):

    db = Database()

    payload = jwt.decode(
        token,
        SECRET_KEY,
        algorithms=[ALGORITHM]
    )

    user_id = int(payload["sub"])

    user = db.get_user_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return user

@app.get("/auth/me")
def get_my_account(current_user = Depends(get_current_user)):
    return {
        "id": current_user[0],
        "name": current_user[1],
        "email": current_user[2],
        "role": current_user[4]
    }

class UpdateAccountRequest(BaseModel):
    name: str
    email: str

@app.put("/auth/me")
def update_my_account(request: UpdateAccountRequest, current_user=Depends(get_current_user)):
    db = Database()

    #update the user
    db.update_user(current_user[0],request.name,request.email, current_user[4])

    #get the updated user
    updated_user = db.get_user_by_id(current_user[0])

    return {
        "message":"Account updated successfully",
        "user": {
            "id": updated_user[0],
            "name": updated_user[1],
            "email": updated_user[2],
            "role": updated_user[4]
        }


    }


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@app.put("/auth/change-password")
def change_password(
    request: ChangePasswordRequest,
    current_user=Depends(get_current_user)):
    db = Database()

    #verify the current password

    if not db.verify_password(request.current_password,current_user[3]):
        raise HTTPException(
            status_code=401,
            detail="Current password is incorrect"
        )

    #hash the new pass
    new_password_hash = db.hash_password(request.new_password)

    #update password in database
    db.update_password(
        current_user[0],
        new_password_hash
    )

    return {
        "message": "Password changed successfully"
    }

@app.post("/auth/logout")
def logout(current_user = Depends(get_current_user)):
    return{
        "message":"Logged out successfully"
    }

class ForgotPasswordRequest(BaseModel):
    email: str

@app.post("/auth/forgot-password")
def forgot_password(data: ForgotPasswordRequest):
    db = Database()

    #receive the user email
    email= data.email

    #check whether the user exists
    user = db.get_user_by_email(email)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )


    #generate a random reset token

    token = secrets.token_urlsafe(32)

    #token expires in 15min
    expires = datetime.utcnow() + timedelta(minutes=15)

    #store the token information
    reset_tokens[token] = {
        "user_id": user[0],
        "expires": expires
    }

    #return token for testing

    return {
        "message": "Password reset token generated",
        "expires": token
    }


class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str


@app.post("/auth/reset-password")
def reset_password(data: ResetPasswordRequest):
    db = Database()

    token_data = reset_tokens.get(data.reset_token)

    if not token_data:
        raise HTTPException(
            status_code=400,
            detail="Invalid reset token"
        )

    if datetime.utcnow() > token_data["expires"]:
        del reset_tokens[data.reset_token]

        raise HTTPException(
            status_code=400,
            detail="Reset token has expired "
        )

    user_id = token_data["user_id"]
    password_hash = db.hash_password(data.new_password)
    db.update_password(user_id, password_hash)
    del reset_tokens[data.reset_token]

    return{
        "message":"Password reset successfully"
    }






    
