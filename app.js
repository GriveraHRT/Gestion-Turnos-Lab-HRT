/**
 * Sistema de Gestión de Turnos y Calendario - Laboratorio Clínico HRT
 * Hospital Regional de Talca - Versión 2027
 */

const DATA_VERSION = '3.2';

const ESTAMENTO_ORDER = {
  'Tecnólogo Médico': 1,
  'Bioquímico': 2,
  'TENS': 3,
  'Auxiliar': 4,
  'Interno TM': 5,
  'Administrativo': 6
};

let state = {
  currentYear: 2026,
  currentMonth: 1,
  activeTab: 'CALENDARIO GENERAL',
  presetFilter: 'ALL',
  groupBy: 'ESTAMENTO',
  estamentoFilter: 'ALL',
  jornadaFilter: 'ALL',
  searchQuery: '',
  selectedCell: null,
  selectedTDMDate: '2026-01-02',
  staff: {},
  turns2026: [],
  tdm2026: [],
  turns2027: [],
  tdm2027: [],
  holidays: {},
  _turnsMap: null,
  _turnsMapYear: null,
  rangeModalState: null
};

function normalizeText(str) {
  return (str || '')
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeRut(rut) {
  return (rut || '').replace(/[\.\-\s]/g, '').toUpperCase();
}

function formatDateToISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseISODate(str) {
  const parts = str.split('-');
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
}

function getAllChileHolidaysSet() {
  const set = new Set();
  if (state.holidays) {
    Object.values(state.holidays).forEach(list => {
      if (Array.isArray(list)) {
        list.forEach(h => set.add(h.date));
      }
    });
  }
  return set;
}

function addWorkdays(startDateStr, targetWorkdays) {
  if (!startDateStr || targetWorkdays <= 0) return startDateStr;
  const holidays = getAllChileHolidaysSet();
  const cur = parseISODate(startDateStr);
  let count = 0;
  while (true) {
    const curStr = formatDateToISO(cur);
    const dow = cur.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = (dow === 0 || dow === 6);
    const isHoliday = holidays.has(curStr);
    if (!isWeekend && !isHoliday) {
      count++;
      if (count >= targetWorkdays) {
        return curStr;
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
}

function getEligibleDatesInRange(startDateStr, endDateStr, mode) {
  if (!startDateStr || !endDateStr) return [];
  const start = parseISODate(startDateStr);
  const end = parseISODate(endDateStr);
  if (end < start) return [];

  const holidays = getAllChileHolidaysSet();
  const dates = [];

  const cur = new Date(start);
  while (cur <= end) {
    const curStr = formatDateToISO(cur);
    const dow = cur.getDay(); // 0 = Sun, 6 = Sat

    if (mode === 'workdays') {
      const isWeekend = (dow === 0 || dow === 6);
      const isHoliday = holidays.has(curStr);
      if (!isWeekend && !isHoliday) {
        dates.push(curStr);
      }
    } else {
      dates.push(curStr);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}


const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const TDM_STATIONS = [
  { id: 'box_0730', name: '07:30 - Box Apertura / Primer Turno', defaultSlot: '07:30:00', icon: 'clock' },
  { id: 'box_0800_1', name: '08:00 - Box 1 (Punción Ambulatoria)', defaultSlot: '08:00:00', icon: 'needle' },
  { id: 'box_0800_2', name: '08:00 - Box 2 (Punción Ambulatoria)', defaultSlot: '08:00:00', icon: 'needle' },
  { id: 'box_0800_3', name: '08:00 - Box 3 (Punción Ambulatoria)', defaultSlot: '08:00:00', icon: 'needle' },
  { id: 'box_0800_4', name: '08:00 - Box 4 (Punción Ambulatoria)', defaultSlot: '08:00:00', icon: 'needle' },
  { id: 'box_0830_1', name: '08:30 - Box Refuerzo Punta (SOS)', defaultSlot: '08:30:00', icon: 'zap' },
  { id: 'recepcion', name: 'Recepción de Muestras (CDT)', defaultSlot: 'RECEPCIÓN', icon: 'inbox' },
  { id: 'orientador', name: 'Orientador y Apoyo en Sala', defaultSlot: 'ORIENTADOR', icon: 'compass' },
  { id: 'urgencia_apoyo', name: 'Refuerzo Urgencia (07:00 a 08:00)', defaultSlot: 'URGENCIA (7-8)', icon: 'alert-triangle' }
];

document.addEventListener('DOMContentLoaded', () => {
  loadInitialData();
  setupMonthButtons();
  setYear(state.currentYear);
  initLucide();
  renderApp();
});

function initLucide() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function rebuildTurnsMap() {
  state._turnsMap = {};
  const list2026 = state.turns2026 || [];
  for (let i = 0; i < list2026.length; i++) {
    const r = list2026[i];
    state._turnsMap[r.staff_id + '_' + r.date] = r;
  }
  const list2027 = state.turns2027 || [];
  for (let i = 0; i < list2027.length; i++) {
    const r = list2027[i];
    state._turnsMap[r.staff_id + '_' + r.date] = r;
  }
  state._turnsMapYear = state.currentYear;
}

function migrateStaffSections(staffObj) {
  if (!staffObj) return;
  Object.values(staffObj).forEach(s => {
    if (s.name === 'Diego Rojas Verdugo') {
      s.section = 'ATE';
      return;
    }
    const secUpper = (s.section || '').toUpperCase();
    const sheetsStr = (s.sheets || []).join(' ').toUpperCase();
    if (secUpper.includes('URGENCIA') || sheetsStr.includes('URGENCIA')) s.section = 'ALU';
    else if (secUpper.includes('HEMATOLOG')) s.section = 'AH';
    else if (secUpper.includes('INMUNOQU') || secUpper.includes('QUIMIC')) s.section = 'AIC';
    else if (secUpper.includes('MICROBIOLOG')) s.section = 'AMB';
    else if (secUpper.includes('ADMINISTRA') || secUpper.includes('FUNCIONES') || s.role === 'Administrativo' || s.estamento === 'Administrativo') s.section = 'ADM';
    else if (secUpper.includes('TENS') || sheetsStr.includes('TENS') || s.estamento === 'TENS') s.section = 'APA';
    else if (secUpper.includes('TOMA DE MUESTRA') || sheetsStr.includes('TOMA DE MUESTRA') || s.name === 'Maria Jose Peñailillo') s.section = 'ATE';
    else if (secUpper.includes('AUXILIAR') || sheetsStr.includes('AUXILIAR') || s.estamento === 'Auxiliar') s.section = 'Auxiliares';
  });
}

function loadInitialData() {
  // Clear any outdated cache from prior buggy builds
  const savedVersion = localStorage.getItem('hrt_data_version');
  if (savedVersion !== DATA_VERSION) {
    localStorage.removeItem('hrt_staff_directory');
    localStorage.setItem('hrt_data_version', DATA_VERSION);
  }

  if (window.TURNOS_INITIAL_DATA) {
    state.staff = JSON.parse(JSON.stringify(window.TURNOS_INITIAL_DATA.staff || {}));
    state.turns2026 = window.TURNOS_INITIAL_DATA.turns_2026 || [];
    state.tdm2026 = window.TURNOS_INITIAL_DATA.tdm_2026 || [];
    state.holidays = window.TURNOS_INITIAL_DATA.holidays || {};
  }

  const savedStaff = localStorage.getItem('hrt_staff_directory');
  if (savedStaff) {
    try {
      const parsed = JSON.parse(savedStaff);
      // Ensure no fake duplicate keys from older cache persist
      if (!parsed.tm_constanza && !parsed.reemplazos) {
        state.staff = parsed;
      }
    } catch(e) {}
  }

  // Ensure sections always conform to official area codes (ALU, AH, AIC, AMB, APA, ADM, ATE)
  migrateStaffSections(state.staff);

  const savedTurns2026 = localStorage.getItem('hrt_turns_2026');
  if (savedTurns2026) {
    try { state.turns2026 = JSON.parse(savedTurns2026); } catch(e) {}
  }

  const savedTDM2026 = localStorage.getItem('hrt_tdm_2026');
  if (savedTDM2026) {
    try { state.tdm2026 = JSON.parse(savedTDM2026); } catch(e) {}
  }

  const savedTurns2027 = localStorage.getItem('hrt_turns_2027');
  if (savedTurns2027) {
    try { state.turns2027 = JSON.parse(savedTurns2027); } catch(e) {}
  }

  const savedTDM2027 = localStorage.getItem('hrt_tdm_2027');
  if (savedTDM2027) {
    try { state.tdm2027 = JSON.parse(savedTDM2027); } catch(e) {}
  }

  rebuildTurnsMap();

  state.selectedTDMDate = `${state.currentYear}-${String(state.currentMonth).padStart(2, '0')}-04`;
  const tdmInput = document.getElementById('tdm-date-input');
  if (tdmInput) tdmInput.value = state.selectedTDMDate;
}

function setYear(year) {
  state.currentYear = year;
  rebuildTurnsMap();

  const btn2026 = document.getElementById('btn-year-2026');
  if (btn2026) {
    btn2026.className = year === 2026 
      ? 'px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 bg-sky-500 text-white shadow-sm'
      : 'px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 bg-slate-700 text-slate-300 hover:text-white';
  }
  
  const btn2027 = document.getElementById('btn-year-2027');
  if (btn2027) {
    btn2027.className = year === 2027
      ? 'px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 bg-sky-500 text-white shadow-sm'
      : 'px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 bg-slate-700 text-slate-300 hover:text-white';
  }

  const banner2027 = document.getElementById('banner-planificacion-2027');
  if (banner2027) {
    if (year === 2027) banner2027.classList.remove('hidden');
    else banner2027.classList.add('hidden');
  }

  const statsYearLabel = document.getElementById('stats-year-label');
  if (statsYearLabel) statsYearLabel.innerText = String(year);

  const parts = state.selectedTDMDate.split('-');
  parts[0] = String(year);
  state.selectedTDMDate = parts.join('-');
  const tdmInput = document.getElementById('tdm-date-input');
  if (tdmInput) tdmInput.value = state.selectedTDMDate;

  renderApp();
}

function setupMonthButtons() {
  const container = document.getElementById('months-list');
  if (!container) return;
  container.innerHTML = '';
  
  MONTH_NAMES.forEach((m, idx) => {
    const monthNum = idx + 1;
    const btn = document.createElement('button');
    btn.className = `month-btn px-2.5 py-1 text-xs font-semibold rounded-lg transition ${monthNum === state.currentMonth ? 'bg-sky-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:bg-slate-100'}`;
    btn.innerText = m.slice(0, 3);
    btn.onclick = () => setMonth(monthNum);
    btn.dataset.month = monthNum;
    container.appendChild(btn);
  });
}

function setMonth(monthNum) {
  state.currentMonth = monthNum;
  document.querySelectorAll('.month-btn').forEach(btn => {
    if (parseInt(btn.dataset.month) === monthNum) {
      btn.className = 'month-btn px-2.5 py-1 text-xs font-bold rounded-lg transition bg-sky-600 text-white shadow-xs';
    } else {
      btn.className = 'month-btn px-2.5 py-1 text-xs font-semibold rounded-lg transition text-slate-600 hover:bg-slate-100';
    }
  });
  
  const parts = state.selectedTDMDate.split('-');
  parts[1] = String(monthNum).padStart(2, '0');
  state.selectedTDMDate = parts.join('-');
  const tdmInput = document.getElementById('tdm-date-input');
  if (tdmInput) tdmInput.value = state.selectedTDMDate;

  renderApp();
}

function prevMonth() {
  if (state.currentMonth > 1) setMonth(state.currentMonth - 1);
  else setMonth(12);
}

function nextMonth() {
  if (state.currentMonth < 12) setMonth(state.currentMonth + 1);
  else setMonth(1);
}

function switchTab(tabId) {
  const normTab = tabId.trim();
  state.activeTab = normTab;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    const btnTab = (btn.dataset.tab || '').trim();
    if (btnTab === normTab) {
      btn.className = 'tab-btn active px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 whitespace-nowrap bg-sky-100 text-sky-800 border border-sky-300 shadow-xs';
    } else {
      btn.className = 'tab-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 whitespace-nowrap text-slate-600 hover:bg-slate-100';
    }
  });

  const isGeneralCalendar = (normTab === 'CALENDARIO GENERAL');
  const isMatrix = (isGeneralCalendar || normTab === 'LAB. URGENCIA' || normTab === 'PROFESIONALES RUTINA' || normTab === 'TENS RUTINA' || normTab === 'AUXILIARES');

  const controlsBar = document.getElementById('section-controls-bar');
  const calendarSearch = document.getElementById('calendar-search-container');
  const generalControls = document.getElementById('general-calendar-controls');
  const sectionLegend = document.getElementById('section-legend');

  if (controlsBar) {
    // Only show controls bar for Calendario General or Toma de Muestra (needs month picker)
    controlsBar.classList.toggle('hidden', normTab !== 'CALENDARIO GENERAL' && normTab !== 'TOMA DE MUESTRA');
  }

  if (calendarSearch) {
    // Search by funcionario/RUT is ONLY useful and visible on Calendario General as requested
    calendarSearch.classList.toggle('hidden', normTab !== 'CALENDARIO GENERAL');
  }

  if (generalControls) {
    generalControls.classList.toggle('hidden', normTab !== 'CALENDARIO GENERAL');
  }

  if (sectionLegend) {
    sectionLegend.classList.toggle('hidden', normTab !== 'CALENDARIO GENERAL');
  }

  document.getElementById('view-matrix').classList.toggle('hidden', !isMatrix);
  document.getElementById('view-tdm').classList.toggle('hidden', normTab !== 'TOMA DE MUESTRA');
  document.getElementById('view-directorio').classList.toggle('hidden', normTab !== 'DIRECTORIO');
  document.getElementById('view-metricas').classList.toggle('hidden', normTab !== 'METRICAS');

  renderApp();
}

function applyFilters() {
  const searchInput = document.getElementById('input-search');
  state.searchQuery = searchInput ? searchInput.value.trim() : '';

  const clearBtn = document.getElementById('btn-clear-search');
  if (clearBtn) {
    if (state.searchQuery.length > 0) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  const estSelect = document.getElementById('select-estamento-filter');
  if (estSelect) state.estamentoFilter = estSelect.value;

  const jorSelect = document.getElementById('select-jornada-filter');
  if (jorSelect) state.jornadaFilter = jorSelect.value;

  renderApp();
}

function clearSearch() {
  const searchInput = document.getElementById('input-search');
  if (searchInput) searchInput.value = '';
  applyFilters();
}

function updatePresetBadges() {
  const staffList = Object.values(state.staff);
  const countAll = document.getElementById('count-all');
  if (countAll) countAll.innerText = staffList.length;

  const countUrg = document.getElementById('count-urgencias');
  if (countUrg) countUrg.innerText = staffList.filter(s => matchesPreset(s, 'URGENCIAS')).length;

  const countRut = document.getElementById('count-rutina');
  if (countRut) countRut.innerText = staffList.filter(s => matchesPreset(s, 'RUTINA')).length;

  const countTens = document.getElementById('count-tens');
  if (countTens) countTens.innerText = staffList.filter(s => matchesPreset(s, 'TENS')).length;

  const countAux = document.getElementById('count-auxiliares');
  if (countAux) countAux.innerText = staffList.filter(s => matchesPreset(s, 'AUXILIARES')).length;

  const countProf = document.getElementById('count-profesionales');
  if (countProf) countProf.innerText = staffList.filter(s => matchesPreset(s, 'PROFESIONALES')).length;
}

function hasUrgencyShiftInCurrentMonth(staffId) {
  const year = state.currentYear;
  const month = state.currentMonth;
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const ev = getShiftEvent(staffId, dateStr);
    if (ev) {
      if (ev.code === 'L' || ev.code === 'N') return true;
      if (ev.sheet && ev.sheet.toUpperCase().includes('URGENCIA')) return true;
    }
  }
  return false;
}

function setPresetFilter(preset) {
  state.presetFilter = preset;

  // Harmonize conflicting dropdown filters when clicking a preset
  state.estamentoFilter = 'ALL';
  state.jornadaFilter = 'ALL';
  const estSelect = document.getElementById('select-estamento-filter');
  if (estSelect) estSelect.value = 'ALL';
  const jorSelect = document.getElementById('select-jornada-filter');
  if (jorSelect) jorSelect.value = 'ALL';

  const presets = ['ALL', 'URGENCIAS', 'RUTINA', 'TENS', 'AUXILIARES', 'PROFESIONALES'];
  presets.forEach(p => {
    const btn = document.getElementById(`preset-${p}`);
    if (btn) {
      if (p === preset) {
        btn.className = 'preset-btn active px-2.5 py-1 text-xs font-bold rounded-lg transition bg-sky-600 text-white shadow-xs whitespace-nowrap flex items-center space-x-1';
      } else {
        btn.className = 'preset-btn px-2.5 py-1 text-xs font-semibold rounded-lg transition text-slate-600 hover:bg-slate-100 whitespace-nowrap flex items-center space-x-1';
      }
    }
  });

  renderApp();
}

function changeGrouping(value) {
  state.groupBy = value;
  renderApp();
}

function matchesSearch(member, rawQuery) {
  if (!rawQuery) return true;
  const qNorm = normalizeText(rawQuery);
  if (!qNorm) return true;

  // Shortcut for auditing incomplete profiles
  if ((qNorm === 'sin rut' || qNorm === 'falta rut' || qNorm === 'pendiente' || qNorm === 'sin ruts') && (!member.rut || (member.missing_fields && member.missing_fields.length > 0))) {
    return true;
  }

  const qWords = qNorm.split(/\s+/).filter(Boolean);
  const qRut = normalizeRut(rawQuery);

  // If query is numeric or unpunctuated RUT with K, match directly against normalized RUT
  if (qRut.length >= 2 && /^[\dK]+$/.test(qRut)) {
    if (member.rut && normalizeRut(member.rut).includes(qRut)) return true;
  }

  let estAbbr = '';
  const est = member.estamento || member.role || '';
  if (est === 'Tecnólogo Médico' || est === 'Profesional') estAbbr = 'tm';
  else if (est === 'Bioquímico') estAbbr = 'bq';
  else if (est === 'Auxiliar') estAbbr = 'aux';

  // Tokenized multi-word search (supports "Rivera Guillermo", "TM Urgencia", etc.)
  const searchable = [
    normalizeText(member.name),
    member.official_name ? normalizeText(member.official_name) : '',
    member.rut ? normalizeRut(member.rut) : '',
    member.section ? normalizeText(member.section) : '',
    normalizeText(est),
    estAbbr,
    member.role ? normalizeText(member.role) : '',
    member.jornada ? normalizeText(member.jornada) : ''
  ].join(' ');

  return qWords.every(word => searchable.includes(word));
}

function matchesPreset(member, preset) {
  if (!preset || preset === 'ALL') return true;

  const sec = (member.section || '').toLowerCase();
  const jor = member.jornada || '';
  const est = member.estamento || member.role || '';
  const sheets = (member.sheets || []).map(s => s.toLowerCase());

  if (preset === 'URGENCIAS') {
    return jor === 'Turno' || sec === 'alu' || sec.includes('urgencia') || sheets.some(s => s.includes('urgencia')) || hasUrgencyShiftInCurrentMonth(member.id);
  }
  if (preset === 'RUTINA') {
    return jor === 'Diurno' || sheets.some(s => s.includes('rutina')) || (sec !== 'alu' && !sec.includes('urgencia') && jor !== 'Turno');
  }
  if (preset === 'TENS') {
    return est === 'TENS' || sec === 'apa' || member.role === 'TENS' || sheets.some(s => s.includes('tens'));
  }
  if (preset === 'AUXILIARES') {
    return est === 'Auxiliar' || member.role === 'Auxiliar' || sec === 'auxiliares' || sheets.some(s => s.includes('auxiliar'));
  }
  if (preset === 'PROFESIONALES') {
    return est === 'Tecnólogo Médico' || est === 'Bioquímico' || est === 'Interno TM' || member.role === 'Profesional' || sheets.some(s => s.includes('profesional'));
  }
  return true;
}


function renderApp() {
  updatePresetBadges();
  if (state.activeTab === 'TOMA DE MUESTRA') {
    renderTDMView();
  } else if (state.activeTab === 'DIRECTORIO') {
    renderDirectorioView();
  } else if (state.activeTab === 'METRICAS') {
    renderMetricasView();
  } else {
    renderMatrixView();
  }
  initLucide();
}

function renderMatrixView() {
  const tableHead = document.getElementById('matrix-head');
  const tableBody = document.getElementById('matrix-body');
  if (!tableHead || !tableBody) return;

  const countAllSpan = document.getElementById('count-all');
  if (countAllSpan) countAllSpan.innerText = Object.keys(state.staff).length;

  const year = state.currentYear;
  const month = state.currentMonth;
  const daysInMonth = new Date(year, month, 0).getDate();

  const currentHolidays = (state.holidays[String(year)] || []).reduce((acc, h) => {
    acc[h.date] = h.name;
    return acc;
  }, {});

  let headHtml = `
    <tr class="sticky-row-header">
      <th class="sticky-col-header">Funcionario</th>
      <th class="sticky-col-header-2">RUT</th>
  `;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dateObj.getDay();
    const dayLetter = DAY_LETTERS[dayOfWeek];
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const holidayName = currentHolidays[dateStr];

    let thClass = 'cell-shift font-bold';
    let extraTitle = `${d} de ${MONTH_NAMES[month-1]} (${dayLetter})`;

    if (holidayName) {
      thClass += ' is-holiday-header';
      extraTitle += ` - Feriado: ${holidayName}`;
    } else if (isWeekend) {
      thClass += ' is-weekend-header';
    } else {
      thClass += ' bg-slate-800 text-slate-200';
    }

    headHtml += `
      <th class="${thClass}" title="${extraTitle}">
        <div class="text-[10px] leading-tight font-normal opacity-90">${dayLetter}</div>
        <div class="text-xs leading-tight">${d}</div>
      </th>
    `;
  }
  headHtml += '</tr>';
  tableHead.innerHTML = headHtml;

  const activeStaff = getStaffForSheet(state.activeTab);
  tableBody.innerHTML = '';
  if (activeStaff.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="${daysInMonth + 2}" class="p-8 text-center text-slate-400 text-xs">No se encontraron funcionarios para este criterio de búsqueda o filtro.</td></tr>`;
    return;
  }

  // Pre-calculate group counts for divider badges
  const groupCounts = {};
  if (state.groupBy !== 'NONE') {
    activeStaff.forEach(m => {
      let gKey = 'General';
      if (state.groupBy === 'ESTAMENTO') gKey = m.estamento || m.role || 'Otros';
      else if (state.groupBy === 'JORNADA') gKey = m.jornada === 'Turno' ? 'Turno Rotativo (Urgencias / 4to Turno)' : 'Personal Diurno (Jornada Ordinaria 44h)';
      else if (state.groupBy === 'SECTION') gKey = m.section || 'General / Sin Sección';
      groupCounts[gKey] = (groupCounts[gKey] || 0) + 1;
    });
  }

  let lastGroup = null;
  activeStaff.forEach((member, index) => {
    let currentGroup = null;
    if (state.groupBy === 'ESTAMENTO') {
      currentGroup = member.estamento || member.role || 'Otros';
    } else if (state.groupBy === 'JORNADA') {
      currentGroup = member.jornada === 'Turno' ? 'Turno Rotativo (Urgencias / 4to Turno)' : 'Personal Diurno (Jornada Ordinaria 44h)';
    } else if (state.groupBy === 'SECTION') {
      currentGroup = member.section || 'General / Sin Sección';
    }

    if (currentGroup && currentGroup !== lastGroup && state.groupBy !== 'NONE') {
      lastGroup = currentGroup;
      const groupRow = document.createElement('tr');
      groupRow.className = 'group-header-row bg-slate-100/95 font-bold text-slate-700 text-xs tracking-wider uppercase';
      groupRow.innerHTML = `
        <td class="sticky-col-group-header bg-slate-200 font-extrabold text-slate-800 py-1.5 px-3 border-r border-slate-300" colspan="2">
          <div class="flex items-center space-x-2">
            <span class="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block shadow-2xs"></span>
            <span class="text-xs font-bold tracking-tight text-slate-900">${currentGroup}</span>
            <span class="text-[10px] font-semibold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full lowercase">${groupCounts[currentGroup] || 0} funcionarios</span>
          </div>
        </td>
        <td colspan="${daysInMonth}" class="bg-slate-100/80 border-b border-slate-200"></td>
      `;
      tableBody.appendChild(groupRow);
    }

    const row = document.createElement('tr');
    row.className = index % 2 === 0 ? 'bg-white hover:bg-slate-50/80 transition group' : 'bg-slate-50/50 hover:bg-slate-50/80 transition group';

    let nameBadges = '';
    if (member.is_intern) nameBadges += '<span class="ml-1 px-1.5 py-0.2 text-[9px] bg-purple-100 text-purple-700 rounded font-semibold">Interno</span>';
    if (member.is_replacement) nameBadges += '<span class="ml-1 px-1.5 py-0.2 text-[9px] bg-amber-100 text-amber-700 rounded font-semibold">Reemplazo</span>';
    if (member.missing_fields && member.missing_fields.length > 0) {
      nameBadges += '<span class="ml-1 px-1.5 py-0.2 text-[9px] bg-yellow-100 text-yellow-800 rounded cursor-pointer" title="Datos pendientes: ' + member.missing_fields.join(', ') + '">⚠️</span>';
    }

    const rutDisplay = member.rut || '<span class="text-amber-600 font-medium italic text-[10px]">Sin RUT</span>';
    const subInfo = [member.estamento || member.role, member.jornada, member.section].filter(Boolean).join(' • ');

    let rowHtml = `
      <td class="sticky-col-body font-semibold text-slate-900 border-r border-slate-200">
        <div class="flex items-center justify-between">
          <div class="truncate text-xs cursor-pointer hover:text-sky-600" onclick="openStaffModal('${member.id}')" title="Editar funcionario">
            ${member.name} ${nameBadges}
          </div>
          <div class="flex items-center space-x-1 shrink-0 ml-2">
            <button onclick="event.stopPropagation(); openShiftScheduleModal('${member.id}')" class="row-quick-range-btn px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-800 hover:bg-sky-100 text-[11px] font-bold border border-sky-300 shadow-2xs" title="Asignar esquemas de turno o rotación para ${member.name}">
              ⚡ Turno
            </button>
            <button onclick="event.stopPropagation(); openRangeModalForStaff('${member.id}')" class="row-quick-range-btn px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-800 hover:bg-teal-100 text-[11px] font-bold border border-teal-300 shadow-2xs" title="Programar ausencia o vacaciones para ${member.name}">
              🌴 Ausencia
            </button>
          </div>
        </div>
        <div class="text-[10px] text-slate-400 font-normal leading-tight truncate">${subInfo}</div>
      </td>
      <td class="sticky-col-body-2 font-mono text-[11px] text-slate-600 border-r border-slate-200">
        ${rutDisplay}
      </td>
    `;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dateObj = new Date(year, month - 1, d);
      const isWeekend = (dateObj.getDay() === 0 || dateObj.getDay() === 6);
      const isHoliday = !!currentHolidays[dateStr];

      const shiftEvent = getShiftEvent(member.id, dateStr);

      let cellClass = 'cell-shift';
      let cellText = '';
      let cellTitle = `${member.name} - ${d} ${MONTH_NAMES[month-1]}`;

      if (shiftEvent) {
        cellText = shiftEvent.code || '';
        const evType = shiftEvent.event_type || 'TURNO';
        
        if (evType === 'VACACIONES') {
          cellClass += ' event-vacaciones';
          cellTitle += ' | Feriado Legal (Vacaciones)';
          if (!cellText) cellText = 'FL';
        } else if (evType === 'ADMINISTRATIVO') {
          cellClass += ' event-administrativo';
          cellTitle += ' | Día Administrativo';
          if (!cellText) cellText = 'DA';
        } else if (evType === 'DEVOLUCION_TIEMPO') {
          cellClass += ' event-devolucion_tiempo';
          cellTitle += ` | Devolución de Tiempo (${cellText})`;
        } else if (evType === 'COMISION_SERVICIO') {
          cellClass += ' event-comision_servicio';
          cellTitle += ' | Comisión de Servicio';
          if (!cellText) cellText = '*';
        } else if (evType === 'LICENCIA_MEDICA') {
          cellClass += ' event-licencia bg-orange-500 text-white';
          cellTitle += ' | Licencia Médica';
          if (!cellText) cellText = 'LM';
        } else if (evType === 'SIN_GOCE_SUELDO') {
          cellClass += ' event-sin_goce_sueldo';
          cellTitle += ' | Permiso sin goce de sueldo';
          if (!cellText) cellText = 'PSG';
        } else if (evType === 'PERMISO_TARDE') {
          cellClass += ' event-permiso_tarde';
          cellTitle += ' | Permiso Tarde';
        } else if (cellText === 'L') {
          cellClass += ' event-largo';
          cellTitle += ' | Turno Largo (08:00 a 20:00)';
        } else if (cellText === 'N') {
          cellClass += ' event-noche';
          cellTitle += ' | Turno Noche (20:00 a 08:00)';
        } else if (cellText === 'D') {
          cellClass += ' event-diurno';
          cellTitle += ' | Jornada Diurna (08:00 a 17:00)';
        } else {
          cellClass += ' bg-slate-100 text-slate-800 font-bold';
          cellTitle += ` | Turno: ${cellText}`;
        }
      } else {
        if (isHoliday) {
          cellClass += ' is-holiday-col';
        } else if (isWeekend) {
          cellClass += ' is-weekend-col';
        }
      }

      rowHtml += `
        <td class="${cellClass}" onclick="openShiftModal('${member.id}', '${dateStr}', '${cellText}', '${shiftEvent ? shiftEvent.event_type : ''}')" title="${cellTitle}">
          ${cellText}
        </td>
      `;
    }

    row.innerHTML = rowHtml;
    tableBody.appendChild(row);
  });
}

function getStaffForSheet(sheetName, ignoreUiFilters = false) {
  let list = Object.values(state.staff);

  // Search filter with smart RUT normalization
  if (!ignoreUiFilters && state.searchQuery) {
    list = list.filter(m => matchesSearch(m, state.searchQuery));
  }

  // CALENDARIO GENERAL handles all staff with presets, subdivision, and explicit filters
  if (sheetName === 'CALENDARIO GENERAL') {
    if (!ignoreUiFilters) {
      list = list.filter(m => matchesPreset(m, state.presetFilter));

      if (state.estamentoFilter && state.estamentoFilter !== 'ALL') {
        list = list.filter(m => (m.estamento || m.role) === state.estamentoFilter);
      }

      if (state.jornadaFilter && state.jornadaFilter !== 'ALL') {
        list = list.filter(m => (m.jornada || 'Diurno') === state.jornadaFilter);
      }
    }

    list.sort((a, b) => {
      if (state.groupBy === 'ESTAMENTO' || ignoreUiFilters) {
        const estA = a.estamento || a.role || '';
        const estB = b.estamento || b.role || '';
        const orderA = ESTAMENTO_ORDER[estA] || 99;
        const orderB = ESTAMENTO_ORDER[estB] || 99;
        if (orderA !== orderB) return orderA - orderB;
        if (estA !== estB) return estA.localeCompare(estB);
      } else if (state.groupBy === 'JORNADA') {
        const jorA = a.jornada || 'Diurno';
        const jorB = b.jornada || 'Diurno';
        if (jorA !== jorB) return jorA === 'Turno' ? -1 : 1;
      } else if (state.groupBy === 'SECTION') {
        const secA = a.section || '';
        const secB = b.section || '';
        if (secA !== secB) return secA.localeCompare(secB);
      }
      return (a.name || '').localeCompare(b.name || '');
    });

    return list;
  }

  // Legacy sheets logic
  const sNorm = (sheetName || '').trim().toUpperCase();
  if (sNorm === 'LAB. URGENCIA') {
    list = list.filter(m => (m.sheets || []).some(s => s.toUpperCase().includes('URGENCIA')) || (m.section && m.section.toLowerCase().includes('urgencia')));
  } else if (sNorm === 'PROFESIONALES RUTINA') {
    list = list.filter(m => (m.sheets || []).some(s => s.toUpperCase().includes('PROFESIONAL')) || (m.role === 'Profesional' && !m.section.toLowerCase().includes('urgencia')));
  } else if (sNorm === 'TENS RUTINA') {
    list = list.filter(m => (m.sheets || []).some(s => s.toUpperCase().includes('TENS RUTINA')) || (m.role === 'TENS' && !m.section.toLowerCase().includes('urgencia')));
  } else if (sNorm === 'AUXILIARES') {
    list = list.filter(m => (m.sheets || []).some(s => s.toUpperCase().includes('AUXILIAR')) || m.role === 'Auxiliar');
  } else if (sNorm === 'TOMA DE MUESTRA') {
    list = list.filter(m => (m.sheets || []).some(s => s.toUpperCase().includes('TOMA DE MUESTRA')));
  }

  list.sort((a, b) => {
    if (a.section !== b.section) return (a.section || '').localeCompare(b.section || '');
    return a.name.localeCompare(b.name);
  });

  return list;
}

function getShiftEvent(staffId, dateStr) {
  if (!state._turnsMap || state._turnsMapYear !== state.currentYear) {
    rebuildTurnsMap();
  }
  return state._turnsMap[staffId + '_' + dateStr] || null;
}

function checkStaffConflict(staffId, dateStr) {
  const shift = getShiftEvent(staffId, dateStr);
  if (shift) {
    if (shift.event_type === 'VACACIONES') return 'Vacaciones (FL)';
    if (shift.event_type === 'LICENCIA_MEDICA') return 'Licencia Médica (LM)';
    if (shift.event_type === 'ADMINISTRATIVO') return 'Día Administrativo (DA)';
    if (shift.code === 'N') return 'Turno Noche Activo';
    if (shift.event_type === 'SIN_GOCE_SUELDO') return 'Permiso Sin Goce';
  }

  // Clinical Rule: Check previous day for night shift (Saliente Turno Noche)
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  const prevDateStr = d.toISOString().split('T')[0];
  const prevShift = getShiftEvent(staffId, prevDateStr);
  if (prevShift && prevShift.code === 'N') {
    return 'Saliente de Turno Noche (08:00 AM)';
  }

  return null;
}

function renderTDMView() {
  const stationsGrid = document.getElementById('tdm-stations-grid');
  const tdmDateInput = document.getElementById('tdm-date-input');
  if (!stationsGrid) return;

  const dateStr = state.selectedTDMDate;
  if (tdmDateInput) tdmDateInput.value = dateStr;

  const currentAssignments = (state.currentYear === 2026 ? state.tdm2026 : state.tdm2027)
    .filter(a => a.date === dateStr);

  stationsGrid.innerHTML = '';

  TDM_STATIONS.forEach(station => {
    // Exact 1-to-1 station assignment matching (eliminates 4x multiplication bug)
    const assigned = currentAssignments.filter(a => a.station_id === station.id);

    const card = document.createElement('div');
    card.className = 'bg-slate-50 rounded-xl border border-slate-200 p-4 shadow-xs hover:border-emerald-300 transition flex flex-col justify-between';
    
    let assignedListHtml = '';
    if (assigned.length > 0) {
      assigned.forEach(item => {
        const conflict = checkStaffConflict(item.staff_id, dateStr);
        let conflictBadge = '';
        if (conflict) {
          conflictBadge = `<span class="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-700 font-bold rounded" title="Conflicto detectado: ${conflict}">⚠️ ${conflict}</span>`;
        }

        assignedListHtml += `
          <div class="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-2xs mb-2">
            <div>
              <div class="text-xs font-bold text-slate-800">${item.staff_name}</div>
              <div class="text-[10px] text-slate-400">${item.role || 'Funcionario'} - ${item.section || 'Lab'}</div>
              ${conflictBadge}
            </div>
            <button onclick="removeTDMAssignment('${item.staff_id}', '${dateStr}', '${station.id}')" class="text-rose-500 hover:text-rose-700 p-1" title="Quitar asignación">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        `;
      });
    } else {
      assignedListHtml = `<div class="text-xs text-slate-400 italic py-2 text-center bg-white/60 rounded-lg border border-dashed border-slate-200 mb-2">Sin personal designado</div>`;
    }

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
          <div class="flex items-center space-x-2">
            <span class="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <i data-lucide="clock" class="w-4 h-4"></i>
            </span>
            <h4 class="text-xs font-bold text-slate-800">${station.name}</h4>
          </div>
          <span class="text-[10px] font-semibold text-slate-400">Puesto fijo</span>
        </div>
        <div>${assignedListHtml}</div>
      </div>
      <div class="pt-2 border-t border-slate-200 flex items-center space-x-2">
        <select id="select-staff-${station.id}" class="w-full text-xs py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-emerald-500">
          <option value="">+ Seleccionar colega para asignar...</option>
          ${getStaffDropdownOptions(dateStr)}
        </select>
        <button onclick="addTDMAssignment('${station.id}', '${dateStr}')" class="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-lg text-xs font-bold shadow-xs">
          <i data-lucide="plus" class="w-4 h-4"></i>
        </button>
      </div>
    `;

    stationsGrid.appendChild(card);
  });

  renderTDMMonthlyTable();
}

function getStaffDropdownOptions(dateStr) {
  const staffList = Object.values(state.staff).sort((a, b) => a.name.localeCompare(b.name));
  return staffList.map(s => {
    const conflict = checkStaffConflict(s.id, dateStr);
    const tag = conflict ? ` [⚠️ ${conflict}]` : ` (${s.role})`;
    return `<option value="${s.id}">${s.name}${tag}</option>`;
  }).join('');
}

function onTDMDateChange(val) {
  state.selectedTDMDate = val;
  const parts = val.split('-');
  state.currentYear = parseInt(parts[0]);
  state.currentMonth = parseInt(parts[1]);
  renderTDMView();
  initLucide();
}

function stepTDMDay(days) {
  const d = new Date(state.selectedTDMDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  state.selectedTDMDate = d.toISOString().split('T')[0];
  const tdmInput = document.getElementById('tdm-date-input');
  if (tdmInput) tdmInput.value = state.selectedTDMDate;
  renderTDMView();
  initLucide();
}

function setTDMToday() {
  state.selectedTDMDate = new Date().toISOString().split('T')[0];
  const tdmInput = document.getElementById('tdm-date-input');
  if (tdmInput) tdmInput.value = state.selectedTDMDate;
  renderTDMView();
  initLucide();
}

function addTDMAssignment(stationId, dateStr) {
  const sel = document.getElementById(`select-staff-${stationId}`);
  if (!sel || !sel.value) return;
  const staffId = sel.value;
  const member = state.staff[staffId];
  if (!member) return;

  const targetList = state.currentYear === 2026 ? state.tdm2026 : state.tdm2027;

  // Prevent duplicate assignment across any station on same date
  const existingSameDay = targetList.find(a => a.staff_id === staffId && a.date === dateStr);
  if (existingSameDay) {
    const stName = TDM_STATIONS.find(s => s.id === existingSameDay.station_id)?.name || 'otro puesto';
    alert(`Aviso: ${member.name} ya se encuentra asignado(a) a ${stName} en la fecha ${dateStr}.`);
    return;
  }

  // Conflict confirmation prompt
  const conflict = checkStaffConflict(staffId, dateStr);
  if (conflict) {
    if (!confirm(`⚠️ Advertencia de Turno / Ausentismo:\n${member.name} registra "${conflict}" el día ${dateStr}.\n\n¿Deseas confirmar la asignación a Toma de Muestras de todos modos?`)) {
      return;
    }
  }

  const station = TDM_STATIONS.find(s => s.id === stationId);

  targetList.push({
    date: dateStr,
    month: parseInt(dateStr.split('-')[1]),
    day: parseInt(dateStr.split('-')[2]),
    staff_id: staffId,
    staff_name: member.name,
    role: member.role,
    section: member.section,
    sheet: 'TOMA DE MUESTRA',
    station_id: stationId,
    time_slot: station ? station.defaultSlot : '08:00:00',
    code: 'X'
  });

  saveChangesToStorage();
  renderTDMView();
  initLucide();
}

function removeTDMAssignment(staffId, dateStr, stationId) {
  const targetList = state.currentYear === 2026 ? state.tdm2026 : state.tdm2027;
  const idx = targetList.findIndex(a => a.staff_id === staffId && a.date === dateStr && (stationId ? a.station_id === stationId : true));
  if (idx !== -1) {
    targetList.splice(idx, 1);
    saveChangesToStorage();
    renderTDMView();
    initLucide();
  }
}

function renderTDMMonthlyTable() {
  const wrapper = document.getElementById('tdm-monthly-table-wrapper');
  if (!wrapper) return;

  const year = state.currentYear;
  const month = state.currentMonth;
  const daysInMonth = new Date(year, month, 0).getDate();

  const monthAssignments = (state.currentYear === 2026 ? state.tdm2026 : state.tdm2027)
    .filter(a => a.date.startsWith(`${year}-${String(month).padStart(2, '0')}`));

  // All 22 official TDM qualified staff
  const tdmStaff = getStaffForSheet('TOMA DE MUESTRA');

  if (tdmStaff.length === 0) {
    wrapper.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">No hay funcionarios designados a toma de muestra registrados para ${MONTH_NAMES[month-1]} ${year}.</div>`;
    return;
  }

  let html = `
    <table class="table-matrix">
      <thead>
        <tr class="sticky-row-header">
          <th class="sticky-col-header">Funcionario TDM</th>
          <th class="sticky-col-header-2">Estamento</th>
  `;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dayLetter = DAY_LETTERS[dateObj.getDay()];
    const isW = dateObj.getDay() === 0 || dateObj.getDay() === 6;
    html += `<th class="cell-shift ${isW ? 'is-weekend-header' : 'bg-slate-800 text-white'}"><div class="text-[9px]">${dayLetter}</div><div>${d}</div></th>`;
  }
  html += `</tr></thead><tbody>`;

  tdmStaff.forEach((st, idx) => {
    html += `
      <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}">
        <td class="sticky-col-body font-semibold text-slate-900 border-r border-slate-200">
          <div class="truncate cursor-pointer hover:text-sky-600" onclick="openStaffModal('${st.id}')">${st.name}</div>
        </td>
        <td class="sticky-col-body-2 text-slate-500 font-mono text-[11px] border-r border-slate-200">
          ${st.role}
        </td>
    `;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const ass = monthAssignments.find(a => a.staff_id === st.id && a.date === dateStr);
      if (ass) {
        html += `<td class="cell-shift event-tdm-assigned" title="${st.name}: Asignado(a) a Toma de Muestras (${ass.time_slot || ''})">X</td>`;
      } else {
        // Show base shift or absence badge if present so coordinator has full context
        const baseEv = getShiftEvent(st.id, dateStr);
        if (baseEv && (baseEv.code || baseEv.event_type)) {
          let codeLabel = baseEv.code || (baseEv.event_type === 'VACACIONES' ? 'FL' : (baseEv.event_type === 'ADMINISTRATIVO' ? 'DA' : ''));
          let cls = 'cell-shift text-[10px] font-bold ';
          if (baseEv.event_type === 'VACACIONES') cls += 'event-vacaciones';
          else if (baseEv.event_type === 'ADMINISTRATIVO') cls += 'event-administrativo';
          else if (baseEv.code === 'N') cls += 'event-noche';
          else if (baseEv.code === 'L') cls += 'event-largo';
          else cls += 'bg-slate-100 text-slate-600';
          html += `<td class="${cls}" title="${st.name}: ${baseEv.event_type || baseEv.code}">${codeLabel}</td>`;
        } else {
          html += `<td class="cell-shift text-slate-300">-</td>`;
        }
      }
    }
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  wrapper.innerHTML = html;
}

let directorioFilters = {
  search: '',
  section: 'ALL',
  estado: 'ALL',
  jornada: 'ALL',
  estamento: 'ALL'
};

function applyDirectorioFilters() {
  const searchInput = document.getElementById('directorio-filter-search');
  directorioFilters.search = searchInput ? searchInput.value.trim() : '';
  
  const clearBtn = document.getElementById('directorio-clear-search');
  if (clearBtn) {
    if (directorioFilters.search.length > 0) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  const secSelect = document.getElementById('directorio-filter-section');
  if (secSelect) directorioFilters.section = secSelect.value;

  const estSelect = document.getElementById('directorio-filter-estado');
  if (estSelect) directorioFilters.estado = estSelect.value;

  const jorSelect = document.getElementById('directorio-filter-jornada');
  if (jorSelect) directorioFilters.jornada = jorSelect.value;

  const staSelect = document.getElementById('directorio-filter-estamento');
  if (staSelect) directorioFilters.estamento = staSelect.value;

  renderDirectorioView();
}

function clearDirectorioSearch() {
  const searchInput = document.getElementById('directorio-filter-search');
  if (searchInput) searchInput.value = '';
  applyDirectorioFilters();
}

function resetDirectorioFilters() {
  directorioFilters = {
    search: '',
    section: 'ALL',
    estado: 'ALL',
    jornada: 'ALL',
    estamento: 'ALL'
  };
  const searchInput = document.getElementById('directorio-filter-search');
  if (searchInput) searchInput.value = '';
  const secSelect = document.getElementById('directorio-filter-section');
  if (secSelect) secSelect.value = 'ALL';
  const estSelect = document.getElementById('directorio-filter-estado');
  if (estSelect) estSelect.value = 'ALL';
  const jorSelect = document.getElementById('directorio-filter-jornada');
  if (jorSelect) jorSelect.value = 'ALL';
  const staSelect = document.getElementById('directorio-filter-estamento');
  if (staSelect) staSelect.value = 'ALL';

  applyDirectorioFilters();
}

function setDirectorioQuickFilter(filterKey, filterValue) {
  if (filterKey === 'RESET') {
    resetDirectorioFilters();
    return;
  }
  if (filterKey === 'estado') {
    directorioFilters.estado = filterValue;
    const el = document.getElementById('directorio-filter-estado');
    if (el) el.value = filterValue;
  } else if (filterKey === 'estamento') {
    directorioFilters.estamento = filterValue;
    const el = document.getElementById('directorio-filter-estamento');
    if (el) el.value = filterValue;
  }
  applyDirectorioFilters();
}

function getSectionBadge(sec) {
  const code = (sec || '').toUpperCase().trim();
  const map = {
    'ALU': { label: 'ALU • Urgencias', class: 'bg-rose-100 text-rose-800 border-rose-200' },
    'AH': { label: 'AH • Hematología', class: 'bg-purple-100 text-purple-800 border-purple-200' },
    'AIC': { label: 'AIC • Química', class: 'bg-blue-100 text-blue-800 border-blue-200' },
    'AMB': { label: 'AMB • Microbiología', class: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    'APA': { label: 'APA • TENS', class: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
    'ADM': { label: 'ADM • Administrativa', class: 'bg-amber-100 text-amber-800 border-amber-200' },
    'ATE': { label: 'ATE • Toma Exámenes', class: 'bg-teal-100 text-teal-800 border-teal-200' },
    'AUXILIARES': { label: 'Auxiliares', class: 'bg-slate-100 text-slate-800 border-slate-200' }
  };
  const item = map[code] || { label: sec || '-', class: 'bg-slate-100 text-slate-700 border-slate-200' };
  return `<span class="px-2 py-0.5 rounded text-[11px] font-bold border ${item.class}">${item.label}</span>`;
}

function renderDirectorioView() {
  const tbody = document.getElementById('directorio-table-body');
  const statsCards = document.getElementById('directorio-stats-cards');
  if (!tbody || !statsCards) return;

  const staffList = Object.values(state.staff);
  const total = staffList.length;
  const tms = staffList.filter(s => s.estamento === 'Tecnólogo Médico' || s.estamento === 'Bioquímico' || s.role === 'Profesional').length;
  const tens = staffList.filter(s => s.estamento === 'TENS' || s.role === 'TENS').length;
  const missingData = staffList.filter(s => s.missing_fields && s.missing_fields.length > 0).length;

  statsCards.innerHTML = `
    <div onclick="setDirectorioQuickFilter('RESET')" class="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs cursor-pointer hover:border-slate-400 transition" title="Clic para ver todos">
      <div class="text-[11px] font-semibold text-slate-500">Dotación Total</div>
      <div class="text-xl font-bold text-slate-800">${total}</div>
    </div>
    <div onclick="setDirectorioQuickFilter('estamento', 'TM_BQ')" class="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs cursor-pointer hover:border-blue-400 transition" title="Clic para filtrar TM y Bioquímicos">
      <div class="text-[11px] font-semibold text-blue-600">TM y Bioquímicos</div>
      <div class="text-xl font-bold text-blue-900">${tms}</div>
    </div>
    <div onclick="setDirectorioQuickFilter('estamento', 'TENS')" class="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs cursor-pointer hover:border-cyan-400 transition" title="Clic para filtrar TENS">
      <div class="text-[11px] font-semibold text-cyan-600">TENS</div>
      <div class="text-xl font-bold text-cyan-900">${tens}</div>
    </div>
    <div onclick="setDirectorioQuickFilter('estado', 'PENDIENTE')" class="bg-white p-3 rounded-xl border border-amber-200 bg-amber-50/50 shadow-2xs cursor-pointer hover:border-amber-400 transition" title="Clic para ver pendientes">
      <div class="text-[11px] font-semibold text-amber-700">RUT / Datos Pendientes</div>
      <div class="text-xl font-bold text-amber-900">${missingData}</div>
    </div>
  `;

  let filteredStaff = staffList.filter(member => {
    // Search query: name, official_name, rut
    if (directorioFilters.search) {
      const q = normalizeText(directorioFilters.search);
      const qRut = normalizeRut(directorioFilters.search);
      const mName = normalizeText(member.name);
      const mOff = normalizeText(member.official_name || '');
      const mRut = normalizeRut(member.rut || '');
      const matchesSearch = mName.includes(q) || mOff.includes(q) || (qRut.length > 2 && mRut.includes(qRut));
      if (!matchesSearch) return false;
    }

    // Section filter
    if (directorioFilters.section !== 'ALL') {
      const sec = member.section || '';
      if (sec !== directorioFilters.section) return false;
    }

    // Estado filter
    if (directorioFilters.estado === 'COMPLETO') {
      if (member.missing_fields && member.missing_fields.length > 0) return false;
    } else if (directorioFilters.estado === 'PENDIENTE') {
      if (!member.missing_fields || member.missing_fields.length === 0) return false;
    }

    // Jornada filter
    if (directorioFilters.jornada !== 'ALL') {
      const jor = member.jornada || 'Diurno';
      if (jor !== directorioFilters.jornada) return false;
    }

    // Estamento filter (supports TM + BQ unified group)
    if (directorioFilters.estamento !== 'ALL') {
      const est = member.estamento || member.role || '';
      if (directorioFilters.estamento === 'TM_BQ') {
        if (est !== 'Tecnólogo Médico' && est !== 'Bioquímico' && member.role !== 'Profesional') return false;
      } else if (est !== directorioFilters.estamento) {
        return false;
      }
    }

    return true;
  });

  const countEl = document.getElementById('directorio-results-count');
  if (countEl) {
    countEl.innerHTML = `Mostrando <strong>${filteredStaff.length}</strong> de <strong>${total}</strong> funcionarios`;
  }

  // Render active tags
  const tagsEl = document.getElementById('directorio-active-tags');
  if (tagsEl) {
    let tagsHtml = '';
    if (directorioFilters.section !== 'ALL') {
      tagsHtml += `<span class="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Sección: ${directorioFilters.section}</span>`;
    }
    if (directorioFilters.estado !== 'ALL') {
      tagsHtml += `<span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Estado: ${directorioFilters.estado}</span>`;
    }
    if (directorioFilters.jornada !== 'ALL') {
      tagsHtml += `<span class="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Jornada: ${directorioFilters.jornada}</span>`;
    }
    if (directorioFilters.estamento !== 'ALL') {
      const estLabel = directorioFilters.estamento === 'TM_BQ' ? 'TM y Bioquímicos' : directorioFilters.estamento;
      tagsHtml += `<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Estamento: ${estLabel}</span>`;
    }
    tagsEl.innerHTML = tagsHtml;
  }

  tbody.innerHTML = '';
  if (filteredStaff.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="7" class="px-4 py-8 text-center text-slate-400 font-medium">
      No se encontraron funcionarios que coincidan con los filtros seleccionados.
      <button onclick="resetDirectorioFilters()" class="ml-2 text-sky-600 font-bold underline">Limpiar filtros</button>
    </td>`;
    tbody.appendChild(tr);
    return;
  }

  filteredStaff.sort((a, b) => a.name.localeCompare(b.name)).forEach(member => {
    let statusBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 whitespace-nowrap">Completo</span>`;
    if (member.missing_fields && member.missing_fields.length > 0) {
      statusBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">⚠️ ${member.missing_fields.join(', ')}</span>`;
    }

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition';
    tr.innerHTML = `
      <td class="px-4 py-3 font-semibold text-slate-900">
        ${member.name}
        ${member.official_name && member.official_name !== member.name ? `<div class="text-[10px] text-slate-400 font-normal">Oficial: ${member.official_name}</div>` : ''}
      </td>
      <td class="px-4 py-3 font-mono text-slate-600">
        ${member.rut || '<span class="text-amber-600 font-bold">FALTA RUT</span>'}
      </td>
      <td class="px-4 py-3 whitespace-nowrap">
        <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">${member.estamento || member.role}</span>
      </td>
      <td class="px-4 py-3 whitespace-nowrap">
        <span class="px-2 py-0.5 rounded text-[11px] font-semibold ${member.jornada === 'Turno' ? 'bg-amber-100 text-amber-800 font-bold' : 'bg-slate-100 text-slate-700'}">${member.jornada || 'Diurno'}</span>
      </td>
      <td class="px-4 py-3 whitespace-nowrap">
        ${getSectionBadge(member.section)}
      </td>
      <td class="px-4 py-3">
        ${statusBadge}
      </td>
      <td class="px-4 py-3 text-right whitespace-nowrap">
        <div class="flex items-center justify-end space-x-1.5">
          <button onclick="openShiftScheduleModal('${member.id}')" class="px-2 py-1 rounded bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold transition flex items-center space-x-1" title="Gestionar turnos y rotaciones">
            <i data-lucide="calendar-sync" class="w-3.5 h-3.5"></i>
            <span>Turno</span>
          </button>
          <button onclick="openStaffModal('${member.id}')" class="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center space-x-1" title="Editar ficha funcionario">
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            <span>Editar</span>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  initLucide();
}

function renderMetricasView() {
  const kpisContainer = document.getElementById('metrics-kpis');
  const tbody = document.getElementById('table-metrics-body');
  if (!kpisContainer || !tbody) return;

  const year = state.currentYear;
  const turns = year === 2026 ? state.turns2026 : state.turns2027;

  let totalVac = 0;
  let totalAdmin = 0;
  let totalDev = 0;
  let totalLic = 0;
  let totalNoche = 0;

  const staffStats = {};
  Object.values(state.staff).forEach(s => {
    staffStats[s.id] = {
      staff: s,
      vacaciones: 0,
      administrativos: 0,
      devoluciones: 0,
      licencias: 0,
      noches: 0
    };
  });

  turns.forEach(t => {
    if (!staffStats[t.staff_id]) return;
    const st = staffStats[t.staff_id];
    
    if (t.event_type === 'VACACIONES') {
      totalVac++;
      st.vacaciones++;
    } else if (t.event_type === 'ADMINISTRATIVO') {
      totalAdmin++;
      st.administrativos++;
    } else if (t.event_type === 'DEVOLUCION_TIEMPO') {
      totalDev++;
      st.devoluciones++;
    } else if (t.event_type === 'LICENCIA_MEDICA') {
      totalLic++;
      st.licencias++;
    }
    if (t.code === 'N') {
      totalNoche++;
      st.noches++;
    }
  });

  kpisContainer.innerHTML = `
    <div class="bg-red-50 p-4 rounded-xl border border-red-200 shadow-xs">
      <div class="text-xs font-bold text-red-700">Días Feriado Legal (Vacaciones)</div>
      <div class="text-2xl font-black text-red-900 mt-1">${totalVac}</div>
      <div class="text-[10px] text-red-600 mt-0.5">Total días programados</div>
    </div>
    <div class="bg-yellow-50 p-4 rounded-xl border border-yellow-200 shadow-xs">
      <div class="text-xs font-bold text-yellow-700">Días Administrativos</div>
      <div class="text-2xl font-black text-yellow-900 mt-1">${totalAdmin}</div>
      <div class="text-[10px] text-yellow-600 mt-0.5">Permisos administrativos</div>
    </div>
    <div class="bg-purple-50 p-4 rounded-xl border border-purple-200 shadow-xs">
      <div class="text-xs font-bold text-purple-700">Devolución de Tiempo / Horas</div>
      <div class="text-2xl font-black text-purple-900 mt-1">${totalDev}</div>
      <div class="text-[10px] text-purple-600 mt-0.5">Registros compensatorios</div>
    </div>
    <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 text-white shadow-xs">
      <div class="text-xs font-bold text-slate-300">Turnos de Noche Realizados</div>
      <div class="text-2xl font-black text-white mt-1">${totalNoche}</div>
      <div class="text-[10px] text-slate-400 mt-0.5">Laboratorio de Urgencia</div>
    </div>
  `;

  tbody.innerHTML = '';
  Object.values(staffStats)
    .sort((a, b) => a.staff.name.localeCompare(b.staff.name))
    .forEach(item => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition';
      tr.innerHTML = `
        <td class="px-3 py-2 font-semibold text-slate-800">${item.staff.name}</td>
        <td class="px-3 py-2 text-slate-600 font-medium">${item.staff.estamento || item.staff.role}</td>
        <td class="px-3 py-2 text-slate-500">${item.staff.section || '-'}</td>
        <td class="px-3 py-2 text-center font-bold text-red-600">${item.vacaciones || '-'}</td>
        <td class="px-3 py-2 text-center font-bold text-yellow-600">${item.administrativos || '-'}</td>
        <td class="px-3 py-2 text-center font-bold text-purple-600">${item.devoluciones || '-'}</td>
        <td class="px-3 py-2 text-center font-bold text-orange-600">${item.licencias || '-'}</td>
        <td class="px-3 py-2 text-center font-bold text-slate-700">${item.noches || '-'}</td>
      `;
      tbody.appendChild(tr);
    });
}

function openShiftModal(staffId, dateStr, currentCode, currentEventType) {
  const member = state.staff[staffId];
  if (!member) return;

  let eventType = currentEventType || '';
  let code = currentCode || '';

  if (!eventType && code) {
    const upperCode = code.toUpperCase();
    if (['L', 'N', 'M', 'T'].includes(upperCode) || upperCode.includes(':')) eventType = 'TURNO';
    else if (upperCode === 'FL') eventType = 'VACACIONES';
    else if (upperCode === 'DA') eventType = 'ADMINISTRATIVO';
    else if (upperCode === 'LM') eventType = 'LICENCIA_MEDICA';
    else if (upperCode.startsWith('H+')) eventType = 'DEVOLUCION_TIEMPO';
    else if (upperCode === '*') eventType = 'COMISION_SERVICIO';
    else if (upperCode === 'PSG') eventType = 'SIN_GOCE_SUELDO';
    else eventType = 'TURNO';
  }

  const isCellEmpty = !code && !eventType;
  if (isCellEmpty) {
    eventType = 'VACACIONES';
    code = '';
  }

  state.rangeModalState = {
    staffId: staffId,
    startDate: dateStr,
    endDate: dateStr,
    mode: 'all',
    eventType: eventType,
    code: code
  };

  document.getElementById('modal-shift-title').innerText = `${member.name}`;
  document.getElementById('modal-shift-subtitle').innerText = `${member.estamento || member.role} • ${member.jornada || 'Diurno'} • ${member.section || ''}`;

  const staffSelectCont = document.getElementById('modal-staff-select-container');
  if (staffSelectCont) staffSelectCont.classList.add('hidden');

  document.getElementById('modal-range-start').value = dateStr;
  document.getElementById('modal-range-end').value = dateStr;
  document.getElementById('modal-range-end').min = dateStr;
  document.getElementById('mode-all-days').checked = true;
  document.getElementById('modal-custom-code').value = code;

  if (isCellEmpty) {
    document.querySelectorAll('.event-choice-btn').forEach(btn => btn.classList.remove('is-active-choice'));
  } else {
    highlightActiveEventButton(eventType, code);
  }
  onRangeDatesChanged();

  const histNotice = document.getElementById('modal-historical-notice');
  if (histNotice) {
    if (state.currentYear === 2026) histNotice.classList.remove('hidden');
    else histNotice.classList.add('hidden');
  }

  document.getElementById('modal-shift-picker').classList.remove('hidden');
  initLucide();
}

function openRangeModalForStaff(staffId) {
  const member = state.staff[staffId];
  if (!member) return;

  const year = state.currentYear;
  const month = String(state.currentMonth).padStart(2, '0');
  const startDate = `${year}-${month}-01`;
  const isWorkdays = document.getElementById('mode-workdays')?.checked || false;
  const endDate = isWorkdays ? addWorkdays(startDate, 10) : formatDateToISO(new Date(year, state.currentMonth - 1, 14));

  state.rangeModalState = {
    staffId: staffId,
    startDate: startDate,
    endDate: endDate,
    mode: isWorkdays ? 'workdays' : 'all',
    eventType: 'VACACIONES',
    code: 'FL'
  };

  document.getElementById('modal-shift-title').innerText = `Programar Ausencia por Rango: ${member.name}`;
  document.getElementById('modal-shift-subtitle').innerText = `${member.estamento || member.role} • ${member.jornada || 'Diurno'}`;

  const staffSelectCont = document.getElementById('modal-staff-select-container');
  if (staffSelectCont) staffSelectCont.classList.add('hidden');

  document.getElementById('modal-range-start').value = startDate;
  document.getElementById('modal-range-end').value = endDate;
  document.getElementById('modal-range-end').min = startDate;
  document.getElementById('modal-custom-code').value = 'FL';

  highlightActiveEventButton('VACACIONES', 'FL');
  onRangeDatesChanged();

  const histNotice = document.getElementById('modal-historical-notice');
  if (histNotice) {
    if (state.currentYear === 2026) histNotice.classList.remove('hidden');
    else histNotice.classList.add('hidden');
  }

  document.getElementById('modal-shift-picker').classList.remove('hidden');
  initLucide();
}

function openRangeModal() {
  const year = state.currentYear;
  const month = String(state.currentMonth).padStart(2, '0');
  const startDate = `${year}-${month}-01`;
  const isWorkdays = document.getElementById('mode-workdays')?.checked || false;
  const endDate = isWorkdays ? addWorkdays(startDate, 10) : formatDateToISO(new Date(year, state.currentMonth - 1, 14));

  const staffSelectCont = document.getElementById('modal-staff-select-container');
  const staffSelect = document.getElementById('modal-staff-select');
  if (staffSelectCont && staffSelect) {
    staffSelectCont.classList.remove('hidden');
    const sorted = Object.values(state.staff).sort((a, b) => a.name.localeCompare(b.name));
    staffSelect.innerHTML = sorted.map(s => `
      <option value="${s.id}">${s.name} (${s.estamento || s.role} - ${s.jornada || 'Diurno'})</option>
    `).join('');

    const firstStaffId = sorted[0]?.id;
    state.rangeModalState = {
      staffId: firstStaffId,
      startDate: startDate,
      endDate: endDate,
      mode: isWorkdays ? 'workdays' : 'all',
      eventType: 'VACACIONES',
      code: 'FL'
    };
    staffSelect.value = firstStaffId;
  }

  document.getElementById('modal-shift-title').innerText = 'Programar Ausencia por Rango';
  document.getElementById('modal-shift-subtitle').innerText = 'Selecciona funcionario y define el rango de fechas';

  document.getElementById('modal-range-start').value = startDate;
  document.getElementById('modal-range-end').value = endDate;
  document.getElementById('modal-range-end').min = startDate;
  document.getElementById('modal-custom-code').value = 'FL';

  highlightActiveEventButton('VACACIONES', 'FL');
  onRangeDatesChanged();

  const histNotice = document.getElementById('modal-historical-notice');
  if (histNotice) {
    if (state.currentYear === 2026) histNotice.classList.remove('hidden');
    else histNotice.classList.add('hidden');
  }

  document.getElementById('modal-shift-picker').classList.remove('hidden');
  initLucide();
}

function onModalStaffChange(staffId) {
  if (state.rangeModalState) {
    state.rangeModalState.staffId = staffId;
  }
}

function onRangeStartDateChanged() {
  const startInput = document.getElementById('modal-range-start');
  const endInput = document.getElementById('modal-range-end');
  if (startInput && endInput) {
    if (endInput.value && startInput.value > endInput.value) {
      endInput.value = startInput.value;
    }
    endInput.min = startInput.value;
  }
  onRangeDatesChanged();
}

function onRangeDatesChanged() {
  const startInput = document.getElementById('modal-range-start');
  const endInput = document.getElementById('modal-range-end');
  const workdaysRadio = document.getElementById('mode-workdays');
  if (!startInput || !endInput) return;

  let startVal = startInput.value;
  let endVal = endInput.value;
  if (!startVal) return;

  if (endVal && endVal < startVal) {
    endVal = startVal;
    endInput.value = startVal;
  }
  endInput.min = startVal;

  const isWorkdays = workdaysRadio ? workdaysRadio.checked : false;
  const mode = isWorkdays ? 'workdays' : 'all';

  if (state.rangeModalState) {
    state.rangeModalState.startDate = startVal;
    state.rangeModalState.endDate = endVal;
    state.rangeModalState.mode = mode;
  }

  const eligibleDates = getEligibleDatesInRange(startVal, endVal, mode);
  const count = eligibleDates.length;

  const badge = document.getElementById('modal-range-badge');
  const applyLabel = document.getElementById('btn-apply-label');
  const clearLabel = document.getElementById('btn-clear-range-label');

  const unit = count === 1 ? 'día' : 'días';
  const modeDesc = isWorkdays ? 'hábiles' : 'corridos';

  if (badge) badge.innerText = `${count} ${unit} (${modeDesc})`;
  if (applyLabel) applyLabel.innerText = count === 1 ? 'Aplicar a 1 día' : `Aplicar a ${count} días`;
  if (clearLabel) clearLabel.innerText = count === 1 ? 'Limpiar día' : `Limpiar ${count} días`;
}

function setRangeDays(days) {
  const startVal = document.getElementById('modal-range-start').value;
  if (!startVal) return;
  const isWorkdays = document.getElementById('mode-workdays')?.checked;

  if (isWorkdays) {
    let targetWorkdays = days;
    if (days === 7) targetWorkdays = 5;
    else if (days === 14) targetWorkdays = 10;
    else if (days === 15) targetWorkdays = 15;
    else if (days === 21) targetWorkdays = 15;

    const endStr = addWorkdays(startVal, targetWorkdays);
    document.getElementById('modal-range-end').value = endStr;
  } else {
    const start = parseISODate(startVal);
    const end = new Date(start);
    end.setDate(end.getDate() + (days - 1));
    document.getElementById('modal-range-end').value = formatDateToISO(end);
  }
  onRangeDatesChanged();
}

function setRangeToEndOfMonth() {
  const startVal = document.getElementById('modal-range-start').value;
  if (!startVal) return;
  const start = parseISODate(startVal);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  document.getElementById('modal-range-end').value = formatDateToISO(end);
  onRangeDatesChanged();
}

function selectEventType(eventType, defaultCode) {
  if (!state.rangeModalState) return;
  state.rangeModalState.eventType = eventType;
  state.rangeModalState.code = defaultCode;
  document.getElementById('modal-custom-code').value = defaultCode;
  highlightActiveEventButton(eventType, defaultCode);
}

function onCustomCodeInput(val) {
  if (!state.rangeModalState) return;
  const code = (val || '').trim().toUpperCase();
  state.rangeModalState.code = code;

  if (code === 'FL') {
    state.rangeModalState.eventType = 'VACACIONES';
  } else if (code === 'DA') {
    state.rangeModalState.eventType = 'ADMINISTRATIVO';
  } else if (code === 'LM') {
    state.rangeModalState.eventType = 'LICENCIA_MEDICA';
  } else if (code.startsWith('H+')) {
    state.rangeModalState.eventType = 'DEVOLUCION_TIEMPO';
  } else if (code === '*') {
    state.rangeModalState.eventType = 'COMISION_SERVICIO';
  } else if (code === 'PSG') {
    state.rangeModalState.eventType = 'SIN_GOCE_SUELDO';
  } else if (['L', 'N', 'M', 'T'].includes(code)) {
    state.rangeModalState.eventType = 'TURNO';
  }
  highlightActiveEventButton(state.rangeModalState.eventType, code);
}

function highlightActiveEventButton(eventType, code) {
  document.querySelectorAll('.event-choice-btn').forEach(btn => {
    btn.classList.remove('is-active-choice');
  });

  const codeMap = {
    'FL': 'btn-ev-vacaciones',
    'DA': 'btn-ev-administrativo',
    'LM': 'btn-ev-licencia',
    'H+6': 'btn-ev-devolucion',
    '*': 'btn-ev-comision',
    'PSG': 'btn-ev-singoce',
    'L': 'btn-ev-largo',
    'N': 'btn-ev-noche',
    'M': 'btn-ev-manana',
    'T': 'btn-ev-tarde'
  };

  const btnId = codeMap[code];
  if (btnId) {
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.add('is-active-choice');
  }
}

function saveShiftModal() {
  if (!state.rangeModalState || !state.rangeModalState.staffId) {
    alert('Por favor selecciona un funcionario.');
    return;
  }

  const staffId = state.rangeModalState.staffId;
  const member = state.staff[staffId];
  if (!member) return;

  let customCode = document.getElementById('modal-custom-code').value.trim();
  let eventType = state.rangeModalState.eventType || 'TURNO';

  if (!customCode) {
    if (eventType === 'VACACIONES') customCode = 'FL';
    else if (eventType === 'ADMINISTRATIVO') customCode = 'DA';
    else if (eventType === 'LICENCIA_MEDICA') customCode = 'LM';
    else if (eventType === 'DEVOLUCION_TIEMPO') customCode = 'H+6';
    else if (eventType === 'COMISION_SERVICIO') customCode = '*';
    else if (eventType === 'SIN_GOCE_SUELDO') customCode = 'PSG';
    else {
      alert('Por favor selecciona una opción de turno o ausencia, o escribe un código.');
      return;
    }
  }

  const startVal = document.getElementById('modal-range-start').value;
  const endVal = document.getElementById('modal-range-end').value;
  const isWorkdays = document.getElementById('mode-workdays').checked;
  const mode = isWorkdays ? 'workdays' : 'all';

  const eligibleDates = getEligibleDatesInRange(startVal, endVal, mode);
  if (eligibleDates.length === 0) {
    alert('El rango de fechas seleccionado no contiene días válidos.');
    return;
  }

  eligibleDates.forEach(dateStr => {
    const dateParts = dateStr.split('-');
    const yearNum = parseInt(dateParts[0], 10);
    const m = parseInt(dateParts[1], 10);
    const d = parseInt(dateParts[2], 10);

    const targetList = yearNum === 2026 ? state.turns2026 : state.turns2027;

    const existing = targetList.find(t => t.staff_id === staffId && t.date === dateStr);
    if (existing) {
      existing.code = customCode;
      existing.event_type = eventType;
    } else {
      targetList.push({
        date: dateStr,
        month: m,
        day: d,
        staff_id: member.id,
        staff_name: member.name,
        role: member.role,
        estamento: member.estamento || member.role,
        jornada: member.jornada || 'Diurno',
        section: member.section,
        sheet: state.activeTab,
        code: customCode,
        event_type: eventType
      });
    }
  });

  rebuildTurnsMap();
  closeShiftModal();
  saveChangesToStorage();
  renderApp();
}

function clearCurrentRangeShift() {
  if (!state.rangeModalState || !state.rangeModalState.staffId) return;
  const staffId = state.rangeModalState.staffId;
  const startVal = document.getElementById('modal-range-start').value;
  const endVal = document.getElementById('modal-range-end').value;
  const isWorkdays = document.getElementById('mode-workdays').checked;
  const mode = isWorkdays ? 'workdays' : 'all';

  const eligibleDates = new Set(getEligibleDatesInRange(startVal, endVal, mode));
  if (eligibleDates.size === 0) return;

  state.turns2026 = state.turns2026.filter(t => !(t.staff_id === staffId && eligibleDates.has(t.date)));
  state.turns2027 = state.turns2027.filter(t => !(t.staff_id === staffId && eligibleDates.has(t.date)));

  rebuildTurnsMap();
  closeShiftModal();
  saveChangesToStorage();
  renderApp();
}

function closeShiftModal() {
  document.getElementById('modal-shift-picker').classList.add('hidden');
  state.rangeModalState = null;
  state.selectedCell = null;
}

function openStaffModal(staffId) {
  const member = state.staff[staffId];
  if (!member) return;

  document.getElementById('staff-edit-id').value = member.id;
  document.getElementById('staff-edit-name').value = member.name;
  document.getElementById('staff-edit-rut').value = member.rut || '';
  document.getElementById('staff-edit-estamento').value = member.estamento || (member.role === 'Profesional' ? 'Tecnólogo Médico' : member.role || 'Tecnólogo Médico');
  document.getElementById('staff-edit-jornada').value = member.jornada || 'Diurno';
  document.getElementById('staff-edit-section').value = member.section || 'ALU';
  document.getElementById('modal-staff-title').innerText = `Editar Funcionario: ${member.name}`;

  document.getElementById('modal-staff-editor').classList.remove('hidden');
  initLucide();
}

function openShiftScheduleFromStaffModal() {
  const staffId = document.getElementById('staff-edit-id').value;
  closeStaffModal();
  openShiftScheduleModal(staffId);
}

function openNewStaffModal() {
  const newId = 'funcionario_' + Date.now();
  document.getElementById('staff-edit-id').value = newId;
  document.getElementById('staff-edit-name').value = '';
  document.getElementById('staff-edit-rut').value = '';
  document.getElementById('staff-edit-estamento').value = 'Tecnólogo Médico';
  document.getElementById('staff-edit-jornada').value = 'Diurno';
  document.getElementById('staff-edit-section').value = 'ALU';
  document.getElementById('modal-staff-title').innerText = 'Nuevo Funcionario';

  document.getElementById('modal-staff-editor').classList.remove('hidden');
  initLucide();
}

function closeStaffModal() {
  document.getElementById('modal-staff-editor').classList.add('hidden');
}

function formatRut(rut) {
  if (!rut) return '';
  const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return rut.toUpperCase();
  const dv = clean.slice(-1);
  const num = clean.slice(0, -1);
  const formattedNum = num.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedNum}-${dv}`;
}

function saveStaffModal() {
  const id = document.getElementById('staff-edit-id').value;
  const name = document.getElementById('staff-edit-name').value.trim();
  const rut = document.getElementById('staff-edit-rut').value.trim();
  const estamento = document.getElementById('staff-edit-estamento').value;
  const jornada = document.getElementById('staff-edit-jornada').value;
  const section = document.getElementById('staff-edit-section').value.trim();

  if (!name) {
    alert('Por favor introduce el nombre del funcionario.');
    return;
  }

  let role = 'Profesional';
  if (estamento === 'TENS') role = 'TENS';
  else if (estamento === 'Auxiliar') role = 'Auxiliar';
  else if (estamento === 'Administrativo') role = 'Administrativo';

  const formattedRut = formatRut(rut);
  const missing = [];
  if (!formattedRut) missing.push('RUT pendiente');
  if (name.split(' ').length < 2) missing.push('Segundo apellido pendiente');

  state.staff[id] = {
    id: id,
    name: name,
    official_name: name,
    rut: formattedRut,
    estamento: estamento,
    jornada: jornada,
    role: role,
    section: section,
    sheets: state.staff[id] ? state.staff[id].sheets : ['CALENDARIO GENERAL'],
    missing_fields: missing,
    is_intern: estamento === 'Interno TM',
    is_replacement: false
  };

  closeStaffModal();
  saveChangesToStorage();
  renderApp();
}

function saveChanges() {
  saveChangesToStorage();
  alert('¡Cambios guardados exitosamente en tu navegador!');
}

function saveChangesToStorage() {
  try {
    localStorage.setItem('hrt_staff_directory', JSON.stringify(state.staff));
    localStorage.setItem('hrt_turns_2026', JSON.stringify(state.turns2026));
    localStorage.setItem('hrt_tdm_2026', JSON.stringify(state.tdm2026));
    localStorage.setItem('hrt_turns_2027', JSON.stringify(state.turns2027));
    localStorage.setItem('hrt_tdm_2027', JSON.stringify(state.tdm2027));
  } catch(e) {
    console.error('Error saving to localStorage:', e);
  }
}

function clone2026to2027() {
  const confirmed = confirm(
    '¿Deseas importar la plantilla de turnos operativos base (Largo, Noche, Horarios) y puestos de TDM de 2026 hacia el año 2027?\n\n' +
    'Los permisos y ausentismos (vacaciones, licencias) quedarán libres para la nueva programación 2027.'
  );
  if (!confirmed) return;

  const clonedTurns = [];
  for (let i = 0; i < state.turns2026.length; i++) {
    const t = state.turns2026[i];
    if (t.event_type === 'TURNO') {
      const targetDate = t.date.replace('2026-', '2027-');
      clonedTurns.push({
        ...t,
        date: targetDate,
        color_tag: null
      });
    }
  }

  const clonedTdm = [];
  for (let i = 0; i < state.tdm2026.length; i++) {
    const a = state.tdm2026[i];
    clonedTdm.push({
      ...a,
      date: a.date.replace('2026-', '2027-')
    });
  }

  state.turns2027 = clonedTurns;
  state.tdm2027 = clonedTdm;
  rebuildTurnsMap();
  saveChangesToStorage();
  setYear(2027);
  renderApp();
  alert(`¡Plantilla 2027 inicializada con éxito! Se importaron ${clonedTurns.length} turnos operativos base y ${clonedTdm.length} puestos de Toma de Muestra.`);
}

function clearPlanning2027() {
  if (!confirm('¿Deseas restablecer la planificación 2027 a una plantilla completamente vacía?')) return;
  state.turns2027 = [];
  state.tdm2027 = [];
  rebuildTurnsMap();
  saveChangesToStorage();
  setYear(2027);
  renderApp();
  alert('Planificación 2027 restablecida con éxito.');
}

function exportJSONBackup() {
  const backup = {
    exportDate: new Date().toISOString(),
    staff: state.staff,
    turns_2026: state.turns2026,
    tdm_2026: state.tdm2026,
    turns_2027: state.turns2027,
    tdm_2027: state.tdm2027,
    holidays: state.holidays
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_turnos_lab_hrt_${state.currentYear}_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJSONBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.staff) state.staff = data.staff;
      if (data.turns_2026) state.turns2026 = data.turns_2026;
      if (data.tdm_2026) state.tdm2026 = data.tdm_2026;
      if (data.turns_2027) state.turns2027 = data.turns_2027;
      if (data.tdm_2027) state.tdm2027 = data.tdm_2027;
      rebuildTurnsMap();
      saveChangesToStorage();
      renderApp();
      alert('¡Copia de seguridad restaurada correctamente!');
    } catch(err) {
      alert('Error al leer el archivo JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function exportToExcel() {
  if (typeof XLSX === 'undefined') {
    alert('La librería de exportación a Excel no está disponible.');
    return;
  }

  const wb = XLSX.utils.book_new();
  const year = state.currentYear;
  const sheets = ['CALENDARIO GENERAL', 'LAB. URGENCIA', 'PROFESIONALES RUTINA', 'TENS RUTINA', 'AUXILIARES', 'TOMA DE MUESTRA'];

  sheets.forEach(sheetName => {
    const wsData = [];
    wsData.push([`HOSPITAL REGIONAL DE TALCA - LABORATORIO CLÍNICO`]);
    wsData.push([`CALENDARIO DE TURNOS ${year} - ${sheetName}`]);
    wsData.push([]);

    for (let m = 1; m <= 12; m++) {
      const daysInM = new Date(year, m, 0).getDate();
      wsData.push([`TURNOS ${MONTH_NAMES[m-1].toUpperCase()} ${year}`]);

      const headerRow = ['FUNCIONARIO', 'RUT', 'ESTAMENTO', 'JORNADA', 'SECCIÓN'];
      for (let d = 1; d <= daysInM; d++) {
        headerRow.push(d);
      }
      wsData.push(headerRow);

      const dowRow = ['', '', '', '', ''];
      for (let d = 1; d <= daysInM; d++) {
        const dow = new Date(year, m - 1, d).getDay();
        dowRow.push(DAY_LETTERS[dow]);
      }
      wsData.push(dowRow);

      const staffList = getStaffForSheet(sheetName, true);
      staffList.forEach(st => {
        const row = [st.name, st.rut || '', st.estamento || st.role || '', st.jornada || 'Diurno', st.section || ''];
        for (let d = 1; d <= daysInM; d++) {
          const dateStr = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          if (sheetName === 'TOMA DE MUESTRA') {
            const ass = (year === 2026 ? state.tdm2026 : state.tdm2027).find(a => a.staff_id === st.id && a.date === dateStr);
            row.push(ass ? 'X' : '');
          } else {
            const ev = getShiftEvent(st.id, dateStr);
            let val = '';
            if (ev) {
              if (ev.code) val = ev.code;
              else if (ev.event_type === 'VACACIONES') val = 'FL';
              else if (ev.event_type === 'ADMINISTRATIVO') val = 'DA';
              else if (ev.event_type === 'LICENCIA_MEDICA') val = 'LM';
              else if (ev.event_type === 'DEVOLUCION_TIEMPO') val = 'H+6';
              else if (ev.event_type === 'COMISION_SERVICIO') val = '*';
              else if (ev.event_type === 'SIN_GOCE_SUELDO') val = 'PSG';
              else val = ev.event_type || '';
            }
            row.push(val);
          }
        }
        wsData.push(row);
      });

      wsData.push([]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  });

  // Add Dotación & Personal Audit Sheet
  const dotData = [];
  dotData.push(['HOSPITAL REGIONAL DE TALCA - LABORATORIO CLÍNICO']);
  dotData.push([`DOTACIÓN OFICIAL Y ESTADO DE DATOS - AÑO ${year}`]);
  dotData.push([]);
  dotData.push(['FUNCIONARIO', 'RUT', 'ESTAMENTO', 'JORNADA', 'SECCIÓN', 'ESTADO']);
  Object.values(state.staff)
    .sort((a, b) => {
      const ordA = ESTAMENTO_ORDER[a.estamento || a.role || ''] || 99;
      const ordB = ESTAMENTO_ORDER[b.estamento || b.role || ''] || 99;
      if (ordA !== ordB) return ordA - ordB;
      return (a.name || '').localeCompare(b.name || '');
    })
    .forEach(s => {
      const status = (s.missing_fields && s.missing_fields.length > 0) ? ('Pendiente: ' + s.missing_fields.join(', ')) : 'Completo';
      dotData.push([
        s.name,
        s.rut || 'PENDIENTE',
        s.estamento || s.role || '',
        s.jornada || 'Diurno',
        s.section || '',
        status
      ]);
    });
  const wsDot = XLSX.utils.aoa_to_sheet(dotData);
  XLSX.utils.book_append_sheet(wb, wsDot, 'DOTACIÓN Y PERSONAL');

  XLSX.writeFile(wb, `TURNOS_LABORATORIO_HRT_${year}.xlsx`);
}

// ============================================================================
// GESTOR DE ESQUEMAS DE TURNO Y ROTACIONES (4TO TURNO, DIURNO, INTERCAMBIO)
// ============================================================================

let scheduleModalState = {
  activeTab: 'PATTERN',
  staffId: null
};

function openShiftScheduleModal(staffId) {
  scheduleModalState.staffId = staffId || null;
  populateScheduleStaffDropdowns(staffId);

  const year = state.currentYear;
  const month = state.currentMonth;
  const daysInMonth = new Date(year, month, 0).getDate();
  const defaultStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const defaultEnd = `${year}-12-31`;

  const pStart = document.getElementById('sched-pattern-start');
  const pEnd = document.getElementById('sched-pattern-end');
  if (pStart) pStart.value = defaultStart;
  if (pEnd) pEnd.value = defaultEnd;

  const dStart = document.getElementById('sched-diurno-start');
  const dEnd = document.getElementById('sched-diurno-end');
  if (dStart) dStart.value = defaultStart;
  if (dEnd) dEnd.value = defaultEnd;

  const sStart = document.getElementById('sched-swap-start');
  const sEnd = document.getElementById('sched-swap-end');
  if (sStart) sStart.value = defaultStart;
  if (sEnd) sEnd.value = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  switchScheduleTab(scheduleModalState.activeTab || 'PATTERN');
  updateSchedulePreview();
  updateDiurnoPreview();
  updateSwapPreview();

  document.getElementById('modal-shift-schedule').classList.remove('hidden');
  initLucide();
}

function closeShiftScheduleModal() {
  document.getElementById('modal-shift-schedule').classList.add('hidden');
}

function switchScheduleTab(tabId) {
  scheduleModalState.activeTab = tabId;

  const tabs = ['PATTERN', 'DIURNO', 'SWAP'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-sched-${t.toLowerCase()}`);
    const content = document.getElementById(`sched-tab-content-${t.toLowerCase()}`);
    if (t === tabId) {
      if (btn) btn.className = 'px-3 py-2 text-xs font-bold border-b-2 border-sky-600 text-sky-700 flex items-center space-x-1.5 transition whitespace-nowrap';
      if (content) content.classList.remove('hidden');
    } else {
      if (btn) btn.className = 'px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 border-b-2 border-transparent flex items-center space-x-1.5 transition whitespace-nowrap';
      if (content) content.classList.add('hidden');
    }
  });

  const submitLabel = document.getElementById('btn-submit-schedule-label');
  if (submitLabel) {
    if (tabId === 'PATTERN') {
      submitLabel.innerText = '⚡ Aplicar Esquema 4to Turno';
      updateSchedulePreview();
    } else if (tabId === 'DIURNO') {
      submitLabel.innerText = '☀️ Pasar a Jornada Diurna';
      updateDiurnoPreview();
    } else if (tabId === 'SWAP') {
      submitLabel.innerText = '🔄 Intercambiar Rotación';
      updateSwapPreview();
    }
  }
  initLucide();
}

function populateScheduleStaffDropdowns(preselectedId) {
  const staffList = Object.values(state.staff).sort((a, b) => a.name.localeCompare(b.name));
  
  const pSelect = document.getElementById('sched-pattern-staff');
  const dSelect = document.getElementById('sched-diurno-staff');
  const sSelect1 = document.getElementById('sched-swap-staff-1');
  const sSelect2 = document.getElementById('sched-swap-staff-2');

  const populate = (sel) => {
    if (!sel) return;
    sel.innerHTML = '';
    staffList.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      const tag = s.section ? `[${s.section}]` : '';
      const jor = s.jornada === 'Turno' ? '⏰ Turno' : '☀️ Diurno';
      opt.text = `${s.name} ${tag} (${s.estamento || s.role} • ${jor})`;
      sel.appendChild(opt);
    });
  };

  populate(pSelect);
  populate(dSelect);
  populate(sSelect1);
  populate(sSelect2);

  if (preselectedId) {
    if (pSelect) pSelect.value = preselectedId;
    if (dSelect) dSelect.value = preselectedId;
    if (sSelect1) sSelect1.value = preselectedId;
  }
  if (sSelect2 && staffList.length > 1) {
    const other = staffList.find(s => s.id !== (preselectedId || staffList[0].id));
    if (other) sSelect2.value = other.id;
  }
}

function setPatternQuickRange(rangeType) {
  const startInput = document.getElementById('sched-pattern-start');
  const endInput = document.getElementById('sched-pattern-end');
  if (!startInput || !endInput) return;

  const startVal = startInput.value || `${state.currentYear}-01-01`;
  const [y, m, d] = startVal.split('-').map(Number);
  const startDate = new Date(y, m - 1, d);

  let endDate;
  if (rangeType === 'MONTH') {
    endDate = new Date(y, m, 0);
  } else if (rangeType === '3MONTHS') {
    endDate = new Date(y, m - 1 + 3, 0);
  } else if (rangeType === '6MONTHS') {
    endDate = new Date(y, m - 1 + 6, 0);
  } else if (rangeType === 'YEAR') {
    endDate = new Date(y, 11, 31);
  }
  if (endDate) {
    endInput.value = formatDateToISO(endDate);
    updateSchedulePreview();
  }
}

function updateSchedulePreview() {
  const startInput = document.getElementById('sched-pattern-start');
  const endInput = document.getElementById('sched-pattern-end');
  const summaryEl = document.getElementById('sched-preview-summary');
  const pillsEl = document.getElementById('sched-preview-pills');
  const cycleRadios = document.getElementsByName('sched-cycle-start');

  if (!startInput || !endInput || !summaryEl || !pillsEl) return;

  const startStr = startInput.value;
  const endStr = endInput.value;

  if (!startStr || !endStr || startStr > endStr) {
    summaryEl.innerText = 'Rango inválido (Inicio debe ser menor o igual a Término)';
    pillsEl.innerHTML = '';
    return;
  }

  let cycleChoice = 'L';
  for (const r of cycleRadios) {
    if (r.checked) {
      cycleChoice = r.value;
      break;
    }
  }

  const cycleMap = {
    'L': ['L', 'N', null, null],
    'N': ['N', null, null, 'L'],
    'X1': [null, null, 'L', 'N'],
    'X2': [null, 'L', 'N', null]
  };
  const cycle = cycleMap[cycleChoice] || cycleMap['L'];

  const sDate = parseISODate(startStr);
  const eDate = parseISODate(endStr);
  const diffDays = Math.round((eDate - sDate) / 86400000) + 1;

  let countL = 0;
  let countN = 0;
  let countLibre = 0;

  const previewItems = [];
  const maxPreview = Math.min(diffDays, 12);

  for (let i = 0; i < diffDays; i++) {
    const cur = new Date(sDate.getTime() + i * 86400000);
    const code = cycle[i % 4];
    if (code === 'L') countL++;
    else if (code === 'N') countN++;
    else countLibre++;

    if (i < maxPreview) {
      const dayNum = cur.getDate();
      const mNum = cur.getMonth() + 1;
      previewItems.push({
        dateLabel: `${dayNum}/${mNum}`,
        code: code
      });
    }
  }

  summaryEl.innerHTML = `<strong>${diffDays} días:</strong> <span class="text-orange-700">${countL} Largos</span>, <span class="text-slate-800">${countN} Noches</span>, <span class="text-emerald-700">${countLibre} Libres</span>`;

  let pillsHtml = previewItems.map(item => {
    if (item.code === 'L') {
      return `<div class="shrink-0 px-2 py-1 rounded bg-orange-100 border border-orange-300 text-orange-950 font-bold text-center">
        <div class="text-[9px] text-orange-700 font-medium">${item.dateLabel}</div>
        <div>☀️ Largo</div>
      </div>`;
    } else if (item.code === 'N') {
      return `<div class="shrink-0 px-2 py-1 rounded bg-slate-800 border border-slate-900 text-white font-bold text-center">
        <div class="text-[9px] text-slate-300 font-medium">${item.dateLabel}</div>
        <div>🌙 Noche</div>
      </div>`;
    } else {
      return `<div class="shrink-0 px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold text-center">
        <div class="text-[9px] text-emerald-600 font-medium">${item.dateLabel}</div>
        <div>🏖️ Libre</div>
      </div>`;
    }
  }).join('');

  if (diffDays > maxPreview) {
    pillsHtml += `<div class="shrink-0 px-2 py-1 text-slate-400 font-bold self-center">+${diffDays - maxPreview} días más...</div>`;
  }

  pillsEl.innerHTML = pillsHtml;
}

function setDiurnoQuickRange(rangeType) {
  const startInput = document.getElementById('sched-diurno-start');
  const endInput = document.getElementById('sched-diurno-end');
  if (!startInput || !endInput) return;

  const startVal = startInput.value || `${state.currentYear}-01-01`;
  const [y, m, d] = startVal.split('-').map(Number);
  const startDate = new Date(y, m - 1, d);

  let endDate;
  if (rangeType === 'MONTH') {
    endDate = new Date(y, m, 0);
  } else if (rangeType === '3MONTHS') {
    endDate = new Date(y, m - 1 + 3, 0);
  } else if (rangeType === '6MONTHS') {
    endDate = new Date(y, m - 1 + 6, 0);
  } else if (rangeType === 'YEAR') {
    endDate = new Date(y, 11, 31);
  }
  if (endDate) {
    endInput.value = formatDateToISO(endDate);
    updateDiurnoPreview();
  }
}

function updateDiurnoPreview() {
  const staffSelect = document.getElementById('sched-diurno-staff');
  const startInput = document.getElementById('sched-diurno-start');
  const endInput = document.getElementById('sched-diurno-end');
  const fillCheck = document.getElementById('sched-diurno-fill');
  const omitHolidaysCheck = document.getElementById('sched-diurno-omit-holidays');
  const preserveCheck = document.getElementById('sched-diurno-preserve-absences');
  const summaryEl = document.getElementById('sched-diurno-preview-summary');
  const pillsEl = document.getElementById('sched-diurno-preview-pills');

  if (!startInput || !endInput || !summaryEl || !pillsEl) return;

  const startStr = startInput.value;
  const endStr = endInput.value;
  const staffId = staffSelect ? staffSelect.value : null;

  if (!startStr || !endStr || startStr > endStr) {
    summaryEl.innerText = 'Rango inválido (Inicio debe ser menor o igual a Término)';
    pillsEl.innerHTML = '';
    return;
  }

  const fillDiurno = fillCheck ? fillCheck.checked : true;
  const omitHolidays = omitHolidaysCheck ? omitHolidaysCheck.checked : true;
  const preserveAbsences = preserveCheck ? preserveCheck.checked : true;

  const sDate = parseISODate(startStr);
  const eDate = parseISODate(endStr);
  const diffDays = Math.round((eDate - sDate) / 86400000) + 1;

  let countBusinessDays = 0;
  let countWeekends = 0;
  let countHolidays = 0;
  let countAbsences = 0;

  const previewItems = [];
  const maxPreview = Math.min(diffDays, 14);

  for (let i = 0; i < diffDays; i++) {
    const cur = new Date(sDate.getTime() + i * 86400000);
    const dStr = formatDateToISO(cur);
    const curYear = cur.getFullYear();
    const dayOfWeek = cur.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const isHoliday = omitHolidays && (state.holidays && (state.holidays[curYear]?.some(h => h.date === dStr) || state.holidays[dStr]));

    const existing = staffId ? getShiftEvent(staffId, dStr) : null;
    const isAbsence = existing && ['VACACIONES', 'ADMINISTRATIVO', 'LICENCIA_MEDICA', 'DEVOLUCION_TIEMPO', 'COMISION_SERVICIO', 'SIN_GOCE_SUELDO'].includes(existing.event_type);

    if (preserveAbsences && isAbsence) {
      countAbsences++;
      if (i < maxPreview) {
        previewItems.push({
          dateLabel: `${cur.getDate()}/${cur.getMonth() + 1}`,
          type: 'ABSENCE',
          label: existing.code || 'Ausencia',
          desc: existing.event_type
        });
      }
    } else if (isWeekend) {
      countWeekends++;
      if (i < maxPreview) {
        previewItems.push({
          dateLabel: `${cur.getDate()}/${cur.getMonth() + 1}`,
          type: 'WEEKEND',
          label: 'Libre',
          desc: 'Fin de Semana'
        });
      }
    } else if (isHoliday) {
      countHolidays++;
      if (i < maxPreview) {
        previewItems.push({
          dateLabel: `${cur.getDate()}/${cur.getMonth() + 1}`,
          type: 'HOLIDAY',
          label: 'Feriado',
          desc: 'Feriado Legal'
        });
      }
    } else {
      countBusinessDays++;
      if (i < maxPreview) {
        previewItems.push({
          dateLabel: `${cur.getDate()}/${cur.getMonth() + 1}`,
          type: fillDiurno ? 'DIURNO' : 'BLANK',
          label: fillDiurno ? 'D' : 'Hábil',
          desc: '08:00 a 17:00'
        });
      }
    }
  }

  summaryEl.innerHTML = `<strong>${diffDays} días:</strong> <span class="text-sky-700 font-bold">${countBusinessDays} días diurnos</span>, <span class="text-emerald-700">${countWeekends} fines de semana</span>${countHolidays > 0 ? `, <span class="text-rose-600">${countHolidays} feriados</span>` : ''}${countAbsences > 0 ? `, <span class="text-amber-700">${countAbsences} ausencias preservadas</span>` : ''}`;

  let pillsHtml = previewItems.map(item => {
    if (item.type === 'DIURNO') {
      return `<div class="shrink-0 px-2 py-1 rounded bg-sky-100 border border-sky-300 text-sky-950 font-bold text-center">
        <div class="text-[9px] text-sky-700 font-medium">${item.dateLabel}</div>
        <div>☀️ Diurno 'D'</div>
      </div>`;
    } else if (item.type === 'ABSENCE') {
      return `<div class="shrink-0 px-2 py-1 rounded bg-amber-100 border border-amber-300 text-amber-950 font-bold text-center">
        <div class="text-[9px] text-amber-700 font-medium">${item.dateLabel}</div>
        <div>🌴 ${item.label}</div>
      </div>`;
    } else if (item.type === 'HOLIDAY') {
      return `<div class="shrink-0 px-2 py-1 rounded bg-rose-100 border border-rose-300 text-rose-950 font-bold text-center">
        <div class="text-[9px] text-rose-700 font-medium">${item.dateLabel}</div>
        <div>🔴 Feriado</div>
      </div>`;
    } else if (item.type === 'WEEKEND') {
      return `<div class="shrink-0 px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-center">
        <div class="text-[9px] text-slate-500 font-medium">${item.dateLabel}</div>
        <div>🏖️ Libre</div>
      </div>`;
    } else {
      return `<div class="shrink-0 px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-600 font-medium text-center">
        <div class="text-[9px] text-slate-400">${item.dateLabel}</div>
        <div>Hábil</div>
      </div>`;
    }
  }).join('');

  if (diffDays > maxPreview) {
    pillsHtml += `<div class="shrink-0 px-2 py-1 text-slate-400 font-bold self-center">+${diffDays - maxPreview} días más...</div>`;
  }

  pillsEl.innerHTML = pillsHtml;
}

function updateSwapPreview() {
  const staff1Id = document.getElementById('sched-swap-staff-1')?.value;
  const staff2Id = document.getElementById('sched-swap-staff-2')?.value;
  const startStr = document.getElementById('sched-swap-start')?.value;
  const endStr = document.getElementById('sched-swap-end')?.value;
  const summaryEl = document.getElementById('sched-swap-summary-text');
  if (!summaryEl) return;

  if (!staff1Id || !staff2Id || staff1Id === staff2Id) {
    summaryEl.innerHTML = '<span class="text-rose-600 font-bold">Debes seleccionar dos funcionarios distintos para el intercambio.</span>';
    return;
  }
  if (!startStr || !endStr || startStr > endStr) {
    summaryEl.innerHTML = '<span class="text-rose-600 font-bold">Rango de fechas inválido.</span>';
    return;
  }

  const s1 = state.staff[staff1Id];
  const s2 = state.staff[staff2Id];
  if (!s1 || !s2) return;

  const sDate = parseISODate(startStr);
  const eDate = parseISODate(endStr);
  const diffDays = Math.round((eDate - sDate) / 86400000) + 1;

  let s1L = 0, s1N = 0;
  let s2L = 0, s2N = 0;

  for (let i = 0; i < diffDays; i++) {
    const cur = new Date(sDate.getTime() + i * 86400000);
    const dStr = formatDateToISO(cur);
    const r1 = getShiftEvent(staff1Id, dStr);
    const r2 = getShiftEvent(staff2Id, dStr);
    if (r1?.code === 'L') s1L++;
    if (r1?.code === 'N') s1N++;
    if (r2?.code === 'L') s2L++;
    if (r2?.code === 'N') s2N++;
  }

  summaryEl.innerHTML = `
    <div class="space-y-1.5">
      <div>Intercambio durante <strong>${diffDays} días</strong> (del ${startStr} al ${endStr}):</div>
      <div class="bg-white p-2.5 rounded-lg border border-slate-200 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span class="font-bold text-slate-800">${s1.name}:</span>
          <div class="text-[11px] text-slate-600">Tiene actualmente: <strong>${s1L}</strong> Largos, <strong>${s1N}</strong> Noches.</div>
          <div class="text-[11px] text-sky-700 font-semibold">➔ Asumirá los turnos de ${s2.name}</div>
        </div>
        <div>
          <span class="font-bold text-slate-800">${s2.name}:</span>
          <div class="text-[11px] text-slate-600">Tiene actualmente: <strong>${s2L}</strong> Largos, <strong>${s2N}</strong> Noches.</div>
          <div class="text-[11px] text-sky-700 font-semibold">➔ Asumirá los turnos de ${s1.name}</div>
        </div>
      </div>
    </div>
  `;
}

function executeShiftScheduleAction() {
  const tab = scheduleModalState.activeTab;
  if (tab === 'PATTERN') {
    applyPatternSchedule();
  } else if (tab === 'DIURNO') {
    applyDiurnoSchedule();
  } else if (tab === 'SWAP') {
    applySwapSchedule();
  }
}

function applyPatternSchedule() {
  const staffSelect = document.getElementById('sched-pattern-staff');
  const startInput = document.getElementById('sched-pattern-start');
  const endInput = document.getElementById('sched-pattern-end');
  const preserveCheck = document.getElementById('sched-preserve-absences');
  const updateJornadaCheck = document.getElementById('sched-update-jornada-turno');

  const staffId = staffSelect ? staffSelect.value : null;
  const startStr = startInput ? startInput.value : '';
  const endStr = endInput ? endInput.value : '';
  const preserveAbsences = preserveCheck ? preserveCheck.checked : true;
  const updateJornada = updateJornadaCheck ? updateJornadaCheck.checked : true;

  if (!staffId || !state.staff[staffId]) {
    alert('Por favor selecciona un funcionario.');
    return;
  }
  if (!startStr || !endStr || startStr > endStr) {
    alert('Por favor especifica un rango de fechas válido.');
    return;
  }

  const member = state.staff[staffId];

  let cycleChoice = 'L';
  const cycleRadios = document.getElementsByName('sched-cycle-start');
  for (const r of cycleRadios) {
    if (r.checked) {
      cycleChoice = r.value;
      break;
    }
  }

  const cycleMap = {
    'L': ['L', 'N', null, null],
    'N': ['N', null, null, 'L'],
    'X1': [null, null, 'L', 'N'],
    'X2': [null, 'L', 'N', null]
  };
  const cycle = cycleMap[cycleChoice] || cycleMap['L'];

  const sDate = parseISODate(startStr);
  const eDate = parseISODate(endStr);
  const diffDays = Math.round((eDate - sDate) / 86400000) + 1;

  let assignedCount = 0;

  for (let i = 0; i < diffDays; i++) {
    const cur = new Date(sDate.getTime() + i * 86400000);
    const dateStr = formatDateToISO(cur);
    const curYear = cur.getFullYear();
    const curMonth = cur.getMonth() + 1;
    const curDay = cur.getDate();

    const targetList = (curYear === 2026) ? state.turns2026 : state.turns2027;
    const existing = getShiftEvent(staffId, dateStr);

    const isAbsence = existing && ['VACACIONES', 'ADMINISTRATIVO', 'LICENCIA_MEDICA', 'DEVOLUCION_TIEMPO', 'COMISION_SERVICIO', 'SIN_GOCE_SUELDO'].includes(existing.event_type);

    if (preserveAbsences && isAbsence) {
      continue;
    }

    const patternCode = cycle[i % 4];

    // Remove any existing record for this staff and date
    const idx = targetList.findIndex(t => t.staff_id === staffId && t.date === dateStr);
    if (idx !== -1) {
      targetList.splice(idx, 1);
    }

    if (patternCode === 'L' || patternCode === 'N') {
      targetList.push({
        date: dateStr,
        month: curMonth,
        day: curDay,
        staff_id: staffId,
        staff_name: member.name,
        role: member.role || 'Profesional',
        section: member.section || 'ALU',
        sheet: 'LAB. URGENCIA',
        code: patternCode,
        event_type: 'TURNO',
        time_slot: '',
        color_tag: null
      });
      assignedCount++;
    }
  }

  if (updateJornada) {
    member.jornada = 'Turno';
    localStorage.setItem('hrt_staff_directory', JSON.stringify(state.staff));
  }

  localStorage.setItem('hrt_turns_2026', JSON.stringify(state.turns2026));
  localStorage.setItem('hrt_turns_2027', JSON.stringify(state.turns2027));

  rebuildTurnsMap();
  renderApp();
  closeShiftScheduleModal();

  alert(`¡Esquema de 4to Turno asignado con éxito a ${member.name}!\nPeríodo: ${startStr} al ${endStr}\nSe programaron ${assignedCount} turnos operativos (Largos y Noches).`);
}

function applyDiurnoSchedule() {
  const staffSelect = document.getElementById('sched-diurno-staff');
  const startInput = document.getElementById('sched-diurno-start');
  const endInput = document.getElementById('sched-diurno-end');
  const fillCheck = document.getElementById('sched-diurno-fill');
  const omitHolidaysCheck = document.getElementById('sched-diurno-omit-holidays');
  const preserveCheck = document.getElementById('sched-diurno-preserve-absences');
  const updateJornadaCheck = document.getElementById('sched-update-jornada-diurno');

  const staffId = staffSelect ? staffSelect.value : null;
  const startStr = startInput ? startInput.value : '';
  const endStr = endInput ? endInput.value : '';
  const fillDiurno = fillCheck ? fillCheck.checked : true;
  const omitHolidays = omitHolidaysCheck ? omitHolidaysCheck.checked : true;
  const preserveAbsences = preserveCheck ? preserveCheck.checked : true;
  const updateJornada = updateJornadaCheck ? updateJornadaCheck.checked : true;

  if (!staffId || !state.staff[staffId]) {
    alert('Por favor selecciona un funcionario.');
    return;
  }
  if (!startStr || !endStr || startStr > endStr) {
    alert('Por favor especifica un rango de fechas válido.');
    return;
  }

  const member = state.staff[staffId];
  const sDate = parseISODate(startStr);
  const eDate = parseISODate(endStr);
  const diffDays = Math.round((eDate - sDate) / 86400000) + 1;

  let removedCount = 0;
  let assignedDiurnoCount = 0;

  for (let i = 0; i < diffDays; i++) {
    const cur = new Date(sDate.getTime() + i * 86400000);
    const dateStr = formatDateToISO(cur);
    const curYear = cur.getFullYear();
    const curMonth = cur.getMonth() + 1;
    const curDay = cur.getDate();
    const dayOfWeek = cur.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const isHoliday = omitHolidays && (state.holidays && (state.holidays[curYear]?.some(h => h.date === dateStr) || state.holidays[dateStr]));

    const targetList = (curYear === 2026) ? state.turns2026 : state.turns2027;
    const existing = getShiftEvent(staffId, dateStr);

    const isAbsence = existing && ['VACACIONES', 'ADMINISTRATIVO', 'LICENCIA_MEDICA', 'DEVOLUCION_TIEMPO', 'COMISION_SERVICIO', 'SIN_GOCE_SUELDO'].includes(existing.event_type);

    if (preserveAbsences && isAbsence) {
      continue;
    }

    // Remove any existing operational turn for this date
    const idx = targetList.findIndex(t => t.staff_id === staffId && t.date === dateStr);
    if (idx !== -1) {
      targetList.splice(idx, 1);
      removedCount++;
    }

    // Fill Monday to Friday with normal daytime shift 'D'
    if (fillDiurno && !isWeekend && !isHoliday) {
      targetList.push({
        date: dateStr,
        month: curMonth,
        day: curDay,
        staff_id: staffId,
        staff_name: member.name,
        role: member.role || 'Profesional',
        section: member.section || 'ALU',
        sheet: member.section === 'ALU' ? 'LAB. URGENCIA' : (member.estamento === 'TENS' ? 'TENS RUTINA' : 'PROFESIONALES RUTINA'),
        code: 'D',
        event_type: 'TURNO',
        time_slot: '08:00-17:00',
        color_tag: null
      });
      assignedDiurnoCount++;
    }
  }

  if (updateJornada) {
    member.jornada = 'Diurno';
    localStorage.setItem('hrt_staff_directory', JSON.stringify(state.staff));
  }

  localStorage.setItem('hrt_turns_2026', JSON.stringify(state.turns2026));
  localStorage.setItem('hrt_turns_2027', JSON.stringify(state.turns2027));

  rebuildTurnsMap();
  renderApp();
  closeShiftScheduleModal();

  alert(`¡Traspaso a Jornada Diurna completado para ${member.name}!\nPeríodo: ${startStr} al ${endStr}\nSe eliminaron ${removedCount} turnos rotativos previos y se programaron ${assignedDiurnoCount} turnos ordinarios ('D') de lunes a viernes (fines de semana y feriados libres).`);
}

function applySwapSchedule() {
  const staff1Select = document.getElementById('sched-swap-staff-1');
  const staff2Select = document.getElementById('sched-swap-staff-2');
  const startInput = document.getElementById('sched-swap-start');
  const endInput = document.getElementById('sched-swap-end');
  const includeAbsencesCheck = document.getElementById('sched-swap-include-absences');

  const staff1Id = staff1Select ? staff1Select.value : null;
  const staff2Id = staff2Select ? staff2Select.value : null;
  const startStr = startInput ? startInput.value : '';
  const endStr = endInput ? endInput.value : '';
  const swapAbsences = includeAbsencesCheck ? includeAbsencesCheck.checked : false;

  if (!staff1Id || !staff2Id || staff1Id === staff2Id) {
    alert('Debes seleccionar dos funcionarios diferentes para intercambiar.');
    return;
  }
  if (!startStr || !endStr || startStr > endStr) {
    alert('Por favor especifica un rango de fechas válido.');
    return;
  }

  const s1 = state.staff[staff1Id];
  const s2 = state.staff[staff2Id];

  const sDate = parseISODate(startStr);
  const eDate = parseISODate(endStr);
  const diffDays = Math.round((eDate - sDate) / 86400000) + 1;

  let swappedDays = 0;

  for (let i = 0; i < diffDays; i++) {
    const cur = new Date(sDate.getTime() + i * 86400000);
    const dateStr = formatDateToISO(cur);
    const curYear = cur.getFullYear();
    const curMonth = cur.getMonth() + 1;
    const curDay = cur.getDate();

    const targetList = (curYear === 2026) ? state.turns2026 : state.turns2027;

    const r1 = getShiftEvent(staff1Id, dateStr);
    const r2 = getShiftEvent(staff2Id, dateStr);

    const isAbsence1 = r1 && ['VACACIONES', 'ADMINISTRATIVO', 'LICENCIA_MEDICA', 'DEVOLUCION_TIEMPO', 'COMISION_SERVICIO', 'SIN_GOCE_SUELDO'].includes(r1.event_type);
    const isAbsence2 = r2 && ['VACACIONES', 'ADMINISTRATIVO', 'LICENCIA_MEDICA', 'DEVOLUCION_TIEMPO', 'COMISION_SERVICIO', 'SIN_GOCE_SUELDO'].includes(r2.event_type);

    if (!swapAbsences) {
      const opCode1 = (r1 && !isAbsence1) ? r1.code : null;
      const opCode2 = (r2 && !isAbsence2) ? r2.code : null;

      // Update staff 1 (receives operational shift from staff 2):
      if (!isAbsence1) {
        const idx1 = targetList.findIndex(t => t.staff_id === staff1Id && t.date === dateStr);
        if (idx1 !== -1) targetList.splice(idx1, 1);
        if (opCode2) {
          targetList.push({
            date: dateStr,
            month: curMonth,
            day: curDay,
            staff_id: staff1Id,
            staff_name: s1.name,
            role: s1.role || 'Profesional',
            section: s1.section || 'ALU',
            sheet: (r2 && r2.sheet) || (s1.section === 'ALU' ? 'LAB. URGENCIA' : 'PROFESIONALES RUTINA'),
            code: opCode2,
            event_type: 'TURNO',
            time_slot: (r2 && r2.time_slot) || '',
            color_tag: null
          });
        }
      }

      // Update staff 2 (receives operational shift from staff 1):
      if (!isAbsence2) {
        const idx2 = targetList.findIndex(t => t.staff_id === staff2Id && t.date === dateStr);
        if (idx2 !== -1) targetList.splice(idx2, 1);
        if (opCode1) {
          targetList.push({
            date: dateStr,
            month: curMonth,
            day: curDay,
            staff_id: staff2Id,
            staff_name: s2.name,
            role: s2.role || 'Profesional',
            section: s2.section || 'ALU',
            sheet: (r1 && r1.sheet) || (s2.section === 'ALU' ? 'LAB. URGENCIA' : 'PROFESIONALES RUTINA'),
            code: opCode1,
            event_type: 'TURNO',
            time_slot: (r1 && r1.time_slot) || '',
            color_tag: null
          });
        }
      }
    } else {
      const idx1 = targetList.findIndex(t => t.staff_id === staff1Id && t.date === dateStr);
      const clone1 = idx1 !== -1 ? { ...targetList[idx1] } : null;
      if (idx1 !== -1) targetList.splice(idx1, 1);

      const idx2 = targetList.findIndex(t => t.staff_id === staff2Id && t.date === dateStr);
      const clone2 = idx2 !== -1 ? { ...targetList[idx2] } : null;
      if (idx2 !== -1) targetList.splice(idx2, 1);

      if (clone2) {
        clone2.staff_id = staff1Id;
        clone2.staff_name = s1.name;
        targetList.push(clone2);
      }
      if (clone1) {
        clone1.staff_id = staff2Id;
        clone1.staff_name = s2.name;
        targetList.push(clone1);
      }
    }

    swappedDays++;
  }

  localStorage.setItem('hrt_turns_2026', JSON.stringify(state.turns2026));
  localStorage.setItem('hrt_turns_2027', JSON.stringify(state.turns2027));

  rebuildTurnsMap();
  renderApp();
  closeShiftScheduleModal();

  alert(`¡Intercambio de rotación realizado con éxito entre ${s1.name} y ${s2.name}!\nPeríodo: ${startStr} al ${endStr} (${swappedDays} días procesados).`);
}
