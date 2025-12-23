from schemas.user import PasswordChange
from fastapi import APIRouter, Body, Depends, HTTPException, status, Request, Header
from typing import Annotated
from db_models.user import User
from sqlalchemy.orm import Session
from schemas.user import UserCreate, UserOut
from schemas.token import Token, TokenRefresh
from database import get_db
from core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from slowapi import Limiter
from slowapi.util import get_remote_address

from datetime import datetime, timedelta, timezone
from db_models.token import RefreshToken
from core.security import REFRESH_TOKEN_EXPIRE_DAYS
from fastapi.security import OAuth2PasswordRequestForm
from dependancies import get_current_user

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

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed",
        )


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login_user(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db),
):

    user = db.query(User).filter(User.email == form_data.username).first()

    if (
        not user
        or not user.is_active
        or not verify_password(form_data.password, user.hashed_password)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    db_token = RefreshToken(token=refresh_token, expires_at=expires_at, user_id=user.id)
    try:
        db.add(db_token)
        db.commit()
        db.refresh(db_token)
    except Exception:
             db.rollback()
             raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Login failed"
        )

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "rt_id": str(
                db_token.id
            ),  # the biding (because for the logout we dont need to logout the user from all sessions (just the current one))
        }
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/refresh")
@limiter.limit("20/minute")
async def refresh_access_token(
    request: Request,
    token_data: Annotated[TokenRefresh, Body()],
    db: Session = Depends(get_db),
):
    payload = decode_token(token_data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=" Invalid or expired refresh token ",
        )

    user_id = payload.get("sub")

    stored_token = (
        db.query(RefreshToken)
        .filter(RefreshToken.token == token_data.refresh_token)
        .first()
    )

    if not stored_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found or revoked",
        )

    if stored_token.expires_at < datetime.now(timezone.utc):
        db.delete(stored_token)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired",
        )

    # Token Rotation: Issue new refresh token, delete old one
    new_refresh_token = create_refresh_token(data={"sub": user_id})
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    # Delete old refresh token (single-use)
    db.delete(stored_token)

    # Create new refresh token in database
    new_db_token = RefreshToken(
        token=new_refresh_token,
        expires_at=expires_at,
        user_id=user_id
    )
    db.add(new_db_token)
    db.commit()
    db.refresh(new_db_token)

    # Create new access token linked to new refresh token
    new_access_token = create_access_token(
        data={"sub": user_id, "rt_id": str(new_db_token.id)}
    )

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,  # Return NEW refresh token
        "token_type": "bearer"
    }


from dependancies import oauth2_scheme


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def logout_user(
    request: Request,
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token"
        )
    refresh_token_id = payload.get("rt_id")

    # Find and Delete that SPECIFIC Session
    if refresh_token_id:
        stored_token = (
            db.query(RefreshToken).filter(RefreshToken.id == int(refresh_token_id))
        ).first()

        if stored_token:
            db.delete(stored_token)
            db.commit()

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token format"
        )

    return None


@router.post("/change-password")
@limiter.limit("5/minute")
async def change_password(
    request: Request,
    passwords: Annotated[PasswordChange, Body()],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(passwords.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")

    current_user.hashed_password = hash_password(passwords.new_password)
    db.commit()

    # Logout all devices
    db.query(RefreshToken).filter(RefreshToken.user_id == current_user.id).delete()
    db.commit()

    return {"message": "Password updated"}
