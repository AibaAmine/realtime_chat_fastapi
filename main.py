from fastapi import FastAPI
from routers import auth,profile
from core.database import engine, Base
from core.config import get_settings
from core import cloudinary_config  

settings = get_settings()
Base.metadata.create_all(bind=engine)
app = FastAPI(title=settings.APP_NAME)


# Include the auth router
app.include_router(auth.router)
# Include the profile router

app.include_router(profile.router) 


@app.get("/")
async def root():
    return {"message": "Hello FastAPI"}
