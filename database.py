import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# 2. Create the Engine
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 3. Create SessionLocal Class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Create the Base Class
# All your database models will inherit from this class
Base = declarative_base()


# 5. Dependency: Get DB Session
# This function creates a new session for a request and closes it when done
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
