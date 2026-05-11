# Pedidos Libreria - Municipalidad de Jesus Maria

Sistema de pedidos de materiales de oficina y libreria para las areas municipales.

## Estructura

| Archivo | Descripcion |
|---------|-------------|
| `index.html` | Formulario publico de pedidos (pagina principal) |
| `admin.html` | Panel de administracion (login, gestion de pedidos, catalogo, usuarios) |

## Navegacion

- Desde el **formulario** se accede al admin mediante el enlace "Administracion" en el pie de pagina.
- Desde el **admin** se accede al formulario mediante el boton "Ver formulario" en la barra superior.

## Backend

El sistema usa **Google Apps Script** como backend, conectado a una hoja de calculo de Google Sheets con tres hojas:

- **Pedidos**: Almacena los pedidos enviados desde el formulario.
- **Catalogo**: Lista de articulos disponibles para pedir.
- **Usuarios**: Credenciales de acceso al panel de administracion.

### Configuracion del Script

1. Abrir [script.google.com](https://script.google.com) y crear un nuevo proyecto.
2. Pegar el codigo del Apps Script (funciones `setup`, `doGet`, `doPost`, etc.).
3. Ejecutar la funcion `setup()` para crear la estructura de hojas.
4. Implementar como **Web App** (Ejecutar como: yo, Acceso: cualquiera).
5. Copiar la URL de la Web App y pegarla en la variable `SCRIPT_URL` de ambos archivos HTML.

## Deploy con GitHub Pages

1. Ir a **Settings > Pages** del repositorio.
2. En "Source" seleccionar la rama `main` y carpeta `/ (root)`.
3. El formulario estara disponible en `https://<usuario>.github.io/<repo>/`.
4. El admin estara en `https://<usuario>.github.io/<repo>/admin.html`.
