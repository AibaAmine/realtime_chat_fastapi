from fastapi import APIRouter, Body, Depends, HTTPException, status, Request
from typing import Annotated
from db_models.user import User
from sqlalchemy.orm import Session
from schemas.user import UserCreate, UserOut
from schemas.token import Token
from database import get_db
from core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
)
from slowapi import Limiter
from slowapi.util import get_remote_address


from fastapi.security import OAuth2PasswordRequestForm

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserOut)
@limiter.limit(
    "5/minute"
)  # Max 5 registrations per minute(slowapi Track rate limits per IP address from request obj(request obj is auth injected by fast api every request))
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


@router.post("/login", response_model=Token)
async def login_user(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db),
):

    user = db.query(User).filter(User.email == form_data.username).first()

    print(
        f"******** user is {user} and verifiy pass result is {verify_password(form_data.password, user.hashed_password)}"
    )

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }
