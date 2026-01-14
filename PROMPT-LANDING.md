# Prompt para Landing Page - Procesador de Opciones

## Descripción General

El **Procesador de Opciones** es una extensión de Chrome diseñada para procesar, analizar y exportar operaciones financieras de opciones. La herramienta permite trabajar con dos fuentes de datos principales: archivos CSV locales o conexión directa a sistemas OMS (Order Management System) mediante API.

**Característica fundamental de seguridad y privacidad**: El procesador **NO guarda ningún dato en servidores externos**. Todo el procesamiento se realiza localmente en el navegador del usuario, y en el caso del procesador OMS, solo realiza una consulta única para obtener las operaciones ejecutadas y luego cierra la sesión inmediatamente.

---

## Funciones Principales del Procesador

### 1. Procesamiento de Archivos CSV

**¿Qué hace?**
- Lee y parsea archivos CSV con datos de operaciones financieras
- Filtra solo las ejecuciones reales (excluye actualizaciones de órdenes)
- Consolida operaciones múltiples de la misma orden calculando el precio promedio ponderado (VWAP)
- Extrae y clasifica automáticamente opciones CALLS, PUTS y acciones subyacentes

**Proceso interno:**
1. **Filtrado inicial**: Solo procesa registros con `event_subtype = "execution_report"` y `ord_status = "Ejecutada"` o `"Parcialmente ejecutada"`
2. **Consolidación**: Agrupa múltiples ejecuciones de la misma orden (`order_id + symbol`) y calcula:
   - Cantidad total ejecutada
   - Precio promedio ponderado (VWAP) basado en volumen
3. **Clasificación**: Identifica si cada operación es:
   - **CALL**: Opciones de compra (símbolos que contienen el patrón `[ACTIVO]C`, ej: GFGC, YPFC)
   - **PUT**: Opciones de venta (símbolos que contienen el patrón `[ACTIVO]V`, ej: GFGV, YPFV)
   - **ACCION**: Acciones del subyacente (formato: `MERV - XMEV - [SUBYACENTE] - 24hs`)
4. **Extracción de strikes**: Para opciones, extrae el precio de ejercicio (strike) del símbolo según el vencimiento configurado
5. **Aplicación de promedios** (opcional): Si está habilitado, agrupa operaciones del mismo strike y calcula promedios separando compras y ventas

### 2. Procesador de OMS (Order Management System)

**¿Qué hace?**
- Se conecta a una API externa que actúa como intermediario con sistemas OMS
- Obtiene las operaciones ejecutadas directamente desde el sistema de trading
- Procesa los datos usando la misma lógica que el procesador CSV
- **NO almacena credenciales ni datos en servidores externos**

**Flujo de funcionamiento detallado:**

1. **Configuración previa** (una sola vez):
   - El usuario configura sus credenciales XOMS en la sección "Conectar con mediante xoms":
     - API URL: Endpoint de la API del OMS
     - WebSocket URL: Endpoint WebSocket del OMS
     - Usuario: Credencial de usuario
     - Contraseña: Credencial de contraseña
     - Cuenta: Número de cuenta de trading
   - Estas credenciales se guardan **únicamente en el almacenamiento local del navegador** (chrome.storage.local)

2. **Proceso de consulta** (cada vez que se procesa):
   - Al hacer clic en "Procesar mediante OMS":
     - La extensión envía una petición POST a la API del procesador de mercado (`https://api-procesador-mercado.mercadodecapitales.site/api/v1/operations`)
     - La petición incluye las credenciales XOMS configuradas
     - La API externa se conecta al sistema OMS usando estas credenciales
     - La API consulta las operaciones ejecutadas
     - La API retorna las operaciones en formato JSON
     - **La API cierra la sesión inmediatamente después de obtener los datos**
     - **Ningún dato se almacena en el servidor de la API**

3. **Conversión y procesamiento**:
   - Las operaciones recibidas de la API se convierten al formato CSV interno
   - Se mapean los campos:
     - `OrderID` → `order_id`
     - `Symbol` → `symbol`
     - `Side` → `side` (BUY/SELL)
     - `LastPx` o `Price` → `last_price`
     - `FilledQty` → `last_qty`
     - `Status` → `ord_status`
   - El formato convertido se procesa usando **exactamente la misma lógica** que el procesador CSV

4. **Resultado**:
   - Los datos procesados se muestran en la interfaz
   - Se guardan **únicamente en el almacenamiento local del navegador**
   - No hay persistencia en servidores externos

**Seguridad y privacidad:**
- Las credenciales XOMS nunca salen del navegador del usuario excepto en la petición HTTP a la API
- La API actúa como un proxy temporal: recibe credenciales, consulta el OMS, retorna datos y cierra sesión
- No hay almacenamiento de datos operacionales en servidores
- Todo el procesamiento final ocurre localmente en el navegador

### 3. Sistema de Promedios

**¿Qué hace?**
- Cuando está habilitado, agrupa todas las operaciones del mismo strike (para opciones) o símbolo (para acciones)
- Calcula promedios **separando compras y ventas**:
  - **Compras** (cantidad positiva): Se agrupan y se calcula precio promedio ponderado
  - **Ventas** (cantidad negativa): Se agrupan y se calcula precio promedio ponderado por separado
- Resultado: Una operación consolidada por strike/símbolo para compras y otra para ventas

**Ejemplo:**
- Sin promedios: 3 operaciones de CALL strike 100 (2 compras, 1 venta)
- Con promedios: 2 operaciones de CALL strike 100 (1 compra consolidada, 1 venta consolidada)

### 4. Exportación de Datos

**Formatos disponibles:**

**EPGB (formato tradicional):**
- Separa CALLS, PUTS y ACCIONES en secciones distintas
- Columnas: Cantidad | Base (strike) | Precio
- Usa comas como separador decimal y tabulaciones como separador de columnas
- Incluye encabezados descriptivos

**DeltaVega (formato unificado):**
- Formato: `Type | Quantity | Strike | Price`
- Type: C (Call), P (Put), S (Subyacente/Acción)
- Ordenamiento: Primero por tipo (C, P, S), luego por strike, luego por cantidad
- Usa puntos como separador decimal y tabulaciones como separador de columnas
- Formato optimizado para importación en sistemas de análisis de opciones

**Métodos de exportación:**
- **Descargar Todo**: Genera un archivo CSV con todas las operaciones según el formato seleccionado
- **Copiar al Portapapeles**: Copia los datos formateados listos para pegar en Excel
- **Botones de copia rápida**: Acceso directo desde la parte superior para copiar CALLS, PUTS o ACCIONES por separado

---

## Secciones de la Interfaz

### 1. Sección de Configuración de Procesamiento

**Ubicación**: Parte superior de la pestaña "Procesador"

**Elementos:**
- **Selector de Símbolo del Activo**: Lista desplegable con símbolos configurados (GFG, YPF, COM, etc.)
- **Selector de Vencimiento**: Lista desplegable con vencimientos configurados (ENE, FEB, MAR, etc.)
- **Toggle "Usar Promedios"**: Activa/desactiva el modo de promedios por strike
- **Selector de Formato de Exportación**: EPGB o DeltaVega

**Función**: Configura los parámetros que se usarán para procesar las operaciones. Estos valores determinan:
- Qué símbolos de opciones se buscarán en los datos (ej: si seleccionas GFG, buscará GFGC y GFGV)
- Qué vencimientos se procesarán (ej: si seleccionas OCT, buscará opciones que terminen en "O" o "OC")
- Si se aplicarán promedios o se mostrarán todas las operaciones individuales
- En qué formato se exportarán los resultados

### 2. Sección de Botones de Copia Rápida

**Ubicación**: Justo debajo de la configuración, visible solo cuando hay datos procesados

**Elementos:**
- **Botón "Calls"**: Copia solo las operaciones CALLS al portapapeles
- **Botón "Puts"**: Copia solo las operaciones PUTS al portapapeles
- **Botón "Acciones"**: Copia solo las operaciones de acciones al portapapeles
- **Botón "Copiar"** (formato DeltaVega): Copia todas las operaciones en formato unificado
- **Información de último reporte**: Muestra fecha y hora del último procesamiento exitoso

**Función**: Proporciona acceso rápido a las funciones de copia más usadas sin necesidad de navegar a la sección de resultados.

### 3. Sección de Procesamiento (con pestañas CSV/OMS)

**Ubicación**: Parte central de la pestaña "Procesador"

**Pestaña "Procesar con CSV":**
- **Input de archivo**: Permite seleccionar un archivo CSV desde el sistema
- **Botón "Procesar Operaciones"**: Inicia el procesamiento del archivo seleccionado
- **Botón "Limpiar Datos"**: Elimina todos los datos procesados del almacenamiento local
- **Estado**: Muestra mensajes de progreso y resultado del procesamiento

**Pestaña "Procesar con OMS":**
- **Advertencia de configuración**: Se muestra si no hay configuración XOMS completa
- **Botón "Procesar"**: Inicia la consulta a la API del procesador de mercado
- **Botón "Limpiar Datos"**: Elimina todos los datos procesados
- **Estado**: Muestra el progreso de la conexión y procesamiento

**Función**: Permite elegir la fuente de datos (archivo local o sistema OMS) y ejecutar el procesamiento.

### 4. Sección de Resultados del Procesamiento

**Ubicación**: Parte inferior de la pestaña "Procesador", visible solo después de procesar datos

**Elementos:**

**Resumen:**
- Muestra estadísticas generales:
  - Modo de procesamiento (CON/SIN PROMEDIOS)
  - Símbolo activo usado
  - Vencimiento seleccionado
  - Total de operaciones (desglosado por tipo)
  - Si hay promedios aplicados, muestra también las cantidades originales

**Vista Previa de Datos:**
- **Pestañas**: Permite alternar entre CALLS, PUTS y ACCIONES
- **Tablas**: Muestra las operaciones procesadas en formato tabular
  - CALLS/PUTS: Columnas Cantidad | Base (strike) | Precio
  - ACCIONES: Columnas Símbolo | Cantidad | Precio
- **Botones de copia**: Copia los datos de cada tipo por separado
- **Botón "Descargar Todo"**: Genera y descarga un archivo CSV completo

**Función**: Visualiza los resultados del procesamiento y permite exportarlos.

### 5. Sección de Datos Guardados

**Ubicación**: Parte inferior de la pestaña "Procesador", visible cuando hay datos de sesiones anteriores

**Elementos:**
- Información de la última sesión procesada:
  - Símbolo usado
  - Vencimiento usado
  - Modo de promedios
  - Cantidad de operaciones por tipo

**Función**: Muestra información sobre datos procesados previamente que aún están disponibles en el almacenamiento local.

### 6. Pestaña de Configuración

**Ubicación**: Pestaña separada "Configuración"

**Sección "Configuración Avanzada":**

**Gestión de Símbolos:**
- **Campos de entrada**: Símbolo nuevo y su subyacente correspondiente
- **Lista de símbolos**: Muestra todos los símbolos configurados con opciones de editar/eliminar
- **Función**: Permite personalizar qué activos se pueden procesar. Cada símbolo debe tener su subyacente asociado (ej: GFG → GGAL) para identificar operaciones de acciones.

**Gestión de Vencimientos:**
- **Campos de entrada**: Nombre del mes y sufijos (separados por comas)
- **Lista de vencimientos**: Muestra todos los vencimientos configurados con opciones de editar/eliminar
- **Función**: Permite personalizar qué vencimientos se reconocerán. Los sufijos son las letras que identifican el vencimiento en los símbolos de opciones (ej: OCT puede tener sufijos "O" y "OC").

**Botones de gestión:**
- **Restaurar Configuración por Defecto**: Vuelve a los valores iniciales
- **Guardar Configuración**: Fuerza el guardado (normalmente se guarda automáticamente)

**Sección "Conectar con mediante xoms":**

**Campos de configuración:**
- **API URL**: Endpoint de la API del sistema OMS
- **WebSocket URL**: Endpoint WebSocket del sistema OMS
- **Usuario**: Credencial de usuario para el OMS
- **Contraseña**: Credencial de contraseña para el OMS
- **Cuenta**: Número de cuenta de trading

**Función**: Permite configurar las credenciales necesarias para conectarse al sistema OMS a través de la API del procesador de mercado. Estas credenciales se guardan únicamente en el almacenamiento local del navegador.

---

## Flujo Completo de Procesamiento

### Flujo con CSV:

1. Usuario selecciona archivo CSV
2. Usuario configura símbolo, vencimiento, promedios y formato
3. Usuario hace clic en "Procesar Operaciones"
4. Sistema lee y parsea el archivo CSV
5. Sistema filtra solo ejecuciones reales
6. Sistema consolida operaciones por orden
7. Sistema clasifica en CALLS, PUTS y ACCIONES
8. Sistema extrae strikes según vencimiento configurado
9. Si hay promedios habilitados, agrupa por strike y calcula promedios
10. Sistema sanitiza y valida datos
11. Sistema guarda resultados en almacenamiento local
12. Sistema muestra resultados en la interfaz
13. Usuario puede exportar o copiar los datos

### Flujo con OMS:

1. Usuario configura credenciales XOMS (una sola vez)
2. Usuario selecciona símbolo, vencimiento, promedios y formato
3. Usuario hace clic en "Procesar mediante OMS"
4. Sistema valida que la configuración XOMS esté completa
5. Sistema envía petición POST a API del procesador de mercado con credenciales
6. API externa se conecta al OMS usando las credenciales
7. API consulta operaciones ejecutadas
8. API cierra sesión inmediatamente
9. API retorna operaciones en formato JSON
10. Sistema convierte datos JSON a formato CSV interno
11. Sistema procesa usando la misma lógica que CSV (pasos 5-11 del flujo CSV)
12. Sistema muestra resultados en la interfaz
13. Usuario puede exportar o copiar los datos

---

## Características Técnicas Importantes

### Persistencia de Datos

- **Almacenamiento**: Todos los datos se guardan en `chrome.storage.local` (almacenamiento local del navegador)
- **Datos guardados**:
  - Configuración (símbolos, vencimientos, preferencias)
  - Datos procesados (CALLS, PUTS, ACCIONES)
  - Credenciales XOMS (encriptadas por el navegador)
  - Metadatos (última hora de procesamiento, símbolo activo, etc.)
- **Sin servidor**: No hay backend, no hay base de datos externa, todo es local

### Seguridad

- **Credenciales XOMS**: Se almacenan localmente, solo se envían en peticiones HTTPS a la API
- **Sin almacenamiento en servidor**: La API del procesador de mercado no guarda credenciales ni datos operacionales
- **Sesión temporal**: La conexión al OMS se cierra inmediatamente después de obtener los datos
- **Procesamiento local**: Todo el análisis y procesamiento ocurre en el navegador del usuario

### Rendimiento

- **Procesamiento eficiente**: Algoritmos optimizados para manejar grandes volúmenes de operaciones
- **Consolidación inteligente**: Agrupa operaciones para reducir redundancia
- **Validación temprana**: Filtra datos inválidos desde el inicio del proceso
- **Sin dependencias externas**: No requiere librerías adicionales, todo es JavaScript vanilla

---

## Casos de Uso

### Caso 1: Trader procesando operaciones del día
1. Exporta CSV de su plataforma de trading
2. Carga el CSV en el procesador
3. Selecciona símbolo y vencimiento
4. Procesa con promedios habilitados
5. Copia los resultados para análisis en Excel

### Caso 2: Asesor financiero con múltiples cuentas
1. Configura símbolos personalizados para sus clientes
2. Procesa archivos CSV de diferentes cuentas
3. Exporta resultados en formato DeltaVega para análisis profesional
4. Compara resultados entre diferentes sesiones

### Caso 3: Usuario con acceso a OMS
1. Configura credenciales XOMS una vez
2. Procesa operaciones directamente desde el sistema OMS
3. Obtiene datos actualizados sin necesidad de exportar CSV
4. Analiza resultados en tiempo real

---

## Puntos Clave para la Landing Page

1. **Privacidad y seguridad**: Enfatizar que no se guardan datos en servidores, todo es local
2. **Procesador OMS**: Explicar claramente que solo hace una consulta y cierra sesión, sin almacenamiento
3. **Flexibilidad**: Destacar la capacidad de personalizar símbolos y vencimientos
4. **Dos formatos de exportación**: EPGB tradicional y DeltaVega profesional
5. **Procesamiento inteligente**: Consolidación automática, promedios opcionales, clasificación automática
6. **Facilidad de uso**: Interfaz intuitiva, botones de acceso rápido, vista previa clara
7. **Sin dependencias**: No requiere conexión a internet (excepto para OMS), todo funciona offline
8. **Persistencia local**: Los datos se mantienen entre sesiones del navegador

---

## Notas para el Diseño de la Landing

- **Sección hero**: Enfatizar "Procesamiento local, sin servidores, 100% privado"
- **Sección de características**: Destacar las dos formas de procesamiento (CSV y OMS)
- **Sección de seguridad**: Explicar claramente el flujo del procesador OMS y cómo garantiza la privacidad
- **Sección de funcionalidades**: Mostrar las diferentes secciones de la interfaz con capturas o mockups
- **Sección de formatos**: Comparar EPGB vs DeltaVega con ejemplos visuales
- **Call to action**: Enfocarse en la instalación fácil y el uso inmediato sin registro

