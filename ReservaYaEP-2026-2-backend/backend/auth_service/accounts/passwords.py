"""Contraseñas con BCrypt (RNF-03).

`bcrypt.checkpw` acepta los hashes `$2a$` que generaba Spring, así que las
cuentas creadas con el backend anterior siguen entrando. Los hashes nuevos son
`$2b$` (mismo algoritmo, también los entiende Spring) con costo 10.
"""
import bcrypt

from reservaya_common.errors import BadRequest

MAX_BYTES = 72  # límite del algoritmo BCrypt


def hash_password(raw: str) -> str:
    data = raw.encode("utf-8")
    if len(data) > MAX_BYTES:
        raise BadRequest("La contraseña es demasiado larga (máximo 72 bytes).")
    return bcrypt.hashpw(data, bcrypt.gensalt(rounds=10)).decode("ascii")


def check_password(raw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(raw.encode("utf-8"), (hashed or "").encode("ascii"))
    except ValueError:  # hash con formato inválido o contraseña de más de 72 bytes
        return False
