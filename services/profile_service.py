from fastapi import HTTPException, status, UploadFile
from db_models.profile import Profile
from db_models.user import User
from sqlalchemy.orm import Session
from schemas.profile import ProfileUpdate
import cloudinary.uploader


class ProfileService:

    @staticmethod
    def get_user_profile(db: Session, user: User) -> Profile:

        profile = db.query(Profile).filter(Profile.user_id == user.id).first()

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found "
            )

        return profile

    @staticmethod
    def update_user_profile(
        db: Session, user: User, profile_data: ProfileUpdate
    ) -> Profile:

        profile = db.query(Profile).filter(Profile.user_id == user.id).first()

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found"
            )

        update_data = profile_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(profile, field, value)

        try:
            db.commit()
            db.refresh(profile)
            return profile
        except Exception:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update profile",
            )

    @staticmethod
    def upload_avatar(db: Session, user: User, file: UploadFile) -> str:
        # validate file type
        if not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="File must be an image"
            )

        profile = db.query(Profile).filter(Profile.user_id == user.id).first()

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found"
            )

        try:
            result = cloudinary.uploader.upload(
                file.file,
                folder="chat_app/avatars",
                public_id=f"user_{user.id}",
                overwrite=True,
                resource_type="image",
            )
            profile.avatar_url = result.get("secure_url")
            db.commit()
            db.refresh(profile)
            return profile.avatar_url

        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload avatar: {str(e)}",
            )
