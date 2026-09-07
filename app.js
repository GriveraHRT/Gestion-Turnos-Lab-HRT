/**
 * Sistema de Gestión de Turnos y Calendario - Laboratorio Clínico HRT
 * Hospital Regional de Talca - Versión 2027
 */

const DATA_VERSION = '2.2';

let state = {
  currentYear: 2027,
  currentMonth: 1,
  activeTab: 'LAB. URGENCIA',
  searchQuery: '',
  roleFilter: 'ALL',
  selectedCell: null,
  selectedTDMDate: '2027-01-04',
  staff: {},
  turns2026: [],
  tdm2026: [],
  turns2027: [],
  tdm2027: [],
  holidays: {},
  _turnsMap: null,
  _turnsMapYear: null
};

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
  initLucide();
  renderApp();
});

function initLucide() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function rebuildTurnsMap() {
  const records = state.currentYear === 2026 ? state.turns2026 : state.turns2027;
  state._turnsMap = {};
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    state._turnsMap[r.staff_id + '_' + r.date] = r;
  }
  state._turnsMapYear = state.currentYear;
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

  document.getElementById('btn-year-2026').className = year === 2026 
    ? 'px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 bg-sky-500 text-white shadow-sm'
    : 'px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 bg-slate-700 text-slate-300 hover:text-white';
  
  document.getElementById('btn-year-2027').className = year === 2027
    ? 'px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 bg-sky-500 text-white shadow-sm'
    : 'px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 bg-slate-700 text-slate-300 hover:text-white';

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
      btn.className = 'tab-btn active px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 whitespace-nowrap bg-sky-100 text-sky-800 border border-sky-300 shadow-xs';
    } else {
      btn.className = 'tab-btn px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 whitespace-nowrap text-slate-600 hover:bg-slate-100';
    }
  });

  document.getElementById('view-matrix').classList.toggle('hidden', normTab === 'TOMA DE MUESTRA' || normTab === 'DIRECTORIO' || normTab === 'METRICAS');
  document.getElementById('view-tdm').classList.toggle('hidden', normTab !== 'TOMA DE MUESTRA');
  document.getElementById('view-directorio').classList.toggle('hidden', normTab !== 'DIRECTORIO');
  document.getElementById('view-metricas').classList.toggle('hidden', normTab !== 'METRICAS');

  renderApp();
}

function applyFilters() {
  state.searchQuery = document.getElementById('input-search').value.toLowerCase().trim();
  state.roleFilter = document.getElementById('select-role-filter').value;
  renderApp();
}

function renderApp() {
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
    tableBody.innerHTML = `<tr><td colspan="${daysInMonth + 2}" class="p-8 text-center text-slate-400 text-xs">No se encontraron funcionarios para este criterio de búsqueda.</td></tr>`;
    return;
  }

  let lastGroup = null;
  activeStaff.forEach((member, index) => {
    const currentGroup = member.section || member.role;
    if (currentGroup && currentGroup !== lastGroup && (state.activeTab === 'PROFESIONALES RUTINA' || state.activeTab === 'LAB. URGENCIA')) {
      lastGroup = currentGroup;
      const groupRow = document.createElement('tr');
      groupRow.className = 'bg-slate-100/90 font-bold text-slate-700 text-xs tracking-wider uppercase';
      groupRow.innerHTML = `
        <td class="sticky-col-body bg-slate-200/90 font-extrabold text-slate-800 py-1.5 px-3 border-r border-slate-300" colspan="2">
          ${currentGroup}
        </td>
        <td colspan="${daysInMonth}" class="bg-slate-100/70 border-b border-slate-200"></td>
      `;
      tableBody.appendChild(groupRow);
    }

    const row = document.createElement('tr');
    row.className = index % 2 === 0 ? 'bg-white hover:bg-slate-50/80 transition' : 'bg-slate-50/50 hover:bg-slate-50/80 transition';

    let nameBadges = '';
    if (member.is_intern) nameBadges += '<span class="ml-1 px-1.5 py-0.2 text-[9px] bg-purple-100 text-purple-700 rounded font-semibold">Interno</span>';
    if (member.is_replacement) nameBadges += '<span class="ml-1 px-1.5 py-0.2 text-[9px] bg-amber-100 text-amber-700 rounded font-semibold">Reemplazo</span>';
    if (member.missing_fields && member.missing_fields.length > 0) {
      nameBadges += '<span class="ml-1 px-1.5 py-0.2 text-[9px] bg-yellow-100 text-yellow-800 rounded cursor-pointer" title="Datos pendientes: ' + member.missing_fields.join(', ') + '">⚠️</span>';
    }

    const rutDisplay = member.rut || '<span class="text-slate-400 italic">Sin RUT</span>';

    let rowHtml = `
      <td class="sticky-col-body font-semibold text-slate-900 border-r border-slate-200">
        <div class="truncate text-xs cursor-pointer hover:text-sky-600" onclick="openStaffModal('${member.id}')" title="Editar funcionario">${member.name} ${nameBadges}</div>
        <div class="text-[10px] text-slate-400 font-normal leading-tight">${member.section || member.role}</div>
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
          cellClass += ' bg-orange-400 text-white';
          cellTitle += ' | Licencia Médica';
          if (!cellText) cellText = 'LM';
        } else if (evType === 'SIN_GOCE_SUELDO') {
          cellClass += ' event-sin_goce_sueldo';
          cellTitle += ' | Permiso sin goce de sueldo';
        } else if (evType === 'PERMISO_TARDE') {
          cellClass += ' event-permiso_tarde';
          cellTitle += ' | Permiso Tarde';
        } else if (cellText === 'L') {
          cellClass += ' event-largo';
          cellTitle += ' | Turno Largo (08:00 a 20:00)';
        } else if (cellText === 'N') {
          cellClass += ' event-noche';
          cellTitle += ' | Turno Noche (20:00 a 08:00)';
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

function getStaffForSheet(sheetName) {
  let list = Object.values(state.staff);

  if (state.searchQuery) {
    list = list.filter(m => 
      m.name.toLowerCase().includes(state.searchQuery) ||
      (m.rut && m.rut.toLowerCase().includes(state.searchQuery)) ||
      (m.section && m.section.toLowerCase().includes(state.searchQuery))
    );
  }

  if (state.roleFilter !== 'ALL') {
    list = list.filter(m => m.role === state.roleFilter);
  }

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

function renderDirectorioView() {
  const tbody = document.getElementById('directorio-table-body');
  const statsCards = document.getElementById('directorio-stats-cards');
  if (!tbody || !statsCards) return;

  const staffList = Object.values(state.staff);
  const total = staffList.length;
  const profesionales = staffList.filter(s => s.role === 'Profesional').length;
  const tens = staffList.filter(s => s.role === 'TENS').length;
  const auxiliares = staffList.filter(s => s.role === 'Auxiliar').length;
  const missingData = staffList.filter(s => s.missing_fields && s.missing_fields.length > 0).length;

  statsCards.innerHTML = `
    <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
      <div class="text-[11px] font-semibold text-slate-500">Dotación Total</div>
      <div class="text-xl font-bold text-slate-800">${total}</div>
    </div>
    <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
      <div class="text-[11px] font-semibold text-blue-600">Profesionales</div>
      <div class="text-xl font-bold text-blue-900">${profesionales}</div>
    </div>
    <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
      <div class="text-[11px] font-semibold text-cyan-600">TENS</div>
      <div class="text-xl font-bold text-cyan-900">${tens}</div>
    </div>
    <div class="bg-white p-3 rounded-xl border border-amber-200 bg-amber-50/50 shadow-2xs">
      <div class="text-[11px] font-semibold text-amber-700">RUT / Datos Pendientes</div>
      <div class="text-xl font-bold text-amber-900">${missingData}</div>
    </div>
  `;

  tbody.innerHTML = '';
  staffList.sort((a, b) => a.name.localeCompare(b.name)).forEach(member => {
    let statusBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">Completo</span>`;
    if (member.missing_fields && member.missing_fields.length > 0) {
      statusBadge = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">⚠️ ${member.missing_fields.join(', ')}</span>`;
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
      <td class="px-4 py-3">
        <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">${member.role}</span>
      </td>
      <td class="px-4 py-3 text-slate-600">
        ${member.section || '-'}
      </td>
      <td class="px-4 py-3 text-slate-500 text-[10px]">
        ${(member.sheets || []).join(', ')}
      </td>
      <td class="px-4 py-3">
        ${statusBadge}
      </td>
      <td class="px-4 py-3 text-right">
        <button onclick="openStaffModal('${member.id}')" class="text-sky-600 hover:text-sky-800 font-bold text-xs flex items-center justify-end space-x-1 ml-auto">
          <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
          <span>Editar</span>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
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
        <td class="px-3 py-2 text-slate-500">${item.staff.role}</td>
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

  state.selectedCell = {
    staffId: staffId,
    date: dateStr,
    code: currentCode,
    eventType: currentEventType || 'TURNO',
    sheet: state.activeTab
  };

  document.getElementById('modal-shift-title').innerText = `${member.name}`;
  document.getElementById('modal-shift-subtitle').innerText = `Fecha: ${dateStr} (${member.section || member.role})`;
  document.getElementById('modal-custom-code').value = currentCode || '';

  document.getElementById('modal-shift-picker').classList.remove('hidden');
  initLucide();
}

function closeShiftModal() {
  document.getElementById('modal-shift-picker').classList.add('hidden');
  state.selectedCell = null;
}

function selectEventType(eventType, defaultCode) {
  if (!state.selectedCell) return;
  state.selectedCell.eventType = eventType;
  state.selectedCell.code = defaultCode;
  document.getElementById('modal-custom-code').value = defaultCode;
}

function clearCurrentDayShift() {
  if (!state.selectedCell) return;
  const targetList = state.currentYear === 2026 ? state.turns2026 : state.turns2027;
  const idx = targetList.findIndex(t => t.staff_id === state.selectedCell.staffId && t.date === state.selectedCell.date);
  if (idx !== -1) {
    targetList.splice(idx, 1);
  }
  rebuildTurnsMap();
  closeShiftModal();
  saveChangesToStorage();
  renderApp();
}

function saveShiftModal() {
  if (!state.selectedCell) return;
  const customCode = document.getElementById('modal-custom-code').value.trim();
  const targetList = state.currentYear === 2026 ? state.turns2026 : state.turns2027;
  
  const member = state.staff[state.selectedCell.staffId];
  const dateParts = state.selectedCell.date.split('-');

  const existing = targetList.find(t => t.staff_id === state.selectedCell.staffId && t.date === state.selectedCell.date);
  if (existing) {
    existing.code = customCode;
    existing.event_type = state.selectedCell.eventType;
  } else {
    targetList.push({
      date: state.selectedCell.date,
      month: parseInt(dateParts[1]),
      day: parseInt(dateParts[2]),
      staff_id: member.id,
      staff_name: member.name,
      role: member.role,
      section: member.section,
      sheet: state.activeTab,
      code: customCode,
      event_type: state.selectedCell.eventType
    });
  }

  rebuildTurnsMap();
  closeShiftModal();
  saveChangesToStorage();
  renderApp();
}

function openStaffModal(staffId) {
  const member = state.staff[staffId];
  if (!member) return;

  document.getElementById('staff-edit-id').value = member.id;
  document.getElementById('staff-edit-name').value = member.name;
  document.getElementById('staff-edit-rut').value = member.rut || '';
  document.getElementById('staff-edit-role').value = member.role || 'Profesional';
  document.getElementById('staff-edit-section').value = member.section || '';
  document.getElementById('modal-staff-title').innerText = `Editar Funcionario: ${member.name}`;

  document.getElementById('modal-staff-editor').classList.remove('hidden');
  initLucide();
}

function openNewStaffModal() {
  const newId = 'funcionario_' + Date.now();
  document.getElementById('staff-edit-id').value = newId;
  document.getElementById('staff-edit-name').value = '';
  document.getElementById('staff-edit-rut').value = '';
  document.getElementById('staff-edit-role').value = 'Profesional';
  document.getElementById('staff-edit-section').value = state.activeTab === 'LAB. URGENCIA' ? 'Urgencia' : 'Rutina';
  document.getElementById('modal-staff-title').innerText = 'Nuevo Funcionario';

  document.getElementById('modal-staff-editor').classList.remove('hidden');
  initLucide();
}

function closeStaffModal() {
  document.getElementById('modal-staff-editor').classList.add('hidden');
}

function saveStaffModal() {
  const id = document.getElementById('staff-edit-id').value;
  const name = document.getElementById('staff-edit-name').value.trim();
  const rut = document.getElementById('staff-edit-rut').value.trim();
  const role = document.getElementById('staff-edit-role').value;
  const section = document.getElementById('staff-edit-section').value.trim();

  if (!name) {
    alert('Por favor introduce el nombre del funcionario.');
    return;
  }

  const missing = [];
  if (!rut) missing.push('RUT pendiente');
  if (name.split(' ').length < 2) missing.push('Segundo apellido pendiente');

  state.staff[id] = {
    id: id,
    name: name,
    official_name: name,
    rut: rut,
    role: role,
    section: section,
    sheets: state.staff[id] ? state.staff[id].sheets : [state.activeTab],
    missing_fields: missing,
    is_intern: role === 'Interno TM',
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
    localStorage.setItem('hrt_turns_2027', JSON.stringify(state.turns2027));
    localStorage.setItem('hrt_tdm_2027', JSON.stringify(state.tdm2027));
  } catch(e) {
    console.error('Error saving to localStorage:', e);
  }
}

function clone2026to2027() {
  if (!confirm('¿Deseas inicializar la plantilla 2027 con la dotación actualizada de funcionarios para comenzar la nueva planificación?')) return;
  state.turns2027 = [];
  state.tdm2027 = [];
  rebuildTurnsMap();
  saveChangesToStorage();
  setYear(2027);
  alert('¡Plantilla 2027 lista para comenzar a programar turnos y ausentismos!');
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
  const sheets = ['LAB. URGENCIA', 'PROFESIONALES RUTINA', 'TENS RUTINA', 'AUXILIARES', 'TOMA DE MUESTRA'];

  sheets.forEach(sheetName => {
    const wsData = [];
    wsData.push([`HOSPITAL REGIONAL DE TALCA - LABORATORIO CLÍNICO`]);
    wsData.push([`CALENDARIO DE TURNOS ${year} - ${sheetName}`]);
    wsData.push([]);

    for (let m = 1; m <= 12; m++) {
      const daysInM = new Date(year, m, 0).getDate();
      wsData.push([`TURNOS ${MONTH_NAMES[m-1].toUpperCase()} ${year}`]);

      const headerRow = ['FUNCIONARIO', 'RUT', 'ESTAMENTO', 'SECCIÓN'];
      for (let d = 1; d <= daysInM; d++) {
        headerRow.push(d);
      }
      wsData.push(headerRow);

      const dowRow = ['', '', '', ''];
      for (let d = 1; d <= daysInM; d++) {
        const dow = new Date(year, m - 1, d).getDay();
        dowRow.push(DAY_LETTERS[dow]);
      }
      wsData.push(dowRow);

      const staffList = getStaffForSheet(sheetName);
      staffList.forEach(st => {
        const row = [st.name, st.rut || '', st.role, st.section || ''];
        for (let d = 1; d <= daysInM; d++) {
          const dateStr = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          if (sheetName === 'TOMA DE MUESTRA') {
            const ass = (year === 2026 ? state.tdm2026 : state.tdm2027).find(a => a.staff_id === st.id && a.date === dateStr);
            row.push(ass ? 'X' : '');
          } else {
            const ev = getShiftEvent(st.id, dateStr);
            row.push(ev ? (ev.code || ev.event_type || '') : '');
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
  dotData.push(['FUNCIONARIO', 'RUT', 'ESTAMENTO', 'SECCIÓN', 'PESTAÑAS EN PLANILLA', 'ESTADO']);
  Object.values(state.staff)
    .sort((a, b) => (a.role || '').localeCompare(b.role || '') || a.name.localeCompare(b.name))
    .forEach(s => {
      const status = (s.missing_fields && s.missing_fields.length > 0) ? ('Pendiente: ' + s.missing_fields.join(', ')) : 'Completo';
      dotData.push([
        s.name,
        s.rut || 'PENDIENTE',
        s.role || '',
        s.section || '',
        (s.sheets || []).join(', '),
        status
      ]);
    });
  const wsDot = XLSX.utils.aoa_to_sheet(dotData);
  XLSX.utils.book_append_sheet(wb, wsDot, 'DOTACIÓN Y PERSONAL');

  XLSX.writeFile(wb, `TURNOS_LABORATORIO_HRT_${year}.xlsx`);
}
