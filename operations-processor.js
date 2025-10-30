/**
 * Procesador de Operaciones Financieras
 * Versión simplificada con persistencia en chrome.storage
 */

class OperationsProcessor {
  constructor() {
    this.originalData = [];
    this.processedData = [];
    this.callsData = [];
    this.putsData = [];
    this.accionesData = [];
    this.useAveraging = false;
    this.activeSymbol = "GFG";
    this.expiration = "OCT";
    this.lastProcessedFile = null;
    this.lastProcessedTime = null;

    // Configuración dinámica
    this.availableSymbols = [];
    this.availableExpirations = {};
    this.symbolSubyacentes = {}; // Mapeo de símbolos a sus subyacentes
  }

  /**
   * Extrae el strike desde un ticker genérico [EMPRESA][TIPO][STRIKE][VENCIMIENTO]
   * @param {string} ticker - Ej: GFGC10200D, PAMPC7400DI, YPFC67131D
   * @returns {number|null} Strike como número o null si no matchea
   */
  extractStrikePrice(ticker) {
    if (typeof ticker !== "string" || ticker.length < 6) return null;

    // 1) Intentar vencimiento de 2 letras
    let match = ticker.match(/^([A-Z]+?)(\d+)([A-Z]{2})$/);
    if (match) {
      const digits = match[2];
      // Por requerimiento: con 2 letras se esperan strikes redondos
      return parseFloat(digits + ".00");
    }

    // 2) Intentar vencimiento de 1 letra
    match = ticker.match(/^([A-Z]+?)(\d+)([A-Z])$/);
    if (match) {
      const digits = match[2];
      if (digits.endsWith("00")) {
        return parseFloat(digits + ".00");
      }
      if (digits.length === 5) {
        return parseFloat(digits.substring(0, 4) + "." + digits.substring(4));
      }
      if (digits.length === 4) {
        return parseFloat(digits.substring(0, 2) + "." + digits.substring(2));
      }
      return parseFloat(digits);
    }

    return null;
  }
  /**
   * Carga la configuración desde chrome.storage
   */
  async loadConfig() {
    try {
      const result = await chrome.storage.local.get([
        "activeSymbol",
        "expiration",
        "useAveraging",
        "lastProcessedFile",
        "lastProcessedTime",
        "callsData",
        "putsData",
        "accionesData",
        "processedData",
        "availableSymbols",
        "availableExpirations",
        "symbolSubyacentes",
      ]);

      this.activeSymbol = result.activeSymbol || "GFG";
      this.expiration = result.expiration || "OCT";
      this.useAveraging = result.useAveraging || false;
      this.lastProcessedFile = result.lastProcessedFile || null;
      this.lastProcessedTime = result.lastProcessedTime || null;

      // Cargar datos procesados
      this.callsData = result.callsData || [];
      this.putsData = result.putsData || [];
      this.accionesData = result.accionesData || [];
      this.processedData = result.processedData || [];

      // Cargar configuración dinámica
      this.availableSymbols =
        result.availableSymbols || this.getDefaultSymbols();
      this.availableExpirations =
        result.availableExpirations || this.getDefaultExpirations();
      this.symbolSubyacentes =
        result.symbolSubyacentes || this.getDefaultSubyacentes();
    } catch (error) {
      console.error("Error cargando configuración:", error);
    }
  }

  /**
   * Guarda la configuración en chrome.storage
   */
  async saveConfig() {
    try {
      await chrome.storage.local.set({
        activeSymbol: this.activeSymbol,
        expiration: this.expiration,
        useAveraging: this.useAveraging,
        lastProcessedFile: this.lastProcessedFile,
        lastProcessedTime: this.lastProcessedTime,
        callsData: this.callsData,
        putsData: this.putsData,
        accionesData: this.accionesData,
        processedData: this.processedData,
        availableSymbols: this.availableSymbols,
        availableExpirations: this.availableExpirations,
        symbolSubyacentes: this.symbolSubyacentes,
      });
    } catch (error) {
      console.error("Error guardando configuración:", error);
    }
  }

  /**
   * Procesa un archivo CSV con datos de operaciones
   * @param {string} csvText - Contenido del archivo CSV
   * @param {boolean} useAveraging - Si usar promedios por strike o no
   * @param {string} activeSymbol - Símbolo del activo (GFG, YPF, COM, etc.)
   * @param {string} expiration - Letra de vencimiento (A, B, C, D, E, F, G, H, I, O, N, Z)
   * @returns {Object} Resultado del procesamiento
   */
  async processCsvData(
    csvText,
    useAveraging = false,
    activeSymbol = "GFG",
    expiration = "OCT"
  ) {
    try {
      // Configurar modo de procesamiento, símbolo activo y vencimiento
      this.useAveraging = useAveraging;
      this.activeSymbol = activeSymbol.toUpperCase();
      this.expiration = expiration.toUpperCase();

      // Parsear CSV
      this.originalData = this.parseCSV(csvText);

      // PRIMERO: Filtrar ejecuciones reales (fills) y excluir updates
      let filteredData = this.filterExecutionReports(this.originalData);

      // SEGUNDO: Consolidar por order_id + symbol
      let consolidatedData = this.consolidateOperations(filteredData);

      // Procesar símbolos y clasificar opciones
      this.processedData = this.processSymbolsAndClassify(consolidatedData);

      if (this.processedData.length === 0) {
        throw new Error(
          "No se encontraron opciones para el vencimiento seleccionado"
        );
      }

      // Separar CALLS, PUTS y ACCIONES
      this.callsData = this.processedData.filter((op) => op.F === "CALL");
      this.putsData = this.processedData.filter((op) => op.F === "PUT");
      this.accionesData = this.processedData.filter((op) => op.F === "ACCION");

      // Guardar cantidades originales antes de aplicar promedios
      const originalCallsCount = this.callsData.length;
      const originalPutsCount = this.putsData.length;

      // Procesar según el modo seleccionado
      if (this.useAveraging) {
        this.callsData = this.processAveraging(this.callsData);
        this.putsData = this.processAveraging(this.putsData);
        this.accionesData = this.processAveragingAcciones(this.accionesData);
      } else {
        // Limpiar datos finales (remover columna F)
        this.callsData = this.callsData.map((op) => ({
          cantidad: op.cantidad,
          base: op.base,
          precio: op.precio,
        }));

        this.putsData = this.putsData.map((op) => ({
          cantidad: op.cantidad,
          base: op.base,
          precio: op.precio,
        }));

        this.accionesData = this.accionesData.map((op) => ({
          cantidad: op.cantidad,
          simbolo: op.simbolo,
          precio: op.precio,
        }));
      }

      // Sanitizar y remover operaciones inválidas o neutras (cantidad 0 o precio inválido)
      this.callsData = this.sanitizeOperations(this.callsData);
      this.putsData = this.sanitizeOperations(this.putsData);
      this.accionesData = this.sanitizeOperationsAcciones(this.accionesData);

      // Guardar datos procesados y metadatos
      this.lastProcessedFile = new Date().toISOString();
      this.lastProcessedTime = new Date().toISOString();
      await this.saveConfig();

      return {
        success: true,
        totalOperations: this.processedData.length,
        callsCount: this.callsData.length,
        putsCount: this.putsData.length,
        accionesCount: this.accionesData.length,
        originalCallsCount: originalCallsCount,
        originalPutsCount: originalPutsCount,
        callsData: this.callsData,
        putsData: this.putsData,
        accionesData: this.accionesData,
        lastProcessedTime: this.lastProcessedTime,
        symbol: this.activeSymbol,
        expiration: this.expiration,
        useAveraging: this.useAveraging,
      };
    } catch (error) {
      console.error("Error procesando datos:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Parsea un string CSV y retorna array de objetos
   * @param {string} csvText - Contenido CSV
   * @returns {Array} Array de objetos con los datos
   */
  parseCSV(csvText) {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

    return lines.slice(1).map((line) => {
      const values = this.parseCSVLine(line);
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      return row;
    });
  }

  /**
   * Parsea una línea CSV manejando comillas y comas dentro de campos
   * @param {string} line - Línea CSV
   * @returns {Array} Array de valores
   */
  parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Filtra execution reports y excluye updates
   * @param {Array} data - Datos originales
   * @returns {Array} Datos filtrados
   */
  filterExecutionReports(data) {
    return data.filter((row) => {
      return (
        row.event_subtype === "execution_report" &&
        ["Ejecutada", "Parcialmente ejecutada"].includes(row.ord_status) &&
        row.text !== "Order Updated"
      );
    });
  }

  /**
   * Consolida operaciones por order_id + symbol y calcula VWAP
   * @param {Array} data - Datos filtrados
   * @returns {Array} Datos consolidados
   */
  consolidateOperations(data) {
    const grouped = {};

    // Agrupar por order_id + symbol
    data.forEach((row) => {
      const key = `${row.order_id}_${row.symbol}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(row);
    });

    // Consolidar cada grupo
    return Object.values(grouped).map((group) => {
      const cantidadTotal = group.reduce(
        (sum, row) => sum + parseFloat(row.last_qty || 0),
        0
      );

      // Calcular VWAP (Volume Weighted Average Price)
      let vwap;
      if (cantidadTotal !== 0) {
        const weightedSum = group.reduce((sum, row) => {
          return (
            sum +
            parseFloat(row.last_price || 0) * parseFloat(row.last_qty || 0)
          );
        }, 0);
        vwap = weightedSum / cantidadTotal;
      } else {
        vwap = parseFloat(group[group.length - 1].last_price || 0);
      }

      // Determinar status final
      const ordStatusFinal = group.some((row) => row.ord_status === "Ejecutada")
        ? "Ejecutada"
        : "Parcialmente ejecutada";

      return {
        symbol: group[0].symbol,
        side: group[0].side,
        ord_status: ordStatusFinal,
        last_price: vwap,
        last_qty: cantidadTotal,
      };
    });
  }

  /**
   * Procesa símbolos, extrae información relevante y clasifica opciones
   * @param {Array} data - Datos consolidados
   * @returns {Array} Datos procesados
   */
  processSymbolsAndClassify(data) {
    const processed = [];

    data.forEach((row) => {
      // Determinar si es PUT, CALL o ACCION
      const putCallAccion = this.determinePutCallAccion(row.symbol);
      if (!putCallAccion) return;

      // Calcular cantidad (negativo para ventas)
      const cantidad =
        row.side === "BUY"
          ? parseFloat(row.last_qty)
          : -parseFloat(row.last_qty);

      const precio = parseFloat(row.last_price);

      // Descartar operaciones con cantidad 0 o precio inválido
      if (cantidad === 0 || !isFinite(precio) || isNaN(precio)) {
        return;
      }

      if (putCallAccion === "ACCION") {
        // Para acciones, extraer el símbolo del formato MERV - XMEV - GGAL - 24hs
        const parts = row.symbol.split(" - ");
        if (parts.length >= 3) {
          const simboloAccion = parts[2]; // GGAL
          processed.push({
            cantidad: cantidad,
            simbolo: simboloAccion,
            precio: precio,
            F: "ACCION",
          });
        }
      } else {
        // Para opciones, extraer y modificar símbolo
        const modifiedSymbol = this.extractAndModifySymbol(row.symbol);
        if (modifiedSymbol === null) return;

        // Descartar operaciones con base inválida
        if (!isFinite(modifiedSymbol) || modifiedSymbol === 0) {
          return;
        }

        processed.push({
          cantidad: cantidad,
          base: modifiedSymbol,
          precio: precio,
          F: putCallAccion,
        });
      }
    });

    return processed;
  }

  /**
   * Determina si un símbolo es PUT, CALL o ACCION
   * @param {string} symbol - Símbolo original
   * @returns {string} 'PUT', 'CALL', 'ACCION' o ''
   */
  determinePutCallAccion(symbol) {
    const putPattern = `${this.activeSymbol}V`; // Ej: GFGV, YPFV, COMV
    const callPattern = `${this.activeSymbol}C`; // Ej: GFGC, YPFC, COMC
    const subyacente = this.getSubyacenteForSymbol(this.activeSymbol);

    // Primero verificar si es una opción (PUT o CALL)
    if (symbol.includes(putPattern)) {
      return "PUT";
    } else if (symbol.includes(callPattern)) {
      return "CALL";
    }

    // Si no es opción, verificar si es acción del subyacente
    // Las acciones tienen formato: MERV - XMEV - GGAL - 24hs
    if (subyacente && symbol.includes(` - ${subyacente} - `)) {
      return "ACCION";
    }

    return "";
  }

  /**
   * Extrae la parte relevante del símbolo para el vencimiento seleccionado
   * @param {string} symbol - Símbolo original
   * @returns {number|null} Valor del strike o null si no es válido
   */
  extractAndModifySymbol(symbol) {
    const parts = symbol.split(" - ");
    if (parts.length < 3) {
      return null;
    }

    let relevantPart = parts[2];

    // Verificar terminaciones del vencimiento seleccionado usando configuración dinámica
    const expirationConfig = this.availableExpirations[this.expiration];
    const suffixes = expirationConfig ? expirationConfig.suffixes : [];

    if (!suffixes.some((s) => relevantPart.endsWith(s))) {
      return null;
    }

    // Remover prefijos del activo (ej: GFGV, GFGC, YPFV, YPFC, etc.)
    const putPattern = `${this.activeSymbol}V`;
    const callPattern = `${this.activeSymbol}C`;

    if (relevantPart.startsWith(putPattern)) {
      relevantPart = relevantPart.substring(putPattern.length);
    } else if (relevantPart.startsWith(callPattern)) {
      relevantPart = relevantPart.substring(callPattern.length);
    }

    // Eliminar terminaciones del vencimiento (probar sufijos más largos primero)
    const sortedSuffixes = [...suffixes].sort((a, b) => b.length - a.length);
    for (const s of sortedSuffixes) {
      if (relevantPart.endsWith(s)) {
        relevantPart = relevantPart.slice(0, -s.length);
        break;
      }
    }

    try {
      // Aplicar reglas de strike: 4 o 5 dígitos
      const digits = relevantPart.replace(/[^0-9]/g, "");
      if (!digits) return null;

      if (digits.endsWith("00")) {
        // Strikes redondos: todo el entero + .00
        return parseFloat(digits + ".00");
      }

      if (digits.length === 5) {
        // Insertar punto antes del último dígito
        return parseFloat(digits.substring(0, 4) + "." + digits.substring(4));
      }

      if (digits.length === 4) {
        // Insertar punto antes de los últimos 2 dígitos
        return parseFloat(digits.substring(0, 2) + "." + digits.substring(2));
      }

      // Si no coincide con 4 o 5 dígitos, intentar parsear directo
      return parseFloat(digits);
    } catch (error) {
      return null;
    }
  }

  /**
   * Procesa operaciones aplicando promedios por strike separando compras y ventas
   * @param {Array} operations - Array de operaciones sin procesar
   * @returns {Array} Array de operaciones procesadas con promedios
   */
  processAveraging(operations) {
    if (!operations || operations.length === 0) {
      return [];
    }

    // Agrupar por strike (base)
    const strikeGroups = {};

    operations.forEach((op) => {
      // Ignorar entradas inválidas desde el inicio
      if (
        !op ||
        op.cantidad === 0 ||
        !isFinite(op.base) ||
        op.base === 0 ||
        !isFinite(op.precio) ||
        isNaN(op.precio)
      ) {
        return;
      }
      const strike = op.base;
      if (!strikeGroups[strike]) {
        strikeGroups[strike] = {
          compras: [],
          ventas: [],
        };
      }

      if (op.cantidad > 0) {
        strikeGroups[strike].compras.push(op);
      } else {
        strikeGroups[strike].ventas.push(op);
      }
    });

    const processedOperations = [];

    // Procesar cada strike
    Object.keys(strikeGroups).forEach((strike) => {
      const group = strikeGroups[strike];

      // Procesar ventas (cantidades negativas)
      if (group.ventas.length > 0) {
        const totalCantidadVentas = group.ventas.reduce(
          (sum, op) => sum + Math.abs(op.cantidad),
          0
        );
        if (totalCantidadVentas > 0) {
          const precioPromedioVentas =
            group.ventas.reduce((sum, op) => {
              return sum + op.precio * Math.abs(op.cantidad);
            }, 0) / totalCantidadVentas;

          if (isFinite(precioPromedioVentas)) {
            processedOperations.push({
              cantidad: -totalCantidadVentas, // Negativo para ventas
              base: parseFloat(strike),
              precio: Math.round(precioPromedioVentas * 10000) / 10000,
            });
          }
        }
      }

      // Procesar compras (cantidades positivas)
      if (group.compras.length > 0) {
        const totalCantidadCompras = group.compras.reduce(
          (sum, op) => sum + op.cantidad,
          0
        );
        if (totalCantidadCompras > 0) {
          const precioPromedioCompras =
            group.compras.reduce((sum, op) => {
              return sum + op.precio * op.cantidad;
            }, 0) / totalCantidadCompras;

          if (isFinite(precioPromedioCompras)) {
            processedOperations.push({
              cantidad: totalCantidadCompras,
              base: parseFloat(strike),
              precio: Math.round(precioPromedioCompras * 10000) / 10000,
            });
          }
        }
      }
    });

    // Ordenar por strike (base) y luego por cantidad (ventas primero, compras después)
    return processedOperations.sort((a, b) => {
      if (a.base === b.base) {
        return a.cantidad - b.cantidad; // Ventas (negativas) primero
      }
      return a.base - b.base; // Por strike ascendente
    });
  }

  /**
   * Procesa operaciones de acciones aplicando promedios por símbolo separando compras y ventas
   * @param {Array} operations - Array de operaciones de acciones sin procesar
   * @returns {Array} Array de operaciones procesadas con promedios
   */
  processAveragingAcciones(operations) {
    if (!operations || operations.length === 0) {
      return [];
    }

    // Agrupar por símbolo
    const symbolGroups = {};

    operations.forEach((op) => {
      // Ignorar entradas inválidas desde el inicio
      if (
        !op ||
        op.cantidad === 0 ||
        !op.simbolo ||
        !isFinite(op.precio) ||
        isNaN(op.precio)
      ) {
        return;
      }
      const simbolo = op.simbolo;
      if (!symbolGroups[simbolo]) {
        symbolGroups[simbolo] = {
          compras: [],
          ventas: [],
        };
      }

      if (op.cantidad > 0) {
        symbolGroups[simbolo].compras.push(op);
      } else {
        symbolGroups[simbolo].ventas.push(op);
      }
    });

    const processedOperations = [];

    // Procesar cada símbolo
    Object.keys(symbolGroups).forEach((simbolo) => {
      const group = symbolGroups[simbolo];

      // Procesar ventas (cantidades negativas)
      if (group.ventas.length > 0) {
        const totalCantidadVentas = group.ventas.reduce(
          (sum, op) => sum + Math.abs(op.cantidad),
          0
        );
        if (totalCantidadVentas > 0) {
          const precioPromedioVentas =
            group.ventas.reduce((sum, op) => {
              return sum + op.precio * Math.abs(op.cantidad);
            }, 0) / totalCantidadVentas;

          if (isFinite(precioPromedioVentas)) {
            processedOperations.push({
              cantidad: -totalCantidadVentas, // Negativo para ventas
              simbolo: simbolo,
              precio: Math.round(precioPromedioVentas * 10000) / 10000,
            });
          }
        }
      }

      // Procesar compras (cantidades positivas)
      if (group.compras.length > 0) {
        const totalCantidadCompras = group.compras.reduce(
          (sum, op) => sum + op.cantidad,
          0
        );
        if (totalCantidadCompras > 0) {
          const precioPromedioCompras =
            group.compras.reduce((sum, op) => {
              return sum + op.precio * op.cantidad;
            }, 0) / totalCantidadCompras;

          if (isFinite(precioPromedioCompras)) {
            processedOperations.push({
              cantidad: totalCantidadCompras,
              simbolo: simbolo,
              precio: Math.round(precioPromedioCompras * 10000) / 10000,
            });
          }
        }
      }
    });

    // Ordenar por símbolo y luego por cantidad (ventas primero, compras después)
    return processedOperations.sort((a, b) => {
      if (a.simbolo === b.simbolo) {
        return a.cantidad - b.cantidad; // Ventas (negativas) primero
      }
      return a.simbolo.localeCompare(b.simbolo); // Por símbolo alfabético
    });
  }

  /**
   * Sanitiza operaciones: remueve inválidas y normaliza números
   * @param {Array} operations
   * @returns {Array}
   */
  sanitizeOperations(operations) {
    if (!Array.isArray(operations)) return [];
    return operations
      .filter((op) => {
        return (
          op &&
          typeof op.cantidad === "number" &&
          op.cantidad !== 0 &&
          typeof op.base === "number" &&
          isFinite(op.base) &&
          op.base !== 0 &&
          typeof op.precio === "number" &&
          isFinite(op.precio) &&
          !isNaN(op.precio)
        );
      })
      .map((op) => ({
        cantidad: op.cantidad,
        base: Math.round(op.base * 10000) / 10000,
        precio: Math.round(op.precio * 10000) / 10000,
      }));
  }

  /**
   * Sanitiza operaciones de acciones: remueve inválidas y normaliza números
   * @param {Array} operations
   * @returns {Array}
   */
  sanitizeOperationsAcciones(operations) {
    if (!Array.isArray(operations)) return [];
    return operations
      .filter((op) => {
        return (
          op &&
          typeof op.cantidad === "number" &&
          op.cantidad !== 0 &&
          typeof op.simbolo === "string" &&
          op.simbolo &&
          typeof op.precio === "number" &&
          isFinite(op.precio) &&
          !isNaN(op.precio)
        );
      })
      .map((op) => ({
        cantidad: op.cantidad,
        simbolo: op.simbolo,
        precio: Math.round(op.precio * 10000) / 10000,
      }));
  }

  /**
   * Genera un reporte visual para mostrar en el popup
   * @returns {Object} Objeto con el reporte visual
   */
  generateVisualReport() {
    if (!this.callsData || !this.putsData || !this.accionesData) {
      return { error: "No hay datos procesados" };
    }

    const totalCalls = this.callsData.length;
    const totalPuts = this.putsData.length;
    const totalAcciones = this.accionesData.length;
    const totalOperations = totalCalls + totalPuts + totalAcciones;

    // Calcular estadísticas
    const callsStats = this.calculateStats(this.callsData);
    const putsStats = this.calculateStats(this.putsData);
    const accionesStats = this.calculateStatsAcciones(this.accionesData);

    return {
      resumen: {
        totalOperaciones: totalOperations,
        totalCalls: totalCalls,
        totalPuts: totalPuts,
        totalAcciones: totalAcciones,
        modoPromedio: this.useAveraging,
        simboloActivo: this.activeSymbol,
        vencimiento: this.expiration,
        ultimaProcesada: this.lastProcessedTime,
      },
      calls: {
        count: totalCalls,
        stats: callsStats,
        operations: this.callsData.slice(0, 5), // Mostrar solo las primeras 5
      },
      puts: {
        count: totalPuts,
        stats: putsStats,
        operations: this.putsData.slice(0, 5), // Mostrar solo las primeras 5
      },
      acciones: {
        count: totalAcciones,
        stats: accionesStats,
        operations: this.accionesData.slice(0, 5), // Mostrar solo las primeras 5
      },
    };
  }

  /**
   * Calcula estadísticas básicas de un conjunto de operaciones
   * @param {Array} operations - Array de operaciones
   * @returns {Object} Estadísticas calculadas
   */
  calculateStats(operations) {
    if (operations.length === 0) {
      return { cantidadTotal: 0, precioPromedio: 0, valorTotal: 0 };
    }

    const cantidadTotal = operations.reduce((sum, op) => sum + op.cantidad, 0);
    const valorTotal = operations.reduce(
      (sum, op) => sum + op.cantidad * op.precio,
      0
    );
    const precioPromedio =
      operations.reduce((sum, op) => sum + op.precio, 0) / operations.length;

    return {
      cantidadTotal: Math.round(cantidadTotal * 100) / 100,
      precioPromedio: Math.round(precioPromedio * 10000) / 10000,
      valorTotal: Math.round(valorTotal * 10000) / 10000,
    };
  }

  /**
   * Calcula estadísticas básicas de un conjunto de operaciones de acciones
   * @param {Array} operations - Array de operaciones de acciones
   * @returns {Object} Estadísticas calculadas
   */
  calculateStatsAcciones(operations) {
    if (!operations || operations.length === 0) {
      return { cantidadTotal: 0, precioPromedio: 0, valorTotal: 0 };
    }

    const cantidadTotal = operations.reduce((sum, op) => sum + op.cantidad, 0);
    const valorTotal = operations.reduce(
      (sum, op) => sum + op.cantidad * op.precio,
      0
    );
    const precioPromedio =
      operations.reduce((sum, op) => sum + op.precio, 0) / operations.length;

    return {
      cantidadTotal: Math.round(cantidadTotal * 100) / 100,
      precioPromedio: Math.round(precioPromedio * 10000) / 10000,
      valorTotal: Math.round(valorTotal * 10000) / 10000,
    };
  }

  /**
   * Genera datos para copiar al portapapeles (formato para pegar en Excel)
   * @param {string} type - 'calls', 'puts' o 'all'
   * @returns {string} Texto formateado para Excel
   */
  generateCopyData(type = "all") {
    let data = [];

    if (type === "all") {
      // Para "todo" incluir encabezados y información
      const modeText = this.useAveraging
        ? " (CON PROMEDIOS)"
        : " (SIN PROMEDIOS)";

      if (this.callsData.length > 0) {
        data.push(`OPERACIONES CALLS${modeText}`);
        data.push("Cantidad\tBase\tPrecio");
        this.callsData.forEach((op) => {
          const cantidad = op.cantidad.toString().replace(".", ",");
          const base = op.base.toString().replace(".", ",");
          const precio = Number(op.precio).toFixed(4).replace(".", ",");
          data.push(`${cantidad}\t${base}\t${precio}`);
        });
        data.push("");
      }

      if (this.putsData.length > 0) {
        data.push(`OPERACIONES PUTS${modeText}`);
        data.push("Cantidad\tBase\tPrecio");
        this.putsData.forEach((op) => {
          const cantidad = op.cantidad.toString().replace(".", ",");
          const base = op.base.toString().replace(".", ",");
          const precio = op.precio.toString().replace(".", ",");
          data.push(`${cantidad}\t${base}\t${precio}`);
        });
        data.push("");
      }

      if (this.accionesData.length > 0) {
        data.push(`OPERACIONES ACCIONES${modeText}`);
        data.push("Símbolo\tCantidad\tPrecio");
        this.accionesData.forEach((op) => {
          const cantidad = op.cantidad.toString().replace(".", ",");
          const precio = Number(op.precio).toFixed(4).replace(".", ",");
          data.push(`${op.simbolo}\t${cantidad}\t${precio}`);
        });
      }
    } else if (type === "calls") {
      // Para "calls" solo los datos, sin encabezados
      this.callsData.forEach((op) => {
        const cantidad = op.cantidad.toString().replace(".", ",");
        const base = op.base.toString().replace(".", ",");
        const precio = Number(op.precio).toFixed(4).replace(".", ",");
        data.push(`${cantidad}\t${base}\t${precio}`);
      });
    } else if (type === "puts") {
      // Para "puts" solo los datos, sin encabezados
      this.putsData.forEach((op) => {
        const cantidad = op.cantidad.toString().replace(".", ",");
        const base = op.base.toString().replace(".", ",");
        const precio = Number(op.precio).toFixed(4).replace(".", ",");
        data.push(`${cantidad}\t${base}\t${precio}`);
      });
    } else if (type === "acciones") {
      // Para "acciones" solo los datos, sin encabezados
      this.accionesData.forEach((op) => {
        const cantidad = op.cantidad.toString().replace(".", ",");
        const precio = Number(op.precio).toFixed(4).replace(".", ",");
        data.push(`${cantidad}\t${precio}`);
      });
    }

    return data.join("\n");
  }

  /**
   * Genera y descarga un archivo Excel
   * @returns {Promise} Promise que resuelve cuando se completa la descarga
   */
  async generateExcelFile() {
    // Nota: Esta función requerirá la librería XLSX (SheetJS)
    // Por ahora, generamos un CSV que se puede abrir en Excel

    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const modePrefix = this.useAveraging ? "Promediadas_" : "";
    const filename = `Operaciones_${modePrefix}${this.activeSymbol}_${fecha}.csv`;

    let csvContent = "";
    const modeText = this.useAveraging
      ? " (CON PROMEDIOS)"
      : " (SIN PROMEDIOS)";

    // Hoja CALLS
    csvContent += `OPERACIONES CALLS${modeText}\n`;
    csvContent += "Cantidad;Base;Precio\n"; // Usar punto y coma como separador para formato europeo
    this.callsData.forEach((op) => {
      // Formatear números con coma decimal
      const cantidad = op.cantidad.toString().replace(".", ",");
      const base = op.base.toString().replace(".", ",");
      const precio = Number(op.precio).toFixed(4).replace(".", ",");
      csvContent += `${cantidad};${base};${precio}\n`;
    });

    csvContent += "\n";

    // Hoja PUTS
    csvContent += `OPERACIONES PUTS${modeText}\n`;
    csvContent += "Cantidad;Base;Precio\n"; // Usar punto y coma como separador para formato europeo
    this.putsData.forEach((op) => {
      // Formatear números con coma decimal
      const cantidad = op.cantidad.toString().replace(".", ",");
      const base = op.base.toString().replace(".", ",");
      const precio = Number(op.precio).toFixed(4).replace(".", ",");
      csvContent += `${cantidad};${base};${precio}\n`;
    });

    csvContent += "\n";

    // Hoja ACCIONES
    csvContent += `OPERACIONES ACCIONES${modeText}\n`;
    csvContent += "Símbolo;Cantidad;Precio\n";
    this.accionesData.forEach((op) => {
      const cantidad = op.cantidad.toString().replace(".", ",");
      const precio = Number(op.precio).toFixed(4).replace(".", ",");
      csvContent += `${op.simbolo};${cantidad};${precio}\n`;
    });

    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: "text/csv;charset-utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return filename;
  }

  /**
   * Genera y descarga un archivo CSV solo para CALLS
   * @returns {Promise} Promise que resuelve cuando se completa la descarga
   */
  async generateCallsFile() {
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const modePrefix = this.useAveraging ? "Promediadas_" : "";
    const filename = `CALLS_${modePrefix}${this.activeSymbol}_${fecha}.csv`;

    let csvContent = "";
    const modeText = this.useAveraging
      ? " (CON PROMEDIOS)"
      : " (SIN PROMEDIOS)";

    csvContent += `OPERACIONES CALLS${modeText}\n`;
    csvContent += "Cantidad;Base;Precio\n";
    this.callsData.forEach((op) => {
      const cantidad = op.cantidad.toString().replace(".", ",");
      const base = op.base.toString().replace(".", ",");
      const precio = Number(op.precio).toFixed(4).replace(".", ",");
      csvContent += `${cantidad};${base};${precio}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset-utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return filename;
  }

  /**
   * Genera y descarga un archivo CSV solo para PUTS
   * @returns {Promise} Promise que resuelve cuando se completa la descarga
   */
  async generatePutsFile() {
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const modePrefix = this.useAveraging ? "Promediadas_" : "";
    const filename = `PUTS_${modePrefix}${this.activeSymbol}_${fecha}.csv`;

    let csvContent = "";
    const modeText = this.useAveraging
      ? " (CON PROMEDIOS)"
      : " (SIN PROMEDIOS)";

    csvContent += `OPERACIONES PUTS${modeText}\n`;
    csvContent += "Cantidad;Base;Precio\n";
    this.putsData.forEach((op) => {
      const cantidad = op.cantidad.toString().replace(".", ",");
      const base = op.base.toString().replace(".", ",");
      const precio = op.precio.toString().replace(".", ",");
      csvContent += `${cantidad};${base};${precio}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset-utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return filename;
  }

  /**
   * Obtiene la lista de símbolos de activos disponibles
   * @returns {Array} Array de símbolos disponibles
   */
  getAvailableSymbols() {
    return this.availableSymbols;
  }

  /**
   * Obtiene la configuración de vencimientos disponibles
   * @returns {Object} Objeto con configuración de vencimientos
   */
  getAvailableExpirations() {
    return this.availableExpirations;
  }

  /**
   * Obtiene la configuración por defecto de símbolos
   * @returns {Array} Array de símbolos por defecto
   */
  getDefaultSymbols() {
    return [
      "GFG",
      "YPF",
      "COM",
      "PAM",
      "TEN",
      "REP",
      "TGNO4",
      "ALUA",
      "BYMA",
      "MIRG",
    ];
  }

  /**
   * Obtiene la configuración por defecto de vencimientos
   * @returns {Object} Objeto con configuración por defecto de vencimientos
   */
  getDefaultExpirations() {
    return {
      ENE: { name: "Enero", suffixes: ["E"] },
      FEB: { name: "Febrero", suffixes: ["F", "FE"] },
      MAR: { name: "Marzo", suffixes: ["M"] },
      ABR: { name: "Abril", suffixes: ["A", "AB"] },
      MAY: { name: "Mayo", suffixes: ["Y"] },
      JUN: { name: "Junio", suffixes: ["J", "JU"] },
      JUL: { name: "Julio", suffixes: ["L"] },
      AGO: { name: "Agosto", suffixes: ["A", "AG"] },
      SEP: { name: "Septiembre", suffixes: ["S"] },
      OCT: { name: "Octubre", suffixes: ["O", "OC"] },
      NOV: { name: "Noviembre", suffixes: ["N"] },
      DIC: { name: "Diciembre", suffixes: ["D", "DI"] },
    };
  }

  /**
   * Obtiene la configuración por defecto de subyacentes
   * @returns {Object} Objeto con configuración por defecto de subyacentes
   */
  getDefaultSubyacentes() {
    return {
      GFG: "GGAL",
      YPF: "YPFD",
      COM: "COME",
      PAM: "PAMP",
      TEN: "TECO2",
      REP: "REP",
      TGNO4: "TGNO4",
      ALUA: "ALUA",
      BYMA: "BYMA",
      MIRG: "MIRG",
    };
  }

  /**
   * Agrega un nuevo símbolo a la configuración
   * @param {string} symbol - Símbolo a agregar
   * @param {string} subyacente - Símbolo subyacente
   */
  async addSymbol(symbol, subyacente) {
    const trimmedSymbol = symbol.trim().toUpperCase();
    const trimmedSubyacente = subyacente.trim().toUpperCase();
    if (trimmedSymbol && !this.availableSymbols.includes(trimmedSymbol)) {
      this.availableSymbols.push(trimmedSymbol);
      this.symbolSubyacentes[trimmedSymbol] = trimmedSubyacente;
      await this.saveConfig();
    }
  }

  /**
   * Elimina un símbolo de la configuración
   * @param {string} symbol - Símbolo a eliminar
   */
  async removeSymbol(symbol) {
    const index = this.availableSymbols.indexOf(symbol);
    if (index > -1) {
      this.availableSymbols.splice(index, 1);
      // Eliminar también el subyacente
      delete this.symbolSubyacentes[symbol];
      // Si el símbolo eliminado era el activo, cambiar al primero disponible
      if (this.activeSymbol === symbol && this.availableSymbols.length > 0) {
        this.activeSymbol = this.availableSymbols[0];
      }
      await this.saveConfig();
    }
  }

  /**
   * Agrega un nuevo vencimiento a la configuración
   * @param {string} code - Código del vencimiento (ej: ENE)
   * @param {string} name - Nombre del vencimiento (ej: Enero)
   * @param {Array} suffixes - Array de sufijos (ej: ["E", "EN"])
   */
  async addExpiration(code, name, suffixes) {
    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    const trimmedSuffixes = suffixes
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s);

    if (trimmedCode && trimmedName && trimmedSuffixes.length > 0) {
      this.availableExpirations[trimmedCode] = {
        name: trimmedName,
        suffixes: trimmedSuffixes,
      };
      await this.saveConfig();
    }
  }

  /**
   * Elimina un vencimiento de la configuración
   * @param {string} code - Código del vencimiento a eliminar
   */
  async removeExpiration(code) {
    if (this.availableExpirations[code]) {
      delete this.availableExpirations[code];
      // Si el vencimiento eliminado era el activo, cambiar al primero disponible
      if (this.expiration === code) {
        const availableCodes = Object.keys(this.availableExpirations);
        if (availableCodes.length > 0) {
          this.expiration = availableCodes[0];
        }
      }
      await this.saveConfig();
    }
  }

  /**
   * Actualiza un vencimiento existente
   * @param {string} code - Código del vencimiento a actualizar
   * @param {string} name - Nuevo nombre del vencimiento
   * @param {Array} suffixes - Nuevos sufijos
   */
  async updateExpiration(code, name, suffixes) {
    const trimmedName = name.trim();
    const trimmedSuffixes = suffixes
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s);

    if (
      this.availableExpirations[code] &&
      trimmedName &&
      trimmedSuffixes.length > 0
    ) {
      this.availableExpirations[code] = {
        name: trimmedName,
        suffixes: trimmedSuffixes,
      };
      await this.saveConfig();
    }
  }

  /**
   * Restaura la configuración por defecto
   */
  async resetToDefaults() {
    this.availableSymbols = this.getDefaultSymbols();
    this.availableExpirations = this.getDefaultExpirations();
    this.symbolSubyacentes = this.getDefaultSubyacentes();
    this.activeSymbol = "GFG";
    this.expiration = "OCT";
    await this.saveConfig();
  }

  /**
   * Configura el símbolo activo a usar
   * @param {string} symbol - Símbolo del activo
   */
  async setActiveSymbol(symbol) {
    this.activeSymbol = symbol.toUpperCase();
    await this.saveConfig();
  }

  /**
   * Obtiene el símbolo activo actual
   * @returns {string} Símbolo activo
   */
  getActiveSymbol() {
    return this.activeSymbol;
  }

  /**
   * Configura el vencimiento a usar
   * @param {string} expiration - Vencimiento
   */
  async setExpiration(expiration) {
    this.expiration = expiration.toUpperCase();
    await this.saveConfig();
  }

  /**
   * Obtiene el vencimiento actual
   * @returns {string} Vencimiento
   */
  getExpiration() {
    return this.expiration;
  }

  /**
   * Configura el modo de promedios
   * @param {boolean} useAveraging - Si usar promedios
   */
  async setUseAveraging(useAveraging) {
    this.useAveraging = useAveraging;
    await this.saveConfig();
  }

  /**
   * Obtiene el estado del modo de promedios
   * @returns {boolean} Si usa promedios
   */
  getUseAveraging() {
    return this.useAveraging;
  }

  /**
   * Limpia todos los datos procesados
   */
  async clearProcessedData() {
    this.callsData = [];
    this.putsData = [];
    this.accionesData = [];
    this.processedData = [];
    this.lastProcessedFile = null;
    this.lastProcessedTime = null;
    await this.saveConfig();
  }

  /**
   * Verifica si hay datos procesados
   * @returns {boolean} Si hay datos procesados
   */
  hasProcessedData() {
    return (
      this.callsData.length > 0 ||
      this.putsData.length > 0 ||
      this.accionesData.length > 0
    );
  }

  /**
   * Obtiene el subyacente para un símbolo
   * @param {string} symbol - Símbolo del activo
   * @returns {string} Símbolo subyacente
   */
  getSubyacenteForSymbol(symbol) {
    return this.symbolSubyacentes[symbol] || "";
  }

  /**
   * Actualiza el subyacente de un símbolo
   * @param {string} symbol - Símbolo del activo
   * @param {string} subyacente - Nuevo símbolo subyacente
   */
  async updateSymbolSubyacente(symbol, subyacente) {
    const trimmedSubyacente = subyacente.trim().toUpperCase();
    this.symbolSubyacentes[symbol] = trimmedSubyacente;
    await this.saveConfig();
  }

  /**
   * Genera y descarga un archivo CSV solo para ACCIONES
   * @returns {Promise} Promise que resuelve cuando se completa la descarga
   */
  async generateAccionesFile() {
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const modePrefix = this.useAveraging ? "Promediadas_" : "";
    const filename = `ACCIONES_${modePrefix}${this.activeSymbol}_${fecha}.csv`;

    let csvContent = "";
    const modeText = this.useAveraging
      ? " (CON PROMEDIOS)"
      : " (SIN PROMEDIOS)";

    csvContent += `OPERACIONES ACCIONES${modeText}\n`;
    csvContent += "Símbolo;Cantidad;Precio\n";
    this.accionesData.forEach((op) => {
      const cantidad = op.cantidad.toString().replace(".", ",");
      const precio = Number(op.precio).toFixed(4).replace(".", ",");
      csvContent += `${op.simbolo};${cantidad};${precio}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset-utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return filename;
  }
}

// Instancia global del procesador
window.operationsProcessor = new OperationsProcessor();
