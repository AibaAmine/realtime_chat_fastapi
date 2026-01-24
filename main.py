from fastapi import FastAPI
from routers import auth, profile
from core.database import engine, Base
from core.config import get_settings
from core.socket_manager import sio, sio_app 
from sockets import events  # Register events

settings = get_settings()
Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.APP_NAME)

# Mount at /socket.io
app.mount("/socket.io", sio_app)

app.include_router(auth.router)
app.include_router(profile.router)


@app.get("/")
async def root():
    return {"message": "Hello FastAPI"}


