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
- [Documentación del Proyecto](#-documentación-del-proyecto)
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
- **Backend:** Spring Boot 4 + Java 21+ + Spring Data JPA + Spring Security + JWT + Maven.
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
├── PLAN_PROYECTO.md         # Estado general, alcance y próximos pasos
├── AUTENTICACION_Y_SESION.md # Diseño y uso del login tokenizado
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
3. Crea tu archivo local de variables desde la plantilla:
   ```powershell
   Copy-Item .env.example .env
   ```
   Edita `.env` y reemplaza los valores de ejemplo. El archivo `.env` está excluido de Git.
4. Construye y levanta los servicios:
   ```powershell
   docker compose up --build
   ```
   *(Para levantarlo en segundo plano y liberar tu terminal, agrega `-d`: `docker compose up --build -d`)*.
5. Para detener los contenedores cuando termines:
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
| **Dashboard de Cocina** | [http://localhost:5173/cocina](http://localhost:5173/cocina) | Visualización en tiempo real de los pedidos entrantes para el personal operativo de cocina (Lista de pedidos). |
| **Login Administrativo** | [http://localhost:5173/admin](http://localhost:5173/admin) | Inicio de sesión para administradores de restaurante. |
| **Dashboard Admin** | [http://localhost:5173/admin/dashboard](http://localhost:5173/admin/dashboard) | Métricas activas, resumen del día y CRUD completo de productos (crear, editar, eliminar y cambiar disponibilidad). |
| **Backend REST API** | [http://localhost:8080](http://localhost:8080) | Endpoints REST (`/api/restaurantes`, `/api/products`, `/api/admin/login`). |

### Datos de Inicio de Sesión (Sembrados)
- **Correo:** `admin@upb.edu.co`
- **Contraseña:** `admin123`
- **Correo:** `admin2@upb.edu.co`
- **Contraseña:** `admin456`

La contraseña se almacena como hash BCrypt. El login entrega un JWT de acceso y administra la renovación mediante un refresh token `HttpOnly`.

Las credenciales de PostgreSQL y el secreto JWT se configuran en `P_upbFood/.env`. Usa [`P_upbFood/.env.example`](P_upbFood/.env.example) como plantilla; nunca subas el archivo `.env` real.

---

## 📚 Documentación del Proyecto

- [Plan general del proyecto](PLAN_PROYECTO.md): alcance, funcionalidades terminadas, trabajo en curso y próximos pasos.
- [Autenticación y sesión](AUTENTICACION_Y_SESION.md): arquitectura JWT, BCrypt, refresh tokens, endpoints y configuración.

---

## 🧪 Ejecución de Pruebas Automatizadas

El proyecto cuenta con suite de pruebas automáticas para garantizar la calidad del software:

### Pruebas Unitarias del Backend (Spring Boot + JUnit / Mockito)
Ejecuta las pruebas de autenticación, controladores y contexto JPA:
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


---

## 📋 Tablero Kanban y Matriz de Historias de Usuario (Actualizado v4)

El proyecto se gestiona de manera ágil bajo el marco **Scrumban**, combinando la estructura temporal de Sprints con el flujo de trabajo continuo en **GitHub Projects**. A continuación se presenta el estado de avance oficial de las Historias de Usuario (HU001 a HU029 - 114 PH en total):

### 🎯 Estado Consolidado de Sprints

| Sprint | Fechas Oficiales | Enfoque Principal | Puntos (PH) | Estado Actual |
| :---: | :---: | :--- | :---: | :---: |
| **Sprint 1** | 26/Ago/2026 – 09/Sep/2026 | Exploración inicial, catálogo, navegación y autenticación administrativa | 16 PH | **Completado (100%)** |
| **Sprint 2** | 09/Sep/2026 – 23/Sep/2026 | Catálogo de productos interactivo y gestión del Carrito (Context API) | 19 PH | **Completado (100%)** |
| **Sprint 3** | 23/Sep/2026 – 07/Oct/2026 | Formalización de pedidos, cliente y Tablero de Cocina en tiempo real | 19 PH | **Completado (100%)** |
| **Sprint 4** | 07/Oct/2026 – 21/Oct/2026 | Gestión administrativa de catálogo, filtros por categoría y altas | 18 PH | **Completado (100%)** |
| **Sprint 4 Ext.** | 21/Oct/2026 – Cierre | Trazabilidad por UUID, pago simulado, aislamiento y seguridad RBAC | 42 PH | **En Ejecución** |

---

### 📌 Detalle de Historias de Usuario en el Kanban

#### Sprint 1: Exploración Inicial y Autenticación Administrativa (16 PH)
* [x] **HU001: Lista de restaurantes y cafeterías (3 PH)** — *Julián Miranda* [AMPLIADA: Buscador de cafeterías] `Completado`
* [x] **HU002: Card Restaurante (3 PH)** — *Valeria Gómez* `Completado`
* [x] **HU003: Barra de navegación (3 PH)** — *Julián Miranda* [AMPLIADA: Vistas separadas por rol] `Completado`
* [x] **HU012: Formulario de login administrativo (4 PH)** — *Andrés Martínez* `Completado`
* [x] **HU013: Botón de ingreso y validación de acceso (3 PH)** — *Ismael López* `Completado`

#### Sprint 2: Catálogo de Productos y Gestión del Carrito (19 PH)
* [x] **HU004: Lista de productos (4 PH)** — *Julián Miranda* [AMPLIADA: Buscador de productos] `Completado`
* [x] **HU005: Card producto (3 PH)** — *Ismael López* [AMPLIADA: Selector de adiciones] `Completado`
* [x] **HU006: Botón y Estado Global del Carrito (4 PH)** — *Valeria Gómez* [AMPLIADA: Carrito de una sola cafetería] `Completado`
* [x] **HU007: Lista de pedidos y Resumen de Compra (3 PH)** — *Valeria Gómez* [AMPLIADA: Flujo en tres pasos] `Completado`
* [x] **HU008: Card de productos pedidos y Notas (5 PH)** — *Andrés Martínez* `Completado`

#### Sprint 3: Confirmación, Identificación y Gestión de Pedidos (19 PH)
* [x] **HU009: Botón confirmar pedido y Persistencia (4 PH)** — *Andrés Martínez* [AMPLIADA: Restricciones de apertura] `Completado`
* [x] **HU010: Formulario de identificación del cliente (4 PH)** — *Julián Miranda* [AMPLIADA: Selección de hora de recogida] `Completado`
* [x] **HU011: Botón continuar al pago y transición de estado (3 PH)** — *Andrés Martínez* `Completado`
* [x] **HU014: Lista de pedidos cocina en tiempo real (4 PH)** — *Ismael López* [AMPLIADA: Tablero Kanban de cocina] `Completado`
* [x] **HU015: Card de pedidos cocina y cambio de estado (4 PH)** — *Valeria Gómez* [AMPLIADA: Transiciones validadas] `Completado`

#### Sprint 4: Administración y Gestión del Catálogo (18 PH)
* [x] **HU016: Lista de productos administrativa (4 PH)** — *Ismael López* [AMPLIADA: Selector de cafetería] `Completado`
* [x] **HU017: Card de productos administrativa y Switch de Stock (4 PH)** — *Valeria Gómez* [AMPLIADA: Retiro seguro] `Completado`
* [x] **HU018: Panel de edición de producto (6 PH)** — *Andrés Martínez & Julián Miranda* [AMPLIADA: Soporte de adiciones] `Completado`
* [x] **HU019: Botón y Formulario para añadir producto (4 PH)** — *Ismael López* `Completado`

#### Sprint 4 (Extendido): Funcionalidades de Robustez y Trazabilidad (42 PH)
* [ ] **HU020: Seguimiento de pedido por código único UUID (5 PH)** — *Valeria Gómez* `En Progreso`
* [ ] **HU021: Consulta de pedido por número, correo o teléfono (4 PH)** — *Ismael López* `En Progreso`
* [ ] **HU022: Portal de pago simulado y validación de total (5 PH)** — *Andrés Martínez* `En Progreso`
* [x] **HU023: Sesión persistente y revocación de tokens JWT (4 PH)** — *Andrés Martínez* `Completado`
* [x] **HU024: Control de acceso basado en roles y cafetería - RBAC (5 PH)** — *Ismael López* `Completado`
* [x] **HU025: Gestión de administradores de cocina con borrado lógico (5 PH)** — *Ismael López* `Completado`
* [x] **HU026: Aislamiento estricto de productos por cafetería (4 PH)** — *Ismael López* `Completado`
* [ ] **HU027: Historial de pedidos del cliente (3 PH)** — *Valeria Gómez* `Planificado`
* [ ] **HU028: Métricas reales del panel administrativo (4 PH)** — *Valeria Gómez* `Planificado`
* [ ] **HU029: Cambio de estado y tiempo de la cafetería (3 PH)** — *Valeria Gómez* `Planificado`

---

🔗 **Enlaces de Seguimiento:**
* 📌 [Tablero Kanban Oficial en GitHub Projects](https://github.com/users/nMiket/projects/1/views/2)
* 📊 [Matriz Completa de Historias de Usuario (Google Sheets)](https://docs.google.com/spreadsheets/d/1amVVqmlFByd3B-D26sb1ATZo2ChJaOUX/edit?usp=sharing)

---

Universidad Pontificia Bolivariana (UPB) — 2026

