import json
import subprocess

def test_data_bundle():
    print("1. Testing data bundle, staff master, and October 2026 updates...")
    with open('data/staff_master.json', encoding='utf-8') as f:
        db = json.load(f)

    assert len(db) == 101, f"Expected 101 unified staff from updated Oct 2026 sheet, got {len(db)}"
    assert 'katalina_tdm' not in db, "katalina_tdm should be merged into katalina_barrera"
    assert 'reemplazo_ignacio' not in db, "reemplazo_ignacio should be merged into ignacio_brunel"
    assert 'TOMA DE MUESTRA' in db['katalina_barrera']['sheets'], "katalina_barrera should include TOMA DE MUESTRA sheet"
    assert 'PROFESIONALES RUTINA' in db['katalina_barrera']['sheets'], "katalina_barrera should include PROFESIONALES RUTINA sheet"
    assert 'LAB. URGENCIA' in db['ignacio_brunel']['sheets'] and 'PROFESIONALES RUTINA' in db['ignacio_brunel']['sheets'], "ignacio_brunel should include both Urgencia and Profesionales Rutina"

    with open('data/data_bundle.js', encoding='utf-8') as f:
        raw = f.read()
    prefix = "window.TURNOS_INITIAL_DATA = "
    assert raw.startswith(prefix), "data_bundle.js does not start with expected prefix"
    json_str = raw[len(prefix):].strip().rstrip(';')
    bundle = json.loads(json_str)

    staff = bundle['staff']
    turns = bundle['turns_2026']
    tdm = bundle['tdm_2026']

    assert len(staff) == len(db)
    assert len(turns) > 8000, f"Expected > 8000 turns, got {len(turns)}"
    assert len(tdm) > 1250, f"Expected > 1250 TDM assignments, got {len(tdm)}"

    # Official section codes validation
    valid_sections = {'ALU', 'AH', 'AIC', 'AMB', 'APA', 'ADM', 'ATE', 'Auxiliares'}
    for sid, s in staff.items():
        sec = s.get('section')
        assert sec in valid_sections, f"Invalid section '{sec}' for staff {sid} ({s.get('name')})"

    # Diego Rojas Verdugo & Alejandra Vorphal -> ATE
    assert db['diego_rojas_verdugo']['section'] == 'ATE'
    assert db['maria_alejandra_vorphal_vasquez']['section'] == 'ATE'

    # Hematología -> AH
    for sid in ['consuelo_cerda_wehinger', 'juan_cerpa_castillo', 'marcela_salgado_carreno', 'miryam_espina_herrera', 'romina_diaz_espinoza', 'patricia_morales_rojas']:
        assert db[sid]['section'] == 'AH', f"{sid} should be AH, got {db[sid]['section']}"

    # Inmunoquímica -> AIC
    for sid in ['camila_gutierrez', 'camila_reyes_vivero', 'carolina_arancibia_jara', 'daniel_schulz', 'loreto_diaz_rios', 'teresa_fuentes_munoz']:
        assert db[sid]['section'] == 'AIC', f"{sid} should be AIC, got {db[sid]['section']}"

    # Microbiología -> AMB
    for sid in ['barbara_fuenzalida_ibanez', 'cristian_andrade', 'daniel_calderon_calderon', 'francisco_sepulveda', 'katalina_barrera', 'melissa_canales_mejias', 'nicole_hernandez_norambuena']:
        assert db[sid]['section'] == 'AMB', f"{sid} should be AMB, got {db[sid]['section']}"

    # All TENS -> APA
    tens_staff = [s for s in staff.values() if s['role'] == 'TENS']
    assert len(tens_staff) >= 24
    for t in tens_staff:
        assert t['section'] == 'APA', f"TENS {t['name']} has section {t['section']}, expected APA"

    # Jimena Gonzalez -> Administrativo / ADM
    jg = staff.get('jimena_gonzalez')
    assert jg is not None and jg['role'] == 'Administrativo' and jg['estamento'] == 'Administrativo' and jg['section'] == 'ADM'

    # Susana Santos vs Susana Sepulveda distinct official identities
    assert staff['susana_santos']['rut'] == '18.474.372-8'
    assert staff['susana_santos']['official_name'] == 'SUSANA FRANCISCA SANTOS SEPULVEDA'
    assert staff['susana_sepulveda']['rut'] == '10.892.073-4'
    assert staff['susana_sepulveda']['official_name'] == 'SUSANA EUGENIA SEPULVEDA VILLANUEVA'

    # Teresa Fuentes Muñoz
    tf = staff.get('teresa_fuentes_munoz')
    assert tf is not None and tf['rut'] == '20.367.852-5' and not tf['needs_completion']

    # Brayans Saavedra (new Oct/Nov TDM induction)
    bs = staff.get('brayans_saavedra')
    assert bs is not None and bs['section'] == 'APA' and 'TOMA DE MUESTRA' in bs['sheets']

    # Corrected official RUTs (no misaligned Excel row swaps)
    assert staff['daniela_castillo']['rut'] == '17.171.464-8'
    assert staff['olivia_belen_rosales']['rut'] == '18.981.532-8'
    assert staff['ociel_beltran']['rut'] == '18.543.174-6'
    assert staff['valentino_becerra']['rut'] == '18.905.196-4'
    assert staff['javier_malpica']['rut'] == '25.649.865-0'
    assert staff['elieser_valdebenito']['rut'] == '17.824.539-2'
    assert staff['sergio_rojo']['rut'] == '17.845.030-1'

    # October 2026 Auxiliares & TDM data from updated Google Sheet
    oct_aux = [t for t in turns if t['sheet'] == 'AUXILIARES' and t['date'].startswith('2026-10-')]
    assert len(oct_aux) > 0, "Expected October 2026 Auxiliares shifts"
    oct_tdm = [t for t in tdm if t['date'].startswith('2026-10-')]
    assert len(oct_tdm) > 100, f"Expected > 100 October 2026 TDM assignments, got {len(oct_tdm)}"

    # Vacaciones (FL) vs Licencia Médica (LM)
    vac_records = [t for t in turns if t['event_type'] == 'VACACIONES']
    lm_records = [t for t in turns if t['event_type'] == 'LICENCIA_MEDICA']
    assert len(vac_records) > 200
    assert len(lm_records) > 1000
    for sid in ['camila_reyes_vivero', 'consuelo_cerda_wehinger', 'katalina_barrera', 'sergio_rojo', 'valeria_montes']:
        staff_turns = [t for t in turns if t['staff_id'] == sid]
        lm_count = sum(1 for t in staff_turns if t['event_type'] == 'LICENCIA_MEDICA')
        vac_count = sum(1 for t in staff_turns if t['event_type'] == 'VACACIONES')
        assert lm_count > 0, f"{sid} should have LICENCIA_MEDICA records"
        assert vac_count == 0, f"{sid} should have 0 VACACIONES records"

    # Extensión Horaria E+(N) vs Horas por Turno Extra H+(N) vs Día Compensatorio (DC) vs A Devolución de Tiempo
    ext_records = [t for t in turns if t['event_type'] == 'EXTENSION_HORARIA']
    hex_records = [t for t in turns if t['event_type'] == 'HORAS_TURNO_EXTRA']
    comp_records = [t for t in turns if t['event_type'] == 'COMPENSATORIO']
    dev_work_records = [t for t in turns if t.get('a_devolucion') is True]

    assert len(ext_records) >= 80, f"Expected >= 80 EXTENSION_HORARIA (E+N) records, got {len(ext_records)}"
    assert len(hex_records) >= 250, f"Expected >= 250 HORAS_TURNO_EXTRA (H+N) records, got {len(hex_records)}"
    assert len(comp_records) >= 200, f"Expected >= 200 COMPENSATORIO (DC) absence records, got {len(comp_records)}"
    assert len(dev_work_records) >= 130, f"Expected >= 130 work records marked a_devolucion=True, got {len(dev_work_records)}"
    assert all(t['code'] == 'DC' for t in comp_records), "All COMPENSATORIO records should have code 'DC' (not H+6/H+9)"

    # All DEVOLUCION_TIEMPO records must display 'DT' in cell code so columns stay uniform, while preserving dt_schedule
    dt_records = [t for t in turns if t['event_type'] == 'DEVOLUCION_TIEMPO']
    assert len(dt_records) >= 200, f"Expected >= 200 DEVOLUCION_TIEMPO records, got {len(dt_records)}"
    assert all(t['code'] == 'DT' for t in dt_records), "All DEVOLUCION_TIEMPO records must have code='DT' for uniform column width"
    assert sum(1 for t in dt_records if t.get('dt_schedule')) >= 180, "Expected partial-day DT records to preserve dt_schedule"

    print("   -> Data bundle tests: PASSED!")


def test_html_and_css():
    print("2. Testing HTML structure and CSS layout rules...")
    with open('index.html', encoding='utf-8') as f:
        html = f.read()

    required_ids = [
        'calendarTopbarTools', 'calendarQuickBar', 'calendarLegendBar',
        'paintToolsGroup', 'btnUndoAction', 'btnOpenShiftManager', 'btnQuickRangeAbsence',
        'modalCellEdit', 'cellStaffSelect', 'cellStaffId', 'cellDate', 'cellEndDate',
        'cellRangeMode', 'cellRangePreview', 'extraHoursBuilder', 'daModeBuilder',
        'daModeFull', 'daModeMorning', 'daModeAfternoon', 'dtScheduleBuilder',
        'dtModePartial', 'dtModeFull', 'dtStartTime', 'dtEndTime', 'dtScheduleTextInput',
        'cellDevolucionGroup', 'cellDevolucionCheck',
        'modalShiftManager', 'smStaff', 'smPattern', 'smStartDate', 'smEndDate',
        'smPreserveAbsences', 'smDiurnoStaff', 'smDiurnoFillD', 'smSwapStaffA', 'smSwapStaffB',
        'modalStaffAnnual', 'annualKpiGrid', 'annualTimelineTable',
        'dirSearch', 'dirFilterSection', 'dirFilterStatus', 'dirFilterModality',
        'dirFilterEstamento', 'dirCountBadge'
    ]
    for rid in required_ids:
        assert f'id="{rid}"' in html, f"Missing required element id='{rid}' in index.html"

    with open('styles.css', encoding='utf-8') as f:
        css = f.read()
    assert 'min-width: 220px;' in css
    assert 'left: 220px;' in css
    assert 'min-width: 410px;' in css
    assert '.is-devolucion' in css
    assert '.ev-EXTENSION_HORARIA' in css
    assert '.ev-HORAS_TURNO_EXTRA' in css
    assert '.col-today' in css
    assert '#tdmMonthTable' in css
    print("   -> HTML and CSS tests: PASSED!")


def test_morales_and_search_in_node():
    print("3. Testing Patricia Morales distinction, RUT search, and JS runtime in Node.js...")
    with open('data/staff_master.json', encoding='utf-8') as f:
        db = json.load(f)

    pmm = db.get('patricia_morales_morales')
    assert pmm['official_name'] == 'PATRICIA ANDREA MORALES MORALES'
    assert pmm['rut'] == '16.555.264-4'
    assert pmm['role'] == 'TENS'
    assert pmm['section'] == 'APA'
    assert 'TOMA DE MUESTRA' in pmm['sheets']

    pmr = db.get('patricia_morales_rojas')
    assert pmr['official_name'] == 'PATRICIA ESTER AIDA MORALES ROJAS'
    assert pmr['rut'] == '11.480.276-K'
    assert pmr['role'] == 'Profesional'
    assert pmr['estamento'] == 'Tecnólogo Médico'
    assert pmr['section'] == 'AH'
    assert 'TOMA DE MUESTRA' not in pmr['sheets']

    node_test = """
    global.window = global;
    global.document = { addEventListener: () => {}, getElementById: () => null };
    global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    const fs = require('fs');
    eval(fs.readFileSync('data/data_bundle.js', 'utf8'));
    eval(fs.readFileSync('app.js', 'utf8'));
    const staff = window.TURNOS_INITIAL_DATA.staff;

    // 1. morales morales
    const resMM = Object.values(staff).filter(m => matchesSearch(m, 'morales morales'));
    if (!resMM.some(m => m.id === 'patricia_morales_morales') || resMM.some(m => m.id === 'patricia_morales_rojas')) {
      console.error('FAIL: morales morales search did not isolate PMM');
      process.exit(1);
    }
    // 2. morales rojas
    const resMR = Object.values(staff).filter(m => matchesSearch(m, 'morales rojas'));
    if (!resMR.some(m => m.id === 'patricia_morales_rojas') || resMR.some(m => m.id === 'patricia_morales_morales')) {
      console.error('FAIL: morales rojas search did not isolate PMR');
      process.exit(1);
    }
    // 3. hematologia
    const resHem = Object.values(staff).filter(m => matchesSearch(m, 'hematologia'));
    if (!resHem.some(m => m.id === 'patricia_morales_rojas') || resHem.some(m => m.id === 'patricia_morales_morales')) {
      console.error('FAIL: hematologia search did not isolate PMR over PMM');
      process.exit(1);
    }
    // 4. toma de muestra
    const resTDM = Object.values(staff).filter(m => matchesSearch(m, 'toma de muestra'));
    if (!resTDM.some(m => m.id === 'patricia_morales_morales') || resTDM.some(m => m.id === 'patricia_morales_rojas')) {
      console.error('FAIL: toma de muestra search did not isolate PMM over PMR');
      process.exit(1);
    }
    // 5. RUT search with and without dots/hyphen
    const resRut1 = Object.values(staff).filter(m => matchesSearch(m, '185431746'));
    const resRut2 = Object.values(staff).filter(m => matchesSearch(m, '18.543.174-6'));
    if (resRut1.length !== 1 || resRut2.length !== 1 || resRut1[0].id !== 'ociel_beltran') {
      console.error('FAIL: RUT search without punctuation failed', resRut1);
      process.exit(1);
    }
    console.log('   -> Node.js runtime & search discrimination tests: PASSED!');
    """
    res = subprocess.run(['node', '-e', node_test], capture_output=True, text=True)
    assert res.returncode == 0, f"Node test failed: {res.stderr}\n{res.stdout}"
    print(res.stdout.strip())


def test_auth_traceability_and_gas():
    print("4. Testing 3-Tier Role System, Traceability Privacy, and Google Apps Script bundle...")
    from pathlib import Path

    with open('index.html', encoding='utf-8') as f:
        html = f.read()

    auth_audit_ids = [
        'authTopbarBox', 'authGuestView', 'authLoggedView', 'btnOpenLoginModal',
        'loggedUserName', 'loggedUserRole', 'btnOpenUserManager', 'btnLogout',
        'tabBtnAudit', 'view-audit', 'auditSearch', 'auditFilterUser', 'auditFilterCategory',
        'btnExportAuditCSV', 'btnClearAuditLog', 'auditTbody',
        'cellAuditTraceBanner', 'cellAuthorizedByInput',
        'modalLogin', 'loginForm', 'loginUsernameInput', 'loginPasswordInput',
        'modalUserManager', 'usersListTbody', 'btnSaveUserAccount',
        'modalCloudConfig', 'gasWebAppUrlInput', 'btnSaveCloudConfig'
    ]
    for rid in auth_audit_ids:
        assert f'id="{rid}"' in html, f"Missing auth/traceability element id='{rid}' in index.html"

    assert Path('google_apps_script/Code.gs').exists(), "Missing google_apps_script/Code.gs"
    assert Path('google_apps_script/Index.html').exists(), "Missing google_apps_script/Index.html"
    assert Path('google_apps_script/INSTRUCCIONES_APPS_SCRIPT.md').exists(), "Missing google_apps_script/INSTRUCCIONES_APPS_SCRIPT.md"

    node_role_test = """
    global.window = global;
    global.document = {
      addEventListener: () => {},
      getElementById: () => null,
      querySelectorAll: () => [],
      body: { classList: { remove: () => {}, add: () => {} } }
    };
    global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    const fs = require('fs');
    const code = fs.readFileSync('data/data_bundle.js', 'utf8') + '\\n' + fs.readFileSync('app.js', 'utf8') + `
    // 1. Default Viewer (unauthenticated)
    state.currentUser = null;
    if (canEditCalendar() !== false || isAdmin() !== false || canViewTraceability() !== false) {
      console.error('FAIL: Viewer role permissions check failed');
      process.exit(1);
    }

    // 2. Jefatura role
    state.currentUser = { username: 'jefatura', name: 'Jefatura Test', role: 'jefatura', cargo: 'Coordinación' };
    if (canEditCalendar() !== true || isAdmin() !== false || canViewTraceability() !== true) {
      console.error('FAIL: Jefatura role permissions check failed');
      process.exit(1);
    }

    // 3. Admin role
    state.currentUser = { username: 'admin', name: 'Admin Test', role: 'admin', cargo: 'Dirección' };
    if (canEditCalendar() !== true || isAdmin() !== true || canViewTraceability() !== true) {
      console.error('FAIL: Admin role permissions check failed');
      process.exit(1);
    }

    // 4. Traceability stamp & Audit Log recording
    const stamp = buildTraceStamp('TM Jefe Coord');
    if (stamp.updated_by_user !== 'admin' || stamp.authorized_by !== 'TM Jefe Coord') {
      console.error('FAIL: buildTraceStamp failed', stamp);
      process.exit(1);
    }
    recordAuditEntry({
      category: 'AUSENCIA',
      action: 'Otorgamiento de Día Administrativo',
      staffId: 'ociel_beltran',
      staffName: 'Ociel Beltran',
      dateRange: '2026-10-25',
      beforeVal: 'D',
      afterVal: 'DA',
      detail: 'Día Administrativo Jornada Completa',
      authorizedBy: 'TM Jefe Coord'
    });
    if (state.auditLog.length !== 1 || state.auditLog[0].after_val !== 'DA' || state.auditLog[0].authorized_by !== 'TM Jefe Coord') {
      console.error('FAIL: recordAuditEntry did not record expected audit entry', state.auditLog);
      process.exit(1);
    }
    console.log('   -> Role permissions, Traceability privacy & GAS bundle tests: PASSED!');
    `;
    eval(code);
    """
    res = subprocess.run(['node', '-e', node_role_test], capture_output=True, text=True)
    assert res.returncode == 0, f"Node role test failed: {res.stderr}\n{res.stdout}"
    print(res.stdout.strip())


if __name__ == '__main__':
    test_data_bundle()
    test_html_and_css()
    test_morales_and_search_in_node()
    test_auth_traceability_and_gas()
    print("\n=== ALL AUTOMATED VERIFICATION TESTS PASSED 100%! ===")
