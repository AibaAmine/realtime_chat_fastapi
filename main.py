from fastapi import FastAPI
from routers import auth
from db_models import user
from database import engine, Base

Base.metadata.create_all(bind=engine)
app = FastAPI()


# Include the auth router
app.include_router(auth.router)


@app.get("/")
async def root():
    return {"message": "Hello FastAPI"}
