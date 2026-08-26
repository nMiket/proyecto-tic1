# UPB Food Monorepo

Estructura base profesional para un proyecto web con:

- Frontend: React + TypeScript + Vite
- Backend: Spring Boot + Maven
- Base de datos: PostgreSQL
- Contenedores: Docker + Docker Compose

## Estructura

- `Frontend/`: interfaz web
- `Backend/`: API REST y logica de negocio
- `DataBase/`: scripts SQL (init, migrations, seeds)
- `docker-compose.yml`: orquestacion local

## Requisitos

- Docker Desktop
- Git

## Levantar el entorno completo

Desde la raiz del proyecto:

```bash
docker compose up --build
```

Servicios:

- Frontend: http://localhost:5173
- Backend: http://localhost:8080
- PostgreSQL: localhost:5432

## Detener el entorno

```bash
docker compose down
```

Para borrar volumen de datos de PostgreSQL:

```bash
docker compose down -v
```

## Notas

- El backend usa variables de entorno para conexion a base de datos.
- El script `DataBase/init.sql` se ejecuta automaticamente en la primera inicializacion del contenedor de PostgreSQL.
