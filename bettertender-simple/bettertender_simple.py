from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import hashlib
import os
from enum import Enum

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import FileResponse
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, ConfigDict
from sqlalchemy import (
    create_engine, Column, Integer, String, Text, Boolean,
    DateTime, Enum as SAEnum, ForeignKey, JSON
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# ------------ Basic config ------------

DATABASE_URL = "sqlite:///./bettertender_simple.db"
SECRET_KEY = "CHANGE_ME_IN_PROD"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

connect_args = {"check_same_thread": False}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ------------ Security helpers ------------

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, expires_minutes: int = None) -> str:
    if expires_minutes is None:
        expires_minutes = ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None

# ------------ Crypto helper for anonymous commits ------------

def sha256_commitment(payload: str, nonce: str) -> str:
    data = (nonce + payload).encode("utf-8")
    return hashlib.sha256(data).hexdigest()

# ------------ SQLAlchemy models ------------

class UserRole(str, Enum):
    admin = "admin"
    issuer = "issuer"
    bidder = "bidder"
    auditor = "auditor"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(String(32), nullable=False, default=UserRole.bidder.value)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class TenderStatus(str, Enum):
    draft = "draft"
    published = "published"
    closed = "closed"
    awarded = "awarded"
    cancelled = "cancelled"


class Tender(Base):
    __tablename__ = "tenders"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=False)
    estimated_budget = Column(Integer, nullable=True)
    status = Column(SAEnum(TenderStatus), nullable=False, default=TenderStatus.draft)
    publish_at = Column(DateTime(timezone=True), nullable=True)
    close_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False, index=True)
    bidder_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    is_anonymous = Column(Boolean, nullable=False, default=False)
    anonymous_commitment = Column(String(128), nullable=True)
    anonymous_nonce_hint = Column(String(64), nullable=True)
    encrypted_payload = Column(Text, nullable=True)
    amount = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=True, index=True)
    original_filename = Column(String(255), nullable=False)
    stored_path = Column(Text, nullable=False)
    mime_type = Column(String(100), nullable=True)
    checksum = Column(String(64), nullable=True)
    visibility = Column(String(32), nullable=False, default="internal")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, nullable=True, index=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(64), nullable=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    immutable_signature = Column(String(128), nullable=False, index=True)

# ------------ Pydantic schemas ------------

class UserCreate(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    password: str
    role: UserRole = UserRole.bidder


class UserRead(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str]
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TenderBase(BaseModel):
    title: str
    description: str
    estimated_budget: Optional[int] = None


class TenderCreate(TenderBase):
    pass


class TenderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    estimated_budget: Optional[int] = None
    status: Optional[TenderStatus] = None


class TenderPublishRequest(BaseModel):
    close_at: Optional[datetime] = None


class TenderAwardRequest(BaseModel):
    submission_id: int


class TenderRead(TenderBase):
    id: int
    owner_id: int
    status: TenderStatus
    created_at: datetime
    publish_at: Optional[datetime]
    close_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class SubmissionBase(BaseModel):
    amount: Optional[int] = None
    notes: Optional[str] = None
    is_anonymous: bool = False
    payload: Optional[str] = None
    nonce: Optional[str] = None


class SubmissionCreate(SubmissionBase):
    pass


class SubmissionRead(BaseModel):
    id: int
    tender_id: int
    bidder_id: Optional[int]
    is_anonymous: bool
    anonymous_commitment: Optional[str]
    amount: Optional[int]
    notes: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentRead(BaseModel):
    id: int
    owner_id: Optional[int]
    tender_id: Optional[int]
    original_filename: str
    stored_path: str
    mime_type: Optional[str]
    checksum: Optional[str]
    visibility: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogRead(BaseModel):
    id: int
    actor_id: Optional[int]
    action: str
    resource_type: str
    resource_id: Optional[str]
    payload: Dict[str, Any]
    created_at: datetime
    immutable_signature: str

    model_config = ConfigDict(from_attributes=True)

# ------------ Audit helper ------------

def _compute_signature(
    prev_signature: Optional[str],
    actor_id: Optional[int],
    action: str,
    resource_type: str,
    resource_id: Optional[str],
    created_at: datetime,
    payload: Optional[Dict[str, Any]],
) -> str:
    import json
    payload_json = json.dumps(payload or {}, sort_keys=True, separators=(",", ":"))
    base = "|".join(
        [
            prev_signature or "GENESIS",
            str(actor_id or 0),
            action,
            resource_type,
            resource_id or "",
            created_at.isoformat(),
            payload_json,
        ]
    )
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def audit_log(
    db: Session,
    actor_id: Optional[int],
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    created_at = datetime.utcnow()
    last = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
    prev_sig = last.immutable_signature if last else None
    sig = _compute_signature(
        prev_signature=prev_sig,
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        created_at=created_at,
        payload=payload,
    )
    entry = AuditLog(
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        payload=payload or {},
        created_at=created_at,
        immutable_signature=sig,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

# ------------ RBAC helpers ------------

def require_role(user: User, allowed_roles: List[str]) -> None:
    if user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requires one of roles: " + ", ".join(allowed_roles),
        )


def require_owner_or_admin(user: User, owner_id: int) -> None:
    if user.id != owner_id and user.role != UserRole.admin.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to modify this resource.",
        )

# ------------ FastAPI app ------------

app = FastAPI(
    title="BetterTender Simple API",
    version="0.1.0",
    description="Single-file version of BetterTender backend (auth, tenders, submissions, documents, audit).",
)

# CORS so frontend (e.g. Next.js on localhost:3000) can call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
BASE_UPLOAD_DIR = os.path.join(os.getcwd(), "uploads", "documents")


def ensure_upload_dir() -> None:
    os.makedirs(BASE_UPLOAD_DIR, exist_ok=True)

@app.on_event("startup")
def on_startup():
    ensure_upload_dir()
    Base.metadata.create_all(bind=engine)

    # Dev-only bootstrap users so you can log in immediately
    db = SessionLocal()
    try:
        any_user = db.query(User).first()
        if not any_user:
            dev_password = "ChangeMe123!"

            admin = User(
                email="admin@sasweb.gov",
                full_name="SASWEB Admin",
                hashed_password=hash_password(dev_password),
                role=UserRole.admin.value,
            )
            issuer = User(
                email="issuer@sasweb.gov",
                full_name="SASWEB Issuer",
                hashed_password=hash_password(dev_password),
                role=UserRole.issuer.value,
            )
            bidder = User(
                email="bidder@sasweb.gov",
                full_name="SASWEB Bidder",
                hashed_password=hash_password(dev_password),
                role=UserRole.bidder.value,
            )

            db.add_all([admin, issuer, bidder])
            db.commit()
    finally:
        db.close()

# ------------ Auth deps & routes ------------

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    subject = decode_token(token)
    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    user = get_user_by_email(db, subject)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive or invalid user",
        )
    return user


@app.post("/auth/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = get_user_by_email(db, user_in.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=hash_password(user_in.password),
        role=user_in.role.value,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    audit_log(
        db=db,
        actor_id=user.id,
        action="user_register",
        resource_type="user",
        resource_id=str(user.id),
        payload={"email": user.email, "role": user.role},
    )
    return user


@app.post("/auth/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = get_user_by_email(db, form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    access_token = create_access_token(subject=user.email)
    audit_log(
        db=db,
        actor_id=user.id,
        action="user_login",
        resource_type="user",
        resource_id=str(user.id),
        payload={},
    )
    return Token(access_token=access_token)


@app.get("/auth/me", response_model=UserRead)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user

# ------------ Tender routes ------------

@app.post(
    "/tenders",
    response_model=TenderRead,
    status_code=status.HTTP_201_CREATED,
)
def create_tender(
    tender_in: TenderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_role(current_user, [UserRole.issuer.value, UserRole.admin.value])
    tender = Tender(
        owner_id=current_user.id,
        title=tender_in.title,
        description=tender_in.description,
        estimated_budget=tender_in.estimated_budget,
        status=TenderStatus.draft,
    )
    db.add(tender)
    db.commit()
    db.refresh(tender)
    audit_log(
        db=db,
        actor_id=current_user.id,
        action="tender_create",
        resource_type="tender",
        resource_id=str(tender.id),
        payload={"title": tender.title},
    )
    return tender


@app.get("/tenders", response_model=List[TenderRead])
def list_tenders(db: Session = Depends(get_db)):
    tenders = db.query(Tender).order_by(Tender.id.desc()).all()
    return tenders


@app.get("/tenders/{tender_id}", response_model=TenderRead)
def get_tender(tender_id: int, db: Session = Depends(get_db)):
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    return tender


@app.put("/tenders/{tender_id}", response_model=TenderRead)
def update_tender(
    tender_id: int,
    tender_in: TenderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    require_owner_or_admin(current_user, tender.owner_id)

    if tender.status in (
        TenderStatus.closed,
        TenderStatus.awarded,
        TenderStatus.cancelled,
    ):
        raise HTTPException(
            status_code=400,
            detail="Cannot modify a closed/awarded/cancelled tender.",
        )

    changed: Dict[str, Any] = {}
    if tender_in.title is not None:
        tender.title = tender_in.title
        changed["title"] = tender_in.title
    if tender_in.description is not None:
        tender.description = tender_in.description
        changed["description"] = tender_in.description
    if tender_in.estimated_budget is not None:
        tender.estimated_budget = tender_in.estimated_budget
        changed["estimated_budget"] = tender_in.estimated_budget
    if tender_in.status is not None:
        tender.status = tender_in.status
        changed["status"] = tender_in.status.value

    db.commit()
    db.refresh(tender)

    if changed:
        audit_log(
            db=db,
            actor_id=current_user.id,
            action="tender_update",
            resource_type="tender",
            resource_id=str(tender.id),
            payload=changed,
        )
    return tender


@app.post("/tenders/{tender_id}/publish", response_model=TenderRead)
def publish_tender(
    tender_id: int,
    body: TenderPublishRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    require_owner_or_admin(current_user, tender.owner_id)

    if tender.status != TenderStatus.draft:
        raise HTTPException(
            status_code=400,
            detail="Only draft tenders can be published.",
        )

    tender.status = TenderStatus.published
    tender.publish_at = datetime.utcnow()
    if body.close_at is not None:
        tender.close_at = body.close_at

    db.commit()
    db.refresh(tender)

    audit_log(
        db=db,
        actor_id=current_user.id,
        action="tender_publish",
        resource_type="tender",
        resource_id=str(tender.id),
        payload={"close_at": tender.close_at.isoformat() if tender.close_at else None},
    )
    return tender


@app.post("/tenders/{tender_id}/close", response_model=TenderRead)
def close_tender(
    tender_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    require_owner_or_admin(current_user, tender.owner_id)

    if tender.status != TenderStatus.published:
        raise HTTPException(
            status_code=400,
            detail="Only published tenders can be closed.",
        )

    tender.status = TenderStatus.closed
    if tender.close_at is None:
        tender.close_at = datetime.utcnow()

    db.commit()
    db.refresh(tender)

    audit_log(
        db=db,
        actor_id=current_user.id,
        action="tender_close",
        resource_type="tender",
        resource_id=str(tender.id),
        payload={},
    )
    return tender


@app.post("/tenders/{tender_id}/award", response_model=TenderRead)
def award_tender(
    tender_id: int,
    body: TenderAwardRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    require_owner_or_admin(current_user, tender.owner_id)

    if tender.status not in (TenderStatus.published, TenderStatus.closed):
        raise HTTPException(
            status_code=400,
            detail="Only published/closed tenders can be awarded.",
        )

    submission = (
        db.query(Submission)
        .filter(Submission.id == body.submission_id, Submission.tender_id == tender.id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found for this tender.")

    tender.status = TenderStatus.awarded
    db.commit()
    db.refresh(tender)

    audit_log(
        db=db,
        actor_id=current_user.id,
        action="tender_award",
        resource_type="tender",
        resource_id=str(tender.id),
        payload={"submission_id": submission.id},
    )
    return tender


@app.delete("/tenders/{tender_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tender(
    tender_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    require_owner_or_admin(current_user, tender.owner_id)

    db.delete(tender)
    db.commit()

    audit_log(
        db=db,
        actor_id=current_user.id,
        action="tender_delete",
        resource_type="tender",
        resource_id=str(tender_id),
        payload={},
    )
    return None

# ------------ Submission routes ------------

def get_tender_or_404(db: Session, tender_id: int) -> Tender:
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    return tender


@app.post(
    "/tenders/{tender_id}/submissions",
    response_model=SubmissionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_submission_for_tender(
    tender_id: int,
    submission_in: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tender = get_tender_or_404(db, tender_id)

    is_anonymous = submission_in.is_anonymous
    anonymous_commit = None
    nonce_hint = None
    encrypted_payload = None

    if is_anonymous:
        if not submission_in.payload or not submission_in.nonce:
            raise HTTPException(
                status_code=400,
                detail="Anonymous submissions require 'payload' and 'nonce'.",
            )
        anonymous_commit = sha256_commitment(
            payload=submission_in.payload,
            nonce=submission_in.nonce,
        )
        nonce_hint = submission_in.nonce[:8]
        encrypted_payload = submission_in.payload
        bidder_id = None
    else:
        bidder_id = current_user.id
        if submission_in.payload:
            encrypted_payload = submission_in.payload

    submission = Submission(
        tender_id=tender.id,
        bidder_id=bidder_id,
        is_anonymous=is_anonymous,
        anonymous_commitment=anonymous_commit,
        anonymous_nonce_hint=nonce_hint,
        encrypted_payload=encrypted_payload,
        amount=submission_in.amount,
        notes=submission_in.notes,
    )

    db.add(submission)
    db.commit()
    db.refresh(submission)

    audit_log(
        db=db,
        actor_id=current_user.id,
        action="submission_create",
        resource_type="submission",
        resource_id=str(submission.id),
        payload={"tender_id": tender.id, "is_anonymous": is_anonymous},
    )

    return submission


@app.get(
    "/tenders/{tender_id}/submissions",
    response_model=List[SubmissionRead],
)
def list_submissions_for_tender(
    tender_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tender = get_tender_or_404(db, tender_id)
    is_owner = tender.owner_id == current_user.id
    is_admin = current_user.role == UserRole.admin.value
    if not (is_owner or is_admin):
        raise HTTPException(
            status_code=403,
            detail="Only the tender owner or admin can list submissions.",
        )
    submissions = (
        db.query(Submission)
        .filter(Submission.tender_id == tender.id)
        .order_by(Submission.id.desc())
        .all()
    )
    return submissions


@app.get("/submissions/mine", response_model=List[SubmissionRead])
def list_my_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submissions = (
        db.query(Submission)
        .filter(Submission.bidder_id == current_user.id)
        .order_by(Submission.id.desc())
        .all()
    )
    return submissions


@app.get("/submissions/{submission_id}", response_model=SubmissionRead)
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    tender = db.query(Tender).filter(Tender.id == submission.tender_id).first()
    is_owner = tender and tender.owner_id == current_user.id
    is_bidder = submission.bidder_id == current_user.id
    is_admin = current_user.role == UserRole.admin.value

    if not (is_owner or is_bidder or is_admin):
        raise HTTPException(
            status_code=403,
            detail="Not allowed to view this submission.",
        )
    return submission

# ------------ Document storage helpers & routes ------------

def save_document_file(file: UploadFile) -> (str, str):
    ensure_upload_dir()
    filename = file.filename or "unnamed"
    safe_name = filename.replace("/", "_").replace("\\", "_")
    dest_path = os.path.join(BASE_UPLOAD_DIR, safe_name)
    base, ext = os.path.splitext(dest_path)
    counter = 1
    while os.path.exists(dest_path):
        dest_path = f"{base}_{counter}{ext}"
        counter += 1

    hasher = hashlib.sha256()
    with open(dest_path, "wb") as out_file:
        while True:
            chunk = file.file.read(8192)
            if not chunk:
                break
            hasher.update(chunk)
            out_file.write(chunk)
    file.file.seek(0)
    checksum = hasher.hexdigest()
    return dest_path, checksum


@app.post(
    "/documents",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    tender_id: Optional[int] = None,
    visibility: str = "internal",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if visibility not in {"public", "internal", "restricted"}:
        raise HTTPException(status_code=400, detail="Invalid visibility value.")

    stored_path, checksum = save_document_file(file)
    doc = Document(
        owner_id=current_user.id,
        tender_id=tender_id,
        original_filename=file.filename or "unnamed",
        stored_path=stored_path,
        mime_type=file.content_type,
        checksum=checksum,
        visibility=visibility,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    audit_log(
        db=db,
        actor_id=current_user.id,
        action="document_upload",
        resource_type="document",
        resource_id=str(doc.id),
        payload={"tender_id": tender_id, "visibility": visibility},
    )

    return doc


@app.get("/documents", response_model=List[DocumentRead])
def list_my_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    docs = (
        db.query(Document)
        .filter(Document.owner_id == current_user.id)
        .order_by(Document.id.desc())
        .all()
    )
    return docs


@app.get("/documents/{document_id}")
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.visibility in {"internal", "restricted"} and doc.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed to access this document")

    if not os.path.exists(doc.stored_path):
        raise HTTPException(status_code=410, detail="File missing on server")

    return FileResponse(
        path=doc.stored_path,
        filename=doc.original_filename,
        media_type=doc.mime_type or "application/octet-stream",
    )


@app.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed to delete this document")

    try:
        if os.path.exists(doc.stored_path):
            os.remove(doc.stored_path)
    except OSError:
        pass

    db.delete(doc)
    db.commit()

    audit_log(
        db=db,
        actor_id=current_user.id,
        action="document_delete",
        resource_type="document",
        resource_id=str(document_id),
        payload={},
    )
    return None

# ------------ Audit routes ------------

@app.get("/audit", response_model=List[AuditLogRead])
def list_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.admin.value, UserRole.auditor.value):
        raise HTTPException(
            status_code=403,
            detail="Not authorised to view audit logs.",
        )
    logs = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(500).all()
    return logs


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "bettertender-simple"}
