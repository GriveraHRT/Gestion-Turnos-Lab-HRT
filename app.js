/**
 * Sistema de Gestión de Turnos y Dotación — Laboratorio Clínico HRT
 * =================================================================
 * Arquitectura unificada 2026 / 2027:
 * - Calendario General Unificado con Modo Pintar Rápido (clic y arrastrar) + Editor por Rango.
 * - Ficha Anual Interactiva (12 meses) por funcionario.
 * - Control automático de ausencias diarias TENS y alertas de cruce con Toma de Muestras (TDM).
 * - Motor de Esquemas y Rotaciones: 4to Turno (L-N-Libre-Libre), Paso a Diurno (L-V) e Intercambio.
 * - Historial Deshacer (Undo / Ctrl+Z) y persistencia reactiva en localStorage.
 */

const STORAGE_KEYS = {
  VERSION: 'hrt_turnos_data_version_v5_official_colors',
  STAFF: 'hrt_turnos_staff_v5',
  TURNS_2026: 'hrt_turnos_2026_v5',
  TURNS_2027: 'hrt_turnos_2027_v5',
  TDM_2026: 'hrt_tdm_2026_v5',
  TDM_2027: 'hrt_tdm_2027_v5',
  USERS: 'hrt_turnos_users_v1',
  SESSION: 'hrt_turnos_session_v1',
  AUDIT_LOG: 'hrt_turnos_audit_log_v1',
  GAS_URL: 'hrt_turnos_gas_webapp_url_v1'
};

const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbwKsDWxQplfuJMlgeCIJl0D9Rt0woCx7HlWytvnnH6lcJQt57m-kT2QHej--lQp-soO/exec';

const DEFAULT_USERS = [
  {
    username: 'grivera@hospitaldetalca.cl',
    password: 'admin2026',
    name: 'TM Guillermo Rivera (Admin)',
    role: 'admin'
  },
  {
    username: 'laboratoriohrt@hospitaldetalca.cl',
    password: 'admin2026',
    name: 'Laboratorio Clínico HRT (Admin)',
    role: 'admin'
  },
  {
    username: 'admin',
    password: 'admin2026',
    name: 'Administrador General',
    role: 'admin'
  },
  {
    username: 'jefatura',
    password: 'jefe2026',
    name: 'Jefatura Laboratorio',
    role: 'jefatura'
  }
];

const DATA_VERSION = '4.5';

const MONTH_LABELS = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DOW_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const OFFICIAL_SECTIONS = ['ALU', 'AH', 'AIC', 'AMB', 'APA', 'ATE', 'ADM', 'Auxiliares'];

const SECTION_DESCRIPTIONS = {
  'ALU': 'ALU (Urgencia y Biología Molecular)',
  'AH': 'AH (Hematología)',
  'AIC': 'AIC (Química / Inmunoquímica)',
  'AMB': 'AMB (Microbiología)',
  'APA': 'APA (TENS)',
  'ATE': 'ATE (Técnicas Especiales)',
  'ADM': 'ADM (Administrativa)',
  'Auxiliares': 'Auxiliares'
};

const SECTION_HUMAN_SEARCH = {
  'ALU': 'alu urgencia urgencias biologia molecular',
  'AH': 'ah hematologia profesional rutina',
  'AIC': 'aic quimica inmunoquimica autoinmunidad profesional rutina',
  'AMB': 'amb microbiologia profesional rutina',
  'APA': 'apa tens tecnico enfermeria rutina',
  'ATE': 'ate tecnicas especiales citometria profesional rutina',
  'ADM': 'adm administrativa administracion secretaria',
  'Auxiliares': 'auxiliares auxiliar aseo servicio'
};

const ABSENCE_TYPES = new Set([
  'VACACIONES',
  'ADMINISTRATIVO',
  'LICENCIA_MEDICA',
  'DEVOLUCION_TIEMPO',
  'COMISION_SERVICIO',
  'SIN_GOCE_SUELDO',
  'COMPENSATORIO'
]);

const EVENT_DESCRIPTIONS = {
  'VACACIONES': 'Feriado Legal / Vacaciones',
  'ADMINISTRATIVO': 'Día Administrativo',
  'LICENCIA_MEDICA': 'Licencia Médica',
  'DEVOLUCION_TIEMPO': 'Devolución de Tiempo (Uso de Permiso / Salida)',
  'COMISION_SERVICIO': 'Capacitación / Comisión de Servicio',
  'SIN_GOCE_SUELDO': 'Permiso Sin Goce de Sueldo',
  'COMPENSATORIO': 'Día Compensatorio (Permiso Compensatorio)',
  'EXTENSION_HORARIA': 'Extensión Horaria E+(N)',
  'HORAS_TURNO_EXTRA': 'Horas por Turno Extra H+(N)',
  'HORARIO_ESPECIAL': 'Horario Especial'
};

// Estado reactivo global
const state = {
  year: '2026',
  month: 10, // Octubre 2026 por defecto (mes vigente actualizado)
  activeTab: 'calendar',
  quickFilter: 'all',
  groupBy: 'section',
  searchQuery: '',
  tdmDate: '2026-10-16',
  tdmStationFilter: 'all',
  dirSearch: '',
  dirFilterSection: 'all',
  dirFilterStatus: 'all',
  dirFilterModality: 'all',
  dirFilterEstamento: 'all',
  analyticsFilter: 'all',
  analyticsSearch: '',
  activeSmTab: '4toturno',

  // Modo Pintar Rápido en Calendario General
  paintMode: '', // '' = normal (abre modal), 'VACACIONES:FL', 'TURNO:L', 'CLEAR', etc.
  isPaintingDrag: false,

  // Ficha Anual activa
  annualModalStaffId: null,

  // Pila de Deshacer (Undo)
  undoStack: [],

  // Autenticación, Usuarios y Trazabilidad
  currentUser: null, // null = Modo Solo Visualización, o { username, name, role: 'jefatura' | 'admin' }
  users: [],
  auditLog: [],
  auditSearch: '',
  auditFilterUser: 'all',
  auditFilterCategory: 'all',
  gasWebAppUrl: '',

  // Datos en memoria
  staff: {},
  turns2026: [],
  turns2027: [],
  tdm2026: [],
  tdm2027: [],
  holidays: {},

  // Índices rápidos O(1)
  turnsMap: {}, // key: `${staff_id}_${date}`
  tdmMap: {},   // key: `${staff_id}_${date}`
};

// ============================================================================
// 0. PERMISOS DE ROL Y UTILIDADES DE TRAZABILIDAD
// ============================================================================
function canEditCalendar() {
  return Boolean(
    state.currentUser &&
    (state.currentUser.role === 'jefatura' || state.currentUser.role === 'admin')
  );
}

function isAdmin() {
  return Boolean(state.currentUser && state.currentUser.role === 'admin');
}

function canViewTraceability() {
  // La trazabilidad es visible únicamente para usuarios Jefatura o Administrador
  return canEditCalendar();
}

function formatDateTimeCL(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch (_) {
    return isoStr;
  }
}

function buildTraceStamp(authorizedByOverride = null) {
  const u = state.currentUser || { username: 'sistema', name: 'Sistema', role: 'admin' };
  const authName = (authorizedByOverride && String(authorizedByOverride).trim())
    ? String(authorizedByOverride).trim()
    : u.name;
  return {
    updated_by_user: u.username,
    updated_by_name: u.name,
    updated_by_role: u.role,
    authorized_by: authName,
    updated_at: new Date().toISOString()
  };
}

function recordAuditEntry({
  category = 'TURNO',
  action = 'Modificación',
  staffId = '',
  staffName = '',
  dateRange = '-',
  beforeVal = 'Libre',
  afterVal = 'Libre',
  detail = '',
  authorizedBy = ''
}) {
  const u = state.currentUser || { username: 'sistema', name: 'Sistema', role: 'admin' };
  const entry = {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    user_username: u.username,
    user_name: u.name,
    user_role: u.role,
    authorized_by: (authorizedBy && String(authorizedBy).trim()) ? String(authorizedBy).trim() : u.name,
    category,
    action,
    staff_id: staffId,
    staff_name: staffName || (staffId && state.staff[staffId]?.name) || 'General',
    date_range: dateRange,
    before_val: beforeVal || 'Libre',
    after_val: afterVal || 'Libre',
    detail: detail || ''
  };
  state.auditLog.unshift(entry);
  if (state.auditLog.length > 2500) {
    state.auditLog.length = 2500;
  }
  return entry;
}

function applyRolePermissionsUI() {
  const body = document.body;
  body.classList.remove('role-viewer', 'role-jefatura', 'role-admin');
  if (!state.currentUser) {
    body.classList.add('role-viewer');
  } else if (state.currentUser.role === 'admin') {
    body.classList.add('role-admin');
  } else {
    body.classList.add('role-jefatura');
  }

  const guestView = document.getElementById('authGuestView');
  const loggedView = document.getElementById('authLoggedView');
  const loggedChip = document.getElementById('loggedUserChip');
  const loggedName = document.getElementById('loggedUserName');
  const loggedRole = document.getElementById('loggedUserRole');

  if (state.currentUser) {
    if (guestView) guestView.classList.add('hidden');
    if (loggedView) loggedView.classList.remove('hidden');
    if (loggedName) loggedName.textContent = state.currentUser.name;
    if (loggedRole) {
      loggedRole.textContent = state.currentUser.role === 'admin'
        ? '🛡️ Administrador'
        : '🩺 Jefatura';
    }
    if (loggedChip) {
      loggedChip.classList.toggle('is-admin-chip', state.currentUser.role === 'admin');
    }
  } else {
    if (guestView) guestView.classList.remove('hidden');
    if (loggedView) loggedView.classList.add('hidden');
  }

  // Mostrar u ocultar elementos según su atributo data-role-req
  document.querySelectorAll('[data-role-req]').forEach(el => {
    const req = el.dataset.roleReq;
    if (req === 'editor') {
      el.classList.toggle('hidden', !canEditCalendar());
    } else if (req === 'admin') {
      el.classList.toggle('hidden', !isAdmin());
    }
  });

  // Si está en Modo Visualización, asegurar que el modo pintar rápido esté apagado y cerrado
  if (!canEditCalendar()) {
    state.paintMode = '';
    const paintDrawer = document.getElementById('paintDrawerPanel');
    if (paintDrawer) paintDrawer.classList.add('hidden');
    const btnTogglePaint = document.getElementById('btnTogglePaintDrawer');
    if (btnTogglePaint) btnTogglePaint.classList.remove('active');
  }

  // Actualizar texto guía en barra inferior del calendario
  const paintStatusEl = document.getElementById('calendarPaintStatus');
  if (paintStatusEl && !state.paintMode) {
    paintStatusEl.classList.remove('painting-active');
    if (canEditCalendar()) {
      paintStatusEl.textContent = 'Clic en celda: marcar día o rango · Clic en nombre: ver Ficha Anual';
    } else {
      paintStatusEl.textContent = '👀 Modo Solo Visualización — Clic en nombre: ver Ficha Anual · Inicia sesión para modificar';
    }
  }

  // Si cerró sesión mientras estaba en la pestaña Trazabilidad, volver al Calendario General
  if (!canViewTraceability() && state.activeTab === 'audit') {
    const calBtn = document.querySelector('.tab-btn[data-tab="calendar"]');
    if (calBtn) calBtn.click();
  }
}

// ============================================================================
// 1. UTILIDADES DE BÚSQUEDA Y NORMALIZACIÓN (RUT Y TEXTO SIN TILDES)
// ============================================================================
function normalizeSearchText(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMemberSearchTokens(member) {
  const secCode = member.section || '';
  const secHuman = SECTION_HUMAN_SEARCH[secCode] || '';
  const tdmKeywords = (member.sheets || []).includes('TOMA DE MUESTRA') ? 'tdm toma de muestra muestras' : '';
  // Use official_name if available (which contains full legal names + 2 surnames), plus unique tokens from short name
  const nameTokens = normalizeSearchText(member.name || '').split(' ').filter(Boolean);
  const offTokens = normalizeSearchText(member.official_name || '').split(' ').filter(Boolean);
  const baseNameTokens = offTokens.length >= nameTokens.length ? offTokens : nameTokens;
  const extraTokens = normalizeSearchText([
    member.rut,
    secCode,
    secHuman,
    member.estamento,
    member.role,
    tdmKeywords
  ].filter(Boolean).join(' ')).split(' ').filter(Boolean);
  return [...baseNameTokens, ...extraTokens];
}

function matchesSearch(member, query) {
  if (!query || !query.trim()) return true;
  const qNorm = normalizeSearchText(query);
  if (!qNorm) return true;

  const qTokens = qNorm.split(' ').filter(Boolean);
  const memberTokens = getMemberSearchTokens(member);
  const rutClean = normalizeSearchText(member.rut || '').replace(/\s+/g, '');

  const qTokenCounts = {};
  for (const qt of qTokens) {
    qTokenCounts[qt] = (qTokenCounts[qt] || 0) + 1;
  }

  return Object.entries(qTokenCounts).every(([qt, requiredCount]) => {
    if (rutClean.includes(qt)) return true;
    const matchCount = memberTokens.filter(mt => mt.includes(qt)).length;
    return matchCount >= requiredCount;
  });
}

function normalizeSectionInMemory(s) {
  if (!s) return;
  if (s.id === 'patricia_morales_rojas') {
    if (!s.name) s.name = 'Patricia Morales R.';
    s.official_name = 'PATRICIA ESTER AIDA MORALES ROJAS';
    s.rut = '11.480.276-K';
    s.role = 'Profesional';
    s.estamento = 'Tecnólogo Médico';
    s.section = 'AH';
    s.needs_completion = false;
    s.missing_fields = [];
    return;
  }
  if (s.id === 'patricia_morales_morales') {
    if (!s.name) s.name = 'Patricia Morales M.';
    s.official_name = 'PATRICIA ANDREA MORALES MORALES';
    s.rut = '16.555.264-4';
    s.role = 'TENS';
    s.estamento = 'TENS';
    s.section = 'APA';
    s.needs_completion = false;
    s.missing_fields = [];
    return;
  }
  if (s.id === 'susana_sepulveda') {
    s.official_name = 'SUSANA EUGENIA SEPULVEDA VILLANUEVA';
    s.rut = '10.892.073-4';
    s.role = 'Auxiliar';
    s.estamento = 'Auxiliar';
    s.section = 'Auxiliares';
    s.needs_completion = false;
    s.missing_fields = [];
    return;
  }
  if (s.id === 'jimena_gonzalez') {
    s.official_name = 'JIMENA ANDREA GONZALEZ VELIS';
    s.rut = '19.043.840-6';
    s.role = 'Administrativo';
    s.estamento = 'Administrativo';
    s.section = 'ADM';
    s.needs_completion = false;
    s.missing_fields = [];
    return;
  }
  if (s.role === 'Auxiliar' || s.section === 'Auxiliares') {
    s.section = 'Auxiliares';
    return;
  }
  if (s.role === 'TENS') {
    s.section = 'APA';
    return;
  }
  if (s.role === 'Administrativo') {
    s.section = 'ADM';
    return;
  }
  const secUp = (s.section || '').toUpperCase();
  if (OFFICIAL_SECTIONS.includes(s.section)) return;
  if (secUp.includes('URGENCIA') || secUp === 'ALU') s.section = 'ALU';
  else if (secUp.includes('HEMATOLOG') || secUp === 'AH') s.section = 'AH';
  else if (secUp.includes('INMUNO') || secUp.includes('QUIMICA') || secUp === 'AIC') s.section = 'AIC';
  else if (secUp.includes('MICROBIOLOG') || secUp === 'AMB') s.section = 'AMB';
  else if (secUp.includes('ADMIN') || secUp === 'ADM') s.section = 'ADM';
  else if (secUp.includes('ESPECIALES') || secUp === 'ATE') s.section = 'ATE';
  else s.section = 'ALU';
}

// ============================================================================
// 2. INICIALIZACIÓN, PERSISTENCIA Y DESHACER (UNDO)
// ============================================================================
async function initApp() {
  if (
    (!window.TURNOS_INITIAL_DATA ||
      !window.TURNOS_INITIAL_DATA.staff ||
      Object.keys(window.TURNOS_INITIAL_DATA.staff).length === 0) &&
    window.TURNOS_GZIP_B64 &&
    typeof DecompressionStream !== 'undefined'
  ) {
    try {
      const binStr = atob(window.TURNOS_GZIP_B64);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
      const ds = new DecompressionStream('gzip');
      const stream = new Blob([bytes]).stream().pipeThrough(ds);
      const text = await new Response(stream).text();
      window.TURNOS_INITIAL_DATA = JSON.parse(text);
    } catch (err) {
      console.error('Error descomprimiendo base inicial:', err);
    }
  }

  const initial = window.TURNOS_INITIAL_DATA || {
    staff: {},
    turns_2026: [],
    tdm_2026: [],
    holidays: { '2026': [], '2027': [] },
    users: [],
    audit_log: []
  };

  state.holidays = initial.holidays || { '2026': [], '2027': [] };

  // Cargar usuarios autorizados (Administrador y Jefatura)
  const savedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
  if (savedUsers) {
    try {
      state.users = JSON.parse(savedUsers);
    } catch (_) {
      state.users = [];
    }
  } else if (Array.isArray(initial.users) && initial.users.length > 0) {
    state.users = structuredClone(initial.users);
  }
  if (!Array.isArray(state.users) || state.users.length === 0) {
    state.users = structuredClone(DEFAULT_USERS);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(state.users));
  } else {
    // Asegurar que las cuentas oficiales (grivera@hospitaldetalca.cl y laboratoriohrt@hospitaldetalca.cl) existan siempre
    let usersUpdated = false;
    for (const defUser of DEFAULT_USERS) {
      if (!state.users.some(u => String(u.username || '').toLowerCase() === defUser.username.toLowerCase())) {
        state.users.unshift(structuredClone(defUser));
        usersUpdated = true;
      }
    }
    if (usersUpdated) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(state.users));
    }
  }

  // Cargar bitácora de trazabilidad (audit_log)
  const savedAudit = localStorage.getItem(STORAGE_KEYS.AUDIT_LOG);
  if (savedAudit) {
    try {
      state.auditLog = JSON.parse(savedAudit);
    } catch (_) {
      state.auditLog = [];
    }
  } else if (Array.isArray(initial.audit_log)) {
    state.auditLog = structuredClone(initial.audit_log);
  }

  // Cargar URL de Google Apps Script (por defecto conectada al despliegue institucional activo)
  state.gasWebAppUrl = localStorage.getItem(STORAGE_KEYS.GAS_URL) || DEFAULT_GAS_URL;

  // Cargar sesión activa (si había iniciado sesión previamente en este navegador)
  const savedSession = sessionStorage.getItem(STORAGE_KEYS.SESSION) || localStorage.getItem(STORAGE_KEYS.SESSION);
  if (savedSession) {
    try {
      const parsedUser = JSON.parse(savedSession);
      const validUser = state.users.find(u => u.username === parsedUser.username);
      if (validUser) {
        state.currentUser = {
          username: validUser.username,
          name: validUser.name,
          role: validUser.role
        };
      }
    } catch (_) {
      state.currentUser = null;
    }
  }

  const savedVersion = localStorage.getItem(STORAGE_KEYS.VERSION);
  if (savedVersion !== DATA_VERSION) {
    localStorage.removeItem(STORAGE_KEYS.STAFF);
    localStorage.removeItem(STORAGE_KEYS.TURNS_2026);
    localStorage.removeItem(STORAGE_KEYS.TDM_2026);
    localStorage.setItem(STORAGE_KEYS.VERSION, DATA_VERSION);
  }

  let parsedStaff = null;
  try {
    const rawS = localStorage.getItem(STORAGE_KEYS.STAFF);
    if (rawS) parsedStaff = JSON.parse(rawS);
  } catch (_) {}
  state.staff = (parsedStaff && Object.keys(parsedStaff).length > 0)
    ? parsedStaff
    : structuredClone(initial.staff || {});

  if (initial.staff) {
    for (const [id, st] of Object.entries(initial.staff)) {
      if (!state.staff[id]) {
        state.staff[id] = structuredClone(st);
      } else {
        // Sincronizar hojas y datos oficiales nuevos si faltaban
        state.staff[id].sheets = st.sheets || state.staff[id].sheets;
        if (st.official_name && !state.staff[id].official_name) {
          state.staff[id].official_name = st.official_name;
        }
        if (st.rut && !state.staff[id].rut) state.staff[id].rut = st.rut;
      }
    }
  }
  Object.values(state.staff).forEach(normalizeSectionInMemory);

  let parsedTurns2026 = null;
  try {
    const rawT = localStorage.getItem(STORAGE_KEYS.TURNS_2026);
    if (rawT) parsedTurns2026 = JSON.parse(rawT);
  } catch (_) {}
  state.turns2026 = (Array.isArray(parsedTurns2026) && parsedTurns2026.length > 0)
    ? parsedTurns2026
    : structuredClone(initial.turns_2026 || []);

  let parsedTdm2026 = null;
  try {
    const rawM = localStorage.getItem(STORAGE_KEYS.TDM_2026);
    if (rawM) parsedTdm2026 = JSON.parse(rawM);
  } catch (_) {}
  state.tdm2026 = (Array.isArray(parsedTdm2026) && parsedTdm2026.length > 0)
    ? parsedTdm2026
    : structuredClone(initial.tdm_2026 || []);

  const savedTurns2027 = localStorage.getItem(STORAGE_KEYS.TURNS_2027);
  state.turns2027 = savedTurns2027
    ? JSON.parse(savedTurns2027)
    : structuredClone(initial.turns_2027 || []);

  const savedTdm2027 = localStorage.getItem(STORAGE_KEYS.TDM_2027);
  state.tdm2027 = savedTdm2027
    ? JSON.parse(savedTdm2027)
    : structuredClone(initial.tdm_2027 || []);

  if (state.staff['katalina_tdm']) {
    delete state.staff['katalina_tdm'];
  }
  if (state.staff['reemplazo_ignacio']) {
    delete state.staff['reemplazo_ignacio'];
  }
  const migrateMergedStaff = (arr) => {
    for (const r of arr) {
      if (r.staff_id === 'katalina_tdm') {
        r.staff_id = 'katalina_barrera';
        if (r.staff_name) r.staff_name = 'Katalina Barrera';
      } else if (r.staff_id === 'reemplazo_ignacio') {
        r.staff_id = 'ignacio_brunel';
        if (r.staff_name) r.staff_name = 'Ignacio Brunel';
      }
    }
  };
  migrateMergedStaff(state.turns2026);
  migrateMergedStaff(state.turns2027);
  migrateMergedStaff(state.tdm2026);
  migrateMergedStaff(state.tdm2027);

  if (state.turns2027.length === 0) {
    generate2027Projection(false);
  }

  const monthSel = document.getElementById('monthSelect');
  if (monthSel) monthSel.value = String(state.month);

  rebuildFastLookupMaps();
  bindEvents();
  applyRolePermissionsUI();
  renderAll();

  // Si se ejecuta dentro de Google Apps Script o tiene URL Web App configurada, sincronizar al iniciar
  pullDatabaseFromCloud(false);
}

function pushUndoSnapshot(actionLabel) {
  state.undoStack.push({
    label: actionLabel,
    turns2026: structuredClone(state.turns2026),
    turns2027: structuredClone(state.turns2027),
    tdm2026: structuredClone(state.tdm2026),
    tdm2027: structuredClone(state.tdm2027)
  });
  if (state.undoStack.length > 20) {
    state.undoStack.shift();
  }
  updateUndoButton();
}

function performUndo() {
  if (!canEditCalendar()) {
    showToast('🔒 Inicia sesión como Jefatura o Administrador para deshacer cambios.');
    return;
  }
  if (state.undoStack.length === 0) return;
  const snap = state.undoStack.pop();
  state.turns2026 = snap.turns2026;
  state.turns2027 = snap.turns2027;
  state.tdm2026 = snap.tdm2026;
  state.tdm2027 = snap.tdm2027;
  recordAuditEntry({
    category: 'TURNO',
    action: 'Deshacer Acción (Ctrl+Z)',
    staffName: 'Calendario',
    dateRange: `${MONTH_LABELS[state.month]} ${state.year}`,
    beforeVal: snap.label,
    afterVal: 'Estado Anterior Restaurado',
    detail: `Se revirtió: ${snap.label}`
  });
  saveStateToStorage();
  rebuildFastLookupMaps();
  renderAll();
  updateUndoButton();
  showToast(`↩️ Deshecho: ${snap.label}`);
}

function updateUndoButton() {
  const btn = document.getElementById('btnUndoAction');
  if (!btn) return;
  btn.disabled = !canEditCalendar() || state.undoStack.length === 0;
  if (state.undoStack.length > 0) {
    const last = state.undoStack[state.undoStack.length - 1];
    btn.title = `Deshacer: ${last.label} (Ctrl+Z)`;
  } else {
    btn.title = 'No hay acciones para deshacer';
  }
}

function buildCurrentBundlePayload() {
  return {
    generated_at: new Date().toISOString(),
    source_file: 'TURNOS 2026.xlsx + Ediciones Web',
    staff: state.staff,
    turns_2026: state.turns2026,
    tdm_2026: state.tdm2026,
    turns_2027: state.turns2027,
    tdm_2027: state.tdm2027,
    holidays: state.holidays,
    users: state.users,
    audit_log: state.auditLog
  };
}

function applyRemotePayloadToState(remoteData) {
  if (!remoteData || typeof remoteData !== 'object') return false;
  if (!remoteData.staff || Object.keys(remoteData.staff).length === 0) return false;
  state.staff = remoteData.staff;
  Object.values(state.staff).forEach(normalizeSectionInMemory);
  if (Array.isArray(remoteData.turns_2026) && remoteData.turns_2026.length > 0) {
    state.turns2026 = remoteData.turns_2026;
  }
  if (Array.isArray(remoteData.tdm_2026) && remoteData.tdm_2026.length > 0) {
    state.tdm2026 = remoteData.tdm_2026;
  }
  if (Array.isArray(remoteData.turns_2027) && remoteData.turns_2027.length > 0) {
    state.turns2027 = remoteData.turns_2027;
  }
  if (Array.isArray(remoteData.tdm_2027) && remoteData.tdm_2027.length > 0) {
    state.tdm2027 = remoteData.tdm_2027;
  }
  if (Array.isArray(remoteData.users) && remoteData.users.length > 0) {
    state.users = remoteData.users;
  }
  if (Array.isArray(remoteData.audit_log)) {
    state.auditLog = remoteData.audit_log;
  }
  localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(state.staff));
  localStorage.setItem(STORAGE_KEYS.TURNS_2026, JSON.stringify(state.turns2026));
  localStorage.setItem(STORAGE_KEYS.TURNS_2027, JSON.stringify(state.turns2027));
  localStorage.setItem(STORAGE_KEYS.TDM_2026, JSON.stringify(state.tdm2026));
  localStorage.setItem(STORAGE_KEYS.TDM_2027, JSON.stringify(state.tdm2027));
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(state.users));
  localStorage.setItem(STORAGE_KEYS.AUDIT_LOG, JSON.stringify(state.auditLog));
  rebuildFastLookupMaps();
  renderAll();
  return true;
}

async function pullDatabaseFromCloud(showNotification = false) {
  // 1. Si se ejecuta embebido en Google Apps Script (HtmlService)
  if (typeof window !== 'undefined' && window.google && window.google.script && window.google.script.run) {
    window.google.script.run
      .withSuccessHandler(res => {
        const data = (res && res.data) ? res.data : res;
        if (applyRemotePayloadToState(data)) {
          if (showNotification) showToast('☁️ Datos sincronizados desde Google Drive / Apps Script.');
        }
      })
      .loadTurnosDatabase();
    return true;
  }

  // 2. Si tiene configurada una URL de Web App de Google Apps Script
  if (state.gasWebAppUrl && typeof fetch === 'function') {
    try {
      const resp = await fetch(`${state.gasWebAppUrl}?action=get_db`, { method: 'GET' });
      if (resp.ok) {
        const json = await resp.json();
        const data = json.data || json;
        if (applyRemotePayloadToState(data)) {
          if (showNotification) showToast('☁️ Base actualizada desde Google Apps Script.');
          return true;
        }
      }
    } catch (_) {
      if (showNotification) showToast('⚠️ No se pudo conectar a la URL de Google Apps Script.');
    }
  }
  return false;
}

async function syncDatabaseToServer(showNotification = false) {
  const payload = buildCurrentBundlePayload();
  const bodyStr = JSON.stringify(payload);

  // 1. Entorno nativo Google Apps Script (HtmlService)
  if (typeof window !== 'undefined' && window.google && window.google.script && window.google.script.run) {
    window.google.script.run
      .withSuccessHandler(() => {
        if (showNotification) {
          showToast('☁️ Guardado en Google Drive y Bitácora Google Sheets.');
        }
      })
      .saveTurnosDatabase(payload);
    return true;
  }

  // 2. URL externa de Web App de Google Apps Script (usa text/plain para evitar bloqueo CORS preflight)
  if (state.gasWebAppUrl && typeof fetch === 'function') {
    try {
      await fetch(state.gasWebAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: bodyStr
      });
      if (showNotification) {
        showToast('☁️ Sincronizado con Google Apps Script.');
      }
    } catch (_) {
      // Continuar hacia servidor local
    }
  }

  if (typeof fetch !== 'function') return false;
  const endpoints = [];
  if (typeof window !== 'undefined' && window.location && window.location.protocol.startsWith('http')) {
    endpoints.push('/api/save-db');
  }
  endpoints.push('http://localhost:8000/api/save-db');

  for (const url of endpoints) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr
      });
      if (resp.ok) {
        if (showNotification) {
          showToast('💾 Base guardada directamente en carpeta data/ (lista para subir a la red).');
        }
        return true;
      }
    } catch (_) {
      // Servidor local no activo en este puerto, probar siguiente o usar localStorage
    }
  }
  return false;
}

async function exportBundleForNetwork() {
  if (!isAdmin()) {
    showToast('🔒 Solo el Administrador puede exportar la base maestra para red.');
    return;
  }
  const savedOnDisk = await syncDatabaseToServer(true);
  if (savedOnDisk) return;

  const payload = buildCurrentBundlePayload();
  const jsContent = `window.TURNOS_INITIAL_DATA = ${JSON.stringify(payload)};\n`;

  if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'data_bundle.js',
        types: [{
          description: 'Base de Datos JavaScript (data_bundle.js)',
          accept: { 'application/javascript': ['.js'] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(jsContent);
      await writable.close();
      showToast('💾 Archivo data_bundle.js guardado correctamente para subir a la red.');
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }

  const blob = new Blob([jsContent], { type: 'application/javascript;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'data_bundle.js';
  a.click();
  URL.revokeObjectURL(url);
  showToast('💾 Descargado data_bundle.js — Reemplázalo dentro de la carpeta data/ para publicar en red.');
}

function saveStateToStorage() {
  localStorage.setItem(STORAGE_KEYS.VERSION, DATA_VERSION);
  localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(state.staff));
  localStorage.setItem(STORAGE_KEYS.TURNS_2026, JSON.stringify(state.turns2026));
  localStorage.setItem(STORAGE_KEYS.TURNS_2027, JSON.stringify(state.turns2027));
  localStorage.setItem(STORAGE_KEYS.TDM_2026, JSON.stringify(state.tdm2026));
  localStorage.setItem(STORAGE_KEYS.TDM_2027, JSON.stringify(state.tdm2027));
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(state.users));
  localStorage.setItem(STORAGE_KEYS.AUDIT_LOG, JSON.stringify(state.auditLog));
  syncDatabaseToServer(false);
}

function resetToBaseData() {
  if (!isAdmin()) {
    showToast('🔒 Solo un usuario Administrador puede restaurar la base oficial.');
    return;
  }
  const initial = window.TURNOS_INITIAL_DATA;
  if (!initial) return;
  pushUndoSnapshot('Restauración de base oficial');
  state.staff = structuredClone(initial.staff);
  Object.values(state.staff).forEach(normalizeSectionInMemory);
  state.turns2026 = structuredClone(initial.turns_2026);
  state.tdm2026 = structuredClone(initial.tdm_2026);
  state.turns2027 = [];
  state.tdm2027 = [];
  generate2027Projection(false);
  recordAuditEntry({
    category: 'PERSONAL',
    action: 'Restauración de Base Oficial',
    staffName: 'Sistema Completo',
    dateRange: '2026 - 2027',
    beforeVal: 'Estado Editado',
    afterVal: 'Base Oficial Original',
    detail: 'Recarga completa desde TURNOS 2026.xlsx'
  });
  saveStateToStorage();
  rebuildFastLookupMaps();
  renderAll();
  showToast('🔄 Base de datos restaurada desde TURNOS 2026.xlsx oficial.');
}

function getActiveTurnsArray() {
  return state.year === '2026' ? state.turns2026 : state.turns2027;
}

function getActiveTdmArray() {
  return state.year === '2026' ? state.tdm2026 : state.tdm2027;
}

function getTurnsArrayForYear(yearStr) {
  return yearStr === '2026' ? state.turns2026 : state.turns2027;
}

function getTdmArrayForYear(yearStr) {
  return yearStr === '2026' ? state.tdm2026 : state.tdm2027;
}

function rebuildFastLookupMaps() {
  state.turnsMap = {};
  state.tdmMap = {};

  for (const r of state.turns2026) state.turnsMap[`${r.staff_id}_${r.date}`] = r;
  for (const r of state.turns2027) state.turnsMap[`${r.staff_id}_${r.date}`] = r;

  for (const t of state.tdm2026) state.tdmMap[`${t.staff_id}_${t.date}`] = t;
  for (const t of state.tdm2027) state.tdmMap[`${t.staff_id}_${t.date}`] = t;
}

// ============================================================================
// 3. MOTOR DE PROYECCIÓN 2027 Y ESQUEMAS DE TURNO (4TO TURNO / DIURNO / SWAP)
// ============================================================================
function generate2027Projection(notify = true) {
  if (notify) pushUndoSnapshot('Proyección anual 2027');
  const newTurns2027 = [];
  const decDates = ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31'];

  const map2026 = {};
  for (const r of state.turns2026) {
    map2026[`${r.staff_id}_${r.date}`] = r;
  }

  for (const staff of Object.values(state.staff)) {
    if (staff.modality !== '4to Turno / Rotativo') continue;

    const tail = decDates.map(d => {
      const rec = map2026[`${staff.id}_${d}`];
      return rec && (rec.code === 'L' || rec.code === 'N') ? rec.code : null;
    });

    let cycleOffset = -1;
    for (let i = 0; i < 4; i++) {
      if (tail[i] === 'L') {
        cycleOffset = (4 - i) % 4;
        break;
      } else if (tail[i] === 'N') {
        cycleOffset = (5 - i) % 4;
        break;
      }
    }

    if (cycleOffset === -1) continue;

    const pattern = ['L', 'N', null, null];
    const startDate = new Date(2027, 0, 1);
    for (let dayIdx = 0; dayIdx < 365; dayIdx++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + dayIdx);
      const iso = formatDateISO(d);
      const shiftCode = pattern[(dayIdx + cycleOffset) % 4];
      if (shiftCode) {
        newTurns2027.push({
          staff_id: staff.id,
          date: iso,
          sheet: 'LAB. URGENCIA',
          code: shiftCode,
          raw_value: shiftCode,
          color_hex: null,
          event_type: 'TURNO',
          description: shiftCode === 'L'
            ? 'Turno Largo Proyectado (08:00 - 20:00)'
            : 'Turno Noche Proyectado (20:00 - 08:00)'
        });
      }
    }
  }

  state.turns2027 = newTurns2027;
  saveStateToStorage();
  if (state.year === '2027') {
    rebuildFastLookupMaps();
    renderAll();
  }
  if (notify) {
    showToast(`✨ Proyección 2027 generada: ${newTurns2027.length} turnos rotativos calculados.`);
  }
}

function apply4toTurnoPattern() {
  if (!canEditCalendar()) {
    showToast('🔒 Inicia sesión como Jefatura o Administrador para aplicar esquemas de turno.');
    return;
  }
  const staffId = document.getElementById('smStaff').value;
  const startStr = document.getElementById('smStartDate').value;
  const endStr = document.getElementById('smEndDate').value;
  const phase = document.getElementById('smPattern').value;
  const preserveAbs = document.getElementById('smPreserveAbsences').checked;

  if (!staffId || !startStr || !endStr) {
    showToast('⚠️ Completa funcionario y rango de fechas.');
    return;
  }
  if (endStr < startStr) {
    showToast('⚠️ La fecha de término debe ser igual o posterior a la fecha de inicio.');
    return;
  }

  pushUndoSnapshot(`Ciclo 4to Turno (${ state.staff[staffId]?.name || staffId })`);
  const stamp = buildTraceStamp();

  const cycleMap = {
    'L': ['L', 'N', null, null],
    'N': ['N', null, null, 'L'],
    'X1': [null, null, 'L', 'N'],
    'X2': [null, 'L', 'N', null]
  };
  const pattern = cycleMap[phase] || cycleMap['L'];

  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  const endDate = new Date(ey, em - 1, ed);
  const diffDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  let appliedCount = 0;
  for (let i = 0; i < diffDays; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const iso = formatDateISO(d);
    const yr = iso.slice(0, 4);
    const turnsArr = getTurnsArrayForYear(yr);

    const existingIdx = turnsArr.findIndex(r => r.staff_id === staffId && r.date === iso);
    if (existingIdx >= 0 && preserveAbs && ABSENCE_TYPES.has(turnsArr[existingIdx].event_type)) {
      continue;
    }

    if (existingIdx >= 0) {
      turnsArr.splice(existingIdx, 1);
    }

    const code = pattern[i % 4];
    if (code) {
      turnsArr.push({
        staff_id: staffId,
        date: iso,
        sheet: 'LAB. URGENCIA',
        code: code,
        raw_value: code,
        color_hex: null,
        event_type: 'TURNO',
        description: code === 'L' ? 'Turno Largo (08:00 - 20:00)' : 'Turno Noche (20:00 - 08:00)',
        ...stamp
      });
      appliedCount++;
    }
  }

  if (state.staff[staffId]) {
    state.staff[staffId].modality = '4to Turno / Rotativo';
  }

  recordAuditEntry({
    category: 'ESQUEMA',
    action: 'Generar Ciclo 4to Turno',
    staffId,
    staffName: state.staff[staffId]?.name,
    dateRange: startStr === endStr ? startStr : `${startStr} al ${endStr}`,
    beforeVal: 'Rotación Previa',
    afterVal: `Ciclo 4to Turno (Fase ${phase}, ${appliedCount} turnos)`,
    detail: preserveAbs ? 'Respetando ausencias legales existentes' : 'Sobrescribiendo periodo completo'
  });

  saveStateToStorage();
  rebuildFastLookupMaps();
  closeModal('modalShiftManager');
  renderAll();
  showToast(`✅ Ciclo 4to Turno aplicado (${appliedCount} turnos generados para ${state.staff[staffId]?.name}).`);
}

function applyPassToDiurno() {
  if (!canEditCalendar()) {
    showToast('🔒 Inicia sesión como Jefatura o Administrador para modificar jornadas.');
    return;
  }
  const staffId = document.getElementById('smDiurnoStaff').value;
  const startStr = document.getElementById('smDiurnoStart').value;
  const endStr = document.getElementById('smDiurnoEnd').value;
  const actionMode = document.getElementById('smDiurnoFillD').value;
  const updateProf = document.getElementById('smDiurnoUpdateProfile').checked;
  const preserveAbs = document.getElementById('smDiurnoPreserveAbs').checked;

  if (!staffId || !startStr || !endStr || endStr < startStr) {
    showToast('⚠️ Verifica el funcionario y rango de fechas.');
    return;
  }

  pushUndoSnapshot(`Paso a Diurno (${state.staff[staffId]?.name || staffId})`);
  const stamp = buildTraceStamp();

  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  const endDate = new Date(ey, em - 1, ed);
  const diffDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  for (let i = 0; i < diffDays; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const iso = formatDateISO(d);
    const yr = iso.slice(0, 4);
    const turnsArr = getTurnsArrayForYear(yr);
    const holidaySet = new Set((state.holidays[yr] || []).map(h => h.date));

    const existingIdx = turnsArr.findIndex(r => r.staff_id === staffId && r.date === iso);
    if (existingIdx >= 0 && preserveAbs && ABSENCE_TYPES.has(turnsArr[existingIdx].event_type)) {
      continue;
    }

    if (existingIdx >= 0) {
      turnsArr.splice(existingIdx, 1);
    }

    const dow = d.getDay();
    const isBusinessDay = dow !== 0 && dow !== 6 && !holidaySet.has(iso);
    if (isBusinessDay && (actionMode === 'fill_D' || actionMode === 'fill_M')) {
      const code = actionMode === 'fill_D' ? 'D' : 'M';
      turnsArr.push({
        staff_id: staffId,
        date: iso,
        sheet: state.staff[staffId]?.role === 'TENS' ? 'TENS RUTINA' : 'PROFESIONALES RUTINA',
        code: code,
        raw_value: code,
        color_hex: null,
        event_type: 'TURNO',
        description: code === 'D' ? 'Jornada Diurna (08:00 - 17:00)' : 'Turno Mañana',
        ...stamp
      });
    }
  }

  if (updateProf && state.staff[staffId]) {
    state.staff[staffId].modality = 'Diurno';
  }

  recordAuditEntry({
    category: 'ESQUEMA',
    action: 'Paso a Jornada Diurna',
    staffId,
    staffName: state.staff[staffId]?.name,
    dateRange: startStr === endStr ? startStr : `${startStr} al ${endStr}`,
    beforeVal: 'Rotativo / Anterior',
    afterVal: actionMode === 'clear_only' ? 'Limpieza de Turnos (Diurno)' : `Jornada Diurna (${actionMode === 'fill_D' ? 'D' : 'M'})`,
    detail: `Paso a modalidad Diurna (${diffDays} días en rango)`
  });

  saveStateToStorage();
  rebuildFastLookupMaps();
  closeModal('modalShiftManager');
  renderAll();
  showToast(`☀️ Funcionario ${state.staff[staffId]?.name} actualizado a modalidad Diurna.`);
}

function applySwapRotation() {
  if (!canEditCalendar()) {
    showToast('🔒 Inicia sesión como Jefatura o Administrador para intercambiar rotaciones.');
    return;
  }
  const staffA = document.getElementById('smSwapStaffA').value;
  const staffB = document.getElementById('smSwapStaffB').value;
  const startStr = document.getElementById('smSwapStart').value;
  const endStr = document.getElementById('smSwapEnd').value;

  if (!staffA || !staffB || staffA === staffB) {
    showToast('⚠️ Selecciona dos funcionarios distintos para intercambiar.');
    return;
  }
  if (!startStr || !endStr || endStr < startStr) {
    showToast('⚠️ Selecciona un rango de fechas válido.');
    return;
  }

  pushUndoSnapshot(`Intercambio ${state.staff[staffA]?.name} ↔ ${state.staff[staffB]?.name}`);
  const stamp = buildTraceStamp();

  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  const endDate = new Date(ey, em - 1, ed);
  const diffDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  for (let i = 0; i < diffDays; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const iso = formatDateISO(d);
    const yr = iso.slice(0, 4);
    const turnsArr = getTurnsArrayForYear(yr);

    const idxA = turnsArr.findIndex(r => r.staff_id === staffA && r.date === iso);
    const idxB = turnsArr.findIndex(r => r.staff_id === staffB && r.date === iso);

    const recA = idxA >= 0 ? structuredClone(turnsArr[idxA]) : null;
    const recB = idxB >= 0 ? structuredClone(turnsArr[idxB]) : null;

    if (idxA >= 0) turnsArr.splice(idxA, 1);
    const newIdxB = turnsArr.findIndex(r => r.staff_id === staffB && r.date === iso);
    if (newIdxB >= 0) turnsArr.splice(newIdxB, 1);

    if (recA) {
      recA.staff_id = staffB;
      Object.assign(recA, stamp);
      turnsArr.push(recA);
    }
    if (recB) {
      recB.staff_id = staffA;
      Object.assign(recB, stamp);
      turnsArr.push(recB);
    }
  }

  recordAuditEntry({
    category: 'ESQUEMA',
    action: 'Intercambio de Rotación (Swap)',
    staffId: staffA,
    staffName: `${state.staff[staffA]?.name} ↔ ${state.staff[staffB]?.name}`,
    dateRange: startStr === endStr ? startStr : `${startStr} al ${endStr}`,
    beforeVal: 'Turnos Originales',
    afterVal: 'Turnos Intercambiados',
    detail: `Enroque de turnos por ${diffDays} día(s)`
  });

  saveStateToStorage();
  rebuildFastLookupMaps();
  closeModal('modalShiftManager');
  renderAll();
  showToast(`🔀 Rotación intercambiada entre ${state.staff[staffA]?.name} y ${state.staff[staffB]?.name}.`);
}

// ============================================================================
// 4. UTILIDADES DE FECHAS Y FERIADOS
// ============================================================================
function formatDateISO(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDaysInMonth(year, month) {
  return new Date(Number(year), Number(month), 0).getDate();
}

function getHolidayMapForMonth(year, month) {
  const list = state.holidays[String(year)] || [];
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  const map = {};
  for (const h of list) {
    if (h.date.startsWith(prefix)) {
      map[h.date] = h;
    }
  }
  return map;
}

// ============================================================================
// 5. FILTRADO Y AGRUPACIÓN DEL PERSONAL
// ============================================================================
function getFilteredAndGroupedStaff() {
  const q = state.searchQuery;
  const qf = state.quickFilter;
  const monthPrefix = `${state.year}-${String(state.month).padStart(2, '0')}-`;

  let list = Object.values(state.staff).filter(s => {
    if (!matchesSearch(s, q)) return false;

    if (qf === 'urgencia') {
      return s.section === 'ALU' || (s.sheets || []).includes('LAB. URGENCIA');
    }
    if (qf === 'rutina') {
      return ['AH', 'AIC', 'AMB', 'ATE', 'ADM'].includes(s.section) ||
        (s.sheets || []).includes('PROFESIONALES RUTINA') ||
        (s.sheets || []).includes('TENS RUTINA');
    }
    if (qf === 'tens') {
      return s.role === 'TENS' || s.section === 'APA';
    }
    if (qf === 'auxiliares') {
      return s.role === 'Auxiliar' || s.section === 'Auxiliares';
    }
    if (qf === 'profesionales') {
      return s.role === 'Profesional' || s.role === 'Interno TM';
    }
    if (qf === 'tdm_active') {
      return getActiveTdmArray().some(t => t.staff_id === s.id && t.date.startsWith(monthPrefix));
    }
    if (qf === 'absent_month') {
      return getActiveTurnsArray().some(
        r => r.staff_id === s.id && r.date.startsWith(monthPrefix) && ABSENCE_TYPES.has(r.event_type)
      );
    }
    return true;
  });

  list.sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const groups = {};
  for (const s of list) {
    let gKey = 'General';
    if (state.groupBy === 'estamento') {
      if (s.role === 'TENS') gKey = '2. TENS';
      else if (s.role === 'Auxiliar') gKey = '3. Auxiliares';
      else if (s.role === 'Interno TM') gKey = '4. Internos TM';
      else if (s.role === 'Administrativo' || (s.estamento || '').toUpperCase().includes('ADMINISTRAT')) gKey = '5. Personal Administrativo';
      else gKey = '1. Profesionales';
    } else if (state.groupBy === 'section') {
      gKey = SECTION_DESCRIPTIONS[s.section] || s.section || 'General';
    } else if (state.groupBy === 'modality') {
      gKey = s.modality === '4to Turno / Rotativo'
        ? '1. 4to Turno / Rotativo'
        : '2. Diurno';
    } else {
      gKey = 'Listado Alfabético (A - Z)';
    }

    if (!groups[gKey]) groups[gKey] = [];
    groups[gKey].push(s);
  }

  return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0], 'es'));
}

// ============================================================================
// 6. MODO PINTAR RÁPIDO (QUICK PAINT) EN CALENDARIO GENERAL
// ============================================================================
function applyQuickPaintToCell(staffId, dateStr, isFirstInStroke = false) {
  if (!canEditCalendar()) {
    if (isFirstInStroke) {
      showToast('🔒 Inicia sesión como Jefatura o Administrador para usar el modo pintar.');
    }
    return;
  }
  const mode = state.paintMode;
  if (!mode || !staffId || !dateStr) return;

  if (isFirstInStroke) {
    pushUndoSnapshot(`Pintar rápido (${mode}) en ${dateStr}`);
  }

  const yr = dateStr.slice(0, 4);
  const turnsArr = getTurnsArrayForYear(yr);
  const existingIdx = turnsArr.findIndex(r => r.staff_id === staffId && r.date === dateStr);
  let prevBaseShift = null;
  let beforeCode = 'Libre';
  if (existingIdx >= 0) {
    const prevRec = turnsArr[existingIdx];
    beforeCode = prevRec.code || prevRec.event_type || 'Libre';
    const cand = String(prevRec.raw_value || prevRec.code || '').toUpperCase().trim();
    if (cand === 'L' || cand === 'N') prevBaseShift = cand;
    turnsArr.splice(existingIdx, 1);
  }

  const stamp = buildTraceStamp();

  if (mode !== 'CLEAR') {
    const [evType, code] = mode.split(':');
    const st = state.staff[staffId];
    let desc = EVENT_DESCRIPTIONS[evType] || `Turno (${code})`;
    if (evType === 'TURNO') {
      const mapDesc = {
        'L': 'Turno Largo (08:00 - 20:00)',
        'N': 'Turno Noche (20:00 - 08:00)',
        'D': 'Jornada Diurna (08:00 - 17:00)',
        'M': 'Turno Mañana',
        'T': 'Turno Tarde'
      };
      desc = mapDesc[code] || desc;
    } else if (prevBaseShift) {
      desc = `${desc} (sobre Turno ${prevBaseShift})`;
    }
    turnsArr.push({
      staff_id: staffId,
      date: dateStr,
      sheet: st?.modality === '4to Turno / Rotativo' ? 'LAB. URGENCIA' : (st?.role === 'TENS' ? 'TENS RUTINA' : 'PROFESIONALES RUTINA'),
      code: code,
      raw_value: (evType !== 'TURNO' && prevBaseShift) ? prevBaseShift : code,
      color_hex: null,
      event_type: evType,
      description: desc,
      ...stamp
    });

    if (beforeCode !== code) {
      recordAuditEntry({
        category: ABSENCE_TYPES.has(evType) ? 'AUSENCIA' : 'TURNO',
        action: 'Pintado Rápido en Grilla',
        staffId,
        staffName: st?.name,
        dateRange: dateStr,
        beforeVal: beforeCode,
        afterVal: `${code} (${desc})`,
        detail: `Asignado con pincel rápido`
      });
    }
  } else if (beforeCode !== 'Libre') {
    recordAuditEntry({
      category: 'LIMPIEZA',
      action: 'Borrado con Pincel Rápido',
      staffId,
      staffName: state.staff[staffId]?.name,
      dateRange: dateStr,
      beforeVal: beforeCode,
      afterVal: 'Libre',
      detail: 'Día limpiado con herramienta Borrar'
    });
  }

  saveStateToStorage();
  rebuildFastLookupMaps();
  renderCalendarMatrix();
  renderTopBadges();
}

// ============================================================================
// 7. RENDERIZADO PRINCIPAL
// ============================================================================
function renderAll() {
  renderTopBadges();
  if (state.activeTab === 'calendar') {
    renderCalendarMatrix();
  } else if (state.activeTab === 'tdm') {
    renderTdmView();
  } else if (state.activeTab === 'directory') {
    renderDirectoryView();
  } else if (state.activeTab === 'analytics') {
    renderAnalyticsView();
  } else if (state.activeTab === 'audit') {
    renderAuditView();
  }
}

function renderTopBadges() {
  const staffArr = Object.values(state.staff);
  const incompleteCount = staffArr.filter(s => s.needs_completion).length;

  document.getElementById('badgeTotalStaff').textContent = staffArr.length;
  document.getElementById('badgeIncompleteStaff').textContent = incompleteCount;

  const prefix = `${state.year}-${String(state.month).padStart(2, '0')}-`;
  const monthTdmCount = getActiveTdmArray().filter(t => t.date.startsWith(prefix)).length;
  document.getElementById('badgeTdmCount').textContent = monthTdmCount;

  const auditBadge = document.getElementById('badgeAuditCount');
  if (auditBadge) {
    auditBadge.textContent = state.auditLog.length;
  }
  updateUndoButton();
}

// ============================================================================
// 8. VISTA 1: MATRIZ DE CALENDARIO GENERAL + CONTADOR DIARIO AUSENCIAS TENS
// ============================================================================
function renderCalendarMatrix() {
  const year = Number(state.year);
  const month = Number(state.month);
  const daysCount = getDaysInMonth(year, month);
  const holidayMap = getHolidayMapForMonth(year, month);

  const thead = document.getElementById('calendarThead');
  const tbody = document.getElementById('calendarTbody');

  let hHtml = `<tr>
    <th class="sticky-col-name">Funcionario (${MONTH_LABELS[month]} ${year})</th>
    <th class="sticky-col-role">Área / Rol</th>`;

  const dayMeta = [];
  for (let d = 1; d <= daysCount; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dow = dateObj.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const iso = formatDateISO(dateObj);
    const holiday = holidayMap[iso];

    dayMeta.push({ d, dow, isWeekend, iso, holiday });

    const cls = holiday ? 'col-holiday' : (isWeekend ? 'col-weekend' : '');
    const titleAttr = holiday ? `title="Feriado Legal: ${holiday.name}"` : '';

    hHtml += `<th class="day-col-header ${cls}" ${titleAttr}>
      <span class="day-num">${d}</span>
      <span class="day-dow">${DOW_SHORT[dow]}</span>
    </th>`;
  }

  hHtml += `
    <th class="summary-col" title="Días asignados en Toma de Muestras (TDM) en el Mes">TDM</th>
  </tr>`;
  thead.innerHTML = hHtml;

  const grouped = getFilteredAndGroupedStaff();
  let bHtml = '';
  let totalVisibleStaff = 0;

  // Contador diario de ausencias TENS (Lunes a Viernes hábiles: TENS Diurnas + 2 TENS de Turno Largo L no cubiertas)
  const tensStaffList = Object.values(state.staff).filter(s => s.role === 'TENS');
  const tensDailyInfo = new Array(daysCount + 1).fill(null);

  for (const dm of dayMeta) {
    // 1. Fines de semana y festivos: no aplica conteo de ausencias de rutina
    if (dm.isWeekend || dm.holiday) {
      tensDailyInfo[dm.d] = {
        skip: true,
        count: 0,
        tooltip: `Día ${dm.d} (${dm.holiday ? 'Festivo: ' + dm.holiday.name : 'Fin de semana'}): No se contabilizan ausencias de rutina`
      };
      continue;
    }

    const diurnoAbsentNames = [];
    const activeLNames = [];
    const rotativoLAbsentNames = [];

    for (const s of tensStaffList) {
      const ev = state.turnsMap[`${s.id}_${dm.iso}`];
      const codeUp = String(ev?.code || '').toUpperCase().trim();
      const rawUp = String(ev?.raw_value || '').toUpperCase().trim();
      const descUp = String(ev?.description || '').toUpperCase();

      // ¿Está cubriendo efectivamente un Turno Largo (L) hoy? (Titular de 4to Turno o Reemplazo/Rutina con L)
      if (ev && ev.event_type === 'TURNO' && codeUp.startsWith('L')) {
        activeLNames.push(s.name);
      }

      if (s.modality !== '4to Turno / Rotativo') {
        // Personal TENS de Rutina / Diurno (debe asistir de Lunes a Viernes salvo ausencia justificada)
        if (ev && ABSENCE_TYPES.has(ev.event_type)) {
          diurnoAbsentNames.push(`${s.name} (${ev.code || ev.event_type})`);
        }
      } else {
        // Personal TENS de 4to Turno: solo se considera si le correspondía Turno Largo (L) hoy
        // (No se considera Turno Noche 'N' ni días libres del ciclo rotativo)
        if (ev && ABSENCE_TYPES.has(ev.event_type)) {
          const wasScheduledL = rawUp.startsWith('L') || descUp.includes('TURNO L');
          if (wasScheduledL) {
            rotativoLAbsentNames.push(`${s.name} (${ev.code || ev.event_type} en L)`);
          }
        }
      }
    }

    // Cada día hábil requiere 2 TENS en Turno Largo (L).
    // Si se puso a otra persona a cubrir ese turno 'L' (activeLNames.length >= 2), no se cuenta como ausencia descubierta.
    const uncoveredLSlots = Math.max(0, 2 - activeLNames.length);
    const uncoveredLNames = rotativoLAbsentNames.slice(0, uncoveredLSlots);

    const totalCount = diurnoAbsentNames.length + uncoveredLNames.length;
    const detailParts = [`Día ${dm.d}: ${totalCount} TENS ausente(s) en jornada diurna`];
    if (diurnoAbsentNames.length > 0) {
      detailParts.push(`Rutina (${diurnoAbsentNames.length}): ${diurnoAbsentNames.join(', ')}`);
    }
    if (uncoveredLNames.length > 0) {
      detailParts.push(`Turno Largo sin cubrir (${uncoveredLNames.length}): ${uncoveredLNames.join(', ')}`);
    } else if (rotativoLAbsentNames.length > 0) {
      detailParts.push(`Turno Largo cubierto (${activeLNames.join(' + ')})`);
    }

    tensDailyInfo[dm.d] = {
      skip: false,
      count: totalCount,
      tooltip: detailParts.join(' | ')
    };
  }

  for (const [groupTitle, members] of grouped) {
    totalVisibleStaff += members.length;
    const cleanGroupLabel = groupTitle.replace(/^\d+\.\s*/, '');
    bHtml += `<tr class="group-header-row">
      <td colspan="${daysCount + 3}" title="${cleanGroupLabel}: ${members.length} funcionario(s)">${cleanGroupLabel}</td>
    </tr>`;

    for (const member of members) {
      let tdmCount = 0;

      const incDot = member.needs_completion
        ? `<span class="incomplete-dot" title="Falta completar: ${(member.missing_fields || []).join(', ')}"></span>`
        : '';

      const officialTooltip = member.official_name
        ? `Nombre Oficial: ${member.official_name} | RUT: ${member.rut || 'Pendiente'} — Clic para abrir Ficha Anual`
        : `RUT: ${member.rut || 'Pendiente'} — Clic para abrir Ficha Anual`;

      const isTdmMember = (member.sheets || []).includes('TOMA DE MUESTRA');
      const secBadge = `<span class="badge ${member.section === 'APA' ? 'badge-ok' : 'badge-blue'}" style="font-size:9.5px; padding:1px 5px;">${member.section}</span>`;
      const tdmBadge = isTdmMember
        ? `<span class="badge badge-purple" style="font-size:9px; padding:1px 4px; margin-left:2px;" title="Participa en Toma de Muestras">🩸 TDM</span>`
        : '';

      bHtml += `<tr>
        <td class="sticky-col-name" title="${officialTooltip}">
          <div class="staff-cell-inner">
            <span class="staff-name-main" data-staff-id="${member.id}">${member.name}</span>
            <span style="display:inline-flex; align-items:center; gap:4px; flex-shrink:0;">
              <button type="button" class="btn-inline-edit-name" data-edit-staff-id="${member.id}" title="Editar nombre o ficha de ${member.name}">✏️</button>
              ${incDot}
            </span>
          </div>
          <div class="staff-rut-sub">${member.rut || 'RUT Pendiente'} · ${member.estamento || member.role}</div>
        </td>
        <td class="sticky-col-role">${secBadge}${tdmBadge}</td>`;

      for (const dm of dayMeta) {
        const key = `${member.id}_${dm.iso}`;
        const ev = state.turnsMap[key];
        const tdm = state.tdmMap[key];

        let cellClasses = ['day-cell'];
        if (dm.holiday) cellClasses.push('col-holiday');
        else if (dm.isWeekend) cellClasses.push('col-weekend');

        let displayCode = '';
        let tooltipParts = [`${member.name} — ${dm.d} ${MONTH_LABELS[month]} ${year}`];
        if (dm.holiday) tooltipParts.push(`🎉 Feriado: ${dm.holiday.name}`);

        if (ev) {
          displayCode = ev.event_type === 'DEVOLUCION_TIEMPO' ? 'DT' : (ev.code || '');
          const uCode = displayCode.toUpperCase();
          if (ev.event_type && ev.event_type !== 'TURNO') {
            cellClasses.push(`ev-${ev.event_type}`);
          } else if (['L', 'N', 'D', 'M', 'T'].includes(uCode)) {
            cellClasses.push(`shift-${uCode}`);
          } else {
            cellClasses.push('ev-HORARIO_ESPECIAL');
          }
          if (ev.a_devolucion) {
            cellClasses.push('is-devolucion');
          }
          if (ev.is_extra_shift) {
            cellClasses.push('is-extra-shift');
          }
          if (ev.event_type === 'DEVOLUCION_TIEMPO') {
            const sched = ev.dt_schedule || (ev.raw_value && !['DT', 'L', 'N', 'D', 'M', 'T'].includes(String(ev.raw_value).toUpperCase().trim()) ? ev.raw_value : '');
            tooltipParts.push(sched ? `🟣 Devolución de Tiempo — Horario: ${sched}` : `🟣 ${ev.description || 'Devolución de Tiempo (Todo el día)'}`);
          } else {
            tooltipParts.push(`📌 ${ev.description || ev.event_type}`);
          }
          // PRIVACIDAD: Solo mostrar quién otorgó o modificó a Jefatura y Administrador
          if (canViewTraceability() && (ev.updated_by_name || ev.authorized_by)) {
            const grantor = ev.authorized_by || ev.updated_by_name;
            const timeTxt = ev.updated_at ? ` el ${formatDateTimeCL(ev.updated_at)}` : '';
            tooltipParts.push(`🛡️ Otorgado/Modificado por: ${grantor}${timeTxt}`);
          }
        }

        let tdmDotHtml = '';
        if (tdm) {
          tdmCount++;
          tdmDotHtml = `<span class="tdm-indicator"></span>`;
          tooltipParts.push(`🩸 TDM: ${tdm.station}`);
          if (canViewTraceability() && tdm.updated_by_name) {
            const timeTxt = tdm.updated_at ? ` (${formatDateTimeCL(tdm.updated_at)})` : '';
            tooltipParts.push(`🛡️ TDM asignado por: ${tdm.updated_by_name}${timeTxt}`);
          }
          if (!displayCode) {
            displayCode = 'TDM';
          }
        }

        bHtml += `<td class="${cellClasses.join(' ')}" data-staff="${member.id}" data-date="${dm.iso}" title="${tooltipParts.join(' | ')}">
          ${displayCode}${tdmDotHtml}
        </td>`;
      }

      bHtml += `
        <td class="summary-col">${tdmCount || '-'}</td>
      </tr>`;
    }
  }

  // Fila resumen inferior de ausencias diarias TENS
  let highAbsenceDays = 0;
  let tensRowHtml = `<tr class="tens-counter-row">
    <td class="sticky-col-name" title="Lunes a Viernes hábiles: TENS de Rutina ausentes + Turnos Largos (L) sin cubrir. Excluye fines de semana, festivos, Turno Noche (N) y días libres rotativos.">🩺 Ausencias Diarias TENS (Rutina + Turno L)</td>
    <td class="sticky-col-role"><span class="badge badge-warn" style="font-size:9.5px;">Máx 4-5/día</span></td>`;

  for (const dm of dayMeta) {
    const info = tensDailyInfo[dm.d];
    if (!info || info.skip) {
      tensRowHtml += `<td style="color:#94a3b8; font-weight:400;" title="${info ? info.tooltip : ''}">-</td>`;
    } else {
      const cnt = info.count;
      const isHigh = cnt > 5;
      if (isHigh) highAbsenceDays++;
      tensRowHtml += `<td class="${isHigh ? 'tens-high-absence' : ''}" title="${info.tooltip}">${cnt}</td>`;
    }
  }
  tensRowHtml += `<td class="summary-col">${highAbsenceDays > 0 ? `⚠️ ${highAbsenceDays}d >5` : '✅ OK'}</td></tr>`;

  if (totalVisibleStaff === 0) {
    bHtml = `<tr><td colspan="${daysCount + 3}" style="padding: 32px; text-align:center; color: #64748b;">
      No se encontraron funcionarios para el filtro o búsqueda actual.
    </td></tr>`;
  } else {
    bHtml += tensRowHtml;
  }

  tbody.innerHTML = bHtml;

  // Actualizar barra de estado del calendario
  const monthLabelEl = document.getElementById('calendarMonthLabel');
  if (monthLabelEl) monthLabelEl.textContent = `${MONTH_LABELS[month]} ${year}`;

  const visCountEl = document.getElementById('calendarVisibleCount');
  if (visCountEl) visCountEl.textContent = `Mostrando ${totalVisibleStaff} de ${Object.keys(state.staff).length} funcionarios`;

  const tensPillEl = document.getElementById('tensAbsenceSummaryPill');
  if (tensPillEl) {
    if (highAbsenceDays > 0) {
      tensPillEl.innerHTML = `<span class="tens-alert-pill tens-alert-warn" title="Días hábiles (L-V) en el mes con más de 5 TENS ausentes simultáneamente">⚠️ Cupo Ausencias TENS (L-V): ${highAbsenceDays} día(s) superan 5 ausencias</span>`;
    } else {
      tensPillEl.innerHTML = `<span class="tens-alert-pill tens-alert-ok">✅ Cupo Ausencias TENS (L-V) dentro de umbral (≤ 5 diarias)</span>`;
    }
  }
}

// ============================================================================
// 9. VISTA 2: MÓDULO TOMA DE MUESTRAS (TDM)
// ============================================================================
function getShortTdmStationCode(station) {
  const s = (station || '').toUpperCase();
  if (s.includes('TARDE')) return { code: 'T', cls: 'tdm-chip-tarde' };
  if (s.includes('07:30') || s.includes('APERTURA')) return { code: '7:30', cls: 'tdm-chip-730' };
  if (s.includes('RECEPCI')) return { code: 'R', cls: 'tdm-chip-rec' };
  if (s.includes('ORIENTADOR') || s.includes('UMT') || s.includes('INSUMOS')) return { code: 'O', cls: 'tdm-chip-ori' };
  if (s.includes('SOS') || s.includes('08:30')) return { code: 'SOS', cls: 'tdm-chip-sos' };
  return { code: 'X', cls: 'tdm-chip-am' };
}

function getPreviousDayISO(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return formatDateISO(dt);
}

function checkStaffConflictOnDate(staffId, dateStr) {
  const mainEv = state.turnsMap[`${staffId}_${dateStr}`];
  const prevIso = getPreviousDayISO(dateStr);
  const prevEv = state.turnsMap[`${staffId}_${prevIso}`];

  if (mainEv) {
    if (mainEv.event_type === 'VACACIONES') {
      return { hasConflict: true, badgeHtml: `<span class="badge badge-danger">⚠️ En Vacaciones (FL)</span>`, text: 'En Vacaciones (FL)' };
    }
    if (mainEv.event_type === 'LICENCIA_MEDICA') {
      return { hasConflict: true, badgeHtml: `<span class="badge badge-danger">⚠️ En Licencia Médica (LM)</span>`, text: 'En Licencia Médica (LM)' };
    }
    if (mainEv.event_type === 'ADMINISTRATIVO') {
      return { hasConflict: true, badgeHtml: `<span class="badge badge-warn">⚠️ Día Administrativo (DA)</span>`, text: 'Con Día Administrativo (DA)' };
    }
    if (mainEv.code === 'N') {
      return { hasConflict: true, badgeHtml: `<span class="badge badge-warn">🌙 En Turno Noche (N)</span>`, text: 'Con Turno Noche (N)' };
    }
    if (prevEv && prevEv.code === 'N') {
      return { hasConflict: true, badgeHtml: `<span class="badge badge-warn">🌙 Saliente de Noche + (${mainEv.code})</span>`, text: 'Saliente de Turno Noche' };
    }
    return { hasConflict: false, badgeHtml: `<span class="badge badge-ok">✅ Activo (${mainEv.code})</span>`, text: `Activo (${mainEv.code})` };
  }
  if (prevEv && prevEv.code === 'N') {
    return { hasConflict: true, badgeHtml: `<span class="badge badge-warn">🌙 Saliente de Turno Noche</span>`, text: 'Saliente de Turno Noche' };
  }
  return { hasConflict: false, badgeHtml: `<span class="badge badge-ok">✅ Jornada Diurna Disponible</span>`, text: 'Disponible' };
}

function renderTdmView() {
  const selectedDate = state.tdmDate;
  const stationFilter = state.tdmStationFilter;
  const tdmArray = getActiveTdmArray();

  const dailyList = tdmArray.filter(t => {
    if (t.date !== selectedDate) return false;
    if (stationFilter !== 'all' && !t.station.toLowerCase().includes(stationFilter.toLowerCase())) return false;
    return true;
  });

  document.getElementById('tdmDailyTitle').textContent = `Dotación Asignada a Toma de Muestras — ${selectedDate}`;
  document.getElementById('tdmDailyCount').textContent = `${dailyList.length} asignados`;

  const dailyTbody = document.getElementById('tdmDailyTbody');
  const alertsDiv = document.getElementById('tdmDailyAlerts');
  let alertsHtml = '';
  let rowsHtml = '';

  for (const item of dailyList) {
    const st = state.staff[item.staff_id] || {
      name: item.staff_name,
      rut: 'N/A',
      role: 'Apoyo',
      estamento: 'Apoyo',
      section: 'APA'
    };

    const statusInfo = checkStaffConflictOnDate(item.staff_id, selectedDate);
    if (statusInfo.hasConflict) {
      alertsHtml += `<div class="alert-banner warning-banner" style="margin: 8px 18px 0 18px;">
        <span>⚠️ <strong>Alerta de Cruce en TDM:</strong> <b>${st.name}</b> figura asignado(a) a <em>${item.station}</em> el ${selectedDate}, pero registra <strong>${statusInfo.text}</strong> en el Calendario General.</span>
      </div>`;
    }

    rowsHtml += `<tr>
      <td><strong class="staff-name-main" data-staff-id="${item.staff_id}">${st.name}</strong></td>
      <td style="font-family: 'JetBrains Mono', monospace; font-size:11.5px;">${st.rut || 'Pendiente'}</td>
      <td>${st.estamento || st.role} · <span class="badge badge-blue">${st.section}</span></td>
      <td><span class="badge badge-purple">${item.station}</span></td>
      <td>${statusInfo.badgeHtml}</td>
      <td>
        <button class="btn btn-danger-outline btn-remove-tdm" style="padding:3px 8px; font-size:11px;" data-staff="${item.staff_id}" data-date="${item.date}">
          Quitar
        </button>
      </td>
    </tr>`;
  }

  if (dailyList.length === 0) {
    rowsHtml = `<tr><td colspan="6" style="text-align:center; padding: 24px; color:#64748b;">
      No hay funcionarios asignados a Toma de Muestras para la fecha ${selectedDate}. Usa "+ Asignar Funcionario a Puesto TDM" o haz clic en la matriz mensual inferior.
    </td></tr>`;
  }

  alertsDiv.innerHTML = alertsHtml;
  dailyTbody.innerHTML = rowsHtml;

  // Renderizar Matriz Mensual TDM Interactiva
  const year = Number(selectedDate.slice(0, 4));
  const month = Number(selectedDate.slice(5, 7));
  const daysCount = getDaysInMonth(year, month);
  const holidayMap = getHolidayMapForMonth(year, month);

  document.getElementById('tdmMonthMatrixTitle').textContent =
    `Matriz Mensual de Rotación en Toma de Muestras — ${MONTH_LABELS[month]} ${year}`;

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
  const monthRecords = tdmArray.filter(t => t.date.startsWith(monthPrefix));

  // Mostrar todos los funcionarios que participan en TDM este mes (o habitualmente en la hoja TDM)
  const staffIdsInMonth = new Set(monthRecords.map(r => r.staff_id));
  for (const s of Object.values(state.staff)) {
    if ((s.sheets || []).includes('TOMA DE MUESTRA') && monthRecords.length === 0) {
      staffIdsInMonth.add(s.id);
    }
  }

  let mHead = `<tr><th class="sticky-col-name">Funcionario en TDM</th>`;
  for (let d = 1; d <= daysCount; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dow = dateObj.getDay();
    const iso = formatDateISO(dateObj);
    const isSelectedDay = iso === selectedDate;
    const cls = holidayMap[iso] ? 'col-holiday' : ((dow === 0 || dow === 6) ? 'col-weekend' : '');
    const selStyle = isSelectedDay ? 'style="outline: 2px solid #7e22ce; background:#f3e8ff;"' : '';
    mHead += `<th class="day-col-header ${cls}" ${selStyle} data-tdm-header-date="${iso}" style="cursor:pointer;" title="Ver tablero diario del ${iso}">
      <span class="day-num">${d}</span>
      <span class="day-dow">${DOW_SHORT[dow]}</span>
    </th>`;
  }
  mHead += `<th class="summary-col">Total Días</th></tr>`;
  document.getElementById('tdmMonthThead').innerHTML = mHead;

  let mBody = '';
  const sortedIds = Array.from(staffIdsInMonth).sort((a, b) => {
    const na = state.staff[a]?.name || a;
    const nb = state.staff[b]?.name || b;
    return na.localeCompare(nb, 'es');
  });

  for (const sid of sortedIds) {
    const st = state.staff[sid] || { name: sid, rut: '' };
    let totalDays = 0;
    mBody += `<tr><td class="sticky-col-name">
      <div class="staff-cell-inner">
        <strong class="staff-name-main" data-staff-id="${sid}">${st.name}</strong>
        <span class="badge badge-blue" style="font-size:9px;">${st.section || 'APA'}</span>
      </div>
    </td>`;
    for (let d = 1; d <= daysCount; d++) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const rec = state.tdmMap[`${sid}_${iso}`];
      const conflictInfo = checkStaffConflictOnDate(sid, iso);
      if (rec) {
        totalDays++;
        const chip = getShortTdmStationCode(rec.station);
        const warnMark = conflictInfo.hasConflict ? '!' : '';
        const bgStyle = conflictInfo.hasConflict
          ? 'background:#fee2e2; color:#991b1b; font-weight:800;'
          : 'background:#f3e8ff; color:#6b21a8; font-weight:700;';
        const traceTip = (canViewTraceability() && rec.updated_by_name)
          ? ` | 🛡️ Asignado por: ${rec.updated_by_name} (${formatDateTimeCL(rec.updated_at)})`
          : '';
        mBody += `<td class="day-cell tdm-matrix-cell" data-staff="${sid}" data-date="${iso}" style="${bgStyle}" title="${st.name} (${iso}): ${rec.station}${conflictInfo.hasConflict ? ' | ⚠️ ' + conflictInfo.text : ''}${traceTip}">
          ${chip.code}${warnMark}
        </td>`;
      } else {
        const mainEv = state.turnsMap[`${sid}_${iso}`];
        const subHint = mainEv && ABSENCE_TYPES.has(mainEv.event_type) ? `<span style="color:#cbd5e1;font-size:9px;">${mainEv.code}</span>` : '';
        const actionHint = canEditCalendar() ? `Clic para asignar a ${st.name} en TDM el ${iso}` : `${st.name} (${iso}): Sin asignación TDM`;
        mBody += `<td class="day-cell tdm-matrix-cell" data-staff="${sid}" data-date="${iso}" title="${actionHint}">${subHint}</td>`;
      }
    }
    mBody += `<td class="summary-col">${totalDays}</td></tr>`;
  }

  if (sortedIds.length === 0) {
    mBody = `<tr><td colspan="${daysCount + 2}" style="text-align:center; padding:20px; color:#64748b;">
      Sin registros de Toma de Muestras en este mes.
    </td></tr>`;
  }
  document.getElementById('tdmMonthTbody').innerHTML = mBody;
}

// ============================================================================
// 10. VISTA 3: DIRECTORIO DE DOTACIÓN Y DATOS PENDIENTES
// ============================================================================
function renderDirectoryView() {
  const allStaff = Object.values(state.staff);
  const total = allStaff.length;
  const incomplete = allStaff.filter(s => s.needs_completion).length;
  const complete = total - incomplete;
  const rotating = allStaff.filter(s => s.modality === '4to Turno / Rotativo').length;

  document.getElementById('statTotalStaff').textContent = total;
  document.getElementById('statCompleteStaff').textContent = complete;
  document.getElementById('statPendingStaff').textContent = incomplete;
  document.getElementById('statRotatingStaff').textContent = rotating;
  document.getElementById('bannerIncompleteCount').textContent = incomplete;

  const banner = document.getElementById('incompleteStaffBanner');
  banner.style.display = incomplete > 0 ? 'flex' : 'none';

  const q = state.dirSearch;
  const fSection = state.dirFilterSection;
  const fStatus = state.dirFilterStatus;
  const fModality = state.dirFilterModality;
  const fEstamento = state.dirFilterEstamento;

  const filtered = allStaff.filter(s => {
    if (!matchesSearch(s, q)) return false;
    if (fSection !== 'all' && s.section !== fSection) return false;
    if (fStatus === 'incomplete' && !s.needs_completion) return false;
    if (fStatus === 'complete' && s.needs_completion) return false;
    if (fModality !== 'all' && s.modality !== fModality) return false;
    if (fEstamento !== 'all') {
      const estNorm = normalizeSearchText(s.estamento || s.role);
      const targetNorm = normalizeSearchText(fEstamento);
      if (!estNorm.includes(targetNorm)) return false;
    }
    return true;
  }).sort((a, b) => {
    if (a.needs_completion !== b.needs_completion) return a.needs_completion ? -1 : 1;
    return a.name.localeCompare(b.name, 'es');
  });

  const countBadge = document.getElementById('dirCountBadge');
  if (countBadge) {
    countBadge.textContent = `${filtered.length} de ${total} funcionarios`;
  }

  let html = '';
  for (const s of filtered) {
    const statusBadge = s.needs_completion
      ? `<span class="badge badge-warn">⚠️ Falta: ${(s.missing_fields || []).join(', ')}</span>`
      : `<span class="badge badge-ok">✅ Completo</span>`;

    const sheetsBadges = (s.sheets || []).map(sh => `<span class="badge">${sh}</span>`).join(' ');

    html += `<tr>
      <td>${statusBadge}</td>
      <td><strong class="staff-name-main" data-staff-id="${s.id}">${s.name}</strong></td>
      <td>${s.official_name || '<em style="color:#94a3b8;">Sin cruce nominal completo</em>'}</td>
      <td style="font-family: 'JetBrains Mono', monospace; font-weight:600;">
        ${s.rut || '<span style="color:#dc2626; font-weight:700;">Falta RUT</span>'}
      </td>
      <td>${s.estamento || s.role}</td>
      <td><span class="badge badge-blue" title="${SECTION_DESCRIPTIONS[s.section] || s.section}">${s.section}</span></td>
      <td><span class="badge ${s.modality.includes('4to') ? 'badge-purple' : 'badge-ok'}">${s.modality}</span></td>
      <td>${sheetsBadges}</td>
      <td style="display:flex; gap:4px;">
        <button class="btn btn-outline btn-annual-staff" style="padding:4px 8px; font-size:11px; color:#1e40af; border-color:#bfdbfe;" data-id="${s.id}" title="Ver calendario anual completo del funcionario">
          📅 Anual
        </button>
        <button class="btn btn-primary btn-edit-staff" style="padding:4px 9px; font-size:11px;" data-id="${s.id}">
          ✏️ Editar
        </button>
      </td>
    </tr>`;
  }

  if (filtered.length === 0) {
    html = `<tr><td colspan="9" style="text-align:center; padding:24px; color:#64748b;">
      No se encontraron funcionarios para los criterios seleccionados.
    </td></tr>`;
  }

  document.getElementById('directoryTbody').innerHTML = html;
}

// ============================================================================
// 11. VISTA 4: ESTADÍSTICAS Y EQUIDAD ANUAL
// ============================================================================
function computeStaffAnnualMetrics(staffId, yearStr) {
  const turns = getTurnsArrayForYear(yearStr);
  const tdm = getTdmArrayForYear(yearStr);
  const holidaysSet = new Set((state.holidays[yearStr] || []).map(h => h.date));

  const m = { L: 0, N: 0, D: 0, extraWork: 0, weekendHoliday: 0, vac: 0, adm: 0, lm: 0, dc: 0, dt: 0, com: 0, tdm: 0 };

  for (const r of turns) {
    if (r.staff_id !== staffId) continue;
    const u = (r.code || '').toUpperCase();
    if (r.event_type === 'VACACIONES') m.vac++;
    else if (r.event_type === 'ADMINISTRATIVO') {
      m.adm += (u === 'DA-M' || u === 'DA-T') ? 0.5 : 1;
    }
    else if (r.event_type === 'LICENCIA_MEDICA') m.lm++;
    else if (r.event_type === 'COMPENSATORIO') m.dc++;
    else if (r.event_type === 'DEVOLUCION_TIEMPO') m.dt++;
    else if (r.event_type === 'COMISION_SERVICIO') m.com++;
    else if (r.event_type === 'SIN_GOCE_SUELDO') { /* ausencia PSG */ }
    else if (r.event_type === 'EXTENSION_HORARIA' || r.event_type === 'HORAS_TURNO_EXTRA') {
      m.extraWork++;
      const [yy, mm, dd] = r.date.split('-').map(Number);
      const dow = new Date(yy, mm - 1, dd).getDay();
      if (dow === 0 || dow === 6 || holidaysSet.has(r.date)) {
        m.weekendHoliday++;
      }
    } else {
      if (u === 'L') m.L++;
      else if (u === 'N') m.N++;
      else m.D++;

      const [yy, mm, dd] = r.date.split('-').map(Number);
      const dow = new Date(yy, mm - 1, dd).getDay();
      if (dow === 0 || dow === 6 || holidaysSet.has(r.date)) {
        m.weekendHoliday++;
      }
    }
  }

  for (const t of tdm) {
    if (t.staff_id === staffId) m.tdm++;
  }
  return m;
}

function renderAnalyticsView() {
  document.getElementById('analyticsYearLabel').textContent = state.year;
  const fg = state.analyticsFilter;
  const q = state.analyticsSearch;

  const staffList = Object.values(state.staff).filter(s => {
    if (!matchesSearch(s, q)) return false;
    if (fg === 'all') return true;
    return s.section === fg;
  }).sort((a, b) => a.name.localeCompare(b.name, 'es'));

  let totL = 0, totN = 0, totVac = 0, totLm = 0, totTdm = 0;
  let html = '';

  for (const s of staffList) {
    const m = computeStaffAnnualMetrics(s.id, state.year);
    totL += m.L;
    totN += m.N;
    totVac += m.vac;
    totLm += m.lm;
    totTdm += m.tdm;

    html += `<tr>
      <td><strong class="staff-name-main" data-staff-id="${s.id}">${s.name}</strong></td>
      <td style="font-family: 'JetBrains Mono', monospace; font-size:11.5px;">${s.rut || 'Pendiente'}</td>
      <td>${s.estamento || s.role} · <span class="badge badge-blue">${s.section}</span></td>
      <td class="num-col">${m.L || '-'}</td>
      <td class="num-col">${m.N || '-'}</td>
      <td class="num-col">${m.D || '-'}</td>
      <td class="num-col">${m.weekendHoliday || '-'}</td>
      <td class="num-col" style="color:#991b1b;">${m.vac || '-'}</td>
      <td class="num-col" style="color:#0e7490;">${m.adm || '-'}</td>
      <td class="num-col" style="color:#9d174d;">${m.lm || '-'}</td>
      <td class="num-col" style="color:#6b21a8;">${m.tdm || '-'}</td>
      <td>
        <button class="btn btn-outline btn-annual-staff" style="padding:3px 8px; font-size:11px; color:#1e40af; border-color:#bfdbfe;" data-id="${s.id}">
          📅 Ficha Anual
        </button>
      </td>
    </tr>`;
  }

  const summaryCardsEl = document.getElementById('analyticsSummaryCards');
  if (summaryCardsEl) {
    summaryCardsEl.innerHTML = `
      <div class="stat-card"><span class="stat-label">Funcionarios en Vista</span><strong class="stat-value">${staffList.length}</strong></div>
      <div class="stat-card stat-info"><span class="stat-label">Turnos Largo (L) + Noche (N)</span><strong class="stat-value">${totL + totN}</strong></div>
      <div class="stat-card stat-ok"><span class="stat-label">Días Feriado Legal (FL)</span><strong class="stat-value">${totVac}</strong></div>
      <div class="stat-card stat-warn"><span class="stat-label">Días Licencia Médica (LM)</span><strong class="stat-value">${totLm}</strong></div>
      <div class="stat-card"><span class="stat-label">Asignaciones TDM</span><strong class="stat-value" style="color:#7e22ce;">${totTdm}</strong></div>
    `;
  }

  document.getElementById('analyticsTbody').innerHTML = html;
}

// ============================================================================
// 12. MODAL 5: FICHA ANUAL DEL FUNCIONARIO (TIMELINE 12 MESES)
// ============================================================================
function openStaffAnnualModal(staffId) {
  const st = state.staff[staffId];
  if (!st) return;
  state.annualModalStaffId = staffId;

  document.getElementById('annualStaffTitle').textContent =
    `${st.name} — Ficha Anual ${state.year}`;
  document.getElementById('annualStaffSubtitle').textContent =
    `Nombre Legal: ${st.official_name || st.name} · RUT: ${st.rut || 'Pendiente'} · Estamento: ${st.estamento || st.role} · Área: ${SECTION_DESCRIPTIONS[st.section] || st.section} · Modalidad: ${st.modality}`;

  const m = computeStaffAnnualMetrics(staffId, state.year);
  document.getElementById('annualKpiGrid').innerHTML = `
    <div class="annual-kpi-box"><span>Turnos Largo (L)</span><strong style="color:#1e40af;">${m.L}</strong></div>
    <div class="annual-kpi-box"><span>Turnos Noche (N)</span><strong style="color:#0f172a;">${m.N}</strong></div>
    <div class="annual-kpi-box"><span>Extensión / H. Extra</span><strong style="color:#c2410c;">${m.extraWork}</strong></div>
    <div class="annual-kpi-box"><span>Fines Sem. / Feriados</span><strong style="color:#d97706;">${m.weekendHoliday}</strong></div>
    <div class="annual-kpi-box"><span>Vacaciones (FL)</span><strong style="color:#991b1b;">${m.vac} días</strong></div>
    <div class="annual-kpi-box"><span>Días Admin. (DA)</span><strong style="color:#0e7490;">${m.adm} / 6</strong></div>
    <div class="annual-kpi-box"><span>Compensat. / Devol.</span><strong style="color:#166534;">${m.dc} DC · ${m.dt} DT</strong></div>
    <div class="annual-kpi-box"><span>Licencias (LM)</span><strong style="color:#9d174d;">${m.lm} días</strong></div>
    <div class="annual-kpi-box"><span>Días en TDM</span><strong style="color:#6b21a8;">${m.tdm} días</strong></div>
  `;

  // Construir matriz 12 meses x 31 días
  let theadHtml = `<tr><th class="sticky-col-name" style="min-width:130px;max-width:130px;">Mes (${state.year})</th>`;
  for (let d = 1; d <= 31; d++) {
    theadHtml += `<th class="day-col-header" style="min-width:28px;"><span class="day-num">${d}</span></th>`;
  }
  theadHtml += `<th class="summary-col">Turnos</th><th class="summary-col">Ausenc.</th><th class="summary-col">TDM</th></tr>`;
  document.getElementById('annualTimelineThead').innerHTML = theadHtml;

  let tbodyHtml = '';
  const yearNum = Number(state.year);

  for (let mIdx = 1; mIdx <= 12; mIdx++) {
    const maxD = getDaysInMonth(yearNum, mIdx);
    const holidayMap = getHolidayMapForMonth(yearNum, mIdx);
    let mShifts = 0, mAbs = 0, mTdm = 0;

    tbodyHtml += `<tr><td class="sticky-col-name" style="min-width:130px;max-width:130px;font-weight:700;">${MONTH_LABELS[mIdx]}</td>`;
    for (let d = 1; d <= 31; d++) {
      if (d > maxD) {
        tbodyHtml += `<td style="background:#e2e8f0;"></td>`;
        continue;
      }
      const dateObj = new Date(yearNum, mIdx - 1, d);
      const dow = dateObj.getDay();
      const iso = formatDateISO(dateObj);
      const ev = state.turnsMap[`${staffId}_${iso}`];
      const tdm = state.tdmMap[`${staffId}_${iso}`];

      let cls = ['day-cell', 'annual-day-cell'];
      if (holidayMap[iso]) cls.push('col-holiday');
      else if (dow === 0 || dow === 6) cls.push('col-weekend');

      let code = '';
      if (ev) {
        code = ev.event_type === 'DEVOLUCION_TIEMPO' ? 'DT' : (ev.code || '');
        const u = code.toUpperCase();
        if (ev.event_type && ev.event_type !== 'TURNO') {
          cls.push(`ev-${ev.event_type}`);
          if (ABSENCE_TYPES.has(ev.event_type)) mAbs++;
          else mShifts++;
        } else if (['L', 'N', 'D', 'M', 'T'].includes(u)) {
          cls.push(`shift-${u}`);
          mShifts++;
        } else {
          cls.push('ev-HORARIO_ESPECIAL');
          mShifts++;
        }
        if (ev.a_devolucion) cls.push('is-devolucion');
        if (ev.is_extra_shift) cls.push('is-extra-shift');
      }
      let dot = '';
      if (tdm) {
        mTdm++;
        dot = `<span class="tdm-indicator"></span>`;
        if (!code) code = 'TDM';
      }

      const traceAnnual = (canViewTraceability() && ev && (ev.authorized_by || ev.updated_by_name))
        ? ` · 🛡️ Otorgado/Modificado por: ${ev.authorized_by || ev.updated_by_name} (${formatDateTimeCL(ev.updated_at)})`
        : '';
      const clickHint = canEditCalendar() ? ' — Clic para editar' : '';
      tbodyHtml += `<td class="${cls.join(' ')}" data-staff="${staffId}" data-date="${iso}" title="${d} ${MONTH_LABELS[mIdx]} ${state.year} (${DOW_SHORT[dow]})${ev ? ' · ' + ev.description : ''}${tdm ? ' · TDM: ' + tdm.station : ''}${traceAnnual}${clickHint}">${code}${dot}</td>`;
    }
    tbodyHtml += `<td class="summary-col">${mShifts || '-'}</td><td class="summary-col">${mAbs || '-'}</td><td class="summary-col">${mTdm || '-'}</td></tr>`;
  }

  document.getElementById('annualTimelineTbody').innerHTML = tbodyHtml;
  document.getElementById('modalStaffAnnual').classList.remove('hidden');
}

// ============================================================================
// 13. MODALES DE EDICIÓN (CELDA / RANGO, ESQUEMAS, FUNCIONARIO, TDM)
// ============================================================================
function populateStaffSelect(selectId, selectedStaffId = null) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const sorted = Object.values(state.staff).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  sel.innerHTML = sorted
    .map(s => `<option value="${s.id}" ${s.id === selectedStaffId ? 'selected' : ''}>${s.name} — ${s.section} (${s.rut || 'Sin RUT'})</option>`)
    .join('');
}

function syncCellModalExtraUI(focusHoursInput = false) {
  const evType = document.getElementById('cellEventType')?.value || '';
  const codeVal = (document.getElementById('cellCodeInput')?.value || '').trim().toUpperCase();

  // 0. Resaltar el botón (.code-pill) activo en "Tipo de Asignación"
  if (typeof document.querySelectorAll === 'function') {
    document.querySelectorAll('#quickCodePills .code-pill').forEach(pill => {
      const pType = pill.dataset.type;
      const pCode = (pill.dataset.code || '').toUpperCase();
      let isActive = false;
      if (pType === 'EXTENSION_HORARIA') {
        isActive = evType === 'EXTENSION_HORARIA' || codeVal.startsWith('E+');
      } else if (pType === 'HORAS_TURNO_EXTRA') {
        isActive = evType === 'HORAS_TURNO_EXTRA' || codeVal.startsWith('H+');
      } else if (pType === 'DEVOLUCION_TIEMPO') {
        isActive = evType === 'DEVOLUCION_TIEMPO' || codeVal === 'DT';
      } else if (pType === 'ADMINISTRATIVO') {
        isActive = evType === 'ADMINISTRATIVO' || codeVal === 'DA' || codeVal === 'DA-M' || codeVal === 'DA-T';
      } else {
        isActive = Boolean(codeVal && pCode === codeVal);
      }
      pill.classList.toggle('active', isActive);
    });
  }

  // 1. Mostrar/ocultar campo de cantidad de horas (n) para E+n / H+n
  const ehBuilder = document.getElementById('extraHoursBuilder');
  const ehLabel = document.getElementById('extraHoursBuilderLabel');
  const ehPrefix = document.getElementById('extraHoursPrefixBadge');
  const ehNumInput = document.getElementById('extraHoursNumberInput');
  if (ehBuilder) {
    const isExtOrHex = evType === 'EXTENSION_HORARIA' || evType === 'HORAS_TURNO_EXTRA';
    ehBuilder.classList.toggle('hidden', !isExtOrHex);
    if (ehLabel) {
      ehLabel.textContent = evType === 'EXTENSION_HORARIA'
        ? '⚡ Extensión Horaria — indica cantidad de horas:'
        : '🔥 Horas por Turno Extra — indica cantidad de horas:';
    }
    if (ehPrefix) {
      ehPrefix.textContent = evType === 'EXTENSION_HORARIA' ? 'E+' : 'H+';
    }
    const hrsMatch = codeVal.match(/^[EH]\+(\d+)$/);
    if (ehNumInput && hrsMatch) {
      ehNumInput.value = hrsMatch[1];
    }
    if (focusHoursInput && isExtOrHex && ehNumInput) {
      setTimeout(() => {
        ehNumInput.focus();
        ehNumInput.select();
      }, 10);
    }
  }

  // 1a. Mostrar/ocultar selector de jornada para DA (Día Completo DA vs Media Jornada Mañana DA-M / Tarde DA-T)
  const daBuilder = document.getElementById('daModeBuilder');
  const daFull = document.getElementById('daModeFull');
  const daMorning = document.getElementById('daModeMorning');
  const daAfternoon = document.getElementById('daModeAfternoon');
  if (daBuilder) {
    const isDA = evType === 'ADMINISTRATIVO' || codeVal === 'DA' || codeVal === 'DA-M' || codeVal === 'DA-T';
    daBuilder.classList.toggle('hidden', !isDA);
    if (isDA) {
      if (codeVal === 'DA-M' && daMorning) daMorning.checked = true;
      else if (codeVal === 'DA-T' && daAfternoon) daAfternoon.checked = true;
      else if (daFull) daFull.checked = true;
    }
  }

  // 1b. Mostrar/ocultar selector inmediato de horario para DT (Devolución de Tiempo)
  const dtBuilder = document.getElementById('dtScheduleBuilder');
  const dtTimeRow = document.getElementById('dtTimeInputsRow');
  const dtModePartial = document.getElementById('dtModePartial');
  const dtScheduleText = document.getElementById('dtScheduleTextInput');
  if (dtBuilder) {
    const isDT = evType === 'DEVOLUCION_TIEMPO' || codeVal === 'DT';
    dtBuilder.classList.toggle('hidden', !isDT);
    if (dtTimeRow && dtModePartial) {
      dtTimeRow.classList.toggle('hidden', !dtModePartial.checked);
    }
    if (focusHoursInput && isDT && dtModePartial?.checked && dtScheduleText) {
      setTimeout(() => {
        dtScheduleText.focus();
        dtScheduleText.select();
      }, 10);
    }
  }

  // 2. Mostrar/ocultar tarjeta "🔄 Realizado para Devolución de Tiempo"
  // Aplica a: Extensión Horaria (E+n), Horas por Turno Extra (H+n), y Turnos (L, N, D, M, T)
  const devGroup = document.getElementById('cellDevolucionGroup');
  if (devGroup) {
    const canBeDevolucion =
      evType === 'EXTENSION_HORARIA' ||
      evType === 'HORAS_TURNO_EXTRA' ||
      evType === 'TURNO';
    devGroup.classList.toggle('hidden', !canBeDevolucion);
  }
}

function showReadonlyCellSummaryToast(staffId, dateStr) {
  const st = state.staff[staffId];
  if (!st || !dateStr) return;
  const key = `${staffId}_${dateStr}`;
  const ev = state.turnsMap[key];
  const tdm = state.tdmMap[key];
  const parts = [`📅 ${st.name} (${dateStr})`];
  if (ev) {
    parts.push(`${ev.code || ev.event_type}: ${ev.description || ev.event_type}`);
  } else {
    parts.push('Libre / Sin turno especial');
  }
  if (tdm) {
    parts.push(`🩸 TDM: ${tdm.station}`);
  }
  showToast(parts.join(' · '));
}

function updateCellAuditTraceBanner(staffId, dateStr) {
  const banner = document.getElementById('cellAuditTraceBanner');
  if (!banner) return;
  if (!canViewTraceability()) {
    banner.classList.add('hidden');
    return;
  }
  const key = `${staffId}_${dateStr}`;
  const ev = state.turnsMap[key];
  const tdm = state.tdmMap[key];

  if (ev && (ev.updated_by_name || ev.authorized_by)) {
    const grantor = ev.authorized_by || ev.updated_by_name;
    const roleLabel = ev.updated_by_role === 'admin' ? 'Administrador' : 'Jefatura';
    const editorInfo = (ev.updated_by_name && ev.authorized_by && ev.updated_by_name !== ev.authorized_by)
      ? ` (registrado por ${ev.updated_by_name})`
      : '';
    banner.innerHTML = `
      <div>
        🛡️ <strong>Trazabilidad del día (${dateStr}):</strong>
        Otorgado / modificado por <strong>${grantor}</strong>${editorInfo}
        <span class="badge badge-blue" style="margin-left:4px;">${roleLabel}</span>
      </div>
      <span style="font-family:'JetBrains Mono',monospace; font-size:11px; color:#0369a1;">
        🕒 ${formatDateTimeCL(ev.updated_at)}
      </span>
    `;
    banner.classList.remove('hidden');
  } else if (tdm && tdm.updated_by_name) {
    banner.innerHTML = `
      <div>
        🛡️ <strong>Trazabilidad TDM (${dateStr}):</strong>
        Asignado por <strong>${tdm.updated_by_name}</strong>
      </div>
      <span style="font-family:'JetBrains Mono',monospace; font-size:11px; color:#0369a1;">
        🕒 ${formatDateTimeCL(tdm.updated_at)}
      </span>
    `;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

function openCellModal(staffId, dateStr, defaultEventType = null) {
  if (!canEditCalendar()) {
    showReadonlyCellSummaryToast(staffId, dateStr);
    return;
  }
  const defaultDate = dateStr || `${state.year}-${String(state.month).padStart(2, '0')}-01`;
  const defaultStaff = staffId || Object.keys(state.staff).sort()[0];

  populateStaffSelect('cellStaffSelect', defaultStaff);
  document.getElementById('cellStaffId').value = defaultStaff;
  document.getElementById('cellDate').value = defaultDate;
  document.getElementById('cellEndDate').value = defaultDate;
  document.getElementById('cellRangeMode').value = 'all';

  const key = `${defaultStaff}_${defaultDate}`;
  const ev = state.turnsMap[key];
  const tdm = state.tdmMap[key];

  updateCellAuditTraceBanner(defaultStaff, defaultDate);

  const authByInput = document.getElementById('cellAuthorizedByInput');
  if (authByInput) {
    authByInput.value = (ev && ev.authorized_by) ? ev.authorized_by : (state.currentUser?.name || '');
  }

  document.getElementById('modalCellTitle').textContent = `Programar Turno, Permiso o Ausencia`;
  const devCheck = document.getElementById('cellDevolucionCheck');
  const dtModePartial = document.getElementById('dtModePartial');
  const dtModeFull = document.getElementById('dtModeFull');
  const dtStartTime = document.getElementById('dtStartTime');
  const dtEndTime = document.getElementById('dtEndTime');
  const dtScheduleText = document.getElementById('dtScheduleTextInput');

  if (defaultEventType) {
    document.getElementById('cellEventType').value = defaultEventType;
    document.getElementById('cellCodeInput').value = defaultEventType === 'VACACIONES' ? 'FL' : 'DA';
    document.getElementById('cellDescInput').value = EVENT_DESCRIPTIONS[defaultEventType] || '';
    if (devCheck) devCheck.checked = false;
    if (defaultEventType === 'VACACIONES' || defaultEventType === 'ADMINISTRATIVO') {
      document.getElementById('cellRangeMode').value = 'weekdays';
    }
  } else {
    let resolvedType = ev ? (ev.event_type || 'TURNO') : '';
    const uCode = ev ? String(ev.code || '').toUpperCase().trim() : '';
    if (uCode.startsWith('E+')) resolvedType = 'EXTENSION_HORARIA';
    else if (uCode.startsWith('H+')) resolvedType = 'HORAS_TURNO_EXTRA';
    document.getElementById('cellEventType').value = resolvedType;
    document.getElementById('cellCodeInput').value = resolvedType === 'DEVOLUCION_TIEMPO' ? 'DT' : (ev ? (ev.code || '') : '');
    document.getElementById('cellDescInput').value = ev ? (ev.description || '') : '';
    if (devCheck) devCheck.checked = Boolean(ev && ev.a_devolucion);

    if (resolvedType === 'DEVOLUCION_TIEMPO') {
      const existingSched = ev?.dt_schedule || (ev?.raw_value && !['DT', 'L', 'N', 'D', 'M', 'T'].includes(String(ev.raw_value).toUpperCase().trim()) ? String(ev.raw_value).trim() : '');
      if (existingSched) {
        if (dtModePartial) dtModePartial.checked = true;
        if (dtScheduleText) dtScheduleText.value = existingSched;
        const mTime = existingSched.match(/^(\d{1,2}:\d{2})\s*[-/]\s*(\d{1,2}:\d{2})$/);
        if (mTime && dtStartTime && dtEndTime) {
          dtStartTime.value = mTime[1].padStart(5, '0');
          dtEndTime.value = mTime[2].padStart(5, '0');
        }
      } else {
        if (dtModeFull) dtModeFull.checked = true;
        if (dtScheduleText) dtScheduleText.value = '';
      }
    } else {
      if (dtModePartial) dtModePartial.checked = true;
      if (dtStartTime) dtStartTime.value = '15:00';
      if (dtEndTime) dtEndTime.value = '17:00';
      if (dtScheduleText) dtScheduleText.value = '15:00-17:00';
    }
  }

  const tdmCheck = document.getElementById('cellTdmCheck');
  const tdmGroup = document.getElementById('cellTdmStationGroup');
  if (tdm) {
    tdmCheck.checked = true;
    tdmGroup.classList.remove('hidden');
    document.getElementById('cellTdmStation').value = tdm.station;
  } else {
    tdmCheck.checked = false;
    tdmGroup.classList.add('hidden');
  }

  syncCellModalExtraUI();
  updateRangePreview();
  document.getElementById('modalCellEdit').classList.remove('hidden');
}

function updateRangePreview() {
  const startStr = document.getElementById('cellDate').value;
  const endStr = document.getElementById('cellEndDate').value;
  const mode = document.getElementById('cellRangeMode').value;
  const previewEl = document.getElementById('cellRangePreview');
  if (!startStr || !endStr || !previewEl) return;

  if (endStr < startStr) {
    previewEl.innerHTML = `<span style="color:#dc2626;">⚠️ La fecha final no puede ser anterior a la fecha inicial.</span>`;
    return;
  }

  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  const endDate = new Date(ey, em - 1, ed);
  const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  let effectiveDays = 0;
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const iso = formatDateISO(d);
    const yr = iso.slice(0, 4);
    const holidaysSet = new Set((state.holidays[yr] || []).map(h => h.date));
    const dow = d.getDay();
    if (mode === 'weekdays' && (dow === 0 || dow === 6 || holidaysSet.has(iso))) {
      continue;
    }
    effectiveDays++;
  }

  if (totalDays === 1) {
    previewEl.innerHTML = `Se aplicará al día <strong>${startStr}</strong> (1 día).`;
  } else {
    previewEl.innerHTML = `Rango seleccionado: <strong>${startStr}</strong> al <strong>${endStr}</strong> (${totalDays} días corridos → se aplicará en <strong>${effectiveDays} días efectivos</strong>).`;
  }
}

function setQuickDuration(daysParam) {
  const startStr = document.getElementById('cellDate').value;
  if (!startStr) return;
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const d = new Date(sy, sm - 1, sd);

  if (daysParam === 'month_end') {
    const lastDay = getDaysInMonth(sy, sm);
    document.getElementById('cellEndDate').value = `${sy}-${String(sm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  } else {
    const numDays = Number(daysParam);
    d.setDate(d.getDate() + numDays - 1);
    document.getElementById('cellEndDate').value = formatDateISO(d);
  }
  updateRangePreview();
}

function saveCellModal() {
  if (!canEditCalendar()) {
    showToast('🔒 Inicia sesión como Jefatura o Administrador para guardar cambios.');
    return;
  }
  const staffId = document.getElementById('cellStaffSelect').value || document.getElementById('cellStaffId').value;
  const startStr = document.getElementById('cellDate').value;
  const endStr = document.getElementById('cellEndDate').value || startStr;
  const rangeMode = document.getElementById('cellRangeMode').value;
  let evType = document.getElementById('cellEventType').value;
  const code = document.getElementById('cellCodeInput').value.trim();
  const desc = document.getElementById('cellDescInput').value.trim();
  const authorizedBy = document.getElementById('cellAuthorizedByInput')?.value.trim() || state.currentUser?.name || '';
  const devChecked = Boolean(document.getElementById('cellDevolucionCheck')?.checked);
  const tdmChecked = document.getElementById('cellTdmCheck').checked;
  const tdmStation = document.getElementById('cellTdmStation').value;

  if (!staffId || !startStr || endStr < startStr) {
    showToast('⚠️ Verifica el funcionario y rango de fechas.');
    return;
  }

  const uInput = code.toUpperCase();
  if (uInput.startsWith('E+')) evType = 'EXTENSION_HORARIA';
  else if (uInput.startsWith('H+')) evType = 'HORAS_TURNO_EXTRA';
  else if (uInput === 'DC') evType = 'COMPENSATORIO';
  else if (uInput === 'DT') evType = 'DEVOLUCION_TIEMPO';
  else if (uInput === 'DA' || uInput === 'DA-M' || uInput === 'DA-T') evType = 'ADMINISTRATIVO';

  pushUndoSnapshot(`Asignación (${code || evType || 'Limpiar'}) a ${state.staff[staffId]?.name}`);
  const stamp = buildTraceStamp(authorizedBy);

  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  const endDate = new Date(ey, em - 1, ed);
  const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  let modifiedDays = 0;
  const beforeCodesSet = new Set();
  let lastAssignedCode = '';
  let lastAssignedDesc = '';
  let lastFinalType = '';

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const iso = formatDateISO(d);
    const yr = iso.slice(0, 4);
    const holidaysSet = new Set((state.holidays[yr] || []).map(h => h.date));
    const dow = d.getDay();

    if (rangeMode === 'weekdays' && (dow === 0 || dow === 6 || holidaysSet.has(iso))) {
      continue;
    }

    const turnsArr = getTurnsArrayForYear(yr);
    const existingIdx = turnsArr.findIndex(r => r.staff_id === staffId && r.date === iso);
    let prevBaseShift = null;
    if (existingIdx >= 0) {
      const prevRec = turnsArr[existingIdx];
      beforeCodesSet.add(prevRec.code || prevRec.event_type || 'Turno');
      const cand = String(prevRec.raw_value || prevRec.code || '').toUpperCase().trim();
      if (cand === 'L' || cand === 'N') prevBaseShift = cand;
      turnsArr.splice(existingIdx, 1);
    } else {
      beforeCodesSet.add('Libre');
    }

    if (evType || code) {
      let defaultCode = code;
      if (!defaultCode) {
        const defaultCodes = {
          'VACACIONES': 'FL',
          'ADMINISTRATIVO': 'DA',
          'LICENCIA_MEDICA': 'LM',
          'DEVOLUCION_TIEMPO': 'DT',
          'COMISION_SERVICIO': '*',
          'SIN_GOCE_SUELDO': 'PSG',
          'COMPENSATORIO': 'DC',
          'EXTENSION_HORARIA': 'E+2',
          'HORAS_TURNO_EXTRA': 'H+6'
        };
        defaultCode = defaultCodes[evType] || 'D';
      }
      const finalType = evType || 'TURNO';
      if (finalType === 'DEVOLUCION_TIEMPO') {
        defaultCode = 'DT';
      }
      const canHaveDevolucion =
        finalType === 'EXTENSION_HORARIA' ||
        finalType === 'HORAS_TURNO_EXTRA' ||
        finalType === 'TURNO';
      const isADevolucion = canHaveDevolucion && devChecked;

      let dtScheduleStr = '';
      if (finalType === 'DEVOLUCION_TIEMPO') {
        const dtModePartial = document.getElementById('dtModePartial');
        if (!dtModePartial || dtModePartial.checked) {
          const customTxt = document.getElementById('dtScheduleTextInput')?.value.trim() || '';
          const stTime = document.getElementById('dtStartTime')?.value || '';
          const enTime = document.getElementById('dtEndTime')?.value || '';
          dtScheduleStr = customTxt || (stTime && enTime ? `${stTime}-${enTime}` : '');
        }
      }

      let autoDesc = EVENT_DESCRIPTIONS[finalType] || `Turno (${defaultCode})`;
      if (finalType === 'ADMINISTRATIVO') {
        const uDef = defaultCode.toUpperCase();
        if (uDef === 'DA-M') autoDesc = 'Día Administrativo — Media Jornada (Mañana)';
        else if (uDef === 'DA-T') autoDesc = 'Día Administrativo — Media Jornada (Tarde)';
        else autoDesc = 'Día Administrativo (Jornada Completa)';
      } else if (finalType === 'DEVOLUCION_TIEMPO') {
        autoDesc = dtScheduleStr
          ? `Devolución de Tiempo (${dtScheduleStr})`
          : 'Devolución de Tiempo (Jornada Completa)';
      } else if (finalType === 'EXTENSION_HORARIA') {
        const hrs = defaultCode.split('+')[1] || '';
        autoDesc = `Extensión Horaria (${hrs ? hrs + 'h' : defaultCode})` + (isADevolucion ? ' — A Devolución de Tiempo' : ' — Horas Extras');
      } else if (finalType === 'HORAS_TURNO_EXTRA') {
        const hrs = defaultCode.split('+')[1] || '';
        autoDesc = `Horas por Turno Extra (${hrs ? hrs + 'h' : defaultCode})` + (isADevolucion ? ' — A Devolución de Tiempo' : ' — Turno Extra');
      } else if (finalType === 'TURNO') {
        const shiftNames = {
          'L': 'Turno Largo (08:00 - 20:00)',
          'N': 'Turno Noche (20:00 - 08:00)',
          'D': 'Jornada Diurna',
          'M': 'Turno Mañana',
          'T': 'Turno Tarde'
        };
        const baseName = shiftNames[defaultCode.toUpperCase()] || `Turno (${defaultCode})`;
        autoDesc = isADevolucion ? `${baseName} — Turno Extra a Devolución de Tiempo` : baseName;
      }

      let finalDesc = desc || autoDesc;
      if (finalType === 'DEVOLUCION_TIEMPO' && dtScheduleStr && !finalDesc.includes(dtScheduleStr)) {
        finalDesc = `Devolución de Tiempo (${dtScheduleStr})`;
      }
      if (isADevolucion && !finalDesc.toLowerCase().includes('devoluci')) {
        finalDesc = `${finalDesc} — A Devolución de Tiempo`;
      }
      if (!ABSENCE_TYPES.has(finalType)) {
        prevBaseShift = null;
      } else if (prevBaseShift && !finalDesc.includes('Turno')) {
        finalDesc = `${finalDesc} (sobre Turno ${prevBaseShift})`;
      }

      lastAssignedCode = defaultCode;
      lastAssignedDesc = finalDesc;
      lastFinalType = finalType;

      const recObj = {
        staff_id: staffId,
        date: iso,
        sheet: state.staff[staffId]?.modality.includes('4to') ? 'LAB. URGENCIA' : 'RUTINA',
        code: defaultCode,
        raw_value: (ABSENCE_TYPES.has(finalType) && prevBaseShift) ? prevBaseShift : (dtScheduleStr || defaultCode),
        color_hex: null,
        event_type: finalType,
        description: finalDesc,
        ...stamp
      };
      if (dtScheduleStr) {
        recObj.dt_schedule = dtScheduleStr;
      }
      if (isADevolucion) {
        recObj.a_devolucion = true;
      }
      turnsArr.push(recObj);
    }

    const tdmArr = getTdmArrayForYear(yr);
    const existingTdmIdx = tdmArr.findIndex(t => t.staff_id === staffId && t.date === iso);
    if (existingTdmIdx >= 0) {
      tdmArr.splice(existingTdmIdx, 1);
    }

    if (tdmChecked) {
      tdmArr.push({
        staff_id: staffId,
        staff_name: state.staff[staffId]?.name || staffId,
        date: iso,
        station: tdmStation,
        raw_marker: 'X',
        ...stamp
      });
      if (state.staff[staffId] && !(state.staff[staffId].sheets || []).includes('TOMA DE MUESTRA')) {
        state.staff[staffId].sheets.push('TOMA DE MUESTRA');
      }
    }

    modifiedDays++;
  }

  if (modifiedDays > 0) {
    const beforeSummary = Array.from(beforeCodesSet).join(', ') || 'Libre';
    const rangeLabel = startStr === endStr ? startStr : `${startStr} al ${endStr} (${modifiedDays}d)`;
    if (evType || code) {
      const isAbs = ABSENCE_TYPES.has(lastFinalType);
      recordAuditEntry({
        category: isAbs ? 'AUSENCIA' : 'TURNO',
        action: isAbs ? 'Otorgamiento de Día / Ausencia' : 'Asignación / Modificación de Turno',
        staffId,
        staffName: state.staff[staffId]?.name,
        dateRange: rangeLabel,
        beforeVal: beforeSummary,
        afterVal: `${lastAssignedCode}${tdmChecked ? ' + TDM' : ''}`,
        detail: `${lastAssignedDesc}${tdmChecked ? ` · TDM: ${tdmStation}` : ''}`,
        authorizedBy
      });
    } else if (tdmChecked) {
      recordAuditEntry({
        category: 'TDM',
        action: 'Asignación a Toma de Muestras',
        staffId,
        staffName: state.staff[staffId]?.name,
        dateRange: rangeLabel,
        beforeVal: beforeSummary,
        afterVal: `TDM (${tdmStation})`,
        detail: tdmStation,
        authorizedBy
      });
    } else {
      recordAuditEntry({
        category: 'LIMPIEZA',
        action: 'Limpieza de Rango / Día Libre',
        staffId,
        staffName: state.staff[staffId]?.name,
        dateRange: rangeLabel,
        beforeVal: beforeSummary,
        afterVal: 'Libre',
        detail: 'Se limpiaron asignaciones en el rango seleccionado',
        authorizedBy
      });
    }
  }

  saveStateToStorage();
  rebuildFastLookupMaps();
  closeModal('modalCellEdit');
  renderAll();
  if (state.annualModalStaffId && !document.getElementById('modalStaffAnnual').classList.contains('hidden')) {
    openStaffAnnualModal(state.annualModalStaffId);
  }
  showToast(`💾 Guardado en ${modifiedDays} día(s) para ${state.staff[staffId]?.name}.`);
}

function clearCellModal() {
  document.getElementById('cellEventType').value = '';
  document.getElementById('cellCodeInput').value = '';
  document.getElementById('cellDescInput').value = '';
  const devCheck = document.getElementById('cellDevolucionCheck');
  if (devCheck) devCheck.checked = false;
  document.getElementById('cellTdmCheck').checked = false;
  saveCellModal();
}

function openShiftManagerModal() {
  if (!canEditCalendar()) {
    showToast('🔒 Inicia sesión como Jefatura o Administrador para gestionar rotaciones.');
    return;
  }
  const defaultStart = `${state.year}-${String(state.month).padStart(2, '0')}-01`;
  const lastDay = getDaysInMonth(Number(state.year), Number(state.month));
  const defaultEnd = `${state.year}-${String(state.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  populateStaffSelect('smStaff');
  populateStaffSelect('smDiurnoStaff');
  populateStaffSelect('smSwapStaffA');
  populateStaffSelect('smSwapStaffB');

  const selB = document.getElementById('smSwapStaffB');
  if (selB && selB.options.length > 1) selB.selectedIndex = 1;

  document.getElementById('smStartDate').value = defaultStart;
  document.getElementById('smEndDate').value = `${state.year}-12-31`;
  document.getElementById('smDiurnoStart').value = defaultStart;
  document.getElementById('smDiurnoEnd').value = defaultEnd;
  document.getElementById('smSwapStart').value = defaultStart;
  document.getElementById('smSwapEnd').value = defaultEnd;

  document.getElementById('modalShiftManager').classList.remove('hidden');
}

function openStaffModal(staffId = null) {
  if (!isAdmin()) {
    showToast('🔒 Solo el perfil Administrador puede crear o modificar fichas maestras de funcionarios.');
    return;
  }
  const isNew = !staffId;
  document.getElementById('modalStaffTitle').textContent = isNew
    ? 'Registrar Nuevo Funcionario'
    : 'Editar / Completar Ficha de Funcionario';

  if (isNew) {
    document.getElementById('staffEditId').value = '';
    document.getElementById('staffEditName').value = '';
    document.getElementById('staffEditOfficialName').value = '';
    document.getElementById('staffEditRut').value = '';
    document.getElementById('staffEditRole').value = 'Profesional';
    document.getElementById('staffEditEstamento').value = 'Tecnólogo Médico';
    document.getElementById('staffEditSection').value = 'ALU';
    document.getElementById('staffEditModality').value = 'Diurno';
  } else {
    const s = state.staff[staffId];
    document.getElementById('staffEditId').value = s.id;
    document.getElementById('staffEditName').value = s.name || '';
    document.getElementById('staffEditOfficialName').value = s.official_name || '';
    document.getElementById('staffEditRut').value = s.rut || '';
    document.getElementById('staffEditRole').value = s.role || 'Profesional';
    document.getElementById('staffEditEstamento').value = s.estamento || '';
    document.getElementById('staffEditSection').value = OFFICIAL_SECTIONS.includes(s.section) ? s.section : 'ALU';
    document.getElementById('staffEditModality').value = s.modality || 'Diurno';
  }

  document.getElementById('modalStaffEdit').classList.remove('hidden');
}

function saveStaffModal() {
  if (!isAdmin()) {
    showToast('🔒 Solo el perfil Administrador puede guardar cambios en la dotación.');
    return;
  }
  const existingId = document.getElementById('staffEditId').value;
  const name = document.getElementById('staffEditName').value.trim();
  const officialName = document.getElementById('staffEditOfficialName').value.trim().toUpperCase();
  const rut = document.getElementById('staffEditRut').value.trim().toUpperCase();
  const role = document.getElementById('staffEditRole').value;
  const estamento = document.getElementById('staffEditEstamento').value.trim();
  let section = document.getElementById('staffEditSection').value;
  const modality = document.getElementById('staffEditModality').value;

  if (!name) {
    showToast('⚠️ El nombre del funcionario es obligatorio.');
    return;
  }

  if (role === 'TENS') section = 'APA';
  if (role === 'Auxiliar') section = 'Auxiliares';
  if (role === 'Administrativo') section = 'ADM';

  const id = existingId || name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_');
  const missing = [];
  if (!rut) missing.push('RUT');
  const words = (officialName || name).replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(w => w.length > 1);
  if (words.length < 3 && !officialName) missing.push('Segundo Apellido / Nombre Completo');

  const isNewStaff = !state.staff[id];
  const prev = state.staff[id] || { sheets: ['RUTINA'] };
  state.staff[id] = {
    ...prev,
    id,
    name,
    official_name: officialName || null,
    rut: rut || null,
    role,
    estamento: estamento || role,
    section,
    modality,
    needs_completion: missing.length > 0,
    missing_fields: missing
  };

  for (const r of state.tdm2026) {
    if (r.staff_id === id) r.staff_name = name;
  }
  for (const r of state.tdm2027) {
    if (r.staff_id === id) r.staff_name = name;
  }

  recordAuditEntry({
    category: 'PERSONAL',
    action: isNewStaff ? 'Incorporación de Nuevo Funcionario' : 'Actualización de Ficha de Personal',
    staffId: id,
    staffName: name,
    dateRange: 'Maestro Dotación',
    beforeVal: isNewStaff ? 'Sin registro' : (prev.rut || 'Ficha previa'),
    afterVal: `${name} (${rut || 'Sin RUT'} · ${section})`,
    detail: `Estamento: ${estamento || role} · Modalidad: ${modality}`
  });

  saveStateToStorage();
  closeModal('modalStaffEdit');
  renderAll();
  if (state.annualModalStaffId === id && !document.getElementById('modalStaffAnnual').classList.contains('hidden')) {
    openStaffAnnualModal(id);
  }
  showToast(`✅ Ficha de ${name} actualizada correctamente.`);
}

function updateTdmModalConflictPreview() {
  const staffId = document.getElementById('tdmModalStaff').value;
  const dateStr = document.getElementById('tdmModalDate').value;
  const alertEl = document.getElementById('tdmModalConflictAlert');
  if (!staffId || !dateStr || !alertEl) return;

  const info = checkStaffConflictOnDate(staffId, dateStr);
  if (info.hasConflict) {
    alertEl.innerHTML = `⚠️ <strong>Atención:</strong> ${state.staff[staffId]?.name} registra <strong>${info.text}</strong> el ${dateStr} en el Calendario General.`;
    alertEl.classList.remove('hidden');
  } else {
    alertEl.classList.add('hidden');
  }
}

function openTdmAssignModal(preselectedStaffId = null, preselectedDate = null) {
  if (!canEditCalendar()) {
    if (preselectedStaffId && preselectedDate) {
      showReadonlyCellSummaryToast(preselectedStaffId, preselectedDate);
    } else {
      showToast('🔒 Inicia sesión como Jefatura o Administrador para asignar puestos en TDM.');
    }
    return;
  }
  const d = preselectedDate || state.tdmDate;
  document.getElementById('tdmModalDate').value = d;
  document.getElementById('tdmModalEndDate').value = d;
  populateStaffSelect('tdmModalStaff', preselectedStaffId);

  const sid = document.getElementById('tdmModalStaff').value;
  const existing = state.tdmMap[`${sid}_${d}`];
  if (existing) {
    document.getElementById('tdmModalStation').value = existing.station;
  }

  updateTdmModalConflictPreview();
  document.getElementById('modalTdmAssign').classList.remove('hidden');
}

function saveTdmAssignModal() {
  if (!canEditCalendar()) {
    showToast('🔒 Inicia sesión como Jefatura o Administrador para guardar en TDM.');
    return;
  }
  const startStr = document.getElementById('tdmModalDate').value;
  const endStr = document.getElementById('tdmModalEndDate').value || startStr;
  const staffId = document.getElementById('tdmModalStaff').value;
  const station = document.getElementById('tdmModalStation').value;

  if (!startStr || !staffId || endStr < startStr) return;

  pushUndoSnapshot(`Asignación TDM (${state.staff[staffId]?.name})`);
  const stamp = buildTraceStamp();

  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  const endDate = new Date(ey, em - 1, ed);
  const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  for (let i = 0; i < totalDays; i++) {
    const dt = new Date(startDate);
    dt.setDate(startDate.getDate() + i);
    const iso = formatDateISO(dt);
    const yr = iso.slice(0, 4);
    const tdmArr = getTdmArrayForYear(yr);

    const existingIdx = tdmArr.findIndex(t => t.staff_id === staffId && t.date === iso);
    if (existingIdx >= 0) tdmArr.splice(existingIdx, 1);

    tdmArr.push({
      staff_id: staffId,
      staff_name: state.staff[staffId]?.name || staffId,
      date: iso,
      station,
      raw_marker: 'X',
      ...stamp
    });
  }

  if (state.staff[staffId] && !(state.staff[staffId].sheets || []).includes('TOMA DE MUESTRA')) {
    state.staff[staffId].sheets.push('TOMA DE MUESTRA');
  }

  recordAuditEntry({
    category: 'TDM',
    action: 'Asignación Puesto TDM',
    staffId,
    staffName: state.staff[staffId]?.name,
    dateRange: startStr === endStr ? startStr : `${startStr} al ${endStr} (${totalDays}d)`,
    beforeVal: 'Sin puesto / Anterior',
    afterVal: station,
    detail: `Asignado a estación: ${station}`
  });

  saveStateToStorage();
  rebuildFastLookupMaps();
  closeModal('modalTdmAssign');
  renderAll();
  showToast(`🩸 ${state.staff[staffId]?.name} asignado(a) a Toma de Muestras.`);
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// ============================================================================
// 13.5 AUTENTICACIÓN, GESTIÓN DE USUARIOS, TRAZABILIDAD Y NUBE
// ============================================================================
function openLoginModal() {
  const errBox = document.getElementById('loginErrorAlert');
  if (errBox) errBox.classList.add('hidden');
  const uInput = document.getElementById('loginUsernameInput');
  const pInput = document.getElementById('loginPasswordInput');
  if (uInput) uInput.value = '';
  if (pInput) pInput.value = '';
  document.getElementById('modalLogin').classList.remove('hidden');
  setTimeout(() => uInput?.focus(), 30);
}

function handleLoginSubmit(e) {
  if (e) e.preventDefault();
  const uVal = (document.getElementById('loginUsernameInput')?.value || '').trim().toLowerCase();
  const pVal = (document.getElementById('loginPasswordInput')?.value || '').trim();
  const errBox = document.getElementById('loginErrorAlert');

  const found = state.users.find(u => {
    const uname = String(u.username || '').trim().toLowerCase();
    const shortUname = uname.includes('@') ? uname.split('@')[0] : uname;
    return (uname === uVal || shortUname === uVal) && String(u.password || '') === pVal;
  });

  if (!found) {
    if (errBox) {
      errBox.innerHTML = '⚠️ <strong>Credenciales incorrectas:</strong> Verifica el nombre de usuario y la contraseña.';
      errBox.classList.remove('hidden');
    }
    return;
  }

  state.currentUser = {
    username: found.username,
    name: found.name,
    role: found.role
  };
  sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(state.currentUser));
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(state.currentUser));

  closeModal('modalLogin');
  applyRolePermissionsUI();
  renderAll();
  const roleTitle = found.role === 'admin' ? 'Administrador (Permisos Totales)' : 'Jefatura (Edición y Trazabilidad)';
  showToast(`🔓 Sesión iniciada: ${found.name} — ${roleTitle}`);
}

function logoutUser() {
  const prevName = state.currentUser?.name || '';
  state.currentUser = null;
  sessionStorage.removeItem(STORAGE_KEYS.SESSION);
  localStorage.removeItem(STORAGE_KEYS.SESSION);
  applyRolePermissionsUI();
  renderAll();
  showToast(`👀 Sesión cerrada (${prevName}). Ahora estás en modo Solo Visualización.`);
}

function resetUserForm() {
  document.getElementById('userEditOriginalUsername').value = '';
  document.getElementById('userEditFullName').value = '';
  document.getElementById('userEditUsername').value = '';
  document.getElementById('userEditPassword').value = '';
  document.getElementById('userEditRoleSelect').value = 'jefatura';
  document.getElementById('userFormTitle').textContent = '➕ Crear Nuevo Usuario Autorizado';
  document.getElementById('btnCancelUserEdit')?.classList.add('hidden');
}

function openUserManagerModal() {
  if (!isAdmin()) {
    showToast('🔒 Solo el Administrador puede gestionar las cuentas de usuario.');
    return;
  }
  resetUserForm();
  renderUsersTable();
  document.getElementById('modalUserManager').classList.remove('hidden');
}

function renderUsersTable() {
  const tbody = document.getElementById('usersListTbody');
  if (!tbody) return;
  let html = '';
  for (const u of state.users) {
    const roleBadge = u.role === 'admin'
      ? `<span class="badge badge-blue">🛡️ Administrador (Permisos Totales)</span>`
      : `<span class="badge badge-ok">🩺 Jefatura (Marcar Días y Trazabilidad)</span>`;

    const isSelf = state.currentUser && state.currentUser.username === u.username;
    const delBtn = (!isSelf && state.users.length > 1)
      ? `<button type="button" class="btn btn-danger-outline btn-delete-user" style="padding:3px 8px; font-size:11px;" data-username="${u.username}">Eliminar</button>`
      : '';

    html += `<tr>
      <td><strong>${u.name}</strong> ${isSelf ? '<span class="badge badge-purple">Tú</span>' : ''}</td>
      <td style="font-family:'JetBrains Mono',monospace; font-weight:600;">${u.username}</td>
      <td>${roleBadge}</td>
      <td style="font-family:'JetBrains Mono',monospace; color:#64748b;">${u.password}</td>
      <td style="display:flex; gap:6px;">
        <button type="button" class="btn btn-outline-dark btn-edit-user" style="padding:3px 8px; font-size:11px;" data-username="${u.username}">✏️ Editar / Clave</button>
        ${delBtn}
      </td>
    </tr>`;
  }
  tbody.innerHTML = html;
}

function saveUserAccount() {
  if (!isAdmin()) return;
  const origUser = document.getElementById('userEditOriginalUsername').value.trim();
  const fullName = document.getElementById('userEditFullName').value.trim();
  const username = document.getElementById('userEditUsername').value.trim().toLowerCase().replace(/\s+/g, '');
  const password = document.getElementById('userEditPassword').value.trim();
  const role = document.getElementById('userEditRoleSelect').value;

  if (!fullName || !username || !password) {
    showToast('⚠️ Completa nombre visible, usuario y contraseña.');
    return;
  }

  const existingIdx = state.users.findIndex(u => u.username.toLowerCase() === (origUser || username).toLowerCase());
  const duplicateCheck = state.users.find(
    (u, idx) => u.username.toLowerCase() === username && idx !== existingIdx
  );
  if (duplicateCheck) {
    showToast('⚠️ Ya existe otro usuario con ese identificador.');
    return;
  }

  if (existingIdx >= 0) {
    // Evitar dejar el sistema sin ningún administrador
    const adminCount = state.users.filter(u => u.role === 'admin').length;
    if (state.users[existingIdx].role === 'admin' && role !== 'admin' && adminCount <= 1) {
      showToast('⚠️ Debe existir al menos una cuenta con rol Administrador.');
      return;
    }
    state.users[existingIdx] = { username, password, name: fullName, role };
    if (state.currentUser && state.currentUser.username === origUser) {
      state.currentUser = { username, name: fullName, role };
      sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(state.currentUser));
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(state.currentUser));
      applyRolePermissionsUI();
    }
    recordAuditEntry({
      category: 'PERSONAL',
      action: 'Actualización de Cuenta de Usuario',
      staffName: fullName,
      dateRange: 'Sistema Usuarios',
      beforeVal: origUser,
      afterVal: `${username} (${role === 'admin' ? 'Administrador' : 'Jefatura'})`,
      detail: `Cuenta actualizada por ${state.currentUser?.name}`
    });
  } else {
    state.users.push({ username, password, name: fullName, role });
    recordAuditEntry({
      category: 'PERSONAL',
      action: 'Creación de Cuenta de Usuario',
      staffName: fullName,
      dateRange: 'Sistema Usuarios',
      beforeVal: 'Nuevo',
      afterVal: `${username} (${role === 'admin' ? 'Administrador' : 'Jefatura'})`,
      detail: `Cuenta autorizada creada`
    });
  }

  saveStateToStorage();
  resetUserForm();
  renderUsersTable();
  renderAll();
  showToast(`✅ Usuario "${fullName}" (${username}) guardado.`);
}

function deleteUserAccount(username) {
  if (!isAdmin()) return;
  const target = state.users.find(u => u.username === username);
  if (!target) return;
  if (state.currentUser && state.currentUser.username === username) {
    showToast('⚠️ No puedes eliminar tu propia cuenta con la sesión activa.');
    return;
  }
  const adminCount = state.users.filter(u => u.role === 'admin').length;
  if (target.role === 'admin' && adminCount <= 1) {
    showToast('⚠️ No puedes eliminar el único Administrador del sistema.');
    return;
  }
  state.users = state.users.filter(u => u.username !== username);
  recordAuditEntry({
    category: 'PERSONAL',
    action: 'Eliminación de Cuenta de Usuario',
    staffName: target.name,
    dateRange: 'Sistema Usuarios',
    beforeVal: `${target.username} (${target.role})`,
    afterVal: 'Eliminado',
    detail: `Acceso revocado`
  });
  saveStateToStorage();
  renderUsersTable();
  renderAll();
  showToast(`🗑️ Usuario ${target.name} eliminado.`);
}

function openCloudConfigModal() {
  if (!isAdmin()) {
    showToast('🔒 Solo el Administrador puede configurar la conexión web.');
    return;
  }
  const urlInput = document.getElementById('gasWebAppUrlInput');
  if (urlInput) urlInput.value = state.gasWebAppUrl || '';
  const statusBox = document.getElementById('cloudSyncStatusBox');
  if (statusBox) {
    const isNativeGas = Boolean(window.google && window.google.script && window.google.script.run);
    if (isNativeGas) {
      statusBox.innerHTML = '☁️ <strong>Modo Activo: Google Apps Script Nativo.</strong> Conectado directamente a tu Google Drive y hoja de Bitácora en Google Sheets.';
    } else if (state.gasWebAppUrl) {
      statusBox.innerHTML = `☁️ <strong>Modo Activo: Conectado a Web App de Google Apps Script</strong> (${state.gasWebAppUrl.slice(0, 48)}...).`;
    } else {
      statusBox.innerHTML = '💻 <strong>Modo Activo: Servidor Local / Red Interna (`server.py` + `data/`).</strong> Si deseas sincronizar con un Google Apps Script externo, pega su URL arriba.';
    }
  }
  document.getElementById('modalCloudConfig').classList.remove('hidden');
}

async function saveCloudConfig() {
  const urlInput = document.getElementById('gasWebAppUrlInput');
  state.gasWebAppUrl = (urlInput?.value || '').trim();
  localStorage.setItem(STORAGE_KEYS.GAS_URL, state.gasWebAppUrl);
  await syncDatabaseToServer(true);
  closeModal('modalCloudConfig');
  showToast('☁️ Configuración de sincronización guardada.');
}

function renderAuditView() {
  if (!canViewTraceability()) return;

  // Poblar selector de filtro de usuarios
  const userSelect = document.getElementById('auditFilterUser');
  if (userSelect) {
    const uniqueUsers = new Map();
    for (const u of state.users) {
      uniqueUsers.set(u.username, u.name);
    }
    for (const entry of state.auditLog) {
      if (entry.user_username && !uniqueUsers.has(entry.user_username)) {
        uniqueUsers.set(entry.user_username, entry.user_name || entry.user_username);
      }
    }
    let opts = `<option value="all">Todos los Usuarios / Jefaturas</option>`;
    for (const [uname, fullName] of uniqueUsers.entries()) {
      opts += `<option value="${uname}" ${state.auditFilterUser === uname ? 'selected' : ''}>${fullName} (${uname})</option>`;
    }
    userSelect.innerHTML = opts;
  }

  const q = normalizeSearchText(state.auditSearch);
  const fUser = state.auditFilterUser;
  const fCat = state.auditFilterCategory;

  const filtered = state.auditLog.filter(item => {
    if (fUser !== 'all' && item.user_username !== fUser) return false;
    if (fCat !== 'all' && item.category !== fCat) return false;
    if (q) {
      const hay = normalizeSearchText([
        item.staff_name,
        item.user_name,
        item.authorized_by,
        item.action,
        item.date_range,
        item.before_val,
        item.after_val,
        item.detail
      ].join(' '));
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Tarjetas KPI de Trazabilidad
  const totalEntries = state.auditLog.length;
  const absenceEntries = state.auditLog.filter(e => e.category === 'AUSENCIA').length;
  const shiftEntries = state.auditLog.filter(e => ['TURNO', 'ESQUEMA', 'TDM'].includes(e.category)).length;
  const lastEntry = state.auditLog[0];

  const cardsEl = document.getElementById('auditSummaryCards');
  if (cardsEl) {
    cardsEl.innerHTML = `
      <div class="stat-card">
        <span class="stat-label">Total Movimientos Registrados</span>
        <strong class="stat-value">${totalEntries}</strong>
      </div>
      <div class="stat-card stat-ok">
        <span class="stat-label">Días / Ausencias Otorgadas</span>
        <strong class="stat-value">${absenceEntries}</strong>
      </div>
      <div class="stat-card stat-info">
        <span class="stat-label">Cambios de Turno, Rotación y TDM</span>
        <strong class="stat-value">${shiftEntries}</strong>
      </div>
      <div class="stat-card">
        <span class="stat-label">Última Modificación</span>
        <strong class="stat-value" style="font-size:13.5px; color:#0369a1;">
          ${lastEntry ? `${lastEntry.authorized_by || lastEntry.user_name} (${formatDateTimeCL(lastEntry.timestamp)})` : 'Sin registros aún'}
        </strong>
      </div>
    `;
  }

  const catBadges = {
    'AUSENCIA': `<span class="badge badge-danger">📅 Ausencia / Permiso</span>`,
    'TURNO': `<span class="badge badge-blue">🔄 Turno</span>`,
    'ESQUEMA': `<span class="badge badge-purple">⚙️ Rotación / Esquema</span>`,
    'TDM': `<span class="badge badge-purple">🩸 Toma de Muestras</span>`,
    'LIMPIEZA': `<span class="badge badge-warn">🧹 Limpieza</span>`,
    'PERSONAL': `<span class="badge badge-ok">👥 Personal / Sistema</span>`
  };

  let html = '';
  for (const item of filtered) {
    const rolePill = item.user_role === 'admin'
      ? `<span class="badge badge-blue" style="font-size:9.5px;">🛡️ Admin</span>`
      : `<span class="badge badge-ok" style="font-size:9.5px;">🩺 Jefatura</span>`;

    const cBadge = catBadges[item.category] || `<span class="badge">${item.category}</span>`;
    const staffCell = item.staff_id && state.staff[item.staff_id]
      ? `<strong class="staff-name-main" data-staff-id="${item.staff_id}">${item.staff_name}</strong>`
      : `<strong>${item.staff_name || 'General'}</strong>`;

    const authExtra = (item.authorized_by && item.authorized_by !== item.user_name)
      ? `<div style="font-size:11px; color:#0369a1; font-weight:600;">Autorizó: ${item.authorized_by}</div>`
      : '';

    html += `<tr>
      <td style="font-family:'JetBrains Mono',monospace; font-size:11.5px; white-space:nowrap;">
        ${formatDateTimeCL(item.timestamp)}
      </td>
      <td>
        <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
          <strong>${item.user_name || item.user_username}</strong>
          ${rolePill}
        </div>
        ${authExtra}
      </td>
      <td>
        ${cBadge}
        <div style="font-size:11px; color:#64748b; margin-top:2px;">${item.action}</div>
      </td>
      <td>${staffCell}</td>
      <td style="font-family:'JetBrains Mono',monospace; font-size:11.5px;">${item.date_range}</td>
      <td>
        <div class="audit-diff-pill">
          <span class="audit-before">${item.before_val || 'Libre'}</span>
          <span class="audit-arrow">→</span>
          <span class="audit-after">${item.after_val || 'Libre'}</span>
        </div>
      </td>
      <td style="font-size:12px; color:#334155;">${item.detail || '-'}</td>
    </tr>`;
  }

  if (filtered.length === 0) {
    html = `<tr><td colspan="7" style="text-align:center; padding:28px; color:#64748b;">
      No hay movimientos registrados en la bitácora de trazabilidad para los filtros actuales. Cada vez que Jefatura o Administración otorgue un día o modifique un turno, quedará registrado aquí automáticamente.
    </td></tr>`;
  }

  const tbody = document.getElementById('auditTbody');
  if (tbody) tbody.innerHTML = html;
}

function exportAuditLogCSV() {
  if (!canViewTraceability()) return;
  const headers = [
    'Fecha y Hora',
    'Usuario que Modifico',
    'Rol',
    'Autorizado por',
    'Categoria',
    'Accion',
    'Funcionario Afectado',
    'Fechas Calendario',
    'Valor Anterior',
    'Valor Nuevo',
    'Detalle'
  ];
  const rows = [headers.join(';')];
  for (const item of state.auditLog) {
    const cols = [
      `"${formatDateTimeCL(item.timestamp)}"`,
      `"${(item.user_name || '').replace(/"/g, '""')}"`,
      `"${item.user_role || ''}"`,
      `"${(item.authorized_by || '').replace(/"/g, '""')}"`,
      `"${item.category || ''}"`,
      `"${(item.action || '').replace(/"/g, '""')}"`,
      `"${(item.staff_name || '').replace(/"/g, '""')}"`,
      `"${(item.date_range || '').replace(/"/g, '""')}"`,
      `"${(item.before_val || '').replace(/"/g, '""')}"`,
      `"${(item.after_val || '').replace(/"/g, '""')}"`,
      `"${(item.detail || '').replace(/"/g, '""')}"`
    ];
    rows.push(cols.join(';'));
  }

  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Bitacora_Trazabilidad_Laboratorio_HRT_${state.year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 Bitácora de trazabilidad exportada a CSV (compatible con Excel).');
}

function clearAuditLogHistory() {
  if (!isAdmin()) {
    showToast('🔒 Solo el Administrador puede depurar la bitácora.');
    return;
  }
  state.auditLog = [];
  recordAuditEntry({
    category: 'PERSONAL',
    action: 'Depuración de Bitácora',
    staffName: 'Sistema de Auditoría',
    dateRange: formatDateTimeCL(new Date().toISOString()),
    beforeVal: 'Historial previo',
    afterVal: 'Bitácora reiniciada',
    detail: `Reiniciada por ${state.currentUser?.name}`
  });
  saveStateToStorage();
  renderAll();
  showToast('🧹 Bitácora depurada.');
}

// ============================================================================
// 14. EXPORTACIÓN CSV (EXCEL COMPATIBLE)
// ============================================================================
function exportCurrentMonthCSV() {
  const year = Number(state.year);
  const month = Number(state.month);
  const daysCount = getDaysInMonth(year, month);

  const headers = ['Nombre Funcionario', 'Nombre Oficial', 'RUT', 'Estamento', 'Sección', 'Modalidad'];
  for (let d = 1; d <= daysCount; d++) headers.push(`Día ${d}`);
  headers.push('Total Turnos', 'Total Ausencias', 'Total TDM');

  const rows = [headers.join(';')];
  const grouped = getFilteredAndGroupedStaff();

  for (const [, members] of grouped) {
    for (const m of members) {
      const cols = [
        `"${m.name}"`,
        `"${m.official_name || ''}"`,
        `"${m.rut || ''}"`,
        `"${m.estamento || m.role}"`,
        `"${m.section}"`,
        `"${m.modality}"`
      ];
      let sc = 0, ac = 0, tc = 0;
      for (let d = 1; d <= daysCount; d++) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const ev = state.turnsMap[`${m.id}_${iso}`];
        const tdm = state.tdmMap[`${m.id}_${iso}`];
        let val = ev ? ev.code : '';
        if (ev) {
          if (ABSENCE_TYPES.has(ev.event_type)) ac++;
          else sc++;
        }
        if (tdm) {
          tc++;
          val = val ? `${val}+TDM` : 'TDM';
        }
        cols.push(`"${val}"`);
      }
      cols.push(sc, ac, tc);
      rows.push(cols.join(';'));
    }
  }

  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Turnos_Laboratorio_HRT_${MONTH_LABELS[month]}_${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`📥 CSV exportado: ${MONTH_LABELS[month]} ${year}`);
}

function showToast(msg) {
  const t = document.getElementById('toastNotification');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.add('hidden'), 3200);
}

// ============================================================================
// 15. EVENT LISTENERS
// ============================================================================
function bindEvents() {
  // Controles de Año y Mes
  document.getElementById('yearSelect').addEventListener('change', e => {
    state.year = e.target.value;
    state.tdmDate = `${state.year}-${String(state.month).padStart(2, '0')}-01`;
    document.getElementById('tdmDateInput').value = state.tdmDate;
    renderAll();
  });

  document.getElementById('monthSelect').addEventListener('change', e => {
    state.month = Number(e.target.value);
    state.tdmDate = `${state.year}-${String(state.month).padStart(2, '0')}-01`;
    document.getElementById('tdmDateInput').value = state.tdmDate;
    renderAll();
  });

  document.getElementById('btnPrevMonth').addEventListener('click', () => {
    if (state.month > 1) state.month--;
    else {
      state.month = 12;
      if (state.year === '2027') {
        state.year = '2026';
        document.getElementById('yearSelect').value = '2026';
      }
    }
    document.getElementById('monthSelect').value = String(state.month);
    renderAll();
  });

  document.getElementById('btnNextMonth').addEventListener('click', () => {
    if (state.month < 12) state.month++;
    else {
      state.month = 1;
      if (state.year === '2026') {
        state.year = '2027';
        document.getElementById('yearSelect').value = '2027';
      }
    }
    document.getElementById('monthSelect').value = String(state.month);
    renderAll();
  });

  const btnCurrMonth = document.getElementById('btnCurrentMonth');
  if (btnCurrMonth) {
    btnCurrMonth.addEventListener('click', () => {
      state.year = '2026';
      state.month = 10;
      document.getElementById('yearSelect').value = '2026';
      document.getElementById('monthSelect').value = '10';
      renderAll();
      showToast('📅 Posicionado en Octubre 2026.');
    });
  }

  document.getElementById('groupBySelect').addEventListener('change', e => {
    state.groupBy = e.target.value;
    renderCalendarMatrix();
  });

  const searchInput = document.getElementById('globalSearch');
  const btnClearSearch = document.getElementById('btnClearSearch');
  searchInput.addEventListener('input', e => {
    state.searchQuery = e.target.value;
    if (btnClearSearch) {
      btnClearSearch.classList.toggle('hidden', !state.searchQuery);
    }
    renderCalendarMatrix();
  });

  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      state.searchQuery = '';
      searchInput.value = '';
      btnClearSearch.classList.add('hidden');
      renderCalendarMatrix();
    });
  }

  // Botón Deshacer y atajo Ctrl+Z
  const btnUndo = document.getElementById('btnUndoAction');
  if (btnUndo) {
    btnUndo.addEventListener('click', performUndo);
  }
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.target.matches('input, select, textarea')) {
      e.preventDefault();
      performUndo();
    }
  });

  // Navegación de Pestañas Principales
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTab = btn.dataset.tab;

      document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`view-${state.activeTab}`).classList.add('active');

      const isCalendar = state.activeTab === 'calendar';
      const topTools = document.getElementById('calendarTopbarTools');
      const quickBar = document.getElementById('calendarQuickBar');
      const legendBar = document.getElementById('calendarLegendBar');
      const footerBar = document.getElementById('calendarFooterBar');
      if (topTools) topTools.classList.toggle('hidden', !isCalendar);
      if (quickBar) quickBar.classList.toggle('hidden', !isCalendar);
      if (legendBar) legendBar.classList.toggle('hidden', !isCalendar);
      if (footerBar) footerBar.classList.toggle('hidden', !isCalendar);

      renderAll();
    });
  });

  // Filtros rápidos en Calendario General
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.quickFilter = chip.dataset.filter;
      renderCalendarMatrix();
    });
  });

  // Función auxiliar para actualizar el estado visual del Modo Pintar
  const setPaintModeState = (paintCode, labelText = '') => {
    state.paintMode = paintCode || '';
    document.querySelectorAll('#paintToolsGroup .paint-btn').forEach(b => {
      b.classList.toggle('active', (b.dataset.paint || '') === state.paintMode);
    });
    const statusEl = document.getElementById('calendarPaintStatus');
    if (statusEl) {
      if (!state.paintMode) {
        statusEl.textContent = 'Modo: 👆 Selección Normal (clic abre editor por rango)';
        statusEl.classList.remove('painting-active');
      } else {
        statusEl.textContent = `🎨 MODO PINTAR ACTIVO (${labelText || state.paintMode}) — Haz clic o arrastra sobre las celdas`;
        statusEl.classList.add('painting-active');
      }
    }
  };

  // Barra de Modo Pintar Rápido
  document.querySelectorAll('#paintToolsGroup .paint-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setPaintModeState(btn.dataset.paint || '', btn.textContent.trim());
    });
  });

  // Paneles colapsables bajo demanda (Modo Pintar y Simbología)
  const btnTogglePaint = document.getElementById('btnTogglePaintDrawer');
  const paintDrawer = document.getElementById('paintDrawerPanel');
  const btnClosePaint = document.getElementById('btnClosePaintDrawer');
  if (btnTogglePaint && paintDrawer) {
    btnTogglePaint.addEventListener('click', () => {
      const willHide = !paintDrawer.classList.contains('hidden');
      paintDrawer.classList.toggle('hidden', willHide);
      btnTogglePaint.classList.toggle('active', !willHide);
      if (willHide && state.paintMode) {
        setPaintModeState('');
      }
    });
  }
  if (btnClosePaint && paintDrawer) {
    btnClosePaint.addEventListener('click', () => {
      paintDrawer.classList.add('hidden');
      if (btnTogglePaint) btnTogglePaint.classList.remove('active');
      setPaintModeState('');
    });
  }

  const btnToggleLegend = document.getElementById('btnToggleLegendDrawer');
  const legendDrawer = document.getElementById('legendDrawerPanel');
  if (btnToggleLegend && legendDrawer) {
    btnToggleLegend.addEventListener('click', () => {
      const willHide = !legendDrawer.classList.contains('hidden');
      legendDrawer.classList.toggle('hidden', willHide);
      btnToggleLegend.classList.toggle('active', !willHide);
    });
  }

  // Menú desplegable "⋯ Herramientas" en barra superior
  const btnMoreTools = document.getElementById('btnMoreTools');
  const moreToolsMenu = document.getElementById('moreToolsMenu');
  if (btnMoreTools && moreToolsMenu) {
    btnMoreTools.addEventListener('click', e => {
      e.stopPropagation();
      moreToolsMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', e => {
      if (!moreToolsMenu.classList.contains('hidden') && !moreToolsMenu.contains(e.target) && e.target !== btnMoreTools) {
        moreToolsMenu.classList.add('hidden');
      }
    });
  }

  // Interacción en Calendario General (Clic / Arrastrar en celdas + Clic en nombre abre Ficha Anual)
  const calTbody = document.getElementById('calendarTbody');
  calTbody.addEventListener('mousedown', e => {
    const cell = e.target.closest('.day-cell');
    if (cell && state.paintMode) {
      e.preventDefault();
      state.isPaintingDrag = true;
      applyQuickPaintToCell(cell.dataset.staff, cell.dataset.date, true);
    }
  });

  calTbody.addEventListener('mouseover', e => {
    if (!state.isPaintingDrag || !state.paintMode) return;
    const cell = e.target.closest('.day-cell');
    if (cell) {
      applyQuickPaintToCell(cell.dataset.staff, cell.dataset.date, false);
    }
  });

  document.addEventListener('mouseup', () => {
    state.isPaintingDrag = false;
  });

  calTbody.addEventListener('click', e => {
    const inlineEditBtn = e.target.closest('.btn-inline-edit-name');
    if (inlineEditBtn && inlineEditBtn.dataset.editStaffId) {
      e.stopPropagation();
      openStaffModal(inlineEditBtn.dataset.editStaffId);
      return;
    }
    const cell = e.target.closest('.day-cell');
    if (cell) {
      if (!state.paintMode) {
        openCellModal(cell.dataset.staff, cell.dataset.date);
      }
      return;
    }
    const nameEl = e.target.closest('.staff-name-main');
    if (nameEl && nameEl.dataset.staffId) {
      openStaffAnnualModal(nameEl.dataset.staffId);
    }
  });

  // Botones de barra superior
  document.getElementById('btnOpenShiftManager').addEventListener('click', openShiftManagerModal);
  document.getElementById('btnQuickRangeAbsence').addEventListener('click', () => {
    const defaultDate = `${state.year}-${String(state.month).padStart(2, '0')}-01`;
    openCellModal(null, defaultDate, 'VACACIONES');
  });
  document.getElementById('btnGenerate2027').addEventListener('click', () => {
    if (moreToolsMenu) moreToolsMenu.classList.add('hidden');
    state.year = '2027';
    document.getElementById('yearSelect').value = '2027';
    generate2027Projection(true);
  });
  document.getElementById('btnExportCSV').addEventListener('click', () => {
    if (moreToolsMenu) moreToolsMenu.classList.add('hidden');
    exportCurrentMonthCSV();
  });
  const btnExportBundle = document.getElementById('btnExportBundle');
  if (btnExportBundle) {
    btnExportBundle.addEventListener('click', () => {
      if (moreToolsMenu) moreToolsMenu.classList.add('hidden');
      exportBundleForNetwork();
    });
  }
  const btnSync = document.getElementById('btnSyncBaseData');
  if (btnSync) {
    btnSync.addEventListener('click', () => {
      if (moreToolsMenu) moreToolsMenu.classList.add('hidden');
      resetToBaseData();
    });
  }

  // Modal 1: Editar Celda / Rango
  document.getElementById('cellStaffSelect').addEventListener('change', e => {
    document.getElementById('cellStaffId').value = e.target.value;
    updateCellAuditTraceBanner(e.target.value, document.getElementById('cellDate').value);
  });
  document.getElementById('cellDate').addEventListener('change', e => {
    const endEl = document.getElementById('cellEndDate');
    if (endEl.value < e.target.value) endEl.value = e.target.value;
    updateRangePreview();
    updateCellAuditTraceBanner(document.getElementById('cellStaffId').value, e.target.value);
  });
  document.getElementById('cellEndDate').addEventListener('change', updateRangePreview);
  document.getElementById('cellRangeMode').addEventListener('change', updateRangePreview);

  document.querySelectorAll('.qd-chip').forEach(chip => {
    chip.addEventListener('click', () => setQuickDuration(chip.dataset.days));
  });

  document.querySelectorAll('.code-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const pType = pill.dataset.type;
      const codeInput = document.getElementById('cellCodeInput');
      const devCheck = document.getElementById('cellDevolucionCheck');
      if (pType === 'EXTENSION_HORARIA' || pType === 'HORAS_TURNO_EXTRA') {
        const prefix = pType === 'EXTENSION_HORARIA' ? 'E+' : 'H+';
        const existingMatch = codeInput.value.trim().match(/\+(\d+)$/);
        const defaultHrs = pType === 'EXTENSION_HORARIA' ? '2' : '6';
        codeInput.value = `${prefix}${existingMatch ? existingMatch[1] : defaultHrs}`;
        document.getElementById('cellEventType').value = pType;
        syncCellModalExtraUI(true);
      } else {
        codeInput.value = pill.dataset.code;
        document.getElementById('cellEventType').value = pType;
        if (pType === 'VACACIONES' || pType === 'ADMINISTRATIVO') {
          document.getElementById('cellRangeMode').value = 'weekdays';
        } else if (pType === 'LICENCIA_MEDICA') {
          document.getElementById('cellRangeMode').value = 'all';
        }
        if (pType === 'DEVOLUCION_TIEMPO') {
          const dtText = document.getElementById('dtScheduleTextInput');
          const dtSt = document.getElementById('dtStartTime');
          const dtEn = document.getElementById('dtEndTime');
          if (dtText && !dtText.value.trim() && dtSt && dtEn) {
            dtText.value = `${dtSt.value}-${dtEn.value}`;
          }
        }
        if (pType !== 'TURNO' && devCheck) {
          devCheck.checked = false;
        }
        syncCellModalExtraUI(pType === 'DEVOLUCION_TIEMPO');
        updateRangePreview();
      }
    });
  });

  // Controles de Jornada en DA (Día Administrativo: Completo DA vs Mañana DA-M vs Tarde DA-T)
  document.querySelectorAll('input[name="daModeRadio"]').forEach(radio => {
    radio.addEventListener('change', e => {
      if (e.target.checked) {
        document.getElementById('cellCodeInput').value = e.target.value;
        document.getElementById('cellEventType').value = 'ADMINISTRATIVO';
        syncCellModalExtraUI(false);
      }
    });
  });

  // Controles de Horario en DT (Devolución de Tiempo)
  const dtModePartial = document.getElementById('dtModePartial');
  const dtModeFull = document.getElementById('dtModeFull');
  const dtStartTime = document.getElementById('dtStartTime');
  const dtEndTime = document.getElementById('dtEndTime');
  const dtScheduleText = document.getElementById('dtScheduleTextInput');
  const syncDtInputsFromTimePickers = () => {
    if (dtStartTime && dtEndTime && dtScheduleText && dtStartTime.value && dtEndTime.value) {
      dtScheduleText.value = `${dtStartTime.value}-${dtEndTime.value}`;
    }
  };
  if (dtModePartial) {
    dtModePartial.addEventListener('change', () => {
      syncDtInputsFromTimePickers();
      syncCellModalExtraUI(true);
    });
  }
  if (dtModeFull) {
    dtModeFull.addEventListener('change', () => {
      if (dtModeFull.checked && dtScheduleText) {
        dtScheduleText.value = '';
      }
      syncCellModalExtraUI(false);
    });
  }
  if (dtStartTime) dtStartTime.addEventListener('input', syncDtInputsFromTimePickers);
  if (dtEndTime) dtEndTime.addEventListener('input', syncDtInputsFromTimePickers);

  const ehNumInput = document.getElementById('extraHoursNumberInput');
  if (ehNumInput) {
    ehNumInput.addEventListener('input', e => {
      const evType = document.getElementById('cellEventType').value;
      const prefix = evType === 'EXTENSION_HORARIA' ? 'E+' : 'H+';
      const val = e.target.value.replace(/[^0-9]/g, '');
      if (val) {
        document.getElementById('cellCodeInput').value = `${prefix}${val}`;
      }
    });
  }

  document.getElementById('cellCodeInput').addEventListener('input', e => {
    const u = e.target.value.trim().toUpperCase();
    const typeSel = document.getElementById('cellEventType');
    if (u.startsWith('E+')) typeSel.value = 'EXTENSION_HORARIA';
    else if (u.startsWith('H+')) typeSel.value = 'HORAS_TURNO_EXTRA';
    else if (u === 'DC') typeSel.value = 'COMPENSATORIO';
    else if (u === 'DT') typeSel.value = 'DEVOLUCION_TIEMPO';
    else if (u === 'FL') {
      typeSel.value = 'VACACIONES';
      document.getElementById('cellRangeMode').value = 'weekdays';
    } else if (u === 'DA' || u === 'DA-M' || u === 'DA-T') {
      typeSel.value = 'ADMINISTRATIVO';
      document.getElementById('cellRangeMode').value = 'weekdays';
    } else if (u === 'LM') {
      typeSel.value = 'LICENCIA_MEDICA';
      document.getElementById('cellRangeMode').value = 'all';
    } else if (u === '*') typeSel.value = 'COMISION_SERVICIO';
    else if (u === 'PSG') typeSel.value = 'SIN_GOCE_SUELDO';
    else if (['L', 'N', 'D', 'M', 'T'].includes(u)) typeSel.value = 'TURNO';
    else if (u === '') typeSel.value = '';
    else typeSel.value = 'HORARIO_ESPECIAL';
    syncCellModalExtraUI(false);
    updateRangePreview();
  });

  document.getElementById('cellTdmCheck').addEventListener('change', e => {
    document.getElementById('cellTdmStationGroup').classList.toggle('hidden', !e.target.checked);
  });

  document.getElementById('btnCloseCellModal').addEventListener('click', () => closeModal('modalCellEdit'));
  document.getElementById('btnCancelCell').addEventListener('click', () => closeModal('modalCellEdit'));
  document.getElementById('btnSaveCell').addEventListener('click', saveCellModal);
  document.getElementById('btnClearCell').addEventListener('click', clearCellModal);

  // Modal 2: Gestor de Esquemas y Rotaciones
  document.querySelectorAll('#shiftManagerTabs .sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#shiftManagerTabs .sub-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeSmTab = btn.dataset.smTab;

      document.querySelectorAll('.sm-panel').forEach(p => p.classList.add('hidden'));
      document.getElementById(`sm-panel-${state.activeSmTab}`).classList.remove('hidden');
    });
  });

  document.querySelectorAll('.sm-qd-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const startStr = document.getElementById('smStartDate').value;
      if (!startStr) return;
      const [sy, sm, sd] = startStr.split('-').map(Number);
      if (chip.dataset.span === 'month') {
        const last = getDaysInMonth(sy, sm);
        document.getElementById('smEndDate').value = `${sy}-${String(sm).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
      } else if (chip.dataset.span === 'quarter') {
        const d = new Date(sy, sm - 1, sd);
        d.setMonth(d.getMonth() + 3);
        document.getElementById('smEndDate').value = formatDateISO(d);
      } else if (chip.dataset.span === 'year_end') {
        document.getElementById('smEndDate').value = `${sy}-12-31`;
      }
    });
  });

  document.getElementById('btnCloseShiftManager').addEventListener('click', () => closeModal('modalShiftManager'));
  document.getElementById('btnCancelShiftManager').addEventListener('click', () => closeModal('modalShiftManager'));
  document.getElementById('btnApplyShiftManager').addEventListener('click', () => {
    if (state.activeSmTab === '4toturno') apply4toTurnoPattern();
    else if (state.activeSmTab === 'diurno') applyPassToDiurno();
    else if (state.activeSmTab === 'swap') applySwapRotation();
  });

  // Modal 3: Editar Funcionario
  document.getElementById('btnAddStaff').addEventListener('click', () => openStaffModal(null));
  document.getElementById('btnCloseStaffModal').addEventListener('click', () => closeModal('modalStaffEdit'));
  document.getElementById('btnCancelStaff').addEventListener('click', () => closeModal('modalStaffEdit'));
  document.getElementById('btnSaveStaff').addEventListener('click', saveStaffModal);
  const staffRoleSelect = document.getElementById('staffEditRole');
  if (staffRoleSelect) {
    staffRoleSelect.addEventListener('change', e => {
      const r = e.target.value;
      const estInput = document.getElementById('staffEditEstamento');
      const secSelect = document.getElementById('staffEditSection');
      if (r === 'Administrativo') {
        if (estInput) estInput.value = 'Administrativo';
        if (secSelect) secSelect.value = 'ADM';
      } else if (r === 'TENS') {
        if (estInput) estInput.value = 'TENS';
        if (secSelect) secSelect.value = 'APA';
      } else if (r === 'Auxiliar') {
        if (estInput) estInput.value = 'Auxiliar';
        if (secSelect) secSelect.value = 'Auxiliares';
      } else if (r === 'Interno TM') {
        if (estInput) estInput.value = 'Interno TM';
        if (secSelect) secSelect.value = 'ALU';
      }
    });
  }

  document.getElementById('directoryTbody').addEventListener('click', e => {
    const editBtn = e.target.closest('.btn-edit-staff');
    if (editBtn) {
      openStaffModal(editBtn.dataset.id);
      return;
    }
    const annualBtn = e.target.closest('.btn-annual-staff');
    if (annualBtn) {
      openStaffAnnualModal(annualBtn.dataset.id);
      return;
    }
    const nameEl = e.target.closest('.staff-name-main');
    if (nameEl && nameEl.dataset.staffId) {
      openStaffAnnualModal(nameEl.dataset.staffId);
    }
  });

  // Controles de Directorio
  document.getElementById('dirSearch').addEventListener('input', e => {
    state.dirSearch = e.target.value;
    renderDirectoryView();
  });
  document.getElementById('dirFilterSection').addEventListener('change', e => {
    state.dirFilterSection = e.target.value;
    renderDirectoryView();
  });
  document.getElementById('dirFilterStatus').addEventListener('change', e => {
    state.dirFilterStatus = e.target.value;
    renderDirectoryView();
  });
  document.getElementById('dirFilterModality').addEventListener('change', e => {
    state.dirFilterModality = e.target.value;
    renderDirectoryView();
  });
  document.getElementById('dirFilterEstamento').addEventListener('change', e => {
    state.dirFilterEstamento = e.target.value;
    renderDirectoryView();
  });

  document.querySelectorAll('.stat-card-clickable').forEach(card => {
    card.addEventListener('click', () => {
      const mode = card.dataset.dirQuick;
      if (mode === 'all') {
        state.dirFilterSection = 'all';
        state.dirFilterStatus = 'all';
        state.dirFilterModality = 'all';
        state.dirFilterEstamento = 'all';
      } else if (mode === 'complete') {
        state.dirFilterStatus = 'complete';
      } else if (mode === 'incomplete') {
        state.dirFilterStatus = 'incomplete';
      } else if (mode === 'turno') {
        state.dirFilterModality = '4to Turno / Rotativo';
      }
      document.getElementById('dirFilterSection').value = state.dirFilterSection;
      document.getElementById('dirFilterStatus').value = state.dirFilterStatus;
      document.getElementById('dirFilterModality').value = state.dirFilterModality;
      document.getElementById('dirFilterEstamento').value = state.dirFilterEstamento;
      renderDirectoryView();
    });
  });

  // Controles de TDM
  document.getElementById('tdmDateInput').addEventListener('change', e => {
    state.tdmDate = e.target.value;
    renderTdmView();
  });

  const btnTdmPrev = document.getElementById('btnTdmPrevDay');
  if (btnTdmPrev) {
    btnTdmPrev.addEventListener('click', () => {
      const [y, m, d] = state.tdmDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() - 1);
      state.tdmDate = formatDateISO(dt);
      document.getElementById('tdmDateInput').value = state.tdmDate;
      renderTdmView();
    });
  }

  const btnTdmNext = document.getElementById('btnTdmNextDay');
  if (btnTdmNext) {
    btnTdmNext.addEventListener('click', () => {
      const [y, m, d] = state.tdmDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() + 1);
      state.tdmDate = formatDateISO(dt);
      document.getElementById('tdmDateInput').value = state.tdmDate;
      renderTdmView();
    });
  }

  document.getElementById('tdmFilterStation').addEventListener('change', e => {
    state.tdmStationFilter = e.target.value;
    renderTdmView();
  });

  document.getElementById('btnAddTdmAssign').addEventListener('click', () => openTdmAssignModal());
  document.getElementById('btnCloseTdmModal').addEventListener('click', () => closeModal('modalTdmAssign'));
  document.getElementById('btnCancelTdmModal').addEventListener('click', () => closeModal('modalTdmAssign'));
  document.getElementById('btnSaveTdmModal').addEventListener('click', saveTdmAssignModal);
  document.getElementById('tdmModalStaff').addEventListener('change', updateTdmModalConflictPreview);
  document.getElementById('tdmModalDate').addEventListener('change', e => {
    const endEl = document.getElementById('tdmModalEndDate');
    if (endEl.value < e.target.value) endEl.value = e.target.value;
    updateTdmModalConflictPreview();
  });

  document.getElementById('tdmDailyTbody').addEventListener('click', e => {
    const btn = e.target.closest('.btn-remove-tdm');
    if (btn) {
      if (!canEditCalendar()) {
        showToast('🔒 Inicia sesión como Jefatura o Administrador para quitar asignaciones TDM.');
        return;
      }
      const sid = btn.dataset.staff;
      const d = btn.dataset.date;
      pushUndoSnapshot(`Quitar de TDM (${state.staff[sid]?.name})`);
      const arr = getActiveTdmArray();
      const idx = arr.findIndex(t => t.staff_id === sid && t.date === d);
      if (idx >= 0) {
        const removed = arr[idx];
        arr.splice(idx, 1);
        recordAuditEntry({
          category: 'TDM',
          action: 'Eliminación de Asignación TDM',
          staffId: sid,
          staffName: state.staff[sid]?.name,
          dateRange: d,
          beforeVal: `TDM (${removed.station || ''})`,
          afterVal: 'Sin TDM',
          detail: `Se retiró de ${removed.station || 'Toma de Muestras'}`
        });
        saveStateToStorage();
        rebuildFastLookupMaps();
        renderAll();
        showToast('🗑️ Asignación TDM eliminada.');
      }
      return;
    }
    const nameEl = e.target.closest('.staff-name-main');
    if (nameEl && nameEl.dataset.staffId) {
      openStaffAnnualModal(nameEl.dataset.staffId);
    }
  });

  // Clic en Matriz Mensual TDM para asignar o editar directamente
  document.getElementById('tdmMonthThead').addEventListener('click', e => {
    const th = e.target.closest('[data-tdm-header-date]');
    if (th) {
      state.tdmDate = th.dataset.tdmHeaderDate;
      document.getElementById('tdmDateInput').value = state.tdmDate;
      renderTdmView();
    }
  });

  document.getElementById('tdmMonthTbody').addEventListener('click', e => {
    const cell = e.target.closest('.tdm-matrix-cell');
    if (cell) {
      openTdmAssignModal(cell.dataset.staff, cell.dataset.date);
      return;
    }
    const nameEl = e.target.closest('.staff-name-main');
    if (nameEl && nameEl.dataset.staffId) {
      openStaffAnnualModal(nameEl.dataset.staffId);
    }
  });

  // Controles de Estadísticas
  document.getElementById('analyticsFilterGroup').addEventListener('change', e => {
    state.analyticsFilter = e.target.value;
    renderAnalyticsView();
  });

  const analyticsSearchEl = document.getElementById('analyticsSearch');
  if (analyticsSearchEl) {
    analyticsSearchEl.addEventListener('input', e => {
      state.analyticsSearch = e.target.value;
      renderAnalyticsView();
    });
  }

  document.getElementById('analyticsTbody').addEventListener('click', e => {
    const annualBtn = e.target.closest('.btn-annual-staff');
    if (annualBtn) {
      openStaffAnnualModal(annualBtn.dataset.id);
      return;
    }
    const nameEl = e.target.closest('.staff-name-main');
    if (nameEl && nameEl.dataset.staffId) {
      openStaffAnnualModal(nameEl.dataset.staffId);
    }
  });

  // Modal 5: Ficha Anual del Funcionario
  document.getElementById('btnCloseAnnualModal').addEventListener('click', () => closeModal('modalStaffAnnual'));
  document.getElementById('btnAnnualEditProfile').addEventListener('click', () => {
    if (state.annualModalStaffId) openStaffModal(state.annualModalStaffId);
  });
  document.getElementById('btnAnnualAddAbsence').addEventListener('click', () => {
    if (state.annualModalStaffId) {
      const defaultDate = `${state.year}-${String(state.month).padStart(2, '0')}-01`;
      openCellModal(state.annualModalStaffId, defaultDate, 'VACACIONES');
    }
  });
  document.getElementById('annualTimelineTbody').addEventListener('click', e => {
    const cell = e.target.closest('.annual-day-cell');
    if (cell) {
      openCellModal(cell.dataset.staff, cell.dataset.date);
    }
  });

  // Modal 6: Autenticación (Login / Logout)
  const btnOpenLogin = document.getElementById('btnOpenLoginModal');
  if (btnOpenLogin) btnOpenLogin.addEventListener('click', openLoginModal);
  const btnCloseLogin = document.getElementById('btnCloseLoginModal');
  if (btnCloseLogin) btnCloseLogin.addEventListener('click', () => closeModal('modalLogin'));
  const btnCancelLogin = document.getElementById('btnCancelLoginModal');
  if (btnCancelLogin) btnCancelLogin.addEventListener('click', () => closeModal('modalLogin'));
  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) btnLogout.addEventListener('click', logoutUser);

  document.querySelectorAll('.btn-quick-fill-login').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('loginUsernameInput').value = btn.dataset.u || '';
      document.getElementById('loginPasswordInput').value = btn.dataset.p || '';
      document.getElementById('loginErrorAlert')?.classList.add('hidden');
    });
  });

  // Modal 7: Gestor de Cuentas de Usuario (Solo Admin)
  const btnOpenUserMgr = document.getElementById('btnOpenUserManager');
  if (btnOpenUserMgr) btnOpenUserMgr.addEventListener('click', openUserManagerModal);
  const btnCloseUserMgr = document.getElementById('btnCloseUserManager');
  if (btnCloseUserMgr) btnCloseUserMgr.addEventListener('click', () => closeModal('modalUserManager'));
  const btnCloseUserMgrFooter = document.getElementById('btnCloseUserManagerFooter');
  if (btnCloseUserMgrFooter) btnCloseUserMgrFooter.addEventListener('click', () => closeModal('modalUserManager'));
  const btnSaveUser = document.getElementById('btnSaveUserAccount');
  if (btnSaveUser) btnSaveUser.addEventListener('click', saveUserAccount);
  const btnCancelUserEdit = document.getElementById('btnCancelUserEdit');
  if (btnCancelUserEdit) btnCancelUserEdit.addEventListener('click', resetUserForm);

  const usersTbody = document.getElementById('usersListTbody');
  if (usersTbody) {
    usersTbody.addEventListener('click', e => {
      const editBtn = e.target.closest('.btn-edit-user');
      if (editBtn) {
        const u = state.users.find(x => x.username === editBtn.dataset.username);
        if (u) {
          document.getElementById('userEditOriginalUsername').value = u.username;
          document.getElementById('userEditFullName').value = u.name || '';
          document.getElementById('userEditUsername').value = u.username || '';
          document.getElementById('userEditPassword').value = u.password || '';
          document.getElementById('userEditRoleSelect').value = u.role || 'jefatura';
          document.getElementById('userFormTitle').textContent = `✏️ Editando cuenta: @${u.username}`;
          document.getElementById('btnCancelUserEdit')?.classList.remove('hidden');
        }
        return;
      }
      const delBtn = e.target.closest('.btn-delete-user');
      if (delBtn) {
        deleteUserAccount(delBtn.dataset.username);
      }
    });
  }

  // Modal 8: Configuración Web / Google Apps Script
  const btnOpenCloud = document.getElementById('btnOpenCloudConfig');
  if (btnOpenCloud) {
    btnOpenCloud.addEventListener('click', () => {
      if (moreToolsMenu) moreToolsMenu.classList.add('hidden');
      openCloudConfigModal();
    });
  }
  const btnCloseCloud = document.getElementById('btnCloseCloudConfig');
  if (btnCloseCloud) btnCloseCloud.addEventListener('click', () => closeModal('modalCloudConfig'));
  const btnCancelCloud = document.getElementById('btnCancelCloudConfig');
  if (btnCancelCloud) btnCancelCloud.addEventListener('click', () => closeModal('modalCloudConfig'));
  const btnSaveCloud = document.getElementById('btnSaveCloudConfig');
  if (btnSaveCloud) btnSaveCloud.addEventListener('click', saveCloudConfig);
  const btnPullCloud = document.getElementById('btnPullFromCloud');
  if (btnPullCloud) {
    btnPullCloud.addEventListener('click', () => {
      const urlVal = document.getElementById('gasWebAppUrlInput')?.value.trim() || '';
      state.gasWebAppUrl = urlVal;
      if (urlVal) localStorage.setItem(STORAGE_KEYS.GAS_URL, urlVal);
      pullDatabaseFromCloud(false);
    });
  }

  // Controles de Vista Bitácora de Trazabilidad
  const auditSearchEl = document.getElementById('auditSearch');
  if (auditSearchEl) {
    auditSearchEl.addEventListener('input', e => {
      state.auditSearch = e.target.value;
      renderAuditView();
    });
  }
  const auditFilterUserEl = document.getElementById('auditFilterUser');
  if (auditFilterUserEl) {
    auditFilterUserEl.addEventListener('change', e => {
      state.auditFilterUser = e.target.value;
      renderAuditView();
    });
  }
  const auditFilterCatEl = document.getElementById('auditFilterCategory');
  if (auditFilterCatEl) {
    auditFilterCatEl.addEventListener('change', e => {
      state.auditFilterCategory = e.target.value;
      renderAuditView();
    });
  }
  const btnExportAudit = document.getElementById('btnExportAuditCSV');
  if (btnExportAudit) btnExportAudit.addEventListener('click', exportAuditLogCSV);
  const btnClearAudit = document.getElementById('btnClearAuditLog');
  if (btnClearAudit) btnClearAudit.addEventListener('click', clearAuditLogHistory);

  const auditTbodyEl = document.getElementById('auditTbody');
  if (auditTbodyEl) {
    auditTbodyEl.addEventListener('click', e => {
      const nameEl = e.target.closest('.staff-name-main');
      if (nameEl && nameEl.dataset.staffId && state.staff[nameEl.dataset.staffId]) {
        openStaffAnnualModal(nameEl.dataset.staffId);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', initApp);
