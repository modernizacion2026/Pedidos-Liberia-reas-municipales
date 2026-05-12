# Pedidos Libreria - Municipalidad de Jesus Maria

Sistema de pedidos de materiales de oficina y libreria para las areas municipales.

## Estructura

| Archivo | Descripcion |
|---------|-------------|
| `index.html` | Formulario publico de pedidos (pagina principal) |
| `admin.html` | Panel de administracion (login, gestion de pedidos, catalogo, usuarios) |
| `script.gs` | Codigo de Google Apps Script (backend) |

## Funcionalidades

### Formulario de pedidos (`index.html`)
- Seleccion de secretaria, area y **dependencia receptora**
- Busqueda de articulos con autocompletado desde el catalogo
- **Carga de foto** por cada articulo solicitado
- Campos de especificacion, empaque y cantidad
- Observaciones generales del pedido

### Panel de administracion (`admin.html`)
- Login con usuario y contrasena
- **Permisos por dependencia receptora**: usuarios con rol "receptor" solo ven los pedidos de su dependencia asignada
- Filtros por secretaria, **dependencia receptora**, estado, fecha y busqueda
- Cambio de estado de pedidos (Pendiente, Aprobado, Entregado, Rechazado)
- Detalle de pedido con **visualizacion de fotos** adjuntas
- Exportacion a Excel
- Gestion de catalogo de articulos
- Gestion de usuarios con asignacion de dependencia

### Dependencias receptoras
- Edificio Centro
- Obrador (Panol)
- Almafuerte 451 (ex Imei)

### Roles de usuario
- **admin**: acceso total, ve todos los pedidos de todas las dependencias, gestiona catalogo y usuarios
- **receptor**: solo ve los pedidos de su dependencia asignada, no puede gestionar catalogo ni usuarios

## Navegacion

- Desde el **formulario** se accede al admin mediante el enlace "Administracion" en el pie de pagina.
- Desde el **admin** se accede al formulario mediante el boton "Ver formulario" en la barra superior.

## Backend

El sistema usa **Google Apps Script** como backend, conectado a una hoja de calculo de Google Sheets con tres hojas:

- **Pedidos**: id, fecha, hora, secretaria, area, nombre, email, observaciones, items_json, estado, **dependencia**
- **Catalogo**: lista de articulos disponibles para pedir
- **Usuarios**: usuario, pass, nombre, rol, **dependencia**

### Configuracion del Script

1. Abrir [script.google.com](https://script.google.com) y crear un nuevo proyecto.
2. Pegar el contenido del archivo `script.gs` del repositorio.
3. Ejecutar la funcion `setup()` para crear la estructura de hojas.
4. Implementar como **Web App** (Ejecutar como: yo, Acceso: cualquiera).
5. Copiar la URL de la Web App y pegarla en la variable `SCRIPT_URL` de ambos archivos HTML (`index.html` y `admin.html`).

> **IMPORTANTE**: Si ya tenes hojas existentes, agrega manualmente la columna "dependencia" (columna 11) en la hoja Pedidos y la columna "dependencia" (columna 5) en la hoja Usuarios.

## Deploy con GitHub Pages

1. Ir a **Settings > Pages** del repositorio.
2. En "Source" seleccionar la rama `main` y carpeta `/ (root)`.
3. El formulario estara disponible en `https://<usuario>.github.io/<repo>/`.
4. El admin estara en `https://<usuario>.github.io/<repo>/admin.html`.
