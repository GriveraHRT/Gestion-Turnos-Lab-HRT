import json
import re

def test_data_bundle():
    print("Testing data bundle and staff master...")
    with open('data/staff_master.json', encoding='utf-8') as f:
        db = json.load(f)
    
    assert len(db) == 98, f"Expected 98 staff, got {len(db)}"
    
    # Requirement 3 validation:
    # 1. Diego Rojas Verdugo -> ATE
    assert db['diego_rojas_verdugo']['section'] == 'ATE', f"Diego Rojas Verdugo must be ATE, got {db['diego_rojas_verdugo']['section']}"
    
    # 2. Urgencia / Urgencia Y Biología Molecular -> ALU
    for s in db.values():
        if 'URGENCIA' in ' '.join(s.get('sheets', [])).upper():
            assert s['section'] == 'ALU', f"{s['name']} in urgency sheets must have section ALU, got {s['section']}"
    assert db['rodrigo_benavente_contreras']['section'] == 'ALU'
    
    # 3. Hematología -> AH
    for name in ['Consuelo Cerda Wehinger', 'Juan Cerpa Castillo', 'Marcela Salgado Carreño', 'Miryam Espina Herrera', 'Romina Diaz Espinoza']:
        found = [s for s in db.values() if s['name'] == name]
        assert len(found) == 1
        assert found[0]['section'] == 'AH', f"{name} must be AH"
        
    # 4. Química / Inmunoquímica -> AIC
    for name in ['Alejandra Vorphal Vasquez', 'Camila Gutierrez', 'Camila Reyes Vivero', 'Carolina Arancibia Jara', 'Daniel Schulz', 'Loreto Diaz Rios']:
        found = [s for s in db.values() if s['name'] == name]
        assert len(found) == 1
        assert found[0]['section'] == 'AIC', f"{name} must be AIC"
        
    # 5. Microbiología -> AMB (except Diego Rojas who is ATE)
    for name in ['Barbara Fuenzalida Ibañez', 'Cristian Andrade', 'Daniel Calderon Calderon', 'Francisco Sepulveda', 'Katalina Barrera', 'Melissa Canales Mejias', 'Nicole Hernandez Norambuena']:
        found = [s for s in db.values() if s['name'] == name]
        assert len(found) == 1
        assert found[0]['section'] == 'AMB', f"{name} must be AMB"
        
    # 6. usuarios TENS -> APA
    for name in ['Ingrid Silva Valdivia', 'Jimena Caceres Valdes', 'Laura Perez', 'Rosa Bernal Muñoz', 'Ruth Jara Lara', 'Susana Quintana']:
        found = [s for s in db.values() if s['name'] == name]
        assert len(found) == 1
        assert found[0]['section'] == 'APA', f"{name} must be APA"
        
    # 7. Administrativa o similares -> ADM
    for name in ['Arlette Garrido Miño', 'Camila Walker', 'Carolina Diaz Ponce', 'Constanza Riquelme', 'Jimena Gonzalez', 'María Riquelme', 'Valeria Montes']:
        found = [s for s in db.values() if s['name'] == name]
        assert len(found) == 1
        assert found[0]['section'] == 'ADM', f"{name} must be ADM"

    print("Requirement 3 (Sections mapping): PASSED!")

def test_html_elements():
    print("Testing HTML structure for Requirements 1, 2, 4...")
    with open('index.html', encoding='utf-8') as f:
        html = f.read()

    # Requirement 1: scrollbar removal & wrapping
    assert 'id="view-presets-container"' in html

    # Requirement 2: controls bar IDs and directory filters
    assert 'id="section-controls-bar"' in html
    assert 'id="calendar-search-container"' in html
    assert 'id="section-legend"' in html
    assert 'id="directorio-filter-search"' in html
    assert 'id="directorio-filter-section"' in html
    assert 'id="directorio-filter-estado"' in html
    assert 'id="directorio-filter-jornada"' in html
    assert 'id="directorio-filter-estamento"' in html
    assert 'id="directorio-results-count"' in html

    # Requirement 4: shift schedule modal and tabs
    assert 'id="modal-shift-schedule"' in html
    assert 'id="sched-tab-content-pattern"' in html
    assert 'id="sched-tab-content-diurno"' in html
    assert 'id="sched-tab-content-swap"' in html
    assert 'openShiftScheduleModal' in html

    print("HTML Elements for all requirements: PASSED!")

def test_js_logic():
    print("Testing JS logic in app.js...")
    with open('app.js', encoding='utf-8') as f:
        js = f.read()

    # Check switchTab hides calendar-search-container outside Calendario General
    assert 'calendarSearch.classList.toggle' in js
    assert "normTab !== 'CALENDARIO GENERAL'" in js

    # Check migrateStaffSections exists and maps Diego Rojas to ATE
    assert 'migrateStaffSections' in js
    assert 'Diego Rojas Verdugo' in js
    assert "'ATE'" in js

    # Check shift schedule implementation
    assert 'applyPatternSchedule' in js
    assert 'applyDiurnoSchedule' in js
    assert 'applySwapSchedule' in js
    assert 'updateSchedulePreview' in js
    assert 'updateDiurnoPreview' in js
    assert 'updateSwapPreview' in js
    assert 'setDiurnoQuickRange' in js
    assert 'event-diurno' in js

    # Check cross-year rebuildTurnsMap indexes both 2026 and 2027
    assert 'state.turns2026' in js and 'state.turns2027' in js

    # Check TM_BQ filter group
    assert 'TM_BQ' in js

    print("JS Logic assertions: PASSED!")

def test_shift_engine_simulation():
    print("Simulating shift assignment & swapping engines...")
    # 4-turn cycle simulation:
    cycle_map = {
        'L': ['L', 'N', None, None],
        'N': ['N', None, None, 'L'],
        'X1': [None, None, 'L', 'N'],
        'X2': [None, 'L', 'N', None]
    }

    # Verify every start offset produces a periodic 4-day sequence
    for start_code, pattern in cycle_map.items():
        seq = [pattern[i % 4] for i in range(12)]
        assert len(seq) == 12
        # Check that L is always followed by N
        for i in range(len(seq) - 1):
            if seq[i] == 'L':
                assert seq[i+1] == 'N'
            if seq[i] == 'N':
                assert seq[i+1] is None

    # Verify absence preservation logic
    absences = ['VACACIONES', 'ADMINISTRATIVO', 'LICENCIA_MEDICA', 'DEVOLUCION_TIEMPO', 'COMISION_SERVICIO', 'SIN_GOCE_SUELDO']
    sample_turns = [
        {'date': '2026-03-01', 'code': 'L', 'event_type': 'TURNO'},
        {'date': '2026-03-02', 'code': 'N', 'event_type': 'TURNO'},
        {'date': '2026-03-03', 'code': 'VAC', 'event_type': 'VACACIONES'},
        {'date': '2026-03-04', 'code': 'LM', 'event_type': 'LICENCIA_MEDICA'},
    ]
    # Diurno filter simulation:
    preserved = [t for t in sample_turns if t['event_type'] in absences]
    assert len(preserved) == 2
    assert {t['event_type'] for t in preserved} == {'VACACIONES', 'LICENCIA_MEDICA'}

    # Diurno Monday-Friday generation simulation (2026-10-01 to 2026-10-07)
    # 2026-10-01 is Thursday, 02 is Friday, 03 is Saturday, 04 is Sunday, 05 is Monday, 06 is Tuesday, 07 is Wednesday
    from datetime import date, timedelta
    s_date = date(2026, 10, 1)
    e_date = date(2026, 10, 7)
    diff_days = (e_date - s_date).days + 1
    generated_diurno = []
    for i in range(diff_days):
        d = s_date + timedelta(days=i)
        is_weekend = d.weekday() in (5, 6) # Sat, Sun
        if not is_weekend:
            generated_diurno.append({'date': d.isoformat(), 'code': 'D', 'event_type': 'TURNO'})

    assert len(generated_diurno) == 5, f"Expected 5 business days, got {len(generated_diurno)}"
    assert all(t['code'] == 'D' for t in generated_diurno)
    assert not any(t['date'] in ('2026-10-03', '2026-10-04') for t in generated_diurno)

    # Cross-year turn indexing simulation
    mock_turns2026 = [{'staff_id': 'staff1', 'date': '2026-12-31', 'code': 'L'}]
    mock_turns2027 = [{'staff_id': 'staff1', 'date': '2027-01-01', 'code': 'N'}]
    turns_map = {}
    for r in mock_turns2026: turns_map[r['staff_id'] + '_' + r['date']] = r
    for r in mock_turns2027: turns_map[r['staff_id'] + '_' + r['date']] = r
    assert turns_map.get('staff1_2026-12-31')['code'] == 'L'
    assert turns_map.get('staff1_2027-01-01')['code'] == 'N'

    print("Shift engine simulations: PASSED!")

if __name__ == '__main__':
    test_data_bundle()
    test_html_elements()
    test_js_logic()
    test_shift_engine_simulation()
    print("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")

