# Changelog

Todas las modificaciones notables de este proyecto se documentarán en este archivo.

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
