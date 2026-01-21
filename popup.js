// Popup script ultra-simplificado para Procesador de opciones

// Variable global para la API del procesador de mercado
const API_PROCESADOR_MERCADO =
  "https://api-procesador-mercado.mercadodecapitales.site/api/v1/operations";

// Presets de conexiones XOMS (API + WebSocket)
const XOMS_PRESETS = [
  {
    id: "remarkets",
    label: "PRUEBA REMARKETS",
    apiUrl: "https://api.remarkets.primary.com.ar/",
    wsUrl: "wss://api.remarkets.primary.com.ar/",
  },
  {
    id: "cocos",
    label: "Cocos Capital 🥥 (Plan Pro)",
    apiUrl: "https://api.cocos.xoms.com.ar/",
    wsUrl: "wss://api.cocos.xoms.com.ar/",
  },
  {
    id: "eco",
    label: "Eco Valores",
    apiUrl: "https://api.eco.xoms.com.ar/",
    wsUrl: "wss://api.eco.xoms.com.ar/",
  },
  {
    id: "veta",
    label: "Veta Capital",
    apiUrl: "https://api.veta.xoms.com.ar/",
    wsUrl: "wss://api.veta.xoms.com.ar/",
  },
  {
    id: "bull",
    label: "Bull Market Brokers",
    apiUrl: "https://api.bull.xoms.com.ar/",
    wsUrl: "wss://api.bull.xoms.com.ar/",
  },
  {
    id: "cohen",
    label: "Cohen",
    apiUrl: "https://api.cohen.xoms.com.ar/",
    wsUrl: "wss://api.cohen.xoms.com.ar/",
  },
  {
    id: "adcap",
    label: "Adcap",
    apiUrl: "https://api.adcap.xoms.com.ar/",
    wsUrl: "wss://api.adcap.xoms.com.ar/",
  },
  {
    id: "bcch",
    label: "BCCH",
    apiUrl: "https://api.bcch.xoms.com.ar/",
    wsUrl: "wss://api.bcch.xoms.com.ar/",
  },
];

class PopupManager {
  constructor() {
    this.isLoading = false;
    this.init();
  }

  async init() {
    try {
      // Verificar que operationsProcessor esté disponible
      if (!window.operationsProcessor) {
        console.error("OperationsProcessor no está disponible");
        this.showError(
          "Error: OperationsProcessor no está disponible. Recarga la extensión."
        );
        return;
      }

      // Cargar configuración
      await window.operationsProcessor.loadConfig();

      // Configurar event listeners
      this.setupEventListeners();

      // Cargar UI
      this.loadConfigToUI();

      // Cargar configuración XOMS
      await this.loadXomsConfig();

      // Cargar preferencia de procesamiento (CSV u OMS) con delay para asegurar que el DOM esté listo
      setTimeout(async () => {
        await this.loadProcessPreference();
      }, 100);

      // Verificar datos guardados con un pequeño delay para asegurar que todo esté listo
      setTimeout(async () => {
        await this.checkSavedData();
      }, 200);
    } catch (e) {
      console.error("Error inicializando popup:", e);
      this.showError("Error inicializando la extensión: " + e.message);
    }
  }

  setupEventListeners() {
    // Pestañas principales (solo las que tienen data-tab, no data-process-tab)
    document.querySelectorAll(".tab-btn[data-tab]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.switchMainTab(e.target.dataset.tab);
      });
    });

    // Pestañas de vista previa
    document.querySelectorAll(".preview-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.switchPreviewTab(e.target.dataset.tab);
      });
    });

    // Configuración
    const symbolSelect = document.getElementById("symbolSelect");
    const expirationSelect = document.getElementById("expirationSelect");
    const useAveraging = document.getElementById("useAveraging");

    if (symbolSelect) {
      symbolSelect.addEventListener("change", (e) => {
        window.operationsProcessor.setActiveSymbol(e.target.value);
      });
    }

    if (expirationSelect) {
      expirationSelect.addEventListener("change", (e) => {
        window.operationsProcessor.setExpiration(e.target.value);
      });
    }

    if (useAveraging) {
      useAveraging.addEventListener("change", (e) => {
        window.operationsProcessor.setUseAveraging(e.target.checked);
      });
    }

    // Selector de formato
    const exportFormatSelect = document.getElementById("exportFormatSelect");
    if (exportFormatSelect) {
      exportFormatSelect.addEventListener("change", async (e) => {
        await window.operationsProcessor.setExportFormat(e.target.value);
        this.updateUIForFormat(e.target.value);
      });
    }

    // Archivo CSV
    const csvFileInput = document.getElementById("csvFileInput");
    if (csvFileInput) {
      csvFileInput.addEventListener("change", (e) => {
        this.enableProcessButton();
      });
    }

    // Botones principales
    const processBtn = document.getElementById("processOperationsBtn");
    if (processBtn) {
      processBtn.addEventListener("click", () => this.processOperations());
    }

    const clearBtn = document.getElementById("clearDataBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => this.clearOperationsResults());
    }

    // Botones de copia rápida (parte superior)
    const quickCopyCallsBtn = document.getElementById("quickCopyCallsBtn");
    if (quickCopyCallsBtn) {
      quickCopyCallsBtn.addEventListener("click", () =>
        this.copyOperationsData("calls")
      );
    }

    const quickCopyPutsBtn = document.getElementById("quickCopyPutsBtn");
    if (quickCopyPutsBtn) {
      quickCopyPutsBtn.addEventListener("click", () =>
        this.copyOperationsData("puts")
      );
    }

    const quickCopyAccionesBtn = document.getElementById(
      "quickCopyAccionesBtn"
    );
    if (quickCopyAccionesBtn) {
      quickCopyAccionesBtn.addEventListener("click", () =>
        this.copyOperationsData("acciones")
      );
    }

    // Botón de copiar DeltaVega (copia rápida)
    const quickCopyDeltaVegaBtn = document.getElementById(
      "quickCopyDeltaVegaBtn"
    );
    if (quickCopyDeltaVegaBtn) {
      quickCopyDeltaVegaBtn.addEventListener("click", () =>
        this.copyOperationsData("all")
      );
    }

    // Botones de resultados
    const downloadAllBtn = document.getElementById("downloadAllBtn");
    if (downloadAllBtn) {
      downloadAllBtn.addEventListener("click", () => this.downloadAllFile());
    }

    const copyCallsBtn = document.getElementById("copyCallsBtn");
    if (copyCallsBtn) {
      copyCallsBtn.addEventListener("click", () =>
        this.copyOperationsData("calls")
      );
    }

    const copyPutsBtn = document.getElementById("copyPutsBtn");
    if (copyPutsBtn) {
      copyPutsBtn.addEventListener("click", () =>
        this.copyOperationsData("puts")
      );
    }

    const downloadCallsBtn = document.getElementById("downloadCallsBtn");
    if (downloadCallsBtn) {
      downloadCallsBtn.addEventListener("click", () =>
        this.downloadCallsFile()
      );
    }

    const downloadPutsBtn = document.getElementById("downloadPutsBtn");
    if (downloadPutsBtn) {
      downloadPutsBtn.addEventListener("click", () => this.downloadPutsFile());
    }

    const copyAccionesBtn = document.getElementById("copyAccionesBtn");
    if (copyAccionesBtn) {
      copyAccionesBtn.addEventListener("click", () =>
        this.copyOperationsData("acciones")
      );
    }

    // Botón de copiar DeltaVega (resultados)
    const copyDeltaVegaBtn = document.getElementById("copyDeltaVegaBtn");
    if (copyDeltaVegaBtn) {
      copyDeltaVegaBtn.addEventListener("click", () =>
        this.copyOperationsData("all")
      );
    }

    const downloadAccionesBtn = document.getElementById("downloadAccionesBtn");
    if (downloadAccionesBtn) {
      downloadAccionesBtn.addEventListener("click", () =>
        this.downloadAccionesFile()
      );
    }

    // Configuración avanzada
    const addSymbolBtn = document.getElementById("addSymbolBtn");
    if (addSymbolBtn) {
      addSymbolBtn.addEventListener("click", () => this.addSymbol());
    }

    const addExpirationBtn = document.getElementById("addExpirationBtn");
    if (addExpirationBtn) {
      addExpirationBtn.addEventListener("click", () => this.addExpiration());
    }

    const resetConfigBtn = document.getElementById("resetConfigBtn");
    if (resetConfigBtn) {
      resetConfigBtn.addEventListener("click", () => this.resetConfiguration());
    }

    const saveConfigBtn = document.getElementById("saveConfigBtn");
    if (saveConfigBtn) {
      saveConfigBtn.addEventListener("click", () => this.saveConfiguration());
    }

    // Botón de guardar configuración XOMS
    const saveXomsConfigBtn = document.getElementById("saveXomsConfigBtn");
    if (saveXomsConfigBtn) {
      saveXomsConfigBtn.addEventListener("click", () =>
        this.saveXomsConfiguration()
      );
    }

    // Selector de preset XOMS
    const xomsPresetSelect = document.getElementById("xomsPresetSelect");
    if (xomsPresetSelect) {
      xomsPresetSelect.addEventListener("change", (e) =>
        this.handleXomsPresetChange(e.target.value)
      );
    }

    // Botón de procesar mediante OMS
    const processOmsBtn = document.getElementById("processOmsBtn");
    if (processOmsBtn) {
      processOmsBtn.addEventListener("click", () =>
        this.processOmsOperations()
      );
    }

    // Botón de limpiar datos para OMS
    const clearDataBtnOms = document.getElementById("clearDataBtnOms");
    if (clearDataBtnOms) {
      clearDataBtnOms.addEventListener("click", () =>
        this.clearOperationsResults()
      );
    }

    // Pestañas de procesamiento (CSV/OMS)
    document.querySelectorAll(".process-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation(); // Importante: detener la propagación para evitar conflictos
        const tabName =
          e.currentTarget.dataset.processTab ||
          e.target.closest(".process-tab-btn")?.dataset.processTab;
        if (tabName) {
          this.switchProcessTab(tabName);
        }
      });
    });
  }

  switchMainTab(tabName) {
    // Actualizar botones de pestañas
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });

    // Mostrar/ocultar contenido
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.toggle("active", content.id === tabName + "Tab");
    });
  }

  switchPreviewTab(tabName) {
    // Actualizar botones de pestañas
    document.querySelectorAll(".preview-tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });

    // Mostrar/ocultar contenido
    document.getElementById("previewCalls").style.display =
      tabName === "calls" ? "block" : "none";
    document.getElementById("previewPuts").style.display =
      tabName === "puts" ? "block" : "none";
    document.getElementById("previewAcciones").style.display =
      tabName === "acciones" ? "block" : "none";
  }

  switchProcessTab(tabName) {
    try {
      // Validar que tabName sea válido
      if (!tabName || (tabName !== "csv" && tabName !== "oms")) {
        console.error("Tab name inválido:", tabName);
        return;
      }

      // Guardar preferencia (no esperar para no bloquear)
      this.saveProcessPreference(tabName).catch((error) => {
        console.error("Error guardando preferencia:", error);
      });

      // Actualizar botones de pestañas
      document.querySelectorAll(".process-tab-btn").forEach((btn) => {
        if (btn.dataset.processTab === tabName) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });

      // Mostrar/ocultar contenido
      const csvTab = document.getElementById("csvProcessTab");
      const omsTab = document.getElementById("omsProcessTab");

      if (!csvTab || !omsTab) {
        console.error("No se encontraron las pestañas de procesamiento");
        return;
      }

      if (tabName === "csv") {
        csvTab.classList.add("active");
        omsTab.classList.remove("active");
      } else {
        csvTab.classList.remove("active");
        omsTab.classList.add("active");
      }

      // Actualizar advertencia de configuración OMS
      if (tabName === "oms") {
        // Usar setTimeout para asegurar que los elementos estén disponibles
        setTimeout(() => {
          try {
            this.updateOmsConfigWarning();
          } catch (error) {
            console.error("Error actualizando advertencia OMS:", error);
          }
        }, 100);
      }
    } catch (error) {
      console.error("Error en switchProcessTab:", error);
      // Intentar mostrar al menos la pestaña CSV como fallback
      try {
        const csvTab = document.getElementById("csvProcessTab");
        const omsTab = document.getElementById("omsProcessTab");
        if (csvTab && omsTab) {
          csvTab.classList.add("active");
          omsTab.classList.remove("active");
        }
      } catch (fallbackError) {
        console.error("Error en fallback:", fallbackError);
      }
    }
  }

  async saveProcessPreference(tabName) {
    try {
      await chrome.storage.local.set({
        processPreference: tabName, // "csv" o "oms"
      });
    } catch (error) {
      console.error("Error guardando preferencia de procesamiento:", error);
    }
  }

  async loadProcessPreference() {
    try {
      // Verificar que los elementos existan antes de cambiar
      const csvTab = document.getElementById("csvProcessTab");
      const omsTab = document.getElementById("omsProcessTab");

      if (!csvTab || !omsTab) {
        console.warn("Las pestañas de procesamiento aún no están disponibles");
        return;
      }

      const storageData = await chrome.storage.local.get(["processPreference"]);
      const preference = storageData.processPreference || "csv";
      this.switchProcessTab(preference);
    } catch (error) {
      console.error("Error cargando preferencia de procesamiento:", error);
      // Por defecto mostrar CSV si hay error
      try {
        const csvTab = document.getElementById("csvProcessTab");
        const omsTab = document.getElementById("omsProcessTab");
        if (csvTab && omsTab) {
          csvTab.classList.add("active");
          omsTab.classList.remove("active");
        }
      } catch (fallbackError) {
        console.error(
          "Error en fallback de loadProcessPreference:",
          fallbackError
        );
      }
    }
  }

  updateOmsConfigWarning() {
    try {
      const warningDiv = document.getElementById("omsConfigWarning");
      if (!warningDiv) {
        console.warn("Elemento omsConfigWarning no encontrado");
        return;
      }

      if (this.validateXomsConfig()) {
        warningDiv.style.display = "none";
      } else {
        warningDiv.style.display = "block";
      }
    } catch (error) {
      console.error("Error actualizando advertencia OMS:", error);
    }
  }

  loadConfigToUI() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      // Cargar símbolos
      this.loadSymbolsToSelect();
      this.loadSymbolsList();

      // Cargar vencimientos
      this.loadExpirationsToSelect();
      this.loadExpirationsList();

      // Establecer valores
      const symbolSelect = document.getElementById("symbolSelect");
      const expirationSelect = document.getElementById("expirationSelect");
      const useAveraging = document.getElementById("useAveraging");
      const exportFormatSelect = document.getElementById("exportFormatSelect");

      if (symbolSelect) {
        symbolSelect.value = window.operationsProcessor.getActiveSymbol();
      }

      if (expirationSelect) {
        expirationSelect.value = window.operationsProcessor.getExpiration();
      }

      if (useAveraging) {
        useAveraging.checked = window.operationsProcessor.getUseAveraging();
      }

      if (exportFormatSelect) {
        const currentFormat = window.operationsProcessor.getExportFormat();
        exportFormatSelect.value = currentFormat || "EPGB";
        this.updateUIForFormat(currentFormat || "EPGB");
      }
    } catch (error) {
      console.error("Error cargando configuración:", error);
    } finally {
      this.isLoading = false;
    }
  }

  loadSymbolsToSelect() {
    const symbolSelect = document.getElementById("symbolSelect");
    if (!symbolSelect) return;

    try {
      const symbols = window.operationsProcessor.getAvailableSymbols();
      if (!symbols || symbols.length === 0) return;

      // Solo actualizar si hay cambios
      const currentOptions = Array.from(symbolSelect.options).map(
        (opt) => opt.value
      );
      const hasChanged =
        symbols.length !== currentOptions.length ||
        symbols.some((symbol) => !currentOptions.includes(symbol));

      if (hasChanged) {
        symbolSelect.innerHTML = "";
        symbols.forEach((symbol) => {
          const option = document.createElement("option");
          option.value = symbol;
          option.textContent = symbol;
          symbolSelect.appendChild(option);
        });
      }
    } catch (error) {
      console.error("Error cargando símbolos:", error);
    }
  }

  loadExpirationsToSelect() {
    const expirationSelect = document.getElementById("expirationSelect");
    if (!expirationSelect) return;

    try {
      const expirations = window.operationsProcessor.getAvailableExpirations();
      if (!expirations || Object.keys(expirations).length === 0) return;

      // Solo actualizar si hay cambios
      const currentOptions = Array.from(expirationSelect.options).map(
        (opt) => opt.value
      );
      const expirationKeys = Object.keys(expirations);
      const hasChanged =
        expirationKeys.length !== currentOptions.length ||
        expirationKeys.some((key) => !currentOptions.includes(key));

      if (hasChanged) {
        expirationSelect.innerHTML = "";
        Object.keys(expirations).forEach((code) => {
          const option = document.createElement("option");
          option.value = code;
          option.textContent = `${code} - ${expirations[code].name}`;
          expirationSelect.appendChild(option);
        });
      }
    } catch (error) {
      console.error("Error cargando vencimientos:", error);
    }
  }

  loadSymbolsList() {
    const symbolsList = document.getElementById("symbolsList");
    if (!symbolsList) return;

    try {
      const symbols = window.operationsProcessor.getAvailableSymbols();
      symbolsList.innerHTML = "";

      if (symbols.length === 0) {
        symbolsList.innerHTML =
          '<div class="empty-state">No hay símbolos configurados</div>';
        return;
      }

      symbols.forEach((symbol) => {
        const item = document.createElement("div");
        item.className = "config-item";
        const subyacente =
          window.operationsProcessor.getSubyacenteForSymbol(symbol) || "";
        item.innerHTML = `
          <div style="flex: 1;">
            <div style="font-weight: 500; margin-bottom: 4px;">${symbol}</div>
            <div style="font-size: 12px; color: #6b7280;">
              <div><strong>Subyacente:</strong> ${subyacente || "N/A"}</div>
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="edit-symbol-btn" data-symbol="${symbol}" style="padding: 4px 8px; font-size: 11px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer;">Editar</button>
            <button class="remove-symbol-btn" data-symbol="${symbol}" style="padding: 4px 8px; font-size: 11px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">Eliminar</button>
          </div>
        `;

        // Agregar event listeners
        const editBtn = item.querySelector(".edit-symbol-btn");
        const removeBtn = item.querySelector(".remove-symbol-btn");

        editBtn.addEventListener("click", () => {
          this.editSymbol(editBtn.dataset.symbol);
        });

        removeBtn.addEventListener("click", () => {
          this.removeSymbol(removeBtn.dataset.symbol);
        });

        symbolsList.appendChild(item);
      });
    } catch (error) {
      console.error("Error cargando lista de símbolos:", error);
    }
  }

  loadExpirationsList() {
    const expirationsList = document.getElementById("expirationsList");
    if (!expirationsList) return;

    try {
      const expirations = window.operationsProcessor.getAvailableExpirations();
      expirationsList.innerHTML = "";

      if (Object.keys(expirations).length === 0) {
        expirationsList.innerHTML =
          '<div class="empty-state">No hay vencimientos configurados</div>';
        return;
      }

      Object.keys(expirations).forEach((code) => {
        const item = document.createElement("div");
        item.className = "config-item";
        const suffixes = expirations[code].suffixes
          ? expirations[code].suffixes.join(", ")
          : "";
        item.innerHTML = `
          <div style="flex: 1;">
            <div style="font-weight: 500; margin-bottom: 4px;">${code} - ${
          expirations[code].name
        }</div>
            <div style="font-size: 12px; color: #6b7280;">
              <div><strong>Sufijos:</strong> ${suffixes || "N/A"}</div>
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="edit-expiration-btn" data-code="${code}" style="padding: 4px 8px; font-size: 11px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer;">Editar</button>
            <button class="remove-expiration-btn" data-code="${code}" style="padding: 4px 8px; font-size: 11px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">Eliminar</button>
          </div>
        `;

        // Agregar event listeners
        const editBtn = item.querySelector(".edit-expiration-btn");
        const removeBtn = item.querySelector(".remove-expiration-btn");

        editBtn.addEventListener("click", () => {
          this.editExpiration(editBtn.dataset.code);
        });

        removeBtn.addEventListener("click", () => {
          this.removeExpiration(removeBtn.dataset.code);
        });

        expirationsList.appendChild(item);
      });
    } catch (error) {
      console.error("Error cargando lista de vencimientos:", error);
    }
  }

  enableProcessButton() {
    const processBtn = document.getElementById("processOperationsBtn");
    const csvFileInput = document.getElementById("csvFileInput");

    if (processBtn && csvFileInput) {
      processBtn.disabled = !csvFileInput.files[0];
    }
  }

  async processOperations() {
    const csvFileInput = document.getElementById("csvFileInput");
    const symbolSelect = document.getElementById("symbolSelect");
    const expirationSelect = document.getElementById("expirationSelect");
    const useAveraging = document.getElementById("useAveraging");
    const processBtn = document.getElementById("processOperationsBtn");

    if (!csvFileInput.files[0]) {
      this.showStatus("Selecciona un archivo CSV o Excel", "error");
      return;
    }

    const file = csvFileInput.files[0];
    const fileName = file.name;
    const isExcel = fileName.toLowerCase().endsWith(".xlsx");

    try {
      processBtn.disabled = true;
      processBtn.textContent = "Procesando...";
      this.showStatus(
        isExcel ? "Leyendo archivo Excel..." : "Leyendo archivo CSV...",
        "info"
      );

      let fileData;
      if (isExcel) {
        // Verificar que XLSX esté disponible antes de procesar Excel
        // Intentar múltiples formas de acceso a XLSX
        const xlsxLib = typeof XLSX !== "undefined" ? XLSX : (typeof window !== "undefined" && window.XLSX ? window.XLSX : null);
        if (!xlsxLib) {
          throw new Error(
            "SheetJS (XLSX) no está disponible. Por favor, espera unos segundos y recarga la extensión."
          );
        }
        // Leer Excel como ArrayBuffer
        fileData = await this.readFileAsArrayBuffer(file);
      } else {
        // Leer CSV como texto
        fileData = await this.readFileAsText(file);
      }

      this.showStatus("Procesando operaciones...", "info");

      const result = await window.operationsProcessor.processCsvData(
        fileData,
        useAveraging.checked,
        symbolSelect.value,
        expirationSelect.value,
        fileName
      );

      if (result.success) {
        const formatLabel = result.formatLabel || "CSV";
        this.showStatus(`Operaciones procesadas exitosamente (${formatLabel})`, "success");
        this.displayOperationsResults(result);
        this.showResultsSection();

        // Guardar la hora de procesamiento
        await this.saveLastProcessTime();

        await this.checkSavedData();
      } else {
        this.showStatus(`Error: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("Error procesando operaciones:", error);
      this.showStatus(`Error procesando archivo: ${error.message}`, "error");
    } finally {
      processBtn.disabled = false;
      processBtn.textContent = "Procesar Operaciones";
    }
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error("Error leyendo archivo"));
      reader.readAsText(file);
    });
  }

  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error("Error leyendo archivo Excel"));
      reader.readAsArrayBuffer(file);
    });
  }

  displayOperationsResults(result) {
    const summaryDiv = document.getElementById("operationsSummary");
    const callsTableBody = document.getElementById("callsTableBody");
    const putsTableBody = document.getElementById("putsTableBody");
    const accionesTableBody = document.getElementById("accionesTableBody");

    if (summaryDiv) {
      const symbolText = result.symbol || "N/A";
      const expirationText = result.expiration || "N/A";

      // Mostrar siempre las cantidades SIN promedios
      const totalOps =
        result.callsData.length +
        result.putsData.length +
        (result.accionesData?.length || 0);
      const callsCount = result.callsData.length;
      const putsCount = result.putsData.length;
      const accionesCount = result.accionesData?.length || 0;

      // Si hay promedios, mostrar también las cantidades originales
      const hasAveraging =
        result.useAveraging &&
        result.originalCallsCount &&
        result.originalPutsCount &&
        (result.originalCallsCount !== callsCount ||
          result.originalPutsCount !== putsCount);

      const formatLabel = result.formatLabel || "CSV";
      const formatColor = result.detectedFormat === "OMS_BYMA" ? "#10b981" : "#8b5cf6";
      
      let summaryHTML = `
        <div class="summary-item">
          <span class="summary-label">Formato:</span>
          <span class="summary-value" style="background: ${formatColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${formatLabel}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Modo:</span>
          <span class="summary-value" style="background: #8b5cf6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${
            result.useAveraging ? "CON PROMEDIOS" : "SIN PROMEDIOS"
          }</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Símbolo:</span>
          <span class="summary-value">${symbolText}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Vencimiento:</span>
          <span class="summary-value">${expirationText}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Total Operaciones:</span>
          <span class="summary-value">${
            hasAveraging && result.originalCallsCount
              ? result.originalCallsCount +
                result.originalPutsCount +
                accionesCount
              : totalOps
          }</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">CALLS:</span>
          <span class="summary-value">${
            hasAveraging && result.originalCallsCount
              ? result.originalCallsCount
              : callsCount
          }</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">PUTS:</span>
          <span class="summary-value">${
            hasAveraging && result.originalPutsCount
              ? result.originalPutsCount
              : putsCount
          }</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">ACCIONES:</span>
          <span class="summary-value">${accionesCount}</span>
        </div>
      `;

      // Agregar caja de promedios si aplica
      if (hasAveraging) {
        summaryHTML += `
          <div style="margin-top: 16px; padding: 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px;">
            <div style="font-weight: 600; color: #1e40af; margin-bottom: 8px; font-size: 13px;">📊 CON PROMEDIOS APLICADOS:</div>
            <div class="summary-item">
              <span class="summary-label">Total Operaciones:</span>
              <span class="summary-value">${totalOps}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">CALLS:</span>
              <span class="summary-value">${callsCount}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">PUTS:</span>
              <span class="summary-value">${putsCount}</span>
            </div>
          </div>
        `;
      }

      summaryDiv.innerHTML = summaryHTML;
    }

    // Llenar tabla de CALLS
    if (callsTableBody) {
      callsTableBody.innerHTML = "";
      if (result.callsData.length > 0) {
        result.callsData.forEach((op) => {
          const row = document.createElement("tr");
          const cantidadClass = op.cantidad >= 0 ? "positive" : "negative";
          const precio4 = Number(op.precio).toFixed(4);
          row.innerHTML = `
            <td class="${cantidadClass}">${op.cantidad}</td>
            <td>${op.base}</td>
            <td>$${precio4}</td>
          `;
          callsTableBody.appendChild(row);
        });
      } else {
        const row = document.createElement("tr");
        row.innerHTML =
          '<td colspan="3" style="text-align: center; color: #6b7280;">No hay operaciones CALLS</td>';
        callsTableBody.appendChild(row);
      }
    }

    // Llenar tabla de PUTS
    if (putsTableBody) {
      putsTableBody.innerHTML = "";
      if (result.putsData.length > 0) {
        result.putsData.forEach((op) => {
          const row = document.createElement("tr");
          const cantidadClass = op.cantidad >= 0 ? "positive" : "negative";
          const precio4 = Number(op.precio).toFixed(4);
          row.innerHTML = `
            <td class="${cantidadClass}">${op.cantidad}</td>
            <td>${op.base}</td>
            <td>$${precio4}</td>
          `;
          putsTableBody.appendChild(row);
        });
      } else {
        const row = document.createElement("tr");
        row.innerHTML =
          '<td colspan="3" style="text-align: center; color: #6b7280;">No hay operaciones PUTS</td>';
        putsTableBody.appendChild(row);
      }
    }

    // Llenar tabla de ACCIONES
    if (accionesTableBody) {
      accionesTableBody.innerHTML = "";
      if (result.accionesData && result.accionesData.length > 0) {
        result.accionesData.forEach((op) => {
          const row = document.createElement("tr");
          const cantidadClass = op.cantidad >= 0 ? "positive" : "negative";
          const precio4 = Number(op.precio).toFixed(4);
          row.innerHTML = `
            <td>${op.simbolo}</td>
            <td class="${cantidadClass}">${op.cantidad}</td>
            <td>$${precio4}</td>
          `;
          accionesTableBody.appendChild(row);
        });
      } else {
        const row = document.createElement("tr");
        row.innerHTML =
          '<td colspan="3" style="text-align: center; color: #6b7280;">No hay operaciones de acciones</td>';
        accionesTableBody.appendChild(row);
      }
    }
  }

  showResultsSection() {
    const resultsSection = document.getElementById("resultsSection");
    if (resultsSection) {
      resultsSection.style.display = "block";
    }

    // Mostrar también la sección de botones de copia rápida solo si hay datos
    this.showQuickCopySection();
  }

  async showQuickCopySection() {
    try {
      // Verificar si hay datos procesados antes de mostrar la sección
      const hasData = window.operationsProcessor.hasProcessedData();

      if (hasData) {
        const quickCopySection = document.getElementById("quickCopySection");
        if (quickCopySection) {
          quickCopySection.style.display = "block";
        }
      }
    } catch (error) {
      console.error(
        "Error verificando datos para mostrar sección de copia:",
        error
      );
    }
  }

  async saveLastProcessTime() {
    try {
      const now = new Date();
      const timeString = now.toLocaleString("es-ES", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      await chrome.storage.local.set({
        lastProcessTime: timeString,
        lastProcessTimestamp: now.getTime(),
      });
    } catch (error) {
      console.error("Error guardando hora de procesamiento:", error);
    }
  }

  async showLastReportInfo() {
    try {
      // Verificar si hay datos procesados antes de mostrar la información
      const hasData = window.operationsProcessor.hasProcessedData();

      if (!hasData) {
        return; // No mostrar si no hay datos
      }

      const storageData = await chrome.storage.local.get(["lastProcessTime"]);

      if (storageData.lastProcessTime) {
        const lastReportInfo = document.getElementById("lastReportInfo");

        if (lastReportInfo) {
          lastReportInfo.innerHTML = `
              <span style="color: #6b7280;">${storageData.lastProcessTime}</span>
            `;
        }
      }
    } catch (error) {
      console.error("Error mostrando información del último reporte:", error);
    }
  }

  async checkSavedData() {
    try {
      // Verificar que operationsProcessor esté disponible
      if (!window.operationsProcessor) {
        console.error(
          "OperationsProcessor no está disponible en checkSavedData"
        );
        return;
      }

      // Forzar recarga de configuración para asegurar que tenemos los datos más recientes
      await window.operationsProcessor.loadConfig();

      // Verificar también directamente desde el storage
      const storageData = await chrome.storage.local.get([
        "callsData",
        "putsData",
        "accionesData",
        "processedData",
      ]);

      if (
        window.operationsProcessor.hasProcessedData() ||
        (storageData.callsData && storageData.callsData.length > 0) ||
        (storageData.putsData && storageData.putsData.length > 0) ||
        (storageData.accionesData && storageData.accionesData.length > 0)
      ) {
        const report = window.operationsProcessor.generateVisualReport();
        this.displaySavedDataInfo(report);
        this.showSavedDataSection();

        // También mostrar los resultados procesados
        await this.displaySavedResults();
        this.showResultsSection();

        // Mostrar información del último reporte
        await this.showLastReportInfo();
      }
    } catch (error) {
      console.error("Error verificando datos guardados:", error);
    }
  }

  displaySavedDataInfo(report) {
    const savedDataInfo = document.getElementById("savedDataInfo");
    if (savedDataInfo) {
      // Verificar si el reporte tiene la estructura correcta
      if (report.error) {
        savedDataInfo.innerHTML = `<div class="status error">${report.error}</div>`;
        return;
      }

      // Usar la estructura correcta del reporte
      const resumen = report.resumen || {};
      const calls = report.calls || {};
      const puts = report.puts || {};
      const acciones = report.acciones || {};

      savedDataInfo.innerHTML = `
        <strong>Última sesión procesada:</strong><br>
        Símbolo: ${resumen.simboloActivo || "N/A"}<br>
        Vencimiento: ${resumen.vencimiento || "N/A"}<br>
        Modo: ${resumen.modoPromedio ? "CON PROMEDIOS" : "SIN PROMEDIOS"}<br>
        CALLS: ${calls.count || 0} operaciones<br>
        PUTS: ${puts.count || 0} operaciones<br>
        ACCIONES: ${acciones.count || 0} operaciones
      `;
    }
  }

  async displaySavedResults() {
    try {
      // Verificar directamente el storage
      const storageData = await chrome.storage.local.get([
        "callsData",
        "putsData",
        "accionesData",
        "processedData",
        "activeSymbol",
        "expiration",
        "useAveraging",
      ]);

      // Usar datos del storage directamente si están disponibles
      const callsData =
        storageData.callsData || window.operationsProcessor.callsData || [];
      const putsData =
        storageData.putsData || window.operationsProcessor.putsData || [];
      const accionesData =
        storageData.accionesData ||
        window.operationsProcessor.accionesData ||
        [];

      // Crear un objeto de resultado similar al que se genera al procesar
      const result = {
        symbol:
          storageData.activeSymbol ||
          window.operationsProcessor.getActiveSymbol(),
        expiration:
          storageData.expiration || window.operationsProcessor.getExpiration(),
        useAveraging:
          storageData.useAveraging !== undefined
            ? storageData.useAveraging
            : window.operationsProcessor.getUseAveraging(),
        callsData: callsData,
        putsData: putsData,
        accionesData: accionesData,
      };

      // Mostrar los resultados usando la misma función que se usa al procesar
      this.displayOperationsResults(result);
    } catch (error) {
      console.error("Error mostrando resultados guardados:", error);
    }
  }

  showSavedDataSection() {
    const savedDataSection = document.getElementById("savedDataSection");
    if (savedDataSection) {
      savedDataSection.style.display = "block";
    }
  }

  async downloadAllFile() {
    try {
      this.showStatus("Generando archivo...", "info");
      const filename = await window.operationsProcessor.generateExcelFile();
      this.showStatus(`Archivo descargado: ${filename}`, "success");
    } catch (error) {
      console.error("Error descargando archivo:", error);
      this.showStatus("Error generando archivo", "error");
    }
  }

  async copyOperationsData(type = "all") {
    try {
      this.showStatus("Copiando datos...", "info");
      const copyData = window.operationsProcessor.generateCopyData(type);
      await navigator.clipboard.writeText(copyData);
      this.showStatus("Datos copiados al portapapeles", "success");
    } catch (error) {
      console.error("Error copiando datos:", error);
      this.showStatus("Error copiando datos", "error");
    }
  }

  async downloadCallsFile() {
    try {
      this.showStatus("Generando archivo CALLS...", "info");
      const filename = await window.operationsProcessor.generateCallsFile();
      this.showStatus(`Archivo CALLS descargado: ${filename}`, "success");
    } catch (error) {
      console.error("Error descargando archivo CALLS:", error);
      this.showStatus("Error generando archivo CALLS", "error");
    }
  }

  async downloadPutsFile() {
    try {
      this.showStatus("Generando archivo PUTS...", "info");
      const filename = await window.operationsProcessor.generatePutsFile();
      this.showStatus(`Archivo PUTS descargado: ${filename}`, "success");
    } catch (error) {
      console.error("Error descargando archivo PUTS:", error);
      this.showStatus("Error generando archivo PUTS", "error");
    }
  }

  async downloadAccionesFile() {
    try {
      this.showStatus("Generando archivo ACCIONES...", "info");
      const filename = await window.operationsProcessor.generateAccionesFile();
      this.showStatus(`Archivo ACCIONES descargado: ${filename}`, "success");
    } catch (error) {
      console.error("Error descargando archivo ACCIONES:", error);
      this.showStatus("Error generando archivo ACCIONES", "error");
    }
  }

  async clearOperationsResults() {
    if (confirm("¿Eliminar todos los datos procesados?")) {
      try {
        await window.operationsProcessor.clearProcessedData();

        // Limpiar UI
        document.getElementById("resultsSection").style.display = "none";
        document.getElementById("savedDataSection").style.display = "none";
        document.getElementById("quickCopySection").style.display = "none";
        document.getElementById("csvFileInput").value = "";
        this.enableProcessButton();

        this.showStatus("Todos los datos eliminados correctamente", "success");
      } catch (error) {
        console.error("Error limpiando datos:", error);
        this.showStatus("Error limpiando datos", "error");
      }
    }
  }

  async addSymbol() {
    const newSymbolInput = document.getElementById("newSymbolInput");
    const newSubyacenteInput = document.getElementById("newSubyacenteInput");
    const symbol = newSymbolInput.value.trim();
    const subyacente = newSubyacenteInput.value.trim();

    if (!symbol) {
      this.showStatus("Ingresa un símbolo válido", "error");
      return;
    }

    if (!subyacente) {
      this.showStatus("Ingresa el símbolo subyacente", "error");
      return;
    }

    try {
      await window.operationsProcessor.addSymbol(symbol, subyacente);
      newSymbolInput.value = "";
      newSubyacenteInput.value = "";
      this.loadSymbolsToSelect();
      this.loadSymbolsList();
      this.showStatus(`Símbolo ${symbol} (${subyacente}) agregado`, "success");
    } catch (error) {
      console.error("Error agregando símbolo:", error);
      this.showStatus("Error agregando símbolo", "error");
    }
  }

  async removeSymbol(symbol) {
    if (confirm(`¿Eliminar el símbolo ${symbol}?`)) {
      try {
        await window.operationsProcessor.removeSymbol(symbol);
        this.loadSymbolsToSelect();
        this.loadSymbolsList();
        this.showStatus(`Símbolo ${symbol} eliminado`, "success");
      } catch (error) {
        console.error("Error eliminando símbolo:", error);
        this.showStatus("Error eliminando símbolo", "error");
      }
    }
  }

  async addExpiration() {
    const nameInput = document.getElementById("newExpirationNameInput");
    const suffixesInput = document.getElementById("newExpirationSuffixesInput");

    const name = nameInput.value.trim();
    const suffixes = suffixesInput.value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);

    // Validaciones
    if (!name) {
      this.showStatus("Ingresa el nombre del mes", "error");
      return;
    }

    if (suffixes.length === 0) {
      this.showStatus("Ingresa al menos un sufijo", "error");
      return;
    }

    if (suffixes.length > 3) {
      this.showStatus("Máximo 3 sufijos permitidos", "error");
      return;
    }

    // Validar que no haya comas de más
    const originalSuffixes = suffixesInput.value.trim();
    if (originalSuffixes.endsWith(",") || originalSuffixes.startsWith(",")) {
      this.showStatus("No pongas comas al inicio o final", "error");
      return;
    }

    // Validar que no haya comas consecutivas
    if (originalSuffixes.includes(",,")) {
      this.showStatus("No pongas comas consecutivas", "error");
      return;
    }

    try {
      // Generar código automáticamente basado en el nombre del mes
      const monthCode = this.generateMonthCode(name);
      await window.operationsProcessor.addExpiration(monthCode, name, suffixes);
      nameInput.value = "";
      suffixesInput.value = "";
      this.loadExpirationsToSelect();
      this.loadExpirationsList();
      this.showStatus(`Vencimiento ${monthCode} agregado`, "success");
    } catch (error) {
      console.error("Error agregando vencimiento:", error);
      this.showStatus("Error agregando vencimiento", "error");
    }
  }

  generateMonthCode(monthName) {
    const monthMap = {
      enero: "ENE",
      febrero: "FEB",
      marzo: "MAR",
      abril: "ABR",
      mayo: "MAY",
      junio: "JUN",
      julio: "JUL",
      agosto: "AGO",
      septiembre: "SEP",
      octubre: "OCT",
      noviembre: "NOV",
      diciembre: "DIC",
    };
    return (
      monthMap[monthName.toLowerCase()] ||
      monthName.substring(0, 3).toUpperCase()
    );
  }

  async removeExpiration(code) {
    if (confirm(`¿Eliminar el vencimiento ${code}?`)) {
      try {
        await window.operationsProcessor.removeExpiration(code);
        this.loadExpirationsToSelect();
        this.loadExpirationsList();
        this.showStatus(`Vencimiento ${code} eliminado`, "success");
      } catch (error) {
        console.error("Error eliminando vencimiento:", error);
        this.showStatus("Error eliminando vencimiento", "error");
      }
    }
  }

  async resetConfiguration() {
    if (confirm("¿Restaurar la configuración por defecto?")) {
      try {
        await window.operationsProcessor.resetToDefaults();
        this.loadConfigToUI();
        this.showStatus("Configuración restaurada por defecto", "success");
      } catch (error) {
        console.error("Error restaurando configuración:", error);
        this.showStatus("Error restaurando configuración", "error");
      }
    }
  }

  async saveConfiguration() {
    try {
      await window.operationsProcessor.saveConfig();
      this.showStatus("Configuración guardada", "success");
    } catch (error) {
      console.error("Error guardando configuración:", error);
      this.showStatus("Error guardando configuración", "error");
    }
  }

  async loadXomsConfig() {
    try {
      const storageData = await chrome.storage.local.get([
        "xomsApiUrl",
        "xomsWsUrl",
        "xomsUser",
        "xomsPassword",
        "xomsAccount",
      ]);

      const apiInput = document.getElementById("xomsApiUrl");
      const wsInput = document.getElementById("xomsWsUrl");
      const presetSelect = document.getElementById("xomsPresetSelect");

      // Si no hay configuración guardada, usar preset por defecto (remarkets)
      if (!storageData.xomsApiUrl && !storageData.xomsWsUrl) {
        const defaultPreset = XOMS_PRESETS.find((p) => p.id === "remarkets");
        if (defaultPreset && apiInput && wsInput && presetSelect) {
          apiInput.value = defaultPreset.apiUrl;
          wsInput.value = defaultPreset.wsUrl;
          presetSelect.value = "remarkets";
          apiInput.disabled = true;
          wsInput.disabled = true;
        }
      } else {
        // Cargar configuración guardada
        if (storageData.xomsApiUrl) {
          document.getElementById("xomsApiUrl").value = storageData.xomsApiUrl;
        }
        if (storageData.xomsWsUrl) {
          document.getElementById("xomsWsUrl").value = storageData.xomsWsUrl;
        }
        if (storageData.xomsUser) {
          document.getElementById("xomsUser").value = storageData.xomsUser;
        }
        if (storageData.xomsPassword) {
          document.getElementById("xomsPassword").value =
            storageData.xomsPassword;
        }
        if (storageData.xomsAccount) {
          document.getElementById("xomsAccount").value =
            storageData.xomsAccount;
        }

        // Ajustar selector de preset según URLs guardadas
        if (apiInput && wsInput && presetSelect) {
          const apiVal = apiInput.value.trim();
          const wsVal = wsInput.value.trim();

          const matchedPreset = XOMS_PRESETS.find(
            (p) => p.apiUrl === apiVal && p.wsUrl === wsVal
          );

          if (matchedPreset) {
            presetSelect.value = matchedPreset.id;
            apiInput.disabled = true;
            wsInput.disabled = true;
          } else {
            presetSelect.value = "custom";
            apiInput.disabled = false;
            wsInput.disabled = false;
          }
        }
      }
    } catch (error) {
      console.error("Error cargando configuración XOMS:", error);
    }
  }

  async saveXomsConfiguration() {
    try {
      const apiUrl = document.getElementById("xomsApiUrl").value.trim();
      const wsUrl = document.getElementById("xomsWsUrl").value.trim();
      const user = document.getElementById("xomsUser").value.trim();
      const password = document.getElementById("xomsPassword").value.trim();
      const account = document.getElementById("xomsAccount").value.trim();

      await chrome.storage.local.set({
        xomsApiUrl: apiUrl,
        xomsWsUrl: wsUrl,
        xomsUser: user,
        xomsPassword: password,
        xomsAccount: account,
      });

      this.showStatus("Configuración XOMS guardada", "success");

      // Actualizar advertencia si estamos en la pestaña OMS
      const omsTab = document.getElementById("omsProcessTab");
      if (omsTab && omsTab.classList.contains("active")) {
        this.updateOmsConfigWarning();
      }
    } catch (error) {
      console.error("Error guardando configuración XOMS:", error);
      this.showStatus("Error guardando configuración XOMS", "error");
    }
  }

  handleXomsPresetChange(presetId) {
    const apiInput = document.getElementById("xomsApiUrl");
    const wsInput = document.getElementById("xomsWsUrl");

    if (!apiInput || !wsInput) return;

    if (presetId === "custom") {
      apiInput.disabled = false;
      wsInput.disabled = false;

      if (!apiInput.value) {
        apiInput.value = "https://";
      }
      if (!wsInput.value) {
        wsInput.value = "wss://";
      }
      return;
    }

    const preset = XOMS_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    apiInput.value = preset.apiUrl;
    wsInput.value = preset.wsUrl;
    apiInput.disabled = true;
    wsInput.disabled = true;
  }

  validateXomsConfig() {
    try {
      const apiUrlEl = document.getElementById("xomsApiUrl");
      const wsUrlEl = document.getElementById("xomsWsUrl");
      const userEl = document.getElementById("xomsUser");
      const passwordEl = document.getElementById("xomsPassword");
      const accountEl = document.getElementById("xomsAccount");

      if (!apiUrlEl || !wsUrlEl || !userEl || !passwordEl || !accountEl) {
        return false;
      }

      const apiUrl = apiUrlEl.value.trim();
      const wsUrl = wsUrlEl.value.trim();
      const user = userEl.value.trim();
      const password = passwordEl.value.trim();
      const account = accountEl.value.trim();

      return apiUrl && wsUrl && user && password && account;
    } catch (error) {
      console.error("Error validando configuración XOMS:", error);
      return false;
    }
  }

  async processOmsOperations() {
    // Validar que la configuración esté completa
    if (!this.validateXomsConfig()) {
      const message =
        'Para habilitar diríjase a configuraciones y complete la sección "conectar con mediante xoms". Para más información diríjase a "https://procesador-opciones.mercadodecapitales.site"';
      this.showOmsStatus(message, "error");
      return;
    }

    const symbolSelect = document.getElementById("symbolSelect");
    const expirationSelect = document.getElementById("expirationSelect");
    const useAveraging = document.getElementById("useAveraging");
    const processOmsBtn = document.getElementById("processOmsBtn");

    try {
      processOmsBtn.disabled = true;
      processOmsBtn.textContent = "Procesando...";
      this.showOmsStatus("Consultando API OMS...", "info");
      // Obtener configuración XOMS
      const storageData = await chrome.storage.local.get([
        "xomsApiUrl",
        "xomsWsUrl",
        "xomsUser",
        "xomsPassword",
        "xomsAccount",
      ]);

      // Preparar datos para la API
      const requestData = {
        environment: "LIVE",
        api_url: storageData.xomsApiUrl,
        ws_url: storageData.xomsWsUrl,
        user: storageData.xomsUser,
        password: storageData.xomsPassword,
        account: storageData.xomsAccount,
      };

      // Hacer petición POST a la API
      const response = await fetch(API_PROCESADOR_MERCADO, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      const apiResult = await response.json();

      // Manejar error 403 (sin acceso)
      if (
        response.status === 403 ||
        (apiResult.status === "error" && apiResult.error_code === 403)
      ) {
        const detail =
          apiResult.detail || apiResult.message || "No posee acceso";
        const web =
          apiResult.web ||
          "https://procesador-opciones.mercadodecapitales.site";
        const errorMessage = `${detail}<br>Para solicitar acceso diríjase a: <a href="${web}" target="_blank" style="color: #4a90e2; text-decoration: underline;">${web}</a>`;
        this.showOmsStatus(errorMessage, "error");
        return;
      }

      if (!response.ok) {
        throw new Error(
          `Error en la API: ${response.status} ${response.statusText}`
        );
      }

      if (apiResult.status !== "ok") {
        throw new Error(apiResult.message || "Error en la respuesta de la API");
      }

      this.showOmsStatus("Procesando operaciones...", "info");

      // Convertir datos de la API al formato que espera el procesador
      const csvFormatData = this.convertApiDataToCsvFormat(
        apiResult.operations
      );

      // Procesar usando la misma lógica que el CSV
      const result = await window.operationsProcessor.processCsvData(
        csvFormatData,
        useAveraging.checked,
        symbolSelect.value,
        expirationSelect.value
      );

      if (result.success) {
        this.showOmsStatus("Operaciones procesadas exitosamente", "success");
        this.displayOperationsResults(result);
        this.showResultsSection();

        // Guardar la hora de procesamiento
        await this.saveLastProcessTime();

        await this.checkSavedData();
      } else {
        this.showOmsStatus(`Error: ${result.error}`, "error");
      }
    } catch (error) {
      console.error("Error procesando operaciones OMS:", error);
      this.showOmsStatus(
        `Error procesando operaciones: ${error.message}`,
        "error"
      );
    } finally {
      processOmsBtn.disabled = false;
      processOmsBtn.textContent = "Procesar mediante XOMS";
    }
  }

  convertApiDataToCsvFormat(operations) {
    // Crear encabezados CSV
    const headers = [
      "event_subtype",
      "ord_status",
      "text",
      "order_id",
      "symbol",
      "side",
      "last_price",
      "last_qty",
    ];

    // Función auxiliar para escapar valores CSV
    const escapeCsvValue = (value) => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      // Si contiene comas, comillas o saltos de línea, envolver en comillas y escapar comillas
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Agrupar operaciones por OrderID para identificar la última ejecución de cada orden
    const operationsByOrder = {};
    operations.forEach((op) => {
      if (!operationsByOrder[op.OrderID]) {
        operationsByOrder[op.OrderID] = [];
      }
      operationsByOrder[op.OrderID].push(op);
    });

    // Ordenar cada grupo por timestamp y encontrar la última ejecución de cada orden
    const lastExecutionsByOrder = {};
    Object.keys(operationsByOrder).forEach((orderId) => {
      operationsByOrder[orderId].sort((a, b) => {
        // Parsear correctamente el formato de timestamp "20260116-11:30:28.136-0300"
        const dateA = a.TimestampUTC.replace(
          /(\d{4})(\d{2})(\d{2})-(\d{2}):(\d{2}):(\d{2})/,
          "$1-$2-$3T$4:$5:$6"
        );
        const dateB = b.TimestampUTC.replace(
          /(\d{4})(\d{2})(\d{2})-(\d{2}):(\d{2}):(\d{2})/,
          "$1-$2-$3T$4:$5:$6"
        );
        return new Date(dateA) - new Date(dateB);
      });
      // La última ejecución es la que tiene el FilledQty más alto (o la última por timestamp)
      const lastExecution =
        operationsByOrder[orderId][operationsByOrder[orderId].length - 1];
      lastExecutionsByOrder[orderId] = lastExecution;
    });

    // Primero: Para cada orden, recopilar TODAS sus ejecuciones ordenadas por timestamp
    const executionsByOrder = {};
    Object.keys(operationsByOrder).forEach((orderId) => {
      const orderExecutions = operationsByOrder[orderId];
      orderExecutions.sort((a, b) => {
        // Parsear correctamente el formato de timestamp "20260116-11:30:28.136-0300"
        const dateA = a.TimestampUTC.replace(
          /(\d{4})(\d{2})(\d{2})-(\d{2}):(\d{2}):(\d{2})/,
          "$1-$2-$3T$4:$5:$6"
        );
        const dateB = b.TimestampUTC.replace(
          /(\d{4})(\d{2})(\d{2})-(\d{2}):(\d{2}):(\d{2})/,
          "$1-$2-$3T$4:$5:$6"
        );
        return new Date(dateA) - new Date(dateB);
      });
      // Incluir TODAS las ejecuciones de esta orden
      executionsByOrder[orderId] = orderExecutions;
    });

    // Función auxiliar para extraer el OrderID base (parte antes del guión)
    const getOrderIdBase = (orderId) => {
      const parts = orderId.split("-");
      return parts[0]; // Ej: "O0PwjZS5VAQB" de "O0PwjZS5VAQB-02052144"
    };

    // Segundo: Agrupar órdenes por OrderID base + Symbol + Side
    // Esto agrupa órdenes que son parte de la misma operación estratégica
    const ordersByOperation = {};
    Object.keys(executionsByOrder).forEach((orderId) => {
      const executions = executionsByOrder[orderId];
      if (executions.length === 0) return;

      const firstExecution = executions[0];
      const orderIdBase = getOrderIdBase(orderId);
      // Clave: OrderID base + Symbol + Side (identifica la operación)
      const key = `${orderIdBase}_${firstExecution.Symbol}_${firstExecution.Side}`;
      if (!ordersByOperation[key]) {
        ordersByOperation[key] = [];
      }
      ordersByOperation[key].push({
        orderId: orderId,
        executions: executions,
        lastExecution:
          operationsByOrder[orderId][operationsByOrder[orderId].length - 1],
      });
    });

    // Tercero: Para cada grupo de operación, usar TODAS las ejecuciones
    const csvLines = [headers.join(",")];

    Object.values(ordersByOperation).forEach((orders) => {
      // Ordenar: primero FILLED, luego por mayor FilledQty
      orders.sort((a, b) => {
        const aStatus = a.lastExecution.Status;
        const bStatus = b.lastExecution.Status;
        if (aStatus === "FILLED" && bStatus !== "FILLED") return -1;
        if (bStatus === "FILLED" && aStatus !== "FILLED") return 1;
        return (
          (b.lastExecution.FilledQty || 0) - (a.lastExecution.FilledQty || 0)
        );
      });

      // Usar TODAS las ejecuciones de TODAS las órdenes del grupo (misma operación)
      // Todas representan la misma operación estratégica (mismo OrderID base + Symbol + Side)
      const executionRows = [];
      let totalFromRealExecutions = 0;
      let hasFilled = false;
      let finalFilledQty = 0;
      let commonOrderId = null;

      // Recopilar todas las ejecuciones de todas las órdenes del grupo
      orders.forEach((order) => {
        if (order.lastExecution.Status === "FILLED") {
          hasFilled = true;
          finalFilledQty = Math.max(
            finalFilledQty,
            order.lastExecution.FilledQty || 0
          );
        }
        if (!commonOrderId) {
          commonOrderId = order.orderId;
        }

        order.executions.forEach((op) => {
          // SOLO usar ejecuciones con LastQty > 0 y LastPx > 0 (ejecuciones reales)
          if (op.LastQty && op.LastQty > 0 && op.LastPx && op.LastPx > 0) {
            executionRows.push({
              qty: op.LastQty,
              price: op.LastPx,
              op: op,
            });
            totalFromRealExecutions += op.LastQty;
          }
        });
      });

      // Si no hay FILLED, usar el mayor FilledQty
      if (!hasFilled && orders.length > 0) {
        finalFilledQty = Math.max(
          ...orders.map((o) => o.lastExecution.FilledQty || 0)
        );
      }

      // Ordenar ejecuciones por timestamp (más antigua primero)
      // El timestamp solo se usa para ordenar dentro del grupo, no para separar grupos
      // El formato es "20260116-11:30:28.136-0300", necesitamos parsearlo correctamente
      executionRows.sort((a, b) => {
        const dateA = a.op.TimestampUTC.replace(
          /(\d{4})(\d{2})(\d{2})-(\d{2}):(\d{2}):(\d{2})/,
          "$1-$2-$3T$4:$5:$6"
        );
        const dateB = b.op.TimestampUTC.replace(
          /(\d{4})(\d{2})(\d{2})-(\d{2}):(\d{2}):(\d{2})/,
          "$1-$2-$3T$4:$5:$6"
        );
        return new Date(dateA) - new Date(dateB);
      });

      // Si la suma de LastQty no alcanza el FilledQty total, ajustar la última ejecución (más reciente)
      const difference = finalFilledQty - totalFromRealExecutions;

      if (difference > 0 && executionRows.length > 0) {
        // Ajustar la última ejecución cronológicamente (la más reciente)
        const lastRow = executionRows[executionRows.length - 1];
        lastRow.qty += difference;
      }

      // Crear filas CSV con las ejecuciones procesadas
      executionRows.forEach((row) => {
        const csvRow = [
          escapeCsvValue("execution_report"), // event_subtype
          escapeCsvValue(hasFilled ? "Ejecutada" : "Parcialmente ejecutada"), // ord_status
          escapeCsvValue(""), // text (vacío para evitar "Order Updated")
          escapeCsvValue(commonOrderId), // order_id común para agrupar
          escapeCsvValue(row.op.Symbol), // symbol
          escapeCsvValue(row.op.Side), // side
          escapeCsvValue(row.price), // last_price (precio real)
          escapeCsvValue(row.qty), // last_qty (cantidad real o ajustada)
        ];

        csvLines.push(csvRow.join(","));
      });
    });

    return csvLines.join("\n");
  }

  showStatus(message, type = "info") {
    const statusEl = document.getElementById("operationsStatus");
    if (statusEl) {
      statusEl.innerHTML = `<div class="status ${type}">${message}</div>`;

      if (type === "success") {
        setTimeout(() => {
          statusEl.innerHTML = "";
        }, 5000);
      }
    }
  }

  showOmsStatus(message, type = "info") {
    const statusEl = document.getElementById("omsOperationsStatus");
    if (statusEl) {
      statusEl.innerHTML = `<div class="status ${type}">${message}</div>`;

      if (type === "success") {
        setTimeout(() => {
          statusEl.innerHTML = "";
        }, 5000);
      }
    }
  }

  showError(message) {
    this.showStatus(message, "error");
  }

  editExpiration(code) {
    const expirations = window.operationsProcessor.getAvailableExpirations();
    const expiration = expirations[code];

    if (!expiration) {
      this.showStatus("Vencimiento no encontrado", "error");
      return;
    }

    // Llenar los campos con los datos actuales
    const nameInput = document.getElementById("newExpirationNameInput");
    const suffixesInput = document.getElementById("newExpirationSuffixesInput");

    nameInput.value = expiration.name;
    suffixesInput.value = expiration.suffixes
      ? expiration.suffixes.join(", ")
      : "";

    // Cambiar el botón a "Actualizar"
    const addBtn = document.getElementById("addExpirationBtn");
    addBtn.textContent = "Actualizar";
    addBtn.onclick = () => this.updateExpiration(code);

    // Scroll hacia los campos
    nameInput.scrollIntoView({ behavior: "smooth", block: "center" });
    nameInput.focus();

    this.showStatus(`Editando vencimiento ${code}`, "info");
  }

  async updateExpiration(oldCode) {
    const nameInput = document.getElementById("newExpirationNameInput");
    const suffixesInput = document.getElementById("newExpirationSuffixesInput");

    const name = nameInput.value.trim();
    const suffixes = suffixesInput.value
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);

    // Validaciones (mismas que en addExpiration)
    if (!name) {
      this.showStatus("Ingresa el nombre del mes", "error");
      return;
    }

    if (suffixes.length === 0) {
      this.showStatus("Ingresa al menos un sufijo", "error");
      return;
    }

    if (suffixes.length > 3) {
      this.showStatus("Máximo 3 sufijos permitidos", "error");
      return;
    }

    const originalSuffixes = suffixesInput.value.trim();
    if (originalSuffixes.endsWith(",") || originalSuffixes.startsWith(",")) {
      this.showStatus("No pongas comas al inicio o final", "error");
      return;
    }

    if (originalSuffixes.includes(",,")) {
      this.showStatus("No pongas comas consecutivas", "error");
      return;
    }

    try {
      // Generar nuevo código
      const newCode = this.generateMonthCode(name);

      // Si el código cambió, eliminar el anterior y agregar el nuevo
      if (oldCode !== newCode) {
        await window.operationsProcessor.removeExpiration(oldCode);
        await window.operationsProcessor.addExpiration(newCode, name, suffixes);
      } else {
        // Si el código es el mismo, solo actualizar
        await window.operationsProcessor.updateExpiration(
          oldCode,
          name,
          suffixes
        );
      }

      // Limpiar campos y restaurar botón
      nameInput.value = "";
      suffixesInput.value = "";
      const addBtn = document.getElementById("addExpirationBtn");
      addBtn.textContent = "Agregar";
      addBtn.onclick = () => this.addExpiration();

      this.loadExpirationsToSelect();
      this.loadExpirationsList();
      this.showStatus(`Vencimiento ${newCode} actualizado`, "success");
    } catch (error) {
      console.error("Error actualizando vencimiento:", error);
      this.showStatus("Error actualizando vencimiento", "error");
    }
  }

  /**
   * Actualiza la UI según el formato de exportación seleccionado
   * @param {string} format - Formato de exportación ("EPGB" o "DeltaVega")
   */
  updateUIForFormat(format) {
    const isDeltaVega = format === "DeltaVega";

    // Botones de copia rápida
    const quickCopyEPGB = document.getElementById("quickCopyButtonsEPGB");
    const quickCopyDeltaVega = document.getElementById(
      "quickCopyButtonsDeltaVega"
    );

    if (quickCopyEPGB) {
      quickCopyEPGB.style.display = isDeltaVega ? "none" : "flex";
    }
    if (quickCopyDeltaVega) {
      quickCopyDeltaVega.style.display = isDeltaVega ? "flex" : "none";
    }

    // Botones de copiar en resultados
    const copyEPGB = document.getElementById("copyButtonsEPGB");
    const copyDeltaVega = document.getElementById("copyButtonsDeltaVega");

    if (copyEPGB) {
      copyEPGB.style.display = isDeltaVega ? "none" : "flex";
    }
    if (copyDeltaVega) {
      copyDeltaVega.style.display = isDeltaVega ? "flex" : "none";
    }
  }

  editSymbol(symbol) {
    const subyacente =
      window.operationsProcessor.getSubyacenteForSymbol(symbol);

    // Llenar los campos con los datos actuales
    const symbolInput = document.getElementById("newSymbolInput");
    const subyacenteInput = document.getElementById("newSubyacenteInput");

    symbolInput.value = symbol;
    subyacenteInput.value = subyacente || "";

    // Indicar visualmente que se está editando
    symbolInput.style.borderColor = "#10b981";
    subyacenteInput.style.borderColor = "#10b981";

    // Cambiar el botón a "Actualizar"
    const addBtn = document.getElementById("addSymbolBtn");
    addBtn.textContent = "Actualizar";
    addBtn.style.background = "#10b981"; // Verde para indicar modo edición

    // Remover todos los event listeners existentes y agregar el nuevo
    addBtn.replaceWith(addBtn.cloneNode(true));
    const newAddBtn = document.getElementById("addSymbolBtn");
    newAddBtn.addEventListener("click", () => {
      this.updateSymbol(symbol);
    });

    // Scroll hacia los campos
    symbolInput.scrollIntoView({ behavior: "smooth", block: "center" });
    symbolInput.focus();

    this.showStatus(
      `✏️ Editando símbolo ${symbol} - Modifica los valores y haz clic en "Actualizar"`,
      "info"
    );
  }

  async updateSymbol(oldSymbol) {
    const symbolInput = document.getElementById("newSymbolInput");
    const subyacenteInput = document.getElementById("newSubyacenteInput");

    const symbol = symbolInput.value.trim();
    const subyacente = subyacenteInput.value.trim();

    // Validaciones
    if (!symbol) {
      this.showStatus("Ingresa un símbolo válido", "error");
      return;
    }

    if (!subyacente) {
      this.showStatus("Ingresa el símbolo subyacente", "error");
      return;
    }

    try {
      // Si el símbolo cambió, eliminar el anterior y agregar el nuevo
      if (oldSymbol !== symbol) {
        await window.operationsProcessor.removeSymbol(oldSymbol);
        await window.operationsProcessor.addSymbol(symbol, subyacente);
      } else {
        // Si el símbolo es el mismo, solo actualizar el subyacente
        await window.operationsProcessor.updateSymbolSubyacente(
          symbol,
          subyacente
        );
      }

      // Limpiar campos y restaurar botón
      symbolInput.value = "";
      subyacenteInput.value = "";
      symbolInput.style.borderColor = ""; // Restaurar color original
      subyacenteInput.style.borderColor = ""; // Restaurar color original
      const addBtn = document.getElementById("addSymbolBtn");
      addBtn.textContent = "Agregar";
      addBtn.style.background = ""; // Restaurar color original

      // Restaurar el event listener original
      addBtn.replaceWith(addBtn.cloneNode(true));
      const newAddBtn = document.getElementById("addSymbolBtn");
      newAddBtn.addEventListener("click", () => {
        this.addSymbol();
      });

      this.loadSymbolsToSelect();
      this.loadSymbolsList();

      // Forzar recarga de configuración para asegurar que los cambios se reflejen
      await window.operationsProcessor.loadConfig();

      // Verificar que el cambio se aplicó correctamente
      const updatedSubyacente =
        window.operationsProcessor.getSubyacenteForSymbol(symbol);

      this.showStatus(
        `✅ Símbolo ${symbol} actualizado exitosamente - Subyacente: ${updatedSubyacente}`,
        "success"
      );
    } catch (error) {
      console.error("Error actualizando símbolo:", error);
      this.showStatus("Error actualizando símbolo", "error");
    }
  }
}

// Inicializar cuando se carga el popup
document.addEventListener("DOMContentLoaded", () => {
  window.popupManager = new PopupManager();
});
