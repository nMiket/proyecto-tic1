# Plan General de UPB Food

## Objetivo

UPB Food es una plataforma web para consultar cafeterías, explorar sus productos y gestionar pedidos dentro de la Universidad Pontificia Bolivariana. El objetivo es reducir filas y tiempos de espera mediante un catálogo digital y un panel administrativo.

## Alcance actual

| Área | Estado | Resultado |
|---|---|---|
| Entorno de desarrollo | Completado | Docker Compose con PostgreSQL, backend y frontend. |
| Modelo de datos | Completado | Tablas normalizadas, funciones CRUD y datos semilla. |
| Catálogo público | Completado | Cafeterías, categorías, productos e imágenes por producto. |
| Selección de cafetería | Completado | Menús independientes por restaurante. |
| Panel administrativo | Completado | Crear, editar, eliminar y cambiar disponibilidad de productos. |
| Login administrativo | Completado | BCrypt, JWT, refresh token revocable y rutas protegidas. |
| Autorización por cafetería | Completado | Cada administrador solo puede crear, editar o eliminar productos de su restaurante. |
| Validación de API | Completado | DTOs tipados, validación de productos y respuestas de error centralizadas. |
| Carrito | Completado | Agregar productos, modificar cantidades y calcular totales. |
| HU008 tarjeta de producto pedido | Completado | Imagen, precio unitario, subtotal, cantidades, eliminación y observaciones editables. |
| Resumen del pedido | En progreso | Interfaz disponible; falta cerrar el flujo persistente contra el backend. |
| Gestión de pedidos | Pendiente | Persistir pedidos, detalles, cliente, estado y seguimiento. |

## Próximos pasos priorizados

1. Crear los endpoints de pedidos y detalles usando las tablas existentes.
2. Conectar el resumen del carrito con la creación de pedidos.
3. Agregar validación de disponibilidad y stock antes de confirmar un pedido.
4. Implementar consulta de historial y estados del pedido para clientes.
5. Completar el flujo administrativo de preparación y cambio de estado.
6. Mejorar las pruebas de integración de autenticación, autorización y pedidos.
7. Corregir los avisos pendientes de ESLint y revisar accesibilidad del frontend.

## Criterios de terminado

Una funcionalidad se considera terminada cuando:

- Tiene una ruta o interacción visible en el frontend.
- Tiene validaciones y respuestas de error en el backend.
- Persiste correctamente los datos necesarios en PostgreSQL.
- Cuenta con pruebas o una verificación reproducible.
- Está documentada y funciona con Docker Compose.

## Comandos de verificación

Desde `P_upbFood/Backend`:

```powershell
.\mvnw.cmd test
```

Desde `P_upbFood/Frontend`:

```powershell
npm.cmd run build
```

Para levantar el sistema completo:

```powershell
cd P_upbFood
docker compose up --build
```

## Equipo y metodología

El proyecto se desarrolla para Proyecto Aplicado en TIC 1 con un enfoque híbrido Scrum + Kanban. La distribución actual de responsabilidades está documentada en el README principal.
