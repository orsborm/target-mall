"""密码哈希"""
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Normalize $2b$ prefix (used by bcrypt library) to $2a$ which passlib recognizes
    if hashed_password.startswith("$2b$"):
        hashed_password = "$2a$" + hashed_password[4:]
    return pwd_context.verify(plain_password, hashed_password)
