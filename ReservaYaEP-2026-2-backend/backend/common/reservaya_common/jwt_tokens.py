"""Emisión y verificación del JWT (RNF-04).

Mismos claims que el backend Spring: sub (id como texto), email, name, role,
iss, iat y exp. El secreto es el mismo en los tres servicios: auth firma y los
demás verifican.
"""
import time

import jwt

# jjwt (Spring) elegía HS256/384/512 según el largo de la clave: se aceptan los
# tres para que los tokens emitidos antes del cambio sigan sirviendo.
ACCEPTED_ALGORITHMS = ["HS256", "HS384", "HS512"]


def issue(user_id: int, email: str, name: str, role: str, *,
          secret: str, issuer: str, minutes: int) -> str:
    now = int(time.time())
    claims = {
        "sub": str(user_id),
        "email": email,
        "name": name,
        "role": role,
        "iss": issuer,
        "iat": now,
        "exp": now + minutes * 60,
    }
    return jwt.encode(claims, secret, algorithm="HS256")


def decode(token: str, *, secret: str, issuer: str) -> dict:
    """Devuelve los claims o lanza jwt.InvalidTokenError (firma, emisor o vencido)."""
    return jwt.decode(token, secret, algorithms=ACCEPTED_ALGORITHMS, issuer=issuer,
                      options={"require": ["sub", "exp", "iss"]})
