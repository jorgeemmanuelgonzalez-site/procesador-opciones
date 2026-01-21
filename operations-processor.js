/**
 * Procesador de Operaciones Financieras
 * Versión simplificada con persistencia en chrome.storage
 */

/**
 * Parser para formato Excel Homebroker
 * Convierte el formato Homebroker Excel al formato interno unificado
 */
class HomebrokerExcelParser {
  /**
   * Parsea un archivo Excel Homebroker
   * @param {ArrayBuffer} arrayBuffer - Contenido del archivo Excel como ArrayBuffer
   * @param {string} activeSymbol - Símbolo del activo elegido (ej: GFG, YPF, COM)
   * @returns {Array} Array de operaciones en formato unificado
   */
  parse(arrayBuffer, activeSymbol) {
    // Verificar que XLSX esté disponible
    if (typeof XLSX === "undefined" && typeof window !== "undefined" && typeof window.XLSX === "undefined") {
      throw new Error("SheetJS (XLSX) no está disponible. Por favor, recarga la extensión.");
    }
    
    // Usar XLSX global o window.XLSX
    const xlsxLib = typeof XLSX !== "undefined" ? XLSX : window.XLSX;
    
    // Leer el workbook usando SheetJS
    const workbook = xlsxLib.read(arrayBuffer, { type: "array" });
    
    // Obtener la primera hoja (worksheet)
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Extraer símbolos y operaciones filtrando por activeSymbol
    const symbolsAndOperations = this.extractSymbolsAndOperations(worksheet, xlsxLib, activeSymbol);
    
    // Debug: verificar qué se encontró
    if (!symbolsAndOperations || symbolsAndOperations.length === 0) {
      console.warn("HomebrokerExcelParser: No se encontraron símbolos y operaciones. activeSymbol:", activeSymbol);
      return [];
    }
    
    // Convertir a formato interno unificado
    const unifiedData = this.convertToUnifiedFormat(symbolsAndOperations);
    
    // Debug: verificar conversión
    if (!unifiedData || unifiedData.length === 0) {
      console.warn("HomebrokerExcelParser: No se pudieron convertir operaciones a formato unificado. symbolsAndOperations:", symbolsAndOperations);
    }
    
    return unifiedData;
  }

  /**
   * Extrae símbolos y operaciones del worksheet de Excel
   * @param {Object} worksheet - Worksheet de SheetJS
   * @param {Object} xlsxLib - Librería XLSX a usar
   * @param {string} activeSymbol - Símbolo del activo elegido (ej: GFG, YPF, COM)
   * @returns {Array} Array de objetos { symbol, operations }
   */
  extractSymbolsAndOperations(worksheet, xlsxLib, activeSymbol) {
    // Convertir worksheet a JSON para facilitar el procesamiento
    const jsonData = xlsxLib.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
    
    const result = [];
    let foundHeader = false;
    const MAX_HEADER_SEARCH_ROWS = 20; // Buscar header solo en las primeras 20 filas
    
    // Normalizar activeSymbol
    const normalizedActiveSymbol = (activeSymbol || "").toUpperCase().trim();
    
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      // Buscar cabecera "historico de ordenes" (más flexible, solo en primeras filas)
      if (!foundHeader && i < MAX_HEADER_SEARCH_ROWS) {
        const firstCell = row[0]?.toString().toLowerCase().trim();
        // Buscar variaciones: "historico de ordenes", "histórico de órdenes", etc.
        if (firstCell && (firstCell.includes("historico") || firstCell.includes("histórico")) && 
            (firstCell.includes("ordenes") || firstCell.includes("órdenes") || firstCell.includes("orden"))) {
          foundHeader = true;
          continue;
        }
        // También buscar en otras celdas de la fila
        for (let cellIdx = 0; cellIdx < Math.min(row.length, 5); cellIdx++) {
          const cell = row[cellIdx]?.toString().toLowerCase().trim() || "";
          if (cell && (cell.includes("historico") || cell.includes("histórico")) && 
              (cell.includes("ordenes") || cell.includes("órdenes") || cell.includes("orden"))) {
            foundHeader = true;
            break;
          }
        }
        if (foundHeader) continue;
      }
      
      // Si no encontramos el header después de MAX_HEADER_SEARCH_ROWS, continuar de todas formas
      // (puede que el Excel no tenga ese header o esté en otro formato)
      if (i >= MAX_HEADER_SEARCH_ROWS && !foundHeader) {
        foundHeader = true; // Continuar procesando aunque no encontremos el header
      }
      
      if (!foundHeader) continue;
      
      // Verificar si es una fila de título (símbolo en primera columna)
      const firstCell = row[0]?.toString().trim();
      
      // Debug: mostrar primeros caracteres de la primera celda para debugging
      if (i < 50 && firstCell && firstCell.length > 0) {
        console.log(`Fila ${i}, primera celda: "${firstCell.substring(0, 50)}"`);
      }
      
      if (firstCell && this.isValidOptionSymbol(firstCell, normalizedActiveSymbol)) {
        // Extraer solo la parte del símbolo (puede venir con texto adicional)
        let symbol = firstCell.trim();
        const spaceIndex = symbol.indexOf(" ");
        if (spaceIndex > 0) {
          symbol = symbol.substring(0, spaceIndex).trim();
        }
        
        console.log(`Símbolo encontrado en fila ${i}: "${symbol}"`);
        
        // Encontramos un símbolo válido, ahora buscar el bloque de operaciones
        // Las operaciones comienzan DOS filas abajo del símbolo (pero puede haber más espacio)
        const operationsStartIndex = i + 2;
        
        // Buscar el header "Cpbt." desde operationsStartIndex (buscar hasta 20 filas abajo para ser más flexible)
        let headerRowIndex = -1;
        let columnIndices = null;
        
        for (let j = operationsStartIndex; j < jsonData.length && j < operationsStartIndex + 20; j++) {
          const headerRow = jsonData[j];
          if (this.isOperationsHeader(headerRow)) {
            headerRowIndex = j;
            columnIndices = this.detectColumnIndices(headerRow);
            console.log(`Header encontrado en fila ${j}, columnIndices:`, columnIndices);
            break;
          }
        }
        
        // Si encontramos el header, procesar operaciones hasta encontrar "Total"
        if (columnIndices && columnIndices.cpbt !== -1 && columnIndices.cantidad !== -1) {
          const operations = [];
          
          for (let k = headerRowIndex + 1; k < jsonData.length; k++) {
            const operationRow = jsonData[k];
            
            // Verificar si es la fila "Total" (marca el fin del bloque)
            // Buscar "Total" en cualquier columna, no solo en la primera
            const hasTotal = operationRow.some((cell) => {
              const cellStr = cell?.toString().toLowerCase().trim() || "";
              return cellStr === "total";
            });
            
            if (hasTotal) {
              console.log(`Total encontrado en fila ${k}, fin del bloque para símbolo ${symbol}`);
              break; // Fin del bloque
            }
            
            // Verificar si es una fila vacía (puede haber filas vacías entre operaciones)
            const isEmptyRow = operationRow.every((cell) => !cell || cell.toString().trim() === "");
            if (isEmptyRow) {
              continue;
            }
            
            // Procesar la fila de operación
            const operation = this.parseOperationRow(operationRow, columnIndices);
            if (operation) {
              operations.push(operation);
            } else {
              // Debug: mostrar por qué no se parseó la operación
              const cpbt = operationRow[columnIndices.cpbt]?.toString().trim() || "";
              const cantidad = operationRow[columnIndices.cantidad]?.toString().trim() || "";
              const neto = columnIndices.neto !== -1 ? (operationRow[columnIndices.neto]?.toString().trim() || "") : "";
              console.log(`Fila ${k} no parseada - cpbt: "${cpbt}", cantidad: "${cantidad}", neto: "${neto}"`);
            }
          }
          
          console.log(`Símbolo ${symbol}: ${operations.length} operaciones encontradas`);
          
          // Agregar el símbolo y sus operaciones al resultado
          if (operations.length > 0) {
            result.push({
              symbol: symbol,
              operations: operations,
            });
          } else {
            console.warn(`Símbolo ${symbol}: No se encontraron operaciones válidas`);
          }
        } else {
          console.warn(`Símbolo ${symbol}: No se encontró header de operaciones o columnas inválidas`);
        }
      }
    }
    
    return result;
  }

  /**
   * Detecta los índices de las columnas desde el header
   * @param {Array} headerRow - Fila de encabezados
   * @returns {Object} Objeto con índices de columnas
   */
  detectColumnIndices(headerRow) {
    const rowLower = headerRow.map((cell) => cell?.toString().toLowerCase().trim() || "");
    
    const indices = {
      cpbt: -1,
      cantidad: -1,
      precio: -1, // Se calculará desde Neto $ y Cantidad
      neto: -1, // Columna "Neto $"
      estado: -1,
      numero: -1,
    };
    
    for (let i = 0; i < rowLower.length; i++) {
      const cell = rowLower[i];
      if (cell.includes("cpbt") || cell.includes("comprobante")) {
        indices.cpbt = i;
      } else if (cell.includes("número") || cell.includes("numero") || cell.includes("nro")) {
        indices.numero = i;
      } else if (cell.includes("cantidad")) {
        indices.cantidad = i;
      } else if (cell.includes("neto") && (cell.includes("$") || cell.includes("pesos"))) {
        indices.neto = i;
      } else if (cell.includes("precio")) {
        indices.precio = i; // Mantener para compatibilidad, pero preferir calcular desde Neto $
      } else if (cell.includes("estado")) {
        indices.estado = i;
      }
    }
    
    return indices;
  }

  /**
   * Verifica si un símbolo es válido según el activo elegido y formato de opciones
   * @param {string} symbol - Símbolo a validar (ej: "GFGC61452J", "VTPR")
   * @param {string} activeSymbol - Símbolo del activo elegido (ej: GFG, YPF, COM)
   * @returns {boolean}
   */
  isValidOptionSymbol(symbol, activeSymbol) {
    if (!symbol || !activeSymbol) {
      return false;
    }

    // Limpiar el símbolo: puede venir con espacios o caracteres adicionales
    // Ejemplo: "GFGC90882D GFG(C) 9,088.200 DICIEMBRE" -> extraer solo "GFGC90882D"
    let cleanedSymbol = symbol.toString().trim();
    
    // Si el símbolo contiene espacios, tomar solo la primera parte
    // Ejemplo: "GFGC90882D GFG(C) 9,088.200 DICIEMBRE" -> "GFGC90882D"
    const spaceIndex = cleanedSymbol.indexOf(" ");
    if (spaceIndex > 0) {
      cleanedSymbol = cleanedSymbol.substring(0, spaceIndex).trim();
    }
    
    const normalizedSymbol = cleanedSymbol.toUpperCase();
    const normalizedActiveSymbol = activeSymbol.toUpperCase().trim();
    
    // Verificar que el símbolo empiece con el activo elegido
    // Ejemplo: Si activeSymbol es "GFG", buscar símbolos como "GFGC61452J", "GFGV61452J"
    if (!normalizedSymbol.startsWith(normalizedActiveSymbol)) {
      return false;
    }

    // Verificar que cumple con el formato de nomenclatura de opciones
    // Formato: [ACTIVO][TIPO][STRIKE][VENCIMIENTO]
    // Ejemplos: GFGC61452J, GFGV61452J, YPFC11753F, COMC61.0FE, GFGC90882D
    // Debe empezar con el activo seguido de C (CALL) o V (PUT)
    const optionPattern = new RegExp(`^${normalizedActiveSymbol}[CV][A-Z0-9.]+$`, "i");
    
    if (!optionPattern.test(normalizedSymbol)) {
      return false;
    }

    // Validar longitud mínima (activo + tipo + al menos 1 carácter más)
    if (normalizedSymbol.length < normalizedActiveSymbol.length + 2) {
      return false;
    }

    return true;
  }

  /**
   * Verifica si una fila es el encabezado de operaciones
   * @param {Array} row - Fila completa
   * @returns {boolean}
   */
  isOperationsHeader(row) {
    const headerCells = ["cpbt", "número", "cantidad", "precio", "neto", "estado"];
    const rowLower = row.map((cell) => cell?.toString().toLowerCase().trim() || "");
    
    // Verificar si contiene las palabras clave del encabezado
    let matches = 0;
    for (const header of headerCells) {
      if (rowLower.some((cell) => cell.includes(header))) {
        matches++;
      }
    }
    
    return matches >= 3; // Al menos 3 de las columnas esperadas
  }

  /**
   * Parsea una fila de operación usando los índices de columnas detectados
   * @param {Array} row - Fila completa
   * @param {Object} columnIndices - Índices de columnas detectados
   * @returns {Object|null} Operación parseada o null si no es válida
   */
  parseOperationRow(row, columnIndices) {
    // Validar que tenemos los índices necesarios (estado es opcional)
    if (
      columnIndices.cpbt === -1 ||
      columnIndices.cantidad === -1
    ) {
      return null;
    }
    
    // Necesitamos Cantidad y Neto $ para calcular el precio correctamente
    if (columnIndices.neto === -1 && columnIndices.precio === -1) {
      return null;
    }
    
    const cpbt = row[columnIndices.cpbt]?.toString().trim() || "";
    const cantidad = row[columnIndices.cantidad]?.toString().trim() || "";
    const estado = columnIndices.estado !== -1 ? (row[columnIndices.estado]?.toString().trim() || "") : "";
    const numero = columnIndices.numero !== -1 ? (row[columnIndices.numero]?.toString().trim() || "") : "";
    
    // Validar que tenemos datos válidos (cpbt y cantidad son obligatorios, estado es opcional)
    if (!cpbt || !cantidad) {
      return null;
    }
    
    // La columna Cpbt. contiene códigos como "COPR" (Compra) o "VTPR" (Venta)
    // No validar el símbolo aquí, ya que el símbolo está en el título del bloque
    
    // Filtrar operaciones "Anulada" solo si tenemos la columna estado
    if (estado && estado.toLowerCase().includes("anulada")) {
      return null;
    }
    
    // Calcular precio desde Neto $ y Cantidad (preferido) o usar Precio directo
    let precio = "";
    if (columnIndices.neto !== -1) {
      const neto = row[columnIndices.neto]?.toString().trim() || "";
      if (neto) {
        // Calcular: precio = (Neto $ / Cantidad) / 100
        // Dividir por 100 porque las operaciones son a 100 acciones
        const netoNum = this.parseNumber(neto);
        const cantidadNum = this.parseNumber(cantidad);
        
        if (cantidadNum !== 0) {
          precio = (netoNum / cantidadNum / 100).toString();
        } else {
          // Si cantidad es 0, intentar usar Precio directo si está disponible
          if (columnIndices.precio !== -1) {
            precio = row[columnIndices.precio]?.toString().trim() || "";
            // Si usamos Precio directo, también dividir por 100
            if (precio) {
              const precioNum = this.parseNumber(precio);
              if (precioNum !== 0) {
                precio = (precioNum / 100).toString();
              }
            }
          }
        }
      } else if (columnIndices.precio !== -1) {
        // Fallback a Precio directo si Neto $ no está disponible
        precio = row[columnIndices.precio]?.toString().trim() || "";
        // Si usamos Precio directo, también dividir por 100
        if (precio) {
          const precioNum = this.parseNumber(precio);
          if (precioNum !== 0) {
            precio = (precioNum / 100).toString();
          }
        }
      }
    } else if (columnIndices.precio !== -1) {
      // Usar Precio directo si Neto $ no está disponible
      precio = row[columnIndices.precio]?.toString().trim() || "";
      // Si usamos Precio directo, también dividir por 100
      if (precio) {
        const precioNum = this.parseNumber(precio);
        if (precioNum !== 0) {
          precio = (precioNum / 100).toString();
        }
      }
    }
    
    // Validar que tenemos precio
    if (!precio) {
      return null;
    }
    
    return {
      cpbt: cpbt, // Mantener el símbolo original (no uppercase para preservar formato)
      cantidad: cantidad,
      precio: precio,
      estado: estado,
      numero: numero,
    };
  }

  /**
   * Convierte operaciones a formato interno unificado
   * @param {Array} symbolsAndOperations - Array de { symbol, operations }
   * @returns {Array} Operaciones en formato interno unificado
   */
  convertToUnifiedFormat(symbolsAndOperations) {
    const unifiedOperations = [];
    
    symbolsAndOperations.forEach(({ symbol, operations }) => {
      operations.forEach((op) => {
        // Parsear números (formato argentino)
        const cantidad = this.parseNumber(op.cantidad);
        const precio = this.parseNumber(op.precio);
        
        // Debug: mostrar valores parseados
        if (!isFinite(cantidad) || cantidad === 0 || !isFinite(precio) || precio === 0) {
          console.log(`Operación rechazada - símbolo: "${symbol}", cantidad: "${op.cantidad}" -> ${cantidad}, precio: "${op.precio}" -> ${precio}`);
          return;
        }
        
        // El precio debe ser positivo (ya se calculó dividiendo por 100)
        // Si es negativo, usar valor absoluto (puede haber errores de cálculo)
        const precioFinal = Math.abs(precio);
        
        if (precioFinal <= 0) {
          console.log(`Operación rechazada por precio inválido - símbolo: "${symbol}", precio: ${precio}`);
          return;
        }
        
        // Determinar side desde la cantidad: positiva = BUY, negativa = SELL
        const side = cantidad > 0 ? "BUY" : "SELL";
        
        unifiedOperations.push({
          symbol: symbol.trim(),
          side: side,
          last_price: precioFinal,
          last_qty: Math.abs(cantidad), // Usar valor absoluto
          order_id: op.numero || "",
        });
      });
    });
    
    console.log(`convertToUnifiedFormat: ${unifiedOperations.length} operaciones convertidas de ${symbolsAndOperations.reduce((sum, so) => sum + so.operations.length, 0)} totales`);
    
    return unifiedOperations;
  }

  /**
   * Parsea un número en formato argentino (punto=miles, coma=decimal)
   * @param {string} value - Valor numérico como string
   * @returns {number} Número parseado
   */
  parseNumber(value) {
    if (!value || typeof value !== "string") return 0;

    // Remover espacios
    let cleaned = value.trim();

    // Si tiene punto y coma, es formato argentino (punto=miles, coma=decimal)
    if (cleaned.includes(".") && cleaned.includes(",")) {
      // Remover puntos (miles) y reemplazar coma por punto (decimal)
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (cleaned.includes(",") && !cleaned.includes(".")) {
      // Solo coma: puede ser miles o decimal
      const parts = cleaned.split(",");
      // Si hay exactamente 3 dígitos después de la coma, generalmente son miles
      if (parts[1] && parts[1].length === 3) {
        // Es miles, remover coma
        cleaned = cleaned.replace(",", "");
      } else if (parts[0].length > 3) {
        // Más de 3 dígitos antes de la coma, probablemente es miles
        cleaned = cleaned.replace(",", "");
      } else {
        // Es decimal, reemplazar coma por punto
        cleaned = cleaned.replace(",", ".");
      }
    }

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
}

/**
 * Parser para formato CSV OMS-BYMA
 * Convierte el formato OMS-BYMA al formato interno unificado
 */
class BymaCsvParser {
  /**
   * Parsea un string CSV OMS-BYMA y retorna array de objetos
   * @param {string} csvText - Contenido del archivo CSV
   * @returns {Array} Array de objetos con los datos parseados
   */
  parse(csvText) {
    const lines = csvText.trim().split("\n");
    if (lines.length === 0) return [];

    // Parsear headers
    const headers = this.parseCSVLine(lines[0])
      .map((h) => h.trim().replace(/"/g, ""));

    // Parsear filas
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
   * Convierte formato OMS-BYMA a formato interno unificado
   * @param {Array} parsedData - Datos parseados del CSV OMS-BYMA
   * @returns {Array} Datos en formato interno unificado
   */
  convertToUnifiedFormat(parsedData) {
    return parsedData
      .filter((row) => {
        // Filtrar filas vacías o sin datos esenciales
        return (
          row.Especie &&
          row.Lado &&
          row.Precio &&
          row.Cantidad &&
          row.Especie.trim() !== "" &&
          row.Lado.trim() !== ""
        );
      })
      .map((row) => {
        // Convertir formato de números argentino (punto=miles, coma=decimal)
        const precio = this.parseNumber(row.Precio);
        const cantidad = this.parseNumber(row.Cantidad);

        // Convertir Lado: Compra -> BUY, Venta -> SELL
        const side = row.Lado.trim().toLowerCase();
        const sideMapped =
          side === "compra" ? "BUY" : side === "venta" ? "SELL" : side.toUpperCase();

        return {
          symbol: row.Especie.trim(),
          side: sideMapped,
          last_price: precio,
          last_qty: cantidad,
          order_id: row.Orden || "", // Para posible consolidación futura
        };
      })
      .filter((row) => {
        // Filtrar filas con datos inválidos
        return (
          row.symbol &&
          (row.side === "BUY" || row.side === "SELL") &&
          isFinite(row.last_price) &&
          !isNaN(row.last_price) &&
          row.last_price > 0 &&
          isFinite(row.last_qty) &&
          !isNaN(row.last_qty) &&
          row.last_qty > 0
        );
      });
  }

  /**
   * Parsea un número en formato argentino BymaOMS (punto=miles, coma=decimal)
   * Ejemplos: "3.749,170" -> 3749.17, "1,000" -> 1, "4,500" -> 4.50
   * @param {string} value - Valor numérico como string
   * @returns {number} Número parseado
   */
  parseNumber(value) {
    if (!value || typeof value !== "string") return 0;

    // Remover espacios y comillas
    let cleaned = value.trim().replace(/"/g, "");

    // Si tiene punto y coma, es formato argentino correcto (punto=miles, coma=decimal)
    if (cleaned.includes(".") && cleaned.includes(",")) {
      // Remover puntos (miles) y reemplazar coma por punto (decimal)
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (cleaned.includes(",") && !cleaned.includes(".")) {
      // Solo coma: en formato BymaOMS, la coma es separador de decimales
      const parts = cleaned.split(",");
      if (parts.length === 2) {
        const parteEntera = parts[0];
        const parteDecimal = parts[1];
        
        // Si la parte decimal son solo ceros (ej: "1,000", "18,000"), es un entero
        if (parteDecimal.match(/^0+$/)) {
          cleaned = parteEntera;
        } else {
          // Los dígitos después de la coma son centavos (ej: "4,500" = 4.50, "4,510" = 4.51)
          // Convertir a formato decimal estándar
          cleaned = parteEntera + "." + parteDecimal;
        }
      } else {
        // Múltiples comas, reemplazar la primera por punto
        cleaned = cleaned.replace(",", ".");
      }
    } else if (cleaned.includes(".") && !cleaned.includes(",")) {
      // Solo punto: en formato BymaOMS, punto es separador de miles
      // Remover puntos para obtener el número entero
      cleaned = cleaned.replace(/\./g, "");
    }

    const parsed = parseFloat(cleaned);
    // Si el resultado es un entero (sin decimales), retornar como entero
    // Esto maneja casos como "1,000" -> 1.0 -> 1
    return isNaN(parsed) ? 0 : (parsed % 1 === 0 ? Math.floor(parsed) : parsed);
  }
}

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
    this.exportFormat = "EPGB"; // Formato de exportación: "EPGB" o "DeltaVega"

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
        "exportFormat",
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
      this.exportFormat = result.exportFormat || "EPGB";
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
        exportFormat: this.exportFormat,
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
   * Procesa un archivo (CSV o Excel) con datos de operaciones
   * Detecta automáticamente el formato y delega al procesador correspondiente
   * @param {string|ArrayBuffer} fileData - Contenido del archivo (string para CSV, ArrayBuffer para Excel)
   * @param {boolean} useAveraging - Si usar promedios por strike o no
   * @param {string} activeSymbol - Símbolo del activo (GFG, YPF, COM, etc.)
   * @param {string} expiration - Letra de vencimiento (A, B, C, D, E, F, G, H, I, O, N, Z)
   * @param {string} fileName - Nombre del archivo (opcional, para detectar extensión)
   * @returns {Object} Resultado del procesamiento
   */
  async processCsvData(
    fileData,
    useAveraging = false,
    activeSymbol = "GFG",
    expiration = "OCT",
    fileName = ""
  ) {
    try {
      // Detectar formato del archivo
      const format = this.detectFormat(fileData, fileName);

      // Delegar al procesador correspondiente
      let result;
      if (format === "XOMS_MATRIZ") {
        result = await this.processXomsMatrizFormat(
          fileData,
          useAveraging,
          activeSymbol,
          expiration
        );
      } else if (format === "OMS_BYMA") {
        result = await this.processBymaCsvFormat(
          fileData,
          useAveraging,
          activeSymbol,
          expiration
        );
      } else if (format === "HOMEBROKER_EXCEL") {
        result = await this.processHomebrokerExcelFormat(
          fileData,
          useAveraging,
          activeSymbol,
          expiration
        );
      } else {
        throw new Error(`Formato no soportado: ${format}`);
      }

      // Agregar información del formato detectado al resultado
      if (result.success) {
        result.detectedFormat = format;
        result.formatLabel =
          format === "XOMS_MATRIZ"
            ? "XOMS Matriz"
            : format === "OMS_BYMA"
            ? "OMS-BYMA"
            : "Homebroker Excel";
      }

      return result;
    } catch (error) {
      console.error("Error procesando datos:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Procesa formato XOMS Matriz (formato actual que funciona)
   * Contiene TODO el código original sin modificaciones
   * @param {string} csvText - Contenido del archivo CSV
   * @param {boolean} useAveraging - Si usar promedios por strike o no
   * @param {string} activeSymbol - Símbolo del activo (GFG, YPF, COM, etc.)
   * @param {string} expiration - Letra de vencimiento
   * @returns {Object} Resultado del procesamiento
   */
  async processXomsMatrizFormat(
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
      console.error("Error procesando datos XOMS Matriz:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Procesa formato OMS-BYMA CSV (nuevo formato)
   * Usa BymaCsvParser para convertir y luego funciones comunes de procesamiento
   * @param {string} csvText - Contenido del archivo CSV
   * @param {boolean} useAveraging - Si usar promedios por strike o no
   * @param {string} activeSymbol - Símbolo del activo (GFG, YPF, COM, etc.)
   * @param {string} expiration - Letra de vencimiento
   * @returns {Object} Resultado del procesamiento
   */
  async processBymaCsvFormat(
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

      // Parsear y convertir formato OMS-BYMA a formato interno unificado
      const bymaParser = new BymaCsvParser();
      const parsedData = bymaParser.parse(csvText);
      const unifiedData = bymaParser.convertToUnifiedFormat(parsedData);

      // Guardar datos originales
      this.originalData = unifiedData;

      // Para OMS-BYMA, no necesitamos filtrar ni consolidar como en XOMS Matriz
      // Los datos ya vienen en formato unificado y listos para procesar
      // Procesar símbolos y clasificar opciones usando funciones comunes
      this.processedData = this.processSymbolsAndClassify(unifiedData);

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
      console.error("Error procesando datos OMS-BYMA:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Procesa formato Homebroker Excel (nuevo formato)
   * Usa HomebrokerExcelParser para parsear y convertir, luego funciones comunes de procesamiento
   * @param {ArrayBuffer} arrayBuffer - Contenido del archivo Excel como ArrayBuffer
   * @param {boolean} useAveraging - Si usar promedios por strike o no
   * @param {string} activeSymbol - Símbolo del activo (GFG, YPF, COM, etc.)
   * @param {string} expiration - Letra de vencimiento
   * @returns {Object} Resultado del procesamiento
   */
  async processHomebrokerExcelFormat(
    arrayBuffer,
    useAveraging = false,
    activeSymbol = "GFG",
    expiration = "OCT"
  ) {
    try {
      // Configurar modo de procesamiento, símbolo activo y vencimiento
      this.useAveraging = useAveraging;
      this.activeSymbol = activeSymbol.toUpperCase();
      this.expiration = expiration.toUpperCase();

      // Parsear y convertir formato Homebroker Excel a formato interno unificado
      const homebrokerParser = new HomebrokerExcelParser();
      const unifiedData = homebrokerParser.parse(arrayBuffer, this.activeSymbol);

      if (!unifiedData || unifiedData.length === 0) {
        throw new Error("No se encontraron operaciones en el archivo Excel");
      }

      // Guardar datos originales
      this.originalData = unifiedData;

      // Para Homebroker Excel, los datos ya vienen en formato unificado
      // Procesar símbolos y clasificar opciones usando funciones comunes
      this.processedData = this.processSymbolsAndClassify(unifiedData);

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
      console.error("Error procesando datos Homebroker Excel:", error);
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
   * Detecta el formato del archivo (CSV o Excel)
   * @param {string|ArrayBuffer} data - Contenido del archivo (string para CSV, ArrayBuffer para Excel)
   * @param {string} fileName - Nombre del archivo (opcional, para detectar extensión)
   * @returns {string} 'XOMS_MATRIZ', 'OMS_BYMA' o 'HOMEBROKER_EXCEL'
   */
  detectFormat(data, fileName = "") {
    // Detectar por extensión primero
    if (fileName && fileName.toLowerCase().endsWith(".xlsx")) {
      return "HOMEBROKER_EXCEL";
    }

    // Si es ArrayBuffer, es Excel
    if (data instanceof ArrayBuffer) {
      return "HOMEBROKER_EXCEL";
    }

    // Si no es string, error
    if (!data || typeof data !== "string") {
      throw new Error("Archivo inválido o vacío");
    }

    const lines = data.trim().split("\n");
    if (lines.length === 0) {
      throw new Error("Archivo vacío");
    }

    // Parsear headers
    const headers = this.parseCSVLine(lines[0])
      .map((h) => h.trim().replace(/"/g, "").toLowerCase());

    // Detectar formato XOMS Matriz: presencia de event_subtype, symbol, side, last_price, last_qty
    const xomsMatrizHeaders = [
      "event_subtype",
      "symbol",
      "side",
      "last_price",
      "last_qty",
    ];
    const hasXomsMatrizHeaders = xomsMatrizHeaders.every((header) =>
      headers.includes(header)
    );

    // Detectar formato OMS-BYMA: presencia de Especie, Lado, Precio, Cantidad
    const bymaHeaders = ["especie", "lado", "precio", "cantidad"];
    const hasBymaHeaders = bymaHeaders.every((header) =>
      headers.includes(header)
    );

    if (hasXomsMatrizHeaders) {
      return "XOMS_MATRIZ";
    } else if (hasBymaHeaders) {
      return "OMS_BYMA";
    } else {
      throw new Error(
        "Formato CSV no reconocido. Se espera formato XOMS Matriz u OMS-BYMA."
      );
    }
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
        // Para acciones, extraer el símbolo
        // Puede venir en formato XOMS Matriz: MERV - XMEV - GGAL - 24hs
        // o formato OMS-BYMA: COME (directo)
        const parts = row.symbol.split(" - ");
        let simboloAccion;
        if (parts.length >= 3) {
          // Formato XOMS Matriz
          simboloAccion = parts[2]; // GGAL
        } else {
          // Formato OMS-BYMA: símbolo directo
          simboloAccion = row.symbol.trim();
        }

        if (simboloAccion) {
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
    // Las acciones pueden tener formato: MERV - XMEV - GGAL - 24hs (XOMS Matriz)
    // o venir directamente como: COME (OMS-BYMA)
    if (subyacente) {
      if (symbol.includes(` - ${subyacente} - `)) {
        return "ACCION";
      } else if (symbol.trim() === subyacente) {
        // Formato OMS-BYMA: símbolo directo sin prefijos
        return "ACCION";
      }
    }

    return "";
  }

  /**
   * Extrae la parte relevante del símbolo para el vencimiento seleccionado
   * @param {string} symbol - Símbolo original
   * @returns {number|null} Valor del strike o null si no es válido
   */
  extractAndModifySymbol(symbol) {
    let relevantPart;

    // Detectar formato: si tiene " - " es formato XOMS Matriz, sino es formato OMS-BYMA
    const parts = symbol.split(" - ");
    if (parts.length >= 3) {
      // Formato XOMS Matriz: MERV - XMEV - GFGV11753F - 24hs
      relevantPart = parts[2];
    } else {
      // Formato OMS-BYMA: símbolo directo como GFGV11753F
      relevantPart = symbol.trim();
    }

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
    let removedSuffix = null;
    for (const s of sortedSuffixes) {
      if (relevantPart.endsWith(s)) {
        removedSuffix = s;
        relevantPart = relevantPart.slice(0, -s.length);
        break;
      }
    }

    try {
      // Si hay un punto en el símbolo, tratarlo como separador decimal
      // Ejemplo: "61.0" en "COMC61.0FE" -> base = 61.0
      if (relevantPart.includes(".")) {
        // Extraer solo números y punto para preservar el formato decimal
        const numericPart = relevantPart.replace(/[^0-9.]/g, "");
        if (!numericPart) return null;
        
        // Parsear directamente como número decimal
        const parsed = parseFloat(numericPart);
        if (isNaN(parsed) || !isFinite(parsed)) return null;
        return parsed;
      }

      // Aplicar reglas de strike: 4, 5 o 6 dígitos (sin punto)
      const digits = relevantPart.replace(/[^0-9]/g, "");
      if (!digits) return null;

      // Si el sufijo es de 2 letras (ej: "DI"), siempre es redondo
      const isTwoLetterSuffix = removedSuffix && removedSuffix.length === 2;

      if (digits.endsWith("00")) {
        // Strikes redondos: todo el entero + .00
        return parseFloat(digits + ".00");
      }

      if (digits.length === 5) {
        // Si el sufijo es de 2 letras, siempre es redondo
        if (isTwoLetterSuffix) {
          return parseFloat(digits + ".00");
        }
        
        // Para sufijos de 1 letra, determinar si es redondo o tiene decimales
        const asInteger = parseInt(digits, 10);
        const asDecimal = parseFloat(digits.substring(0, 4) + "." + digits.substring(4));
        
        // Si el número como entero es < 10,000, siempre tiene decimales
        // Ejemplos: 26549 -> 2654.9, 27549 -> 2754.9, 32772 -> 3277.2, 50115 -> 5011.5
        if (asInteger < 10000) {
          return asDecimal;
        }
        
        // Si el número como entero es >= 10,000:
        // Necesitamos distinguir entre strikes redondos (ej: 10577 -> 10577.00) 
        // y strikes con decimales (ej: 82772 -> 8277.2, 44549 -> 4454.9)
        // 
        // La clave está en el rango del strike como decimal:
        // - Si el strike como decimal está en un rango "típico" de strikes (>= 2000), tiene decimales
        // - Si el strike como decimal está en un rango "bajo" (< 2000), es redondo
        // 
        // Ejemplos:
        // - 10577: asDecimal = 1057.7 (< 2000) -> redondo 10577.00 ✓
        // - 10177: asDecimal = 1017.7 (< 2000) -> redondo 10177.00 ✓
        // - 10977: asDecimal = 1097.7 (< 2000) -> redondo 10977.00 ✓
        // - 11377: asDecimal = 1137.7 (< 2000) -> redondo 11377.00 ✓
        // - 11777: asDecimal = 1177.7 (< 2000) -> redondo 11777.00 ✓
        // - 82772: asDecimal = 8277.2 (>= 2000) -> tiene decimales 8277.2 ✓
        // - 44549: asDecimal = 4454.9 (>= 2000) -> tiene decimales 4454.9 ✓
        // - 84903: asDecimal = 8490.3 (>= 2000) -> tiene decimales 8490.3 ✓
        if (asDecimal >= 2000) {
          // Está en rango típico de strikes con decimales
          return asDecimal;
        } else {
          // Está en rango bajo, probablemente es un strike redondo grande
          return parseFloat(digits + ".00");
        }
      }

      if (digits.length === 4) {
        // Si el sufijo es de 2 letras, siempre es redondo
        if (isTwoLetterSuffix) {
          return parseFloat(digits + ".00");
        }
        
        // Para números de 4 dígitos, si termina en "00", es redondo
        // Si no termina en "00", también lo tratamos como redondo porque
        // los decimales deberían estar en el ticker original (6 dígitos)
        // Si el ticker solo tiene 4 dígitos, asumimos que es redondo
        return parseFloat(digits + ".00");
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
   * Genera datos en formato DeltaVega (Type | Quantity | Strike | Price)
   * @returns {string} Texto formateado para Excel
   */
  generateDeltaVegaData() {
    const data = [];
    
    // Combinar todas las operaciones en un solo array
    const allOperations = [];
    
    // Agregar Calls
    this.callsData.forEach((op) => {
      allOperations.push({
        type: "C",
        quantity: op.cantidad,
        strike: op.base,
        price: op.precio,
      });
    });
    
    // Agregar Puts
    this.putsData.forEach((op) => {
      allOperations.push({
        type: "P",
        quantity: op.cantidad,
        strike: op.base,
        price: op.precio,
      });
    });
    
    // Agregar Subyacentes (S)
    this.accionesData.forEach((op) => {
      allOperations.push({
        type: "S",
        quantity: op.cantidad,
        strike: null, // Subyacentes no tienen strike
        price: op.precio,
      });
    });
    
    // Ordenar: primero por tipo (C, P, S), luego por strike (si aplica), luego por cantidad
    allOperations.sort((a, b) => {
      // Ordenar por tipo primero
      const typeOrder = { C: 1, P: 2, S: 3 };
      if (typeOrder[a.type] !== typeOrder[b.type]) {
        return typeOrder[a.type] - typeOrder[b.type];
      }
      
      // Si ambos tienen strike, ordenar por strike
      if (a.strike !== null && b.strike !== null) {
        if (a.strike !== b.strike) {
          return a.strike - b.strike;
        }
      }
      
      // Finalmente ordenar por cantidad
      return a.quantity - b.quantity;
    });
    
    // Formatear cada operación (DeltaVega usa punto para decimales)
    allOperations.forEach((op) => {
      const quantity = op.quantity.toString();
      const strike = op.strike !== null ? op.strike.toFixed(2) : "";
      const price = Number(op.price).toFixed(2);
      data.push(`${op.type}\t${quantity}\t${strike}\t${price}`);
    });
    
    return data.join("\n");
  }

  /**
   * Genera datos para copiar al portapapeles (formato para pegar en Excel)
   * @param {string} type - 'calls', 'puts', 'acciones' o 'all' (ignorado si formato es DeltaVega)
   * @returns {string} Texto formateado para Excel
   */
  generateCopyData(type = "all") {
    // Si el formato es DeltaVega, siempre devolver formato unificado
    if (this.exportFormat === "DeltaVega") {
      return this.generateDeltaVegaData();
    }

    // Formato EPGB (comportamiento original)
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
          const base = Number(op.base).toFixed(2).replace(".", ",");
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
          const base = Number(op.base).toFixed(2).replace(".", ",");
          const precio = Number(op.precio).toFixed(4).replace(".", ",");
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
        const base = Number(op.base).toFixed(2).replace(".", ",");
        const precio = Number(op.precio).toFixed(4).replace(".", ",");
        data.push(`${cantidad}\t${base}\t${precio}`);
      });
    } else if (type === "puts") {
      // Para "puts" solo los datos, sin encabezados
      this.putsData.forEach((op) => {
        const cantidad = op.cantidad.toString().replace(".", ",");
        const base = Number(op.base).toFixed(2).replace(".", ",");
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
    const formatPrefix = this.exportFormat === "DeltaVega" ? "DeltaVega_" : "";
    const filename = `Operaciones_${formatPrefix}${modePrefix}${this.activeSymbol}_${fecha}.csv`;

    let csvContent = "";

    // Si el formato es DeltaVega, generar formato unificado
    if (this.exportFormat === "DeltaVega") {
      // Encabezados (usar punto y coma como separador para formato CSV europeo)
      csvContent += "Type;Quantity;Strike;Price\n";
      
      // Combinar todas las operaciones
      const allOperations = [];
      
      // Agregar Calls
      this.callsData.forEach((op) => {
        allOperations.push({
          type: "C",
          quantity: op.cantidad,
          strike: op.base,
          price: op.precio,
        });
      });
      
      // Agregar Puts
      this.putsData.forEach((op) => {
        allOperations.push({
          type: "P",
          quantity: op.cantidad,
          strike: op.base,
          price: op.precio,
        });
      });
      
      // Agregar Subyacentes (S)
      this.accionesData.forEach((op) => {
        allOperations.push({
          type: "S",
          quantity: op.cantidad,
          strike: null,
          price: op.precio,
        });
      });
      
      // Ordenar igual que en generateDeltaVegaData
      allOperations.sort((a, b) => {
        const typeOrder = { C: 1, P: 2, S: 3 };
        if (typeOrder[a.type] !== typeOrder[b.type]) {
          return typeOrder[a.type] - typeOrder[b.type];
        }
        if (a.strike !== null && b.strike !== null) {
          if (a.strike !== b.strike) {
            return a.strike - b.strike;
          }
        }
        return a.quantity - b.quantity;
      });
      
      // Formatear cada operación (DeltaVega usa punto para decimales, punto y coma como separador de columnas)
      allOperations.forEach((op) => {
        const quantity = op.quantity.toString();
        const strike = op.strike !== null ? op.strike.toFixed(2) : "";
        const price = Number(op.price).toFixed(2);
        csvContent += `${op.type};${quantity};${strike};${price}\n`;
      });
    } else {
      // Formato EPGB (comportamiento original)
      const modeText = this.useAveraging
        ? " (CON PROMEDIOS)"
        : " (SIN PROMEDIOS)";

      // Hoja CALLS
      csvContent += `OPERACIONES CALLS${modeText}\n`;
      csvContent += "Cantidad;Base;Precio\n"; // Usar punto y coma como separador para formato europeo
      this.callsData.forEach((op) => {
        // Formatear números con coma decimal
        const cantidad = op.cantidad.toString().replace(".", ",");
        const base = Number(op.base).toFixed(2).replace(".", ",");
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
        const base = Number(op.base).toFixed(2).replace(".", ",");
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
    }

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
      const base = Number(op.base).toFixed(2).replace(".", ",");
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
      const base = Number(op.base).toFixed(2).replace(".", ",");
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
   * Configura el formato de exportación
   * @param {string} format - Formato de exportación ("EPGB" o "DeltaVega")
   */
  async setExportFormat(format) {
    if (format === "EPGB" || format === "DeltaVega") {
      this.exportFormat = format;
      await this.saveConfig();
    }
  }

  /**
   * Obtiene el formato de exportación actual
   * @returns {string} Formato de exportación ("EPGB" o "DeltaVega")
   */
  getExportFormat() {
    return this.exportFormat;
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
