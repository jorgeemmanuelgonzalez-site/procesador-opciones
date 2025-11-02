# Guía Completa: Configuración OAuth 2.0 para Google Sheets

Esta guía te ayudará a configurar OAuth 2.0 en Google Cloud Console para obtener el Client ID necesario para tu extensión de Chrome.

## Pasos para Configurar OAuth 2.0

### Paso 1: Crear un Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Inicia sesión con tu cuenta de Google
3. En la parte superior, junto a "Google Cloud", haz clic en el selector de proyectos
4. Haz clic en **"NUEVO PROYECTO"**
5. Ingresa un nombre para tu proyecto (ej: "Procesador Opciones")
6. Opcionalmente, selecciona una organización
7. Haz clic en **"CREAR"**
8. Espera a que se cree el proyecto y selecciónalo desde el selector de proyectos

### Paso 2: Habilitar las APIs Necesarias

1. En el menú lateral izquierdo, ve a **"APIs y servicios"** → **"Biblioteca"**
2. En el cuadro de búsqueda, escribe: **"Google Sheets API"**
3. Haz clic en **"Google Sheets API"**
4. Haz clic en **"HABILITAR"**
5. Repite el proceso para **"Google Drive API"**:
   - Busca "Google Drive API" en la biblioteca
   - Haz clic en **"HABILITAR"**

### Paso 3: Configurar Pantalla de Consentimiento de OAuth

**⚠️ NOTA: Google ha actualizado la interfaz. Hay dos formas de acceder:**

**Método 1 - Nueva Interfaz (Google Auth Platform):**

1. En el menú lateral, busca **"Acceso a los datos"** o **"Data access"** y haz clic ✅ **ESTÁS AQUÍ**
2. Verás un botón azul con borde que dice **"Agregar o quitar permisos"** - ¡**HAZ CLIC AHÍ**! 🎯
3. Se abrirá una ventana/modal con una lista de permisos (ámbitos) disponibles
4. Usa la barra de búsqueda o busca en la lista estos dos ámbitos:
   - `https://www.googleapis.com/auth/spreadsheets` (Google Sheets API - Lectura/Escritura)
   - `https://www.googleapis.com/auth/drive.readonly` (Google Drive API - Solo lectura)
5. **Marca las casillas** de estos dos ámbitos
6. Haz clic en **"Actualizar"** o **"Agregar"** para cerrar la ventana
7. De vuelta en la página "Acceso a los datos", haz clic en **"Save"** (o "Guardar") en la parte inferior de la página
8. Los ámbitos deberían aparecer en una de las secciones: "Tus permisos no sensibles", "Tus permisos sensibles" o "Tus permisos restringidos"

**Método 2 - Interfaz Clásica:**

1. En el menú lateral, ve a **"APIs y servicios"** → **"Pantalla de consentimiento de OAuth"**
2. Selecciona el tipo de usuario:
   - Si es para uso personal o interno: **"Externo"** (recomendado para desarrollo)
   - Si es para publicación pública: **"Externo"** (deberás pasar por verificación)
3. Haz clic en **"CREAR"**

#### Paso 3.1: Información de la aplicación

4. En la pestaña **"INFORMACIÓN DE LA APLICACIÓN"**, completa:
   - **Nombre de la aplicación**: "Procesador de Opciones" (o el nombre que prefieras)
   - **Correo electrónico de soporte**: Tu email
   - **Correo electrónico del desarrollador**: Tu email (debería aparecer automáticamente)
5. Haz clic en **"GUARDAR Y CONTINUAR"**

#### Paso 3.2: Ámbitos (Scopes) - ⚠️ ESTO ES LO QUE BUSCAS

6. Ahora estarás en la pestaña **"ÁMBITOS"** (Scopes). Si no la ves, busca las pestañas en la parte superior:

   - **INFORMACIÓN DE LA APLICACIÓN**
   - **ÁMBITOS** ← Esta es la que necesitas
   - **USUARIOS DE PRUEBA**
   - **RESUMEN**

7. En la pestaña **"ÁMBITOS"**, verás dos opciones:

   - **Opción A**: Si ves un botón **"+ AGREGAR O ELIMINAR ÁMBITOS"** o **"ADD OR REMOVE SCOPES"**, haz clic en él
   - **Opción B**: Si ves una lista de ámbitos, busca el botón **"AGREGAR ÁMBITO"** o un enlace **"AGREGAR ÁMBITO MANUALMENTE"**

8. Si usaste la Opción A y se abrió una ventana modal:

   - Busca en la lista o usa la barra de búsqueda para encontrar:
     - `https://www.googleapis.com/auth/spreadsheets` (Google Sheets API - Lectura/Escritura)
     - `https://www.googleapis.com/auth/drive.readonly` (Google Drive API - Solo lectura)
   - Marca las casillas de estos dos ámbitos
   - Haz clic en **"ACTUALIZAR"** o **"AGREGAR"**

9. Si usaste la Opción B (agregar manualmente):

   - Haz clic en **"AGREGAR ÁMBITO MANUALMENTE"**
   - Ingresa cada uno de estos ámbitos uno por uno:
     - `https://www.googleapis.com/auth/spreadsheets`
     - `https://www.googleapis.com/auth/drive.readonly`
   - Haz clic en **"AGREGAR A LA TABLA"** después de cada uno

10. Una vez agregados, deberías ver ambos ámbitos listados en la tabla de ámbitos
11. Haz clic en **"GUARDAR Y CONTINUAR"**

#### Paso 3.3: Usuarios de prueba

12. Ahora estarás en la pestaña **"USUARIOS DE PRUEBA"** (Test users)
13. Haz clic en **"+ AGREGAR USUARIOS"** o **"ADD USERS"**
14. Ingresa tu email de Google (el que usarás para probar la extensión)
15. Presiona Enter o haz clic en **"AGREGAR"**
16. Verás tu email en la lista de usuarios de prueba
17. Haz clic en **"GUARDAR Y CONTINUAR"**

#### Paso 3.4: Resumen

18. Revisa la información en la pestaña **"RESUMEN"**
19. Verifica que los ámbitos aparezcan correctamente
20. Haz clic en **"VOLVER AL PANEL"** o simplemente cierra esta ventana

**💡 Nota importante**: Si ya creaste la pantalla de consentimiento antes y no encuentras los ámbitos:

- Ve a **"Pantalla de consentimiento de OAuth"**
- Haz clic en **"EDITAR APLICACIÓN"** o el botón de editar (lápiz)
- Navega a la pestaña **"ÁMBITOS"** para agregar los ámbitos necesarios

### Paso 4: Crear Credenciales OAuth 2.0 (Client ID)

1. En el menú lateral, ve a **"APIs y servicios"** → **"Credenciales"**
2. Haz clic en **"+ CREAR CREDENCIALES"** en la parte superior
3. Selecciona **"ID de cliente de OAuth"**
4. Si es la primera vez, te pedirá configurar la pantalla de consentimiento (ya lo hicimos, así que haz clic en **"CONFIGURAR LA PANTALLA DE CONSENTIMIENTO"** y luego regresa)
5. En **"Tipo de aplicación"**, selecciona **"Aplicación de Chrome"**
6. Completa los campos:
   - **Nombre**: "Procesador de Opciones" (o el nombre que prefieras)
   - **Origen de aplicación**: **DEJAR EN BLANCO** (no se usa para extensiones de Chrome)
7. Haz clic en **"CREAR"**
8. **¡IMPORTANTE!** Copia el **"ID de cliente"** que aparece (tiene el formato: `xxxxxxxxxxxxx.apps.googleusercontent.com`)
9. Haz clic en **"ACEPTAR"**

### Paso 5: Actualizar manifest.json

1. Abre el archivo `manifest.json` en tu proyecto
2. Busca la línea que dice:
   ```json
   "client_id": "TU_CLIENT_ID.apps.googleusercontent.com",
   ```
3. Reemplaza `TU_CLIENT_ID.apps.googleusercontent.com` con el Client ID que copiaste
4. Guarda el archivo

**Ejemplo:**

```json
"oauth2": {
    "client_id": "123456789012-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com",
    "scopes": [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.readonly"
    ]
}
```

### Paso 6: Verificar la Configuración

1. Recarga la extensión en Chrome:
   - Ve a `chrome://extensions/`
   - Busca tu extensión
   - Haz clic en el ícono de recargar (🔄)
2. Abre la extensión haciendo clic en su ícono
3. Intenta conectar con Google
4. Deberías ver la pantalla de consentimiento de Google solicitando permisos

## Resolución de Problemas

### Error: "Invalid client ID"

- Verifica que copiaste correctamente el Client ID completo (incluye `.apps.googleusercontent.com`)
- Asegúrate de que el tipo de aplicación sea **"Aplicación de Chrome"** (no "Aplicación web")

### Error: "Access blocked"

- Verifica que agregaste tu email como "Usuario de prueba" en la pantalla de consentimiento
- Si es un usuario nuevo, espera unos minutos para que se propague el cambio

### Error: "Redirect URI mismatch"

- Para extensiones de Chrome con Manifest V3, esto no debería ocurrir si configuraste como "Aplicación de Chrome"
- Verifica que el tipo de aplicación sea correcto

### La extensión no solicita permisos

- Verifica que recargaste la extensión después de actualizar `manifest.json`
- Revisa la consola de Chrome (`chrome://extensions/` → "Detalles" → "Errores") para ver mensajes de error

## Notas Importantes

1. **Usuarios de prueba**: Si configuraste la pantalla de consentimiento como "Externo", solo los usuarios agregados como "Usuarios de prueba" podrán usar la extensión durante el desarrollo.

2. **Publicación**: Si quieres que otros usuarios usen la extensión:

   - Deberás pasar por el proceso de verificación de Google (requiere más información y puede tomar varios días)
   - O mantener la aplicación en modo de prueba y agregar manualmente los usuarios

3. **Seguridad**: No compartas tu Client ID públicamente. Si lo haces por error, puedes regenerarlo desde Google Cloud Console.

4. **Límites**: Durante el desarrollo, las APIs de Google tienen límites de uso. Para producción, considera solicitar aumentos de cuota si es necesario.

## Próximos Pasos

Una vez completada la configuración:

1. ✅ Client ID configurado en `manifest.json`
2. ✅ Recarga la extensión
3. ✅ Prueba la conexión con Google
4. ✅ Configura spreadsheet, hoja, fila y columnas
5. ✅ Sincroniza datos

¡Listo! Ya deberías poder usar la integración con Google Sheets.
