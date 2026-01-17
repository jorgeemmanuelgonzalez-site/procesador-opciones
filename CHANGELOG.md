# Changelog

Todas las modificaciones notables de este proyecto se documentarán en este archivo.

## [2.0.1] - 2025-01-XX

### Fixes

- **Corrección de agrupamiento de operaciones OMS**: Se corrigió la lógica de agrupamiento de operaciones recibidas desde sistemas OMS. Ahora las operaciones se agrupan por OrderID base (parte antes del guión) + Symbol + Side, en lugar de solo Symbol + Side. Esto permite identificar correctamente operaciones estratégicas que se ejecutan mediante múltiples órdenes individuales, evitando mezclar operaciones independientes del mismo símbolo. El timestamp ahora solo se utiliza para ordenar ejecuciones dentro del mismo grupo, no para separar grupos de operaciones.

### Mejoras técnicas

- Implementación de función auxiliar `getOrderIdBase()` para extraer el identificador base de operación desde el OrderID completo.
- Mejora en la precisión del cálculo de VWAP (Volume Weighted Average Price) al agrupar correctamente todas las ejecuciones de la misma operación estratégica.

## [2.0.0] - 2025-01-XX

### Nuevas funcionalidades

- **Integración con sistemas OMS mediante XOMS**: Se agregó la capacidad de procesar operaciones directamente desde sistemas OMS (Order Management System) sin necesidad de archivos CSV. La extensión se conecta a sistemas OMS a través de una API externa que actúa como intermediario.
- **Presets de brokers/OMS preconfigurados**: Se incluyeron 7 presets preconfigurados para facilitar la conexión: Cocos Capital, Eco Valores, Veta Capital, Bull Market Brokers, Cohen, Adcap y BCCH. Cada preset incluye las URLs de API y WebSocket correspondientes.
- **Nueva pestaña "Procesar con OMS"**: Se agregó una nueva pestaña en la interfaz principal que permite alternar entre procesamiento de archivos CSV y procesamiento mediante OMS.
- **Configuración de credenciales XOMS**: Nueva sección en configuración avanzada para gestionar las credenciales de conexión OMS (API URL, WebSocket URL, Usuario, Contraseña y Cuenta). Las credenciales se almacenan únicamente en el almacenamiento local del navegador.
- **Selector de preset XOMS**: Selector desplegable que permite elegir un broker preconfigurado o configurar conexiones personalizadas manualmente.
- **Procesamiento remoto de operaciones**: Las operaciones se obtienen directamente desde el sistema OMS mediante una consulta única a la API externa, que cierra la sesión inmediatamente después de obtener los datos.

### Mejoras técnicas

- Integración con API externa del procesador de mercado (`api-procesador-mercado.mercadodecapitales.site`) para consultar operaciones OMS.
- Validación de configuración XOMS antes de permitir el procesamiento.
- Conversión automática de datos JSON recibidos de la API OMS al formato CSV interno para procesamiento unificado.
- Interfaz adaptativa que muestra advertencias cuando la configuración OMS está incompleta.
- Persistencia de preferencia de modo de procesamiento (CSV u OMS) en el almacenamiento local.

### Seguridad y privacidad

- **Sin almacenamiento en servidores externos**: Las credenciales XOMS se guardan únicamente en el almacenamiento local del navegador (chrome.storage.local).
- **Sesiones temporales**: La API externa cierra la sesión OMS inmediatamente después de obtener los datos, sin almacenar información en servidores.

## [1.1.0] - 2025-11-09

### Nuevas funcionalidades

- **Formato de exportación DeltaVega**: Se agregó un nuevo formato de exportación llamado "DeltaVega" que genera datos en formato unificado con columnas Type | Quantity | Strike | Price.
- **Selector de formato de exportación**: Ahora se puede seleccionar entre formato EPGB (tradicional) o DeltaVega desde la interfaz de configuración.
- **Exportación unificada DeltaVega**: El formato DeltaVega combina todas las operaciones (CALLS, PUTS y ACCIONES) en un solo formato ordenado por tipo (C, P, S), strike y cantidad.
- **Botones de copia específicos por formato**: Se agregaron botones de copia rápida específicos para cada formato de exportación, mostrándose según el formato seleccionado.

### Mejoras técnicas

- Generación de datos optimizada para formato DeltaVega con ordenamiento automático.
- Interfaz de usuario adaptativa que muestra/oculta botones según el formato de exportación seleccionado.

## [1.0.5] - 2025-11-08

### Fixes

- **Corrección de formateo para strikes mayores a 9mil**: Se corrigió el procesamiento de strikes de 5 dígitos mayores a 10,000 para distinguir correctamente entre strikes redondos (ej: 10577 → 10577.00) y strikes con decimales (ej: 82772 → 8277.2). Se implementó lógica mejorada que evalúa el rango del strike como decimal para determinar si es redondo o tiene decimales.

## [1.0.4] - 2025-10-30

### Fixes

- Corrección de extracción de strike price para tickers de opciones: ahora los strikes de 5 dígitos que terminan en `00` (p. ej. `10200`, `11000`, `10600`, `11400`) se interpretan correctamente como valores redondos (`10200.00`, `11000.00`, etc.). Para strikes con decimales, se inserta el punto según la longitud: en 5 dígitos antes del último dígito y en 4 dígitos antes de los últimos dos. Se agregó la función `extractStrikePrice(ticker)` genérica y una función de pruebas `testStrikePriceExtraction()`.

## [1.0.3] - 2025-01-27

### Nuevas funcionalidades

- **Soporte para activos subyacentes**: Ahora se puede configurar el símbolo subyacente para cada activo de opciones (ej: GFG → GGAL, YPF → YPFD).
- **Nueva sección de acciones**: Se agregó una tercera pestaña "ACCIONES" en la vista previa de datos para visualizar operaciones del activo subyacente.
- **Gestión mejorada de símbolos**: Los símbolos ahora incluyen su correspondiente subyacente, con opciones de edición y eliminación.
- **Funciones de copia y descarga para acciones**: Se pueden copiar y descargar por separado las operaciones de acciones, además de las opciones CALLS y PUTS.

### Mejoras técnicas

- Detección automática de operaciones de acciones basada en el símbolo subyacente configurado.
- Procesamiento separado de opciones y acciones en el mismo archivo CSV.
- Configuración por defecto de subyacentes para los símbolos más comunes del mercado argentino.

## [1.0.2] - 2025-10-08

- Ajuste: precios ahora mantienen 4 decimales en cálculo y visualización.
- Cálculo de promedios y sanitización sin truncar a 2 decimales.

## [1.0.1] - 2025-10-07

- Fix: corrección del error al procesar operaciones con cantidades iguales a 0.

## [1.0.0] - 2025-10-01

- Versión inicial pública del procesador de opciones.
