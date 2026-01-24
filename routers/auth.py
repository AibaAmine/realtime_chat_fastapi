from schemas.user import PasswordChange
from fastapi import APIRouter, Body, Depends, status, Request
from typing import Annotated
from db_models.user import User
from sqlalchemy.orm import Session
from schemas.user import UserCreate, UserOut
from schemas.token import Token, TokenRefresh
from core.database import get_db
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi.security import OAuth2PasswordRequestForm
from dependancies import get_current_user, oauth2_scheme
from services.auth_service import AuthService

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserOut)
@limiter.limit(
    "5/minute"
)  # Max 5 registrations per minute(slowapi Track rate limits per IP address from request obj(request obj is auth injected by fast api every request))
async def register_user(
    request: Request, user: Annotated[UserCreate, Body()], db: Session = Depends(get_db)
):
    return AuthService.register_user(db=db, user_data=user)


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login_user(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db),
):
    return AuthService.authenticate_user(
        db=db, email=form_data.username, password=form_data.password 
    )


@router.post("/refresh")
@limiter.limit("20/minute")
async def refresh_access_token(
    request: Request,
    token_data: Annotated[TokenRefresh, Body()],
    db: Session = Depends(get_db),
):
    return AuthService.refresh_tokens(db=db, refresh_token=token_data.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def logout_user(
    request: Request,
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    AuthService.logout_user(db=db, access_token=token)
    return None


@router.post("/change-password")
@limiter.limit("5/minute")
async def change_password(
    request: Request,
    passwords: Annotated[PasswordChange, Body()],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return AuthService.change_user_password(
        db=db,
        user=current_user,
        old_password=passwords.old_password,
        new_password=passwords.new_password,
    )
