from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from passlib.context import CryptContext
import jwt
import datetime
import os
import py_eureka_client.eureka_client as eureka_client

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://agro_user:agro_password@timescaledb:5432/agro_auth")
JWT_SECRET = os.getenv("JWT_SECRET", "supersecretkey")
EUREKA_SERVER = os.getenv("EUREKA_SERVER", "http://eureka-server:8761/eureka")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

app = FastAPI()

# Eureka registration on startup
@app.on_event("startup")
async def startup_event():
    try:
        await eureka_client.init_async(
            eureka_server=EUREKA_SERVER,
            app_name="auth-service",
            instance_port=8000,
            instance_host="auth-service"
        )
        print("Registered with Eureka")
    except Exception as e:
        print(f"Failed to register with Eureka: {e}")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],  # Frontend origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Setup
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String)

# Create tables (simple migration)
Base.metadata.create_all(bind=engine)

# Auth Utils
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
security = HTTPBearer()

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return user info"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return {"username": username, "user_id": payload.get("user_id")}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

# Pydantic Models
class UserCreate(BaseModel):
    username: str
    email: EmailStr | None = None
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str | None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Endpoints
@app.post("/register", response_model=Token)
def register(user: UserCreate, db: Session = Depends(get_db)):
    # Check if username exists
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Check if email exists (if provided)
    if user.email:
        db_email = db.query(User).filter(User.email == user.email).first()
        if db_email:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    new_user = User(username=user.username, email=user.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = create_access_token(data={"sub": new_user.username, "user_id": new_user.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": new_user.id, "username": new_user.username, "email": new_user.email}
    }

@app.post("/login", response_model=Token)
def login(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    access_token = create_access_token(data={"sub": db_user.username, "user_id": db_user.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": db_user.id, "username": db_user.username, "email": db_user.email}
    }

@app.get("/verify")
def verify(token_data: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Verify token and return user info"""
    db_user = db.query(User).filter(User.username == token_data["username"]).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "valid": True,
        "user": {
            "id": db_user.id,
            "username": db_user.username,
            "email": db_user.email
        }
    }

@app.get("/me", response_model=UserResponse)
def get_current_user(token_data: dict = Depends(verify_token), db: Session = Depends(get_db)):
    """Get current user profile"""
    db_user = db.query(User).filter(User.username == token_data["username"]).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"id": db_user.id, "username": db_user.username, "email": db_user.email}

@app.get("/health")
def health():
    return {"status": "ok"}
