/**
 * Integración con Google Sheets API
 * Maneja autenticación OAuth 2.0 y operaciones con Google Sheets
 */

class GoogleSheetsIntegration {
  constructor() {
    this.accessToken = null;
    this.isAuthenticated = false;
    this.apiBaseUrl = "https://sheets.googleapis.com/v4";
    this.driveApiUrl = "https://www.googleapis.com/drive/v3";
  }

  /**
   * Inicializa la integración cargando el token guardado
   */
  async init() {
    try {
      const stored = await chrome.storage.local.get([
        "googleAccessToken",
        "googleSheetsConfig",
      ]);

      if (stored.googleAccessToken) {
        this.accessToken = stored.googleAccessToken;
        this.isAuthenticated = true;
      }

      return {
        isAuthenticated: this.isAuthenticated,
        config: stored.googleSheetsConfig || null,
      };
    } catch (error) {
      console.error("Error inicializando Google Sheets:", error);
      return { isAuthenticated: false, config: null };
    }
  }

  /**
   * Inicia el flujo de autenticación OAuth 2.0
   */
  async authenticate() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, async (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        try {
          this.accessToken = token;
          this.isAuthenticated = true;
          await chrome.storage.local.set({ googleAccessToken: token });
          resolve(token);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Cierra la sesión de Google
   */
  async signOut() {
    if (!this.accessToken) {
      return;
    }

    try {
      // Revocar el token
      await fetch(
        `https://accounts.google.com/o/oauth2/revoke?token=${this.accessToken}`
      );
    } catch (error) {
      console.error("Error revocando token:", error);
    }

    // Remover el token del storage
    await chrome.storage.local.remove(["googleAccessToken"]);
    await chrome.identity.removeCachedAuthToken({ token: this.accessToken });

    this.accessToken = null;
    this.isAuthenticated = false;
  }

  /**
   * Obtiene la lista de spreadsheets del usuario
   */
  async getSpreadsheets() {
    if (!this.isAuthenticated) {
      throw new Error("No autenticado. Por favor, conéctate primero.");
    }

    try {
      const response = await fetch(
        `${this.driveApiUrl}/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name)&orderBy=modifiedTime desc`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Error obteniendo spreadsheets: ${response.statusText}`
        );
      }

      const data = await response.json();
      return data.files || [];
    } catch (error) {
      console.error("Error obteniendo spreadsheets:", error);
      throw error;
    }
  }

  /**
   * Obtiene las hojas (sheets) de un spreadsheet
   */
  async getSheets(spreadsheetId) {
    if (!this.isAuthenticated) {
      throw new Error("No autenticado. Por favor, conéctate primero.");
    }

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/spreadsheets/${spreadsheetId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Error obteniendo sheets: ${response.statusText}`);
      }

      const data = await response.json();
      return (
        data.sheets?.map((sheet) => ({
          sheetId: sheet.properties.sheetId,
          title: sheet.properties.title,
          index: sheet.properties.index,
        })) || []
      );
    } catch (error) {
      console.error("Error obteniendo sheets:", error);
      throw error;
    }
  }

  /**
   * Guarda la configuración de Google Sheets
   */
  async saveConfig(config) {
    try {
      await chrome.storage.local.set({ googleSheetsConfig: config });
    } catch (error) {
      console.error("Error guardando configuración:", error);
      throw error;
    }
  }

  /**
   * Obtiene la configuración guardada
   */
  async getConfig() {
    try {
      const result = await chrome.storage.local.get(["googleSheetsConfig"]);
      return result.googleSheetsConfig || null;
    } catch (error) {
      console.error("Error obteniendo configuración:", error);
      return null;
    }
  }

  /**
   * Convierte un número de columna a letra (1 = A, 2 = B, etc.)
   */
  columnNumberToLetter(columnNumber) {
    let letter = "";
    while (columnNumber > 0) {
      const remainder = (columnNumber - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      columnNumber = Math.floor((columnNumber - 1) / 26);
    }
    return letter;
  }

  /**
   * Convierte una letra de columna a número (A = 1, B = 2, etc.)
   */
  columnLetterToNumber(letter) {
    let number = 0;
    for (let i = 0; i < letter.length; i++) {
      number = number * 26 + (letter.charCodeAt(i) - 64);
    }
    return number;
  }

  /**
   * Extrae la fecha (YYYY-MM-DD) de un timestamp en milisegundos
   */
  extractDateFromTimestamp(timestamp) {
    const date = new Date(parseInt(timestamp));
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Busca filas que coincidan con la fecha especificada
   * @param {string} spreadsheetId - ID del spreadsheet
   * @param {string} sheetName - Nombre de la hoja
   * @param {Object} config - Configuración con startRow y columnMapping
   * @param {string} targetDate - Fecha objetivo en formato YYYY-MM-DD
   * @returns {Promise<Array>} Array de números de fila (1-indexed) que coinciden
   */
  async findRowsByDate(spreadsheetId, sheetName, config, targetDate) {
    if (!this.isAuthenticated) {
      throw new Error("No autenticado. Por favor, conéctate primero.");
    }

    const { startRow, columnMapping } = config;
    const fechaColumn = columnMapping.fecha;

    if (!fechaColumn) {
      throw new Error("No hay columna FECHA configurada");
    }

    try {
      // Leer todas las filas desde startRow hacia abajo
      // Leemos un rango amplio (hasta Z) para asegurar que tenemos todas las filas
      const range = `${sheetName}!${fechaColumn}${startRow}:${fechaColumn}1000`;

      const response = await fetch(
        `${this.apiBaseUrl}/spreadsheets/${spreadsheetId}/values/${range}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        // Si no hay datos, retornar array vacío
        if (response.status === 400) {
          return [];
        }
        throw new Error(`Error leyendo filas: ${response.statusText}`);
      }

      const data = await response.json();
      const rows = data.values || [];
      const matchingRows = [];

      rows.forEach((row, index) => {
        const timestamp = row[0];
        if (timestamp) {
          try {
            const rowDate = this.extractDateFromTimestamp(timestamp);
            if (rowDate === targetDate) {
              // La fila real es startRow + index (1-indexed)
              matchingRows.push(startRow + index);
            }
          } catch (error) {
            // Ignorar filas con timestamps inválidos
            console.warn(
              `Timestamp inválido en fila ${startRow + index}:`,
              timestamp
            );
          }
        }
      });

      return matchingRows;
    } catch (error) {
      console.error("Error buscando filas por fecha:", error);
      throw error;
    }
  }

  /**
   * Borra filas específicas usando batch delete
   * @param {string} spreadsheetId - ID del spreadsheet
   * @param {string} sheetName - Nombre de la hoja
   * @param {Array<number>} rowIndices - Array de números de fila (1-indexed) a borrar
   */
  async deleteRows(spreadsheetId, sheetName, rowIndices) {
    if (!this.isAuthenticated) {
      throw new Error("No autenticado. Por favor, conéctate primero.");
    }

    if (!rowIndices || rowIndices.length === 0) {
      return; // No hay nada que borrar
    }

    try {
      // Necesitamos el sheetId para borrar filas
      const sheets = await this.getSheets(spreadsheetId);
      const sheet = sheets.find((s) => s.title === sheetName);
      if (!sheet) {
        throw new Error(`Hoja "${sheetName}" no encontrada`);
      }

      // Ordenar filas de mayor a menor para borrar correctamente
      const sortedRows = [...rowIndices].sort((a, b) => b - a);

      // Preparar requests de borrado (necesitamos borrar de abajo hacia arriba)
      const deleteRequests = sortedRows.map((rowIndex) => ({
        deleteDimension: {
          range: {
            sheetId: sheet.sheetId,
            dimension: "ROWS",
            startIndex: rowIndex - 1, // API usa 0-indexed
            endIndex: rowIndex, // End es exclusivo
          },
        },
      }));

      // Ejecutar batch update
      const response = await fetch(
        `${this.apiBaseUrl}/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: deleteRequests,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error borrando filas: ${JSON.stringify(errorData)}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error borrando filas:", error);
      throw error;
    }
  }

  /**
   * Escribe datos en el sheet según el mapeo de columnas configurado
   * Usa batchUpdate para escribir solo en las columnas específicas configuradas
   * @param {string} spreadsheetId - ID del spreadsheet
   * @param {string} sheetName - Nombre de la hoja
   * @param {Array<Object>} data - Array de objetos con los datos a escribir
   * @param {Object} config - Configuración con startRow y columnMapping
   */
  async writeData(spreadsheetId, sheetName, data, config) {
    if (!this.isAuthenticated) {
      throw new Error("No autenticado. Por favor, conéctate primero.");
    }

    if (!data || data.length === 0) {
      return; // No hay datos para escribir
    }

    const { startRow, columnMapping } = config;

    try {
      // Determinar dónde escribir (después de borrar, usar startRow)
      let writeStartRow = startRow;

      // Verificar si hay datos existentes desde startRow en la columna FECHA
      const fechaColumn = columnMapping.fecha;
      const checkRange = `${sheetName}!${fechaColumn}${startRow}:${fechaColumn}`;
      const checkResponse = await fetch(
        `${this.apiBaseUrl}/spreadsheets/${spreadsheetId}/values/${checkRange}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        const existingRows = checkData.values || [];
        if (existingRows.length > 0) {
          writeStartRow = startRow + existingRows.length;
        }
      }

      // Preparar updates para cada columna específica
      // Cada columna se escribe por separado para no afectar columnas intermedias
      const dataUpdates = [];

      // Preparar valores para columna FECHA
      if (columnMapping.fecha) {
        dataUpdates.push({
          range: `${sheetName}!${columnMapping.fecha}${writeStartRow}:${
            columnMapping.fecha
          }${writeStartRow + data.length - 1}`,
          values: data.map((row) => [row.fecha.toString()]),
        });
      }

      // Preparar valores para columna TIPO
      if (columnMapping.tipo) {
        dataUpdates.push({
          range: `${sheetName}!${columnMapping.tipo}${writeStartRow}:${
            columnMapping.tipo
          }${writeStartRow + data.length - 1}`,
          values: data.map((row) => [row.tipo]),
        });
      }

      // Preparar valores para columna CANTIDAD
      if (columnMapping.cantidad) {
        dataUpdates.push({
          range: `${sheetName}!${columnMapping.cantidad}${writeStartRow}:${
            columnMapping.cantidad
          }${writeStartRow + data.length - 1}`,
          values: data.map((row) => [row.cantidad.toString()]),
        });
      }

      // Preparar valores para columna BASE/PRECIO
      if (columnMapping.basePrecio) {
        dataUpdates.push({
          range: `${sheetName}!${columnMapping.basePrecio}${writeStartRow}:${
            columnMapping.basePrecio
          }${writeStartRow + data.length - 1}`,
          values: data.map((row) => [
            row.basePrecio != null ? row.basePrecio.toString() : "",
          ]),
        });
      }

      // Preparar valores para columna PRIMA (si está configurada)
      if (columnMapping.prima) {
        dataUpdates.push({
          range: `${sheetName}!${columnMapping.prima}${writeStartRow}:${
            columnMapping.prima
          }${writeStartRow + data.length - 1}`,
          values: data.map((row) => [
            row.prima != null ? row.prima.toString() : "",
          ]),
        });
      }

      // Usar batchUpdate con múltiples rangos para escribir solo en columnas específicas
      const response = await fetch(
        `${this.apiBaseUrl}/spreadsheets/${spreadsheetId}/values:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            valueInputOption: "USER_ENTERED",
            data: dataUpdates,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `Error escribiendo datos: ${JSON.stringify(errorData)}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Error escribiendo datos:", error);
      throw error;
    }
  }

  /**
   * Sincroniza los datos procesados a Google Sheets
   * Este es el método principal que orquesta todo el proceso
   */
  async syncDataToSheets(dataType = "all") {
    const config = await this.getConfig();
    if (!config) {
      throw new Error("No hay configuración de Google Sheets guardada");
    }

    if (!this.isAuthenticated) {
      throw new Error("No autenticado. Por favor, conéctate primero.");
    }

    if (!window.operationsProcessor) {
      throw new Error("No hay datos procesados disponibles");
    }

    // Validar configuración
    if (!config.spreadsheetId || !config.sheetName || !config.startRow) {
      throw new Error(
        "Configuración incompleta. Verifica spreadsheet, hoja y fila de inicio."
      );
    }

    if (
      !config.columnMapping ||
      !config.columnMapping.fecha ||
      !config.columnMapping.tipo ||
      !config.columnMapping.cantidad ||
      !config.columnMapping.basePrecio
    ) {
      throw new Error(
        "Mapeo de columnas incompleto. Verifica que todas las columnas estén configuradas."
      );
    }

    try {
      // 1. Obtener timestamp actual
      const currentTimestamp = Date.now();
      const currentDate = this.extractDateFromTimestamp(currentTimestamp);

      // 2. Buscar filas del mismo día
      const rowsToDelete = await this.findRowsByDate(
        config.spreadsheetId,
        config.sheetName,
        config,
        currentDate
      );

      // 3. Borrar filas del mismo día si existen
      if (rowsToDelete.length > 0) {
        await this.deleteRows(
          config.spreadsheetId,
          config.sheetName,
          rowsToDelete
        );
      }

      // 4. Preparar datos para escribir
      let allData = [];

      if (dataType === "calls" || dataType === "all") {
        const callsData = window.operationsProcessor.callsData || [];
        callsData.forEach((op) => {
          allData.push({
            fecha: currentTimestamp,
            tipo: "CALL",
            cantidad: op.cantidad,
            basePrecio: op.base,
            prima: op.precio,
          });
        });
      }

      if (dataType === "puts" || dataType === "all") {
        const putsData = window.operationsProcessor.putsData || [];
        putsData.forEach((op) => {
          allData.push({
            fecha: currentTimestamp,
            tipo: "PUT",
            cantidad: op.cantidad,
            basePrecio: op.base,
            prima: op.precio,
          });
        });
      }

      if (dataType === "acciones" || dataType === "all") {
        const accionesData = window.operationsProcessor.accionesData || [];
        accionesData.forEach((op) => {
          allData.push({
            fecha: currentTimestamp,
            tipo: "ACC",
            cantidad: op.cantidad,
            basePrecio: op.precio, // Para ACCIONES, precio va en basePrecio
            prima: "", // PRIMA vacía para ACCIONES
          });
        });
      }

      if (allData.length === 0) {
        throw new Error("No hay datos para sincronizar");
      }

      // 5. Escribir nuevas filas
      await this.writeData(
        config.spreadsheetId,
        config.sheetName,
        allData,
        config
      );

      return {
        success: true,
        rowsWritten: allData.length,
        rowsDeleted: rowsToDelete.length,
        timestamp: currentTimestamp,
      };
    } catch (error) {
      console.error("Error sincronizando datos:", error);
      throw error;
    }
  }
}

// Instancia global
window.googleSheetsIntegration = new GoogleSheetsIntegration();
