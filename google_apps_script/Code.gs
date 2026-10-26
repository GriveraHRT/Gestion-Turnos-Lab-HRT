/**
 * ============================================================================
 * SISTEMA DE GESTIÓN DE TURNOS Y DOTACIÓN — LABORATORIO CLÍNICO HRT
 * Backend Oficial para Google Apps Script (Drive + Google Sheets Bitácora)
 * ============================================================================
 *
 * Cuentas Institucionales con Derechos y Autorización Total (Co-Propietarios):
 * - grivera@hospitaldetalca.cl
 * - laboratoriohrt@hospitaldetalca.cl
 */

const DB_FILENAME = 'TURNOS_HRT_DB.json';
const DEFAULT_DB_FILE_ID = '18-57r81QgQ6kqg5f6q-4dG6uncYpPL7z';
const DEFAULT_SPREADSHEET_ID = '1kgffDsCAawpxk3_8e35iFf-iro8bGtrnA-z1eJ1GVgQ';
const AUDIT_SPREADSHEET_NAME = 'BITÁCORA DE TRAZABILIDAD - TURNOS LABORATORIO HRT';
const AUDIT_SHEET_NAME = 'BITÁCORA DE TRAZABILIDAD';

const AUTHORIZED_OWNERS = [
  'grivera@hospitaldetalca.cl',
  'laboratoriohrt@hospitaldetalca.cl'
];

/**
 * Verifica si un correo ya es propietario o editor antes de compartir,
 * evitando que Google Drive envíe correos repetidos de notificación.
 * NOTA: Esta función NO se ejecuta en cada guardado; los permisos ya son permanentes.
 */
function ensureAuthorizedAccessOnce(targetObj) {
  if (!targetObj) return;
  let existingEmails = [];
  try {
    const owner = targetObj.getOwner();
    if (owner && owner.getEmail()) {
      existingEmails.push(String(owner.getEmail()).toLowerCase());
    }
    const editors = targetObj.getEditors() || [];
    for (let j = 0; j < editors.length; j++) {
      if (editors[j] && editors[j].getEmail()) {
        existingEmails.push(String(editors[j].getEmail()).toLowerCase());
      }
    }
  } catch (_) {}

  for (let i = 0; i < AUTHORIZED_OWNERS.length; i++) {
    const email = AUTHORIZED_OWNERS[i].toLowerCase();
    if (existingEmails.indexOf(email) === -1) {
      try {
        targetObj.addEditor(email);
      } catch (_) {}
    }
  }
}

/**
 * Función de configuración inicial (de ejecución única).
 * NO reenvía correos si la cuenta ya figura como editora.
 */
function setupCoOwnershipAndSheets() {
  const ss = getOrCreateAuditSpreadsheet();
  return {
    ok: true,
    shared_with: AUTHORIZED_OWNERS,
    script_id: ScriptApp.getScriptId(),
    spreadsheet_url: ss ? ss.getUrl() : ''
  };
}

/**
 * Punto de entrada GET:
 * - ?action=get_db -> Devuelve el JSON de la base de datos.
 * - Sin parámetros -> Renderiza la aplicación web Index.html con los datos desde Google Drive.
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : '';
  if (action === 'get_db' || action === 'load') {
    const db = loadTurnosDatabase();
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, data: db }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'init_permissions') {
    const res = setupCoOwnershipAndSheets();
    return ContentService
      .createTextOutput(JSON.stringify(res))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Sistema de Turnos y Dotación — Laboratorio Clínico HRT')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Punto de entrada POST:
 * Recibe actualizaciones desde la versión Web y guarda en Google Drive + Sheets (sin enviar correos).
 */
function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const body = JSON.parse(raw);
    const payload = body.payload || body;
    const result = saveTurnosDatabase(payload);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Carga la base de datos desde Google Drive.
 */
function loadTurnosDatabase() {
  if (DEFAULT_DB_FILE_ID) {
    try {
      const f = DriveApp.getFileById(DEFAULT_DB_FILE_ID);
      return JSON.parse(f.getBlob().getDataAsString('UTF-8'));
    } catch (_) {
      // Fallback a búsqueda por nombre
    }
  }
  const files = DriveApp.getFilesByName(DB_FILENAME);
  if (files.hasNext()) {
    const file = files.next();
    const content = file.getBlob().getDataAsString('UTF-8');
    return JSON.parse(content);
  }
  return null;
}

/**
 * Guarda la base de datos en Google Drive y actualiza la Bitácora en Google Sheets.
 * (No ejecuta addEditor para no enviar correos de notificación).
 */
function saveTurnosDatabase(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const jsonString = JSON.stringify(payload);
    let dbFile = null;
    if (DEFAULT_DB_FILE_ID) {
      try {
        dbFile = DriveApp.getFileById(DEFAULT_DB_FILE_ID);
        dbFile.setContent(jsonString);
      } catch (_) {
        dbFile = null;
      }
    }
    if (!dbFile) {
      const files = DriveApp.getFilesByName(DB_FILENAME);
      if (files.hasNext()) {
        dbFile = files.next();
        dbFile.setContent(jsonString);
      } else {
        dbFile = DriveApp.createFile(DB_FILENAME, jsonString, MimeType.PLAIN_TEXT);
        ensureAuthorizedAccessOnce(dbFile);
      }
    }

    let sheetUrl = '';
    if (payload && Array.isArray(payload.audit_log)) {
      sheetUrl = syncAuditSheet(payload.audit_log);
    }

    return {
      ok: true,
      saved_at: new Date().toISOString(),
      audit_sheet_url: sheetUrl
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Obtiene o crea la hoja de cálculo de Bitácora de Trazabilidad (sin reenviar invitaciones por correo).
 */
function getOrCreateAuditSpreadsheet() {
  let ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (_) {
    ss = null;
  }

  if (!ss && DEFAULT_SPREADSHEET_ID) {
    try {
      ss = SpreadsheetApp.openById(DEFAULT_SPREADSHEET_ID);
    } catch (_) {
      ss = null;
    }
  }

  if (!ss) {
    const props = PropertiesService.getScriptProperties();
    const savedId = props.getProperty('AUDIT_SPREADSHEET_ID');
    if (savedId) {
      try {
        ss = SpreadsheetApp.openById(savedId);
      } catch (_) {
        ss = null;
      }
    }
    if (!ss) {
      const existing = DriveApp.getFilesByName(AUDIT_SPREADSHEET_NAME);
      if (existing.hasNext()) {
        ss = SpreadsheetApp.open(existing.next());
      } else {
        ss = SpreadsheetApp.create(AUDIT_SPREADSHEET_NAME);
        ensureAuthorizedAccessOnce(ss);
      }
      props.setProperty('AUDIT_SPREADSHEET_ID', ss.getId());
    }
  }

  let sheet = ss.getSheetByName(AUDIT_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(AUDIT_SHEET_NAME);
  }
  return ss;
}

/**
 * Sincroniza la bitácora de trazabilidad en Google Sheets.
 */
function syncAuditSheet(auditLog) {
  const ss = getOrCreateAuditSpreadsheet();
  const sheet = ss.getSheetByName(AUDIT_SHEET_NAME) || ss.insertSheet(AUDIT_SHEET_NAME);

  const headers = [
    'ID Registro',
    'Fecha / Hora',
    'Usuario Responsable',
    'Username',
    'Rol',
    'Autorizado / Otorgado por',
    'Categoría',
    'Acción',
    'Funcionario Afectado',
    'Fecha(s) Turno',
    'Valor Anterior',
    'Valor Nuevo',
    'Detalle / Observación'
  ];

  sheet.clearContents();
  const rows = [headers];
  const maxRows = Math.min((auditLog || []).length, 1000);
  for (let i = 0; i < maxRows; i++) {
    const item = auditLog[i];
    rows.push([
      item.id || '',
      item.timestamp || '',
      item.user_name || '',
      item.user_username || item.username || '',
      item.user_role || '',
      item.authorized_by || item.user_name || '',
      item.category || '',
      item.action || '',
      item.staff_name || '',
      item.date_range || '',
      item.before_val || '',
      item.after_val || '',
      item.detail || ''
    ]);
  }

  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1e293b')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  return ss.getUrl();
}
