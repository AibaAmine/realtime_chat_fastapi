from pydantic import BaseModel, EmailStr, Field, field_validator
from uuid import UUID
from datetime import datetime
import re


class UserCreate(BaseModel):
    # "..." means Required!
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)

    @field_validator("username")# the field_validator make sure the func is executed before acepting the username
    #cls is the class itself (UserCreate)
    # v is the value being validated
    def username_alphanumeric(cls, v):
        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise ValueError(
                "username must be alphanumeric (letter, numbers, underscore)"
            )


class UserOut(BaseModel):
    id: UUID
    username: str
    email: EmailStr
    created_at: datetime
    is_active: bool

    class Config:
        # from_attributs = True means that we are allowing pydantic to convert orm models (db obj) to pydantic model
        from_attributes = True
