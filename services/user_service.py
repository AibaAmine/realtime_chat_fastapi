from sqlalchemy.orm import Session, joinedload
from db_models.user import User
from uuid import UUID
from typing import List


class UserService:

    @staticmethod
    def search_users(db: Session, query: str, current_user_id: UUID, limit: int = 25) -> List[User]:
        return (
            db.query(User)
            .options(joinedload(User.profile))
            .filter(
                User.username.ilike(f"%{query}%"),
                User.id != current_user_id,
                User.is_active == True,
            )
            .limit(limit)
            .all()
        )
