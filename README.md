# 🍔 Plataforma Web para la Gestión de Pedidos en Cafeterías y Restaurantes UPB

¡Bienvenido al repositorio oficial del proyecto **UPB Food**! Esta solución tecnológica nace para transformar la experiencia gastronómica en el campus de la **Universidad Pontificia Bolivariana (UPB)**, optimizando los tiempos de atención y digitalizando el proceso de compra.

---

## 📋 Tabla de Contenidos
- [Misión del Proyecto](#-misión-del-proyecto)
- [Arquitectura y Tecnologías](#-arquitectura-y-tecnologías)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Requisitos Previos](#-requisitos-previos)
- [Guía de Ejecución Rápida (Docker + VS Code)](#-guía-de-ejecución-rápida-con-docker)
  - [Método 1: Con atajo en Visual Studio Code](#método-1-con-atajo-en-visual-studio-code-recomendado)
  - [Método 2: Mediante Terminal](#método-2-mediante-terminal-en-vs-code-o-powershell)
  - [Método 3: Con la extensión de Docker](#método-3-con-la-extensión-de-docker-en-vs-code)
- [Ejecución Local sin Docker (Modo Desarrollo)](#-ejecución-local-sin-docker-modo-desarrollo)
- [Credenciales y URLs de Prueba](#-credenciales-y-urls-de-prueba)
- [Ejecución de Pruebas Automatizadas](#-ejecución-de-pruebas-automatizadas)
- [Equipo de Trabajo](#-equipo-de-trabajo)
- [Metodología de Desarrollo](#-metodología-de-desarrollo)

---

## 🎯 Misión del Proyecto

En horas pico, los estudiantes, docentes y colaboradores de la UPB enfrentan filas de hasta **30 minutos** para comprar alimentos. Nuestra plataforma web permite realizar **pedidos anticipados y personalizados**, reduciendo el tiempo de espera a solo **3 minutos** (un 90% de optimización) sin pagar costos adicionales por domicilio o intermediarios externos.

---

## 🛠 Arquitectura y Tecnologías

El sistema está construido bajo una arquitectura de monorepo moderno y desacoplado:

- **Frontend:** React 19 + TypeScript + Vite + React Router DOM + CSS modular.
- **Backend:** Spring Boot 4 + Java 25 + Spring Data JPA + Spring Security + Maven.
- **Base de Datos:** PostgreSQL 16 con scripts de inicialización y funciones almacenadas (3FN).
- **Contenedores:** Docker y Docker Compose para orquestación de servicios en local.

---

## 📂 Estructura del Proyecto

```text
proyecto-tic1/
├── .vscode/                 # Tareas y configuración para Visual Studio Code
├── P_upbFood/
│   ├── Backend/             # API REST en Spring Boot, entidades, controladores y tests
│   ├── DataBase/            # Script init.sql (tablas 3FN, funciones y datos de prueba)
│   ├── Frontend/            # Aplicación React + TypeScript (componentes, vistas, tipos)
│   ├── docker-compose.yml   # Orquestador multi-contenedor (db, backend, frontend)
│   └── README.md            # Documentación técnica del módulo
└── README.md                # Documentación general y guía de uso
```

---

## ⚙️ Requisitos Previos

Para ejecutar el proyecto de la forma más rápida y recomendada:
- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** instalado y en ejecución en tu equipo.
- **[Git](https://git-scm.com/)**.
- **[Visual Studio Code](https://code.visualstudio.com/)** (opcional pero recomendado).

---

## 🚀 Guía de Ejecución Rápida con Docker

> [!IMPORTANT]
> **Antes de iniciar:** Asegúrate de abrir **Docker Desktop** en tu computadora y verificar que el motor esté activo (ícono de la ballena en verde en la barra de tareas).

### Método 1: Con atajo en Visual Studio Code (Recomendado)

El repositorio incluye tareas preconfiguradas para VS Code:

1. Abre la carpeta del repositorio `proyecto-tic1` en **Visual Studio Code**.
2. Presiona el atajo:
   ```text
   Ctrl + Shift + B
   ```
   *(O ve al menú superior: **Terminal** > **Run Build Task...**)*.
3. Se abrirá la terminal integrada de VS Code compilando las imágenes y levantando los 3 servicios (`upbfood-db`, `upbfood-backend`, `upbfood-frontend`).

> **Para detener el sistema:** Menú superior **Terminal** > **Run Task...** > selecciona **`Docker: Detener todo (down)`**.

---

### Método 2: Mediante Terminal (en VS Code o PowerShell)

1. Abre tu terminal o la terminal integrada de VS Code (`Ctrl + ~`).
2. Navega al directorio del proyecto:
   ```powershell
   cd P_upbFood
   ```
3. Construye y levanta los servicios:
   ```powershell
   docker compose up --build
   ```
   *(Para levantarlo en segundo plano y liberar tu terminal, agrega `-d`: `docker compose up --build -d`)*.
4. Para detener los contenedores cuando termines:
   ```powershell
   docker compose down
   ```

---

### Método 3: Con la extensión de Docker en VS Code

1. Instala la extensión oficial **Docker** (de Microsoft) en VS Code.
2. En el explorador lateral de archivos, expande la carpeta `P_upbFood`.
3. Haz **clic derecho** sobre `docker-compose.yml` y selecciona **Compose Up**.
4. Para detenerlo, vuelve a hacer clic derecho sobre `docker-compose.yml` y selecciona **Compose Down**.

---

## 💻 Ejecución Local sin Docker (Modo Desarrollo)

Si prefieres ejecutar los componentes de forma individual sin Docker:

### 1. Base de Datos (PostgreSQL)
- Instala y abre PostgreSQL localmente en el puerto `5432`.
- Crea la base de datos `upbfood` con usuario `upbfood` y clave `upbfood123`.
- Ejecuta el script SQL ubicado en [`P_upbFood/DataBase/init.sql`](P_upbFood/DataBase/init.sql) para cargar el esquema y los datos semilla.

### 2. Backend (Spring Boot)
Desde la terminal:
```powershell
cd P_upbFood/Backend
.\mvnw spring-boot:run
```
*(En Linux/Mac: `./mvnw spring-boot:run`)*.  
El backend iniciará en: `http://localhost:8080`.

### 3. Frontend (React + Vite)
En otra terminal:
```powershell
cd P_upbFood/Frontend
npm install
npm run dev
```
El frontend iniciará en: `http://localhost:5173`.

---

## 🔑 Credenciales y URLs de Prueba

Una vez levantados los servicios, accede desde tu navegador web:

| Servicio / Vista | URL | Descripción |
| :--- | :--- | :--- |
| **Vista Pública** | [http://localhost:5173](http://localhost:5173) | Explora las cafeterías (`CardRestaurante`) y el catálogo de productos con formato de moneda en COP (`CardProducto`). |
| **Login Administrativo** | [http://localhost:5173/admin](http://localhost:5173/admin) | Inicio de sesión para administradores de restaurante. |
| **Dashboard Admin** | [http://localhost:5173/admin/dashboard](http://localhost:5173/admin/dashboard) | Métricas activas, resumen del día y CRUD completo de productos (crear, editar, eliminar y cambiar disponibilidad). |
| **Backend REST API** | [http://localhost:8080](http://localhost:8080) | Endpoints REST (`/api/restaurantes`, `/api/products`, `/api/admin/login`). |

### Datos de Inicio de Sesión (Sembrados)
- **Correo:** `admin@upb.edu.co`
- **Contraseña:** `admin123`

---

## 🧪 Ejecución de Pruebas Automatizadas

El proyecto cuenta con suite de pruebas automáticas para garantizar la calidad del software:

### Pruebas Unitarias del Backend (Spring Boot + JUnit / Mockito)
Ejecuta los 7 tests unitarios (autenticación, controladores y contexto JPA):
```powershell
cd P_upbFood/Backend
.\mvnw test
```

### Verificación de Tipos y Compilación del Frontend (TypeScript)
Verifica que no existan errores de tipos ni dependencias faltantes:
```powershell
cd P_upbFood/Frontend
npm run build
```

---

## 👥 Equipo de Trabajo

Este proyecto es desarrollado en el marco de la asignatura **Proyecto Aplicado en TIC 1**, guiado por la docente **Yuri Marcela Escobar**:

| Nombre | Carrera | Rol en el Proyecto |
| :--- | :--- | :--- |
| 👩‍💻 **Valeria Gómez Arcila** | Ing. de Sistemas e Informática | **Scrum Master & UI/UX Designer** *(Líder)* |
| 👨‍💻 **Andrés Felipe Martínez Taborda** | Ing. de Sistemas e Informática | **Tech Lead & Backend Engineer & Product Owner** |
| 👨‍💻 **Julián Eduardo Miranda Salazar** | Ing. de Sistemas e Informática | **Frontend Developer** |
| 👨‍💻 **Ismael López Cardozo** | Ing. en Ciencia de Datos | **Data Scientist & QA Manager** |

---

## 📈 Metodología de Desarrollo

Trabajamos con un **enfoque híbrido Scrum + Kanban**:
* **Scrum:** Planificación incremental en **4 Sprints** de 2 semanas (8 semanas totales, 72 Puntos de Historia).
* **Kanban:** Gestión del flujo de trabajo visualizado mediante **GitHub Projects**.

📌 **Tablero de Control:** [GitHub Projects - Kanban TIC1](https://github.com/users/nMiket/projects/1/views/2)

---

Universidad Pontificia Bolivariana (UPB) — 2026
