# Procesador de Opciones - Extensión de Chrome

Una extensión de Chrome para procesar operaciones financieras de opciones desde archivos CSV. Permite configurar símbolos y vencimientos dinámicamente, procesar datos con o sin promedios, y exportar resultados con persistencia de datos en el navegador.

## Características

- **Procesamiento de archivos CSV**: Carga y procesa archivos CSV con datos de operaciones financieras
- **Configuración dinámica**: Personaliza completamente los símbolos de activos y vencimientos disponibles
- **Configuración flexible**: Selecciona símbolo del activo, vencimiento y modo de procesamiento
- **Persistencia de datos**: Los datos procesados se guardan automáticamente en el almacenamiento del navegador
- **Vista previa de resultados**: Visualiza los datos procesados antes de exportarlos
- **Exportación múltiple**: Descarga archivos CSV o copia datos al portapapeles
- **Formatos de exportación**: Soporte para formato EPGB y formato DeltaVega (Type | Quantity | Strike | Price)
- **Sin autenticación**: Acceso directo a la funcionalidad sin necesidad de login

## Historial de versiones

- Consulta el historial completo en `CHANGELOG.md`.
- Última versión: 1.1.0 — Nueva funcionalidad: Formato de exportación DeltaVega para opciones.

## Instalación

1. Descarga o clona este repositorio
2. Abre Chrome y ve a `chrome://extensions/`
3. Activa el "Modo de desarrollador" en la esquina superior derecha
4. Haz clic en "Cargar extensión sin empaquetar"
5. Selecciona la carpeta `procesador-opciones`

## Uso

### 1. Configuración Inicial

#### Configuración de Símbolos de Activos

- **Agregar símbolos**: En "Configuración Avanzada", ingresa nuevos símbolos (ej: GGAL, YPF, COM, etc.)
- **Eliminar símbolos**: Usa el botón ✕ junto a cada símbolo para eliminarlo
- **Símbolos por defecto**: GFG, YPF, COM, PAM, TEN, REP, TGNO4, ALUA, BYMA, MIRG

#### Configuración de Vencimientos

- **Agregar vencimientos**: Ingresa código (ej: ENE), nombre (ej: Enero) y sufijos (ej: E,EN)
- **Eliminar vencimientos**: Usa el botón ✕ junto a cada vencimiento
- **Vencimientos por defecto**: Todos los meses del año con sus sufijos correspondientes

#### Configuración de Procesamiento

- **Símbolo del Activo**: Selecciona de tu lista personalizada
- **Vencimiento**: Elige de tu configuración personalizada
- **Usar Promedios**: Activa/desactiva el procesamiento con promedios por strike
- **Formato de Exportación**: Selecciona entre formato EPGB (formato tradicional) o DeltaVega (Type | Quantity | Strike | Price)

### 2. Procesamiento de Archivos

1. **Cargar archivo**: Haz clic en "Seleccionar archivo CSV" y elige tu archivo
2. **Configurar procesamiento**:
   - Selecciona el símbolo del activo de tu lista personalizada
   - Elige el vencimiento de tu configuración personalizada
   - Activa/desactiva el modo de promedios según necesites
   - Selecciona el formato de exportación (EPGB o DeltaVega)
3. **Procesar**: Haz clic en "Procesar Operaciones"
4. **Persistencia**: Los datos se procesarán y guardarán automáticamente en el navegador

### 3. Visualización de Resultados

- **Resumen**: Estadísticas generales del procesamiento
- **Vista Previa**: Muestra las primeras 10 operaciones de CALLS y PUTS
- **Pestañas**: Cambia entre CALLS y PUTS para ver cada tipo por separado

### 4. Exportación

- **Formato EPGB**: Formato tradicional con columnas separadas para CALLS, PUTS y ACCIONES
- **Formato DeltaVega**: Formato unificado con columnas Type | Quantity | Strike | Price, ordenado por tipo (C, P, S), strike y cantidad
- **Descargar Todo**: Genera un archivo CSV con todas las operaciones según el formato seleccionado
- **Descargar CALLS/PUTS**: Archivos separados por tipo de opción (solo en formato EPGB)
- **Copiar al Portapapeles**: Copia los datos formateados para Excel según el formato seleccionado

### 5. Gestión de Configuración

- **Restaurar por defecto**: Vuelve a la configuración inicial con símbolos y vencimientos estándar
- **Guardar configuración**: Los cambios se guardan automáticamente, pero puedes forzar el guardado
- **Persistencia**: La configuración se mantiene entre sesiones del navegador

### 6. Gestión de Datos

- **Datos Guardados**: Muestra información sobre la última sesión procesada
- **Limpiar Datos**: Elimina todos los datos procesados del almacenamiento

## Formato del Archivo CSV

El archivo CSV debe contener las siguientes columnas:

- `event_subtype`: Debe ser "execution_report"
- `ord_status`: Debe ser "Ejecutada" o "Parcialmente ejecutada"
- `text`: No debe ser "Order Updated"
- `order_id`: Identificador único de la orden
- `symbol`: Símbolo de la opción (ej: "GFGC53566O")
- `side`: "BUY" o "SELL"
- `last_price`: Precio de ejecución
- `last_qty`: Cantidad ejecutada

## Persistencia de Datos

- Los datos procesados se guardan automáticamente en `chrome.storage.local`
- La configuración (símbolo, vencimiento, modo) se persiste entre sesiones
- Los datos permanecen disponibles hasta que se cargue un nuevo archivo o se limpien manualmente
- No se requiere conexión a internet para el funcionamiento

## Símbolos Soportados

- GFG
- YPF
- COM
- PAM
- TEN
- REP
- TGNO4
- ALUA
- BYMA
- MIRG

## Vencimientos Soportados

- ENE (Enero)
- FEB (Febrero)
- MAR (Marzo)
- ABR (Abril)
- MAY (Mayo)
- JUN (Junio)
- JUL (Julio)
- AGO (Agosto)
- SEP (Septiembre)
- OCT (Octubre)
- NOV (Noviembre)
- DIC (Diciembre)

## Características Principales

Esta extensión simplificada incluye:

- ✅ **Sin autenticación**: Acceso directo a la funcionalidad
- ✅ **Procesamiento especializado**: Enfocada únicamente en el procesador de operaciones
- ✅ **Persistencia local**: Usa chrome.storage para mantener datos entre sesiones
- ✅ **Interfaz simplificada**: Solo las funciones esenciales del procesador
- ✅ **Configuración dinámica**: Personaliza símbolos y vencimientos según necesidades
- ✅ **Exportación múltiple**: Descarga archivos CSV o copia datos al portapapeles
- ✅ **Formatos de exportación**: Soporte para formato EPGB y formato DeltaVega

## Desarrollo

### Estructura de Archivos

```
procesador-opciones/
├── manifest.json          # Configuración de la extensión
├── popup.html            # Interfaz principal
├── popup.js              # Lógica del popup
├── operations-processor.js # Procesador de operaciones
├── icon16.png            # Icono 16x16
├── icon48.png            # Icono 48x48
├── icon128.png           # Icono 128x128
└── README.md             # Este archivo
```

### Tecnologías Utilizadas

- **Manifest V3**: Última versión del sistema de extensiones de Chrome
- **Chrome Storage API**: Para persistencia de datos
- **Vanilla JavaScript**: Sin dependencias externas
- **CSS Grid/Flexbox**: Para el diseño responsive

## Solución de Problemas

### El archivo CSV no se procesa

- Verifica que el archivo tenga el formato correcto
- Asegúrate de que las columnas requeridas estén presentes
- Comprueba que el símbolo y vencimiento seleccionados coincidan con los datos

### Los datos no se guardan

- Verifica que la extensión tenga permisos de almacenamiento
- Revisa la consola del navegador para errores
- Intenta recargar la extensión

### Error al exportar archivos

- Verifica que el navegador permita descargas
- Comprueba que hay datos procesados disponibles
- Intenta limpiar los datos y procesar nuevamente

## Licencia

Este proyecto es de código abierto y está disponible para el procesamiento de operaciones financieras de opciones.
