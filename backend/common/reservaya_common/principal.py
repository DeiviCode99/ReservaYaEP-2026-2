"""El usuario autenticado que viaja en el JWT. Sin dependencias de Django."""
from dataclasses import dataclass


@dataclass(frozen=True)
class AuthenticatedUser:
    id: int
    email: str
    name: str
    role: str

    # DRF consulta estas propiedades para decidir permisos.
    is_authenticated = True
    is_anonymous = False

    @classmethod
    def from_claims(cls, claims: dict) -> "AuthenticatedUser":
        return cls(id=int(claims["sub"]), email=claims.get("email") or "",
                   name=claims.get("name") or "", role=claims.get("role") or "")

    @property
    def is_admin_role(self) -> bool:
        return self.role in ("RESTAURANT_ADMIN", "SYSTEM_ADMIN")
