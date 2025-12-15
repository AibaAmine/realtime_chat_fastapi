from fastapi import APIRouter, Body, Depends, HTTPException, status, Request
from typing import Annotated
from db_models.user import User
from sqlalchemy.orm import Session
from schemas.user import UserCreate, UserOut
from database import get_db
from core.security import hash_password, verify_password
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserOut)
@limiter.limit(
    "5/minute"
)  # Max 5 registrations per minute(slowapi Track rate limits per IP address from request obj)
async def register_user(
    request: Request, user: Annotated[UserCreate, Body()], db: Session = Depends(get_db)
):

    user_exists = (
        db.query(User)
        .filter((User.email == user.email) | (User.username == user.username))
        .first()
    )

    if user_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or username allready registered",
        )

    hashed_psw = hash_password(user.password)

    new_user = User(
        username=user.username, email=user.email, hashed_password=hashed_psw
    )

    db.add(new_user)
    db.commit()  # save changes
    db.refresh(new_user)  ## Refresh instance to get the new ID and created_at timestamp

    return new_user


@router.post("/login")
async def login_user():
    return {"message": "Login endpoint"}
