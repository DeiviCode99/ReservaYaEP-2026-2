# ReservaYa - Backend Spring Boot + MongoDB

Backend académico de ReservaYa implementado con **Java 17, Spring Boot 3, Spring Security, Spring Data MongoDB y JWT**.

## Tecnologías

- Java 17+
- Spring Boot 3.4
- Spring Web / Validation / Security
- Spring Data MongoDB
- MongoDB Atlas
- JJWT
- Lombok
- springdoc OpenAPI / Swagger
- React 18 + Vite en el frontend

## Arquitectura

```mermaid
flowchart LR
    Browser["React 18<br/>http://localhost:3000"] -->|HTTP/JSON + JWT| API["Spring Boot 3<br/>http://localhost:8080"]
    API -->|Spring Data MongoDB| Atlas[("MongoDB Atlas M0")]
```

```mermaid
sequenceDiagram
    actor C as Cliente
    participant F as React
    participant A as AuthController
    participant S as AuthService
    participant U as users
    participant P as credentials

    C->>F: Ingresa correo y contraseña
    F->>A: POST /api/auth/login
    A->>S: login(request)
    S->>U: Buscar usuario por correo
    U-->>S: Usuario
    S->>P: Buscar hash por userId
    P-->>S: PasswordHash BCrypt
    S->>S: BCrypt verifica contraseña
    S-->>F: {token, user}
    F->>F: Guarda sesión en localStorage
```

```mermaid
sequenceDiagram
    actor A as Administrador
    participant F as React
    participant C as UserController
    participant S as UserService
    participant M as MongoDB

    A->>F: Crear/editar/eliminar usuario
    F->>C: Request con Bearer JWT
    C->>C: Valida JWT y rol SYSTEM_ADMIN
    C->>S: Ejecuta operación CRUD
    S->>M: users / credentials
    M-->>S: Resultado
    S-->>C: UserResponse o 204
    C-->>F: JSON o sin contenido
    F-->>A: Mensaje de éxito/error
```

## Modelo de datos

```mermaid
erDiagram
    users ||--|| credentials : "1 usuario tiene 1 credencial"
    users {
        string id PK
        string name
        string email UK
        string phone
        string role
        boolean active
        instant createdAt
        instant updatedAt
    }
    credentials {
        string id PK
        string userId UK
        string passwordHash
    }
```

Las colecciones son `users` y `credentials`. La contraseña nunca se guarda en `users`.

## Crear MongoDB Atlas

1. Crear una cuenta en https://cloud.mongodb.com/.
2. Seleccionar **Create** → **Deployment** → **M0 Free**.
3. Elegir proveedor y región cercanos.
4. Asignar un nombre al cluster y finalizar la creación.
5. En **Database Access**, crear un usuario con un nombre y una contraseña segura.
6. Dar al usuario el rol **Read and Write to Any Database** para desarrollo.
7. En **Network Access**, agregar `0.0.0.0/0` para desarrollo o la IP pública de la máquina/servidor para producción.
8. En **Database**, abrir **Connect** → **Drivers** y copiar la cadena.
9. Sustituir `<username>` y `<password>` y conservar la codificación URL de caracteres especiales.

Ejemplo:

```text
mongodb+srv://usuario:clave@reservaya.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

## Configuración

Copiar `.env.example` a `.env` y exportar las variables antes de iniciar el backend.

```powershell
cd backend/spring-backend
$env:MONGODB_URI="mongodb+srv://usuario:clave@cluster.mongodb.net/?retryWrites=true&w=majority"
$env:MONGODB_DATABASE="reservaya"
$env:JWT_SECRET="un-secreto-aleatorio-de-al-menos-32-caracteres"
$env:JWT_EXPIRATION_MINUTES="120"
$env:FRONTEND_ORIGIN="http://localhost:3000"
$env:ADMIN_EMAIL="admin@reservaya.test"
$env:ADMIN_PASSWORD="CambiaEsteAdmin123!"
$env:ADMIN_NAME="Administrador ReservaYa"
```

No se deben versionar credenciales reales.

## Ejecutar el backend

Requisitos: JDK 17+ y Maven.

```powershell
cd backend/spring-backend
mvn spring-boot:run
```

URLs:

- API: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/swagger-ui/index.html`
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`

Al iniciar, `CommandLineRunner` crea el usuario administrador inicial usando `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_NAME`.

## Ejecutar el frontend

```powershell
cd frontend
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Endpoints

| Método | Ruta | Descripción | Auth | Ejemplo request | Ejemplo response |
|---|---|---|---:|---|---|
| POST | `/api/auth/register` | Crear cuenta cliente/admin | No | `{"name":"Ana","email":"ana@test.com","password":"Clave123!","role":"CLIENT"}` | `{"token":"...","user":{"id":"...","name":"Ana","role":"CLIENT"}}` |
| POST | `/api/auth/login` | Autenticar | No | `{"email":"ana@test.com","password":"Clave123!"}` | `{"token":"...","user":{"id":"...","name":"Ana","role":"CLIENT"}}` |
| GET | `/api/auth/me` | Usuario autenticado | Sí | — | `{"id":"...","name":"Ana","email":"ana@test.com","role":"CLIENT"}` |
| GET | `/api/users` | Listar usuarios | SYSTEM_ADMIN | — | `[{"id":"...","name":"Ana","email":"ana@test.com","role":"CLIENT"}]` |
| GET | `/api/users/{id}` | Consultar usuario | SYSTEM_ADMIN | — | `{"id":"...","name":"Ana","email":"ana@test.com","role":"CLIENT"}` |
| POST | `/api/users` | Crear usuario | SYSTEM_ADMIN | `{"name":"Luis","email":"luis@test.com","password":"Clave123!","role":"CLIENT"}` | `201` + usuario |
| PUT | `/api/users/{id}` | Actualizar usuario | SYSTEM_ADMIN | `{"name":"Luis Pérez","email":"luis@test.com","role":"CLIENT","active":true}` | Usuario actualizado |
| DELETE | `/api/users/{id}` | Eliminar usuario y credencial | SYSTEM_ADMIN | — | `204 No Content` |

Los errores siguen el formato:

```json
{
  "status": 400,
  "error": "BAD_REQUEST",
  "message": "Descripción del error",
  "timestamp": "2026-11-17T20:56:07Z"
}
```

## Pruebas con Swagger/Postman

1. Abrir `/swagger-ui/index.html`.
2. Ejecutar `POST /api/auth/register` o iniciar sesión con el administrador.
3. Copiar el valor `token`.
4. En Swagger, pulsar **Authorize** y escribir `Bearer <token>`.
5. Ejecutar los endpoints de `/api/users`.

En Postman, configurar:

```text
Authorization: Bearer <token>
Content-Type: application/json
```

## Capturas

### 1. Inicio de sesión

Formulario de autenticación usado por los usuarios para ingresar con correo y contraseña.

![Inicio de sesión](capturas/login.jpeg)

### 2. Sesión iniciada

Vista posterior al inicio de sesión, que confirma la autenticación y permite acceder al sistema según el rol del usuario.

![Sesión iniciada](capturas/sesion.jpeg)

### 3. Documentación Swagger

Interfaz OpenAPI utilizada para consultar y probar los endpoints públicos y protegidos del backend.

![Swagger UI](capturas/swagger.jpeg)

### 4. CRUD de usuarios

Listado principal de usuarios y acciones disponibles para crear, editar y eliminar registros.

![CRUD de usuarios](capturas/crud.jpeg)

### 5. Agregar usuario

Formulario del CRUD usado para crear un nuevo usuario con nombre, correo, teléfono, contraseña y rol.

![Agregar usuario](capturas/crud1.jpeg)

### 6. Editar usuario

Formulario del CRUD usado para modificar los datos de un usuario existente y, opcionalmente, su contraseña.

![Editar usuario](capturas/crud2.jpeg)

```text
{
  "openapi": "3.1.0",
  "info": {
    "title": "ReservaYa API",
    "description": "API REST con autenticación JWT y MongoDB.",
    "version": "1.0"
  },
  "servers": [
    {
      "url": "http://localhost:8080",
      "description": "Generated server url"
    }
  ],
  "paths": {
    "/api/users/{id}": {
      "get": {
        "tags": [
          "user-controller"
        ],
        "summary": "Consultar un usuario",
        "operationId": "findById",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/UserResponse"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "put": {
        "tags": [
          "user-controller"
        ],
        "summary": "Actualizar un usuario",
        "operationId": "update",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UserRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/UserResponse"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "delete": {
        "tags": [
          "user-controller"
        ],
        "summary": "Eliminar un usuario",
        "operationId": "delete",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/users": {
      "get": {
        "tags": [
          "user-controller"
        ],
        "summary": "Listar usuarios",
        "operationId": "findAll",
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/UserResponse"
                  }
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      },
      "post": {
        "tags": [
          "user-controller"
        ],
        "summary": "Crear un usuario",
        "operationId": "create",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RegisterRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/UserResponse"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    },
    "/api/auth/register": {
      "post": {
        "tags": [
          "auth-controller"
        ],
        "summary": "Registrar un usuario",
        "operationId": "register",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/RegisterRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/AuthResponse"
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/login": {
      "post": {
        "tags": [
          "auth-controller"
        ],
        "summary": "Iniciar sesión",
        "operationId": "login",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/LoginRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/AuthResponse"
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/me": {
      "get": {
        "tags": [
          "auth-controller"
        ],
        "summary": "Obtener el usuario autenticado",
        "operationId": "me",
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "*/*": {
                "schema": {
                  "$ref": "#/components/schemas/UserResponse"
                }
              }
            }
          }
        },
        "security": [
          {
            "bearerAuth": []
          }
        ]
      }
    }
  },
  "components": {
    "schemas": {
      "UserRequest": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "maxLength": 80,
            "minLength": 2
          },
          "email": {
            "type": "string",
            "minLength": 1
          },
          "phone": {
            "type": "string",
            "maxLength": 30,
            "minLength": 0
          },
          "role": {
            "type": "string",
            "enum": [
              "CLIENT",
              "RESTAURANT_ADMIN",
              "SYSTEM_ADMIN"
            ]
          },
          "active": {
            "type": "boolean"
          },
          "password": {
            "type": "string",
            "maxLength": 72,
            "minLength": 8
          }
        },
        "required": [
          "role"
        ]
      },
      "UserResponse": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "email": {
            "type": "string"
          },
          "phone": {
            "type": "string"
          },
          "role": {
            "type": "string",
            "enum": [
              "CLIENT",
              "RESTAURANT_ADMIN",
              "SYSTEM_ADMIN"
            ]
          },
          "active": {
            "type": "boolean"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "RegisterRequest": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "maxLength": 80,
            "minLength": 2
          },
          "email": {
            "type": "string",
            "minLength": 1
          },
          "password": {
            "type": "string",
            "maxLength": 72,
            "minLength": 8
          },
          "phone": {
            "type": "string"
          },
          "role": {
            "type": "string",
            "enum": [
              "CLIENT",
              "RESTAURANT_ADMIN",
              "SYSTEM_ADMIN"
            ]
          }
        },
        "required": [
          "role"
        ]
      },
      "AuthResponse": {
        "type": "object",
        "properties": {
          "token": {
            "type": "string"
          },
          "user": {
            "$ref": "#/components/schemas/UserResponse"
          }
        }
      },
      "LoginRequest": {
        "type": "object",
        "properties": {
          "email": {
            "type": "string",
            "minLength": 1
          },
          "password": {
            "type": "string",
            "minLength": 1
          }
        }
      }
    },
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      }
    }
  }
}
```

## Estructura del backend

```text
backend/spring-backend/
├── pom.xml
├── .env.example
├── src/main/java/com/reservaya/backend/
│   ├── ReservaYaApplication.java
│   ├── config/
│   │   ├── SecurityConfig.java
│   │   ├── InitialDataConfig.java
│   │   └── OpenApiConfig.java
│   ├── controller/
│   │   ├── AuthController.java
│   │   └── UserController.java
│   ├── dto/
│   ├── exception/
│   ├── model/
│   ├── repository/
│   ├── security/
│   └── service/
└── src/main/resources/application.properties
```

## Cambios mínimos del frontend

- `src/lib/api.js`: valida la expiración del JWT antes de reutilizar la sesión.
- `src/lib/authService.js`: servicios HTTP de login y registro.
- `src/lib/userService.js`: CRUD de usuarios.
- `src/pages/auth-shared.jsx`: usa los servicios de autenticación y conserva redirección segura.
- `src/pages/Users.jsx`: pantalla CRUD mínima.
- `src/main.jsx`: agrega la ruta protegida `/usuarios`.

El frontend ya contiene `RequireRole`, que redirige a `/login` sin sesión o al panel correspondiente si el rol no coincide.

## Posibles mejoras futuras

- Refresh tokens y revocación.
- Recuperación de contraseña por correo.
- Paginación y filtros en el listado de usuarios.
- Registro de auditoría.
- Pruebas unitarias e integración con MongoDB Testcontainers.
- HTTPS y secretos administrados por Azure Key Vault/AWS Secrets Manager.
