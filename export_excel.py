import json
import os
import calendar
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

MONTH_NAMES_ES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] # 0=Domingo, 1=Lunes, ...

def generate_hospital_excel(year=2027, output_path=None):
    if output_path is None:
        output_path = f"TURNOS_LABORATORIO_HRT_{year}.xlsx"

    # Load staff and planned turns
    with open('data/staff_master.json', 'r', encoding='utf-8') as f:
        staff_dict = json.load(f)

    # Load turns for target year
    turns_file = f"data/turns_{year}.json"
    turns = []
    if os.path.exists(turns_file):
        with open(turns_file, 'r', encoding='utf-8') as f:
            turns = json.load(f)

    # Load TDM for target year
    tdm_file = f"data/tdm_{year}.json"
    tdm = []
    if os.path.exists(tdm_file):
        with open(tdm_file, 'r', encoding='utf-8') as f:
            tdm = json.load(f)

    # Load Chilean holidays
    holidays_by_date = {}
    if os.path.exists('data/holidays_chile.json'):
        with open('data/holidays_chile.json', 'r', encoding='utf-8') as f:
            all_holidays = json.load(f)
            for h in all_holidays.get(str(year), []):
                holidays_by_date[h['date']] = h['name']

    # Fast O(1) indexed lookup tables (replaces slow 425-million loop)
    turns_map = {(t['staff_id'], t['date']): t for t in turns}
    tdm_map = {(a['staff_id'], a['date']): a for a in tdm}

    wb = openpyxl.Workbook()
    wb.remove(wb.active) # Remove default sheet

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    color_fills = {
        'VACACIONES': PatternFill(start_color='EF4444', end_color='EF4444', fill_type='solid'),        # Red
        'ADMINISTRATIVO': PatternFill(start_color='FACC15', end_color='FACC15', fill_type='solid'),    # Yellow
        'DEVOLUCION_TIEMPO': PatternFill(start_color='C084FC', end_color='C084FC', fill_type='solid'), # Purple
        'COMISION_SERVICIO': PatternFill(start_color='F472B6', end_color='F472B6', fill_type='solid'), # Pink
        'LICENCIA_MEDICA': PatternFill(start_color='FB923C', end_color='FB923C', fill_type='solid'),   # Orange
        'SIN_GOCE_SUELDO': PatternFill(start_color='1E3A8A', end_color='1E3A8A', fill_type='solid'),   # Dark Blue
        'LARGO': PatternFill(start_color='FED7AA', end_color='FED7AA', fill_type='solid'),             # Light Orange
        'NOCHE': PatternFill(start_color='334155', end_color='334155', fill_type='solid'),             # Dark Slate
        'WEEKEND': PatternFill(start_color='FFF7ED', end_color='FFF7ED', fill_type='solid'),           # Warm light
        'HEADER_WEEKEND': PatternFill(start_color='EA580C', end_color='EA580C', fill_type='solid'),    # Bold Orange
        'HEADER_HOLIDAY': PatternFill(start_color='DC2626', end_color='DC2626', fill_type='solid'),    # Red header
        'HEADER_NAVY': PatternFill(start_color='0F172A', end_color='0F172A', fill_type='solid'),       # Hospital Navy
        'SECTION_HEADER': PatternFill(start_color='F1F5F9', end_color='F1F5F9', fill_type='solid'),    # Slate light
        'TDM_ASSIGNED': PatternFill(start_color='10B981', end_color='10B981', fill_type='solid')       # Emerald
    }

    sheets_to_generate = [
        ('LAB. URGENCIA', 'Urgencia'),
        ('PROFESIONALES RUTINA', 'Profesionales'),
        ('TENS RUTINA', 'TENS'),
        ('AUXILIARES', 'Auxiliares'),
        ('TOMA DE MUESTRA', 'TDM')
    ]

    for sheet_title, target_group in sheets_to_generate:
        ws = wb.create_sheet(title=sheet_title[:31])
        ws.views.sheetView[0].showGridLines = True

        # Sheet Header
        ws.cell(row=1, column=1, value="HOSPITAL REGIONAL DE TALCA - UNIDAD DE LABORATORIO CLÍNICO")
        ws.cell(row=1, column=1).font = Font(name='Arial', size=13, bold=True, color='0F172A')
        ws.cell(row=2, column=1, value=f"CALENDARIO DE TURNOS Y GESTIÓN DE PERSONAL {year} - {sheet_title}")
        ws.cell(row=2, column=1).font = Font(name='Arial', size=11, bold=True, color='475569')

        current_row = 4

        # Filter staff for this sheet
        if sheet_title == 'LAB. URGENCIA':
            sheet_staff = [s for s in staff_dict.values() if any('URGENCIA' in sh.upper() for sh in s.get('sheets', [])) or 'urgencia' in s.get('section', '').lower()]
        elif sheet_title == 'PROFESIONALES RUTINA':
            sheet_staff = [s for s in staff_dict.values() if any('PROFESIONAL' in sh.upper() for sh in s.get('sheets', [])) or (s.get('role') == 'Profesional' and 'urgencia' not in s.get('section', '').lower())]
        elif sheet_title == 'TENS RUTINA':
            sheet_staff = [s for s in staff_dict.values() if any('TENS RUTINA' in sh.upper() for sh in s.get('sheets', [])) or (s.get('role') == 'TENS' and 'urgencia' not in s.get('section', '').lower())]
        elif sheet_title == 'AUXILIARES':
            sheet_staff = [s for s in staff_dict.values() if any('AUXILIAR' in sh.upper() for sh in s.get('sheets', [])) or s.get('role') == 'Auxiliar']
        else: # TDM
            sheet_staff = [s for s in staff_dict.values() if any('TOMA DE MUESTRA' in sh.upper() for sh in s.get('sheets', []))]

        sheet_staff.sort(key=lambda x: (x.get('section', ''), x.get('name', '')))

        for m in range(1, 13):
            days_in_month = calendar.monthrange(year, m)[1]
            month_name = MONTH_NAMES_ES[m - 1]

            # Month Banner
            ws.cell(row=current_row, column=1, value=f"TURNOS {month_name} {year}")
            ws.cell(row=current_row, column=1).font = Font(name='Arial', size=11, bold=True, color='FFFFFF')
            ws.cell(row=current_row, column=1).fill = color_fills['HEADER_NAVY']
            current_row += 1

            # Day Numbers Header
            ws.cell(row=current_row, column=1, value="FUNCIONARIO").font = Font(name='Arial', size=9, bold=True, color='FFFFFF')
            ws.cell(row=current_row, column=1).fill = color_fills['HEADER_NAVY']
            ws.cell(row=current_row, column=2, value="RUT").font = Font(name='Arial', size=9, bold=True, color='FFFFFF')
            ws.cell(row=current_row, column=2).fill = color_fills['HEADER_NAVY']

            for d in range(1, days_in_month + 1):
                date_str = f"{year}-{m:02d}-{d:02d}"
                cell = ws.cell(row=current_row, column=d + 2, value=d)
                cell.font = Font(name='Arial', size=9, bold=True, color='FFFFFF')
                cell.alignment = Alignment(horizontal='center', vertical='center')

                dow = (calendar.weekday(year, m, d) + 1) % 7 # 0=Domingo
                if date_str in holidays_by_date:
                    cell.fill = color_fills['HEADER_HOLIDAY']
                elif dow in [0, 6]:
                    cell.fill = color_fills['HEADER_WEEKEND']
                else:
                    cell.fill = color_fills['HEADER_NAVY']

            current_row += 1

            # Day Letters Header
            ws.cell(row=current_row, column=1, value="")
            ws.cell(row=current_row, column=2, value="")
            for d in range(1, days_in_month + 1):
                date_str = f"{year}-{m:02d}-{d:02d}"
                dow = (calendar.weekday(year, m, d) + 1) % 7
                d_letter = DAY_LETTERS[dow]
                cell = ws.cell(row=current_row, column=d + 2, value=d_letter)
                cell.font = Font(name='Arial', size=8, bold=True, color='FFFFFF')
                cell.alignment = Alignment(horizontal='center', vertical='center')

                if date_str in holidays_by_date:
                    cell.fill = color_fills['HEADER_HOLIDAY']
                elif dow in [0, 6]:
                    cell.fill = color_fills['HEADER_WEEKEND']
                else:
                    cell.fill = color_fills['HEADER_NAVY']

            current_row += 1

            # Staff Rows
            last_section = None
            for st in sheet_staff:
                sec = st.get('section') or st.get('role')
                if sec and sec != last_section and sheet_title in ['PROFESIONALES RUTINA', 'LAB. URGENCIA']:
                    last_section = sec
                    sec_cell = ws.cell(row=current_row, column=1, value=sec.upper())
                    sec_cell.font = Font(name='Arial', size=9, bold=True, color='1E293B')
                    sec_cell.fill = color_fills['SECTION_HEADER']
                    for col_idx in range(2, days_in_month + 3):
                        c_empty = ws.cell(row=current_row, column=col_idx)
                        c_empty.fill = color_fills['SECTION_HEADER']
                        c_empty.border = thin_border
                    current_row += 1

                name_cell = ws.cell(row=current_row, column=1, value=st['name'])
                name_cell.font = Font(name='Arial', size=9, bold=True, color='0F172A')
                name_cell.border = thin_border
                
                rut_cell = ws.cell(row=current_row, column=2, value=st.get('rut', ''))
                rut_cell.font = Font(name='Arial', size=8, color='475569')
                rut_cell.border = thin_border

                for d in range(1, days_in_month + 1):
                    date_str = f"{year}-{m:02d}-{d:02d}"
                    cell = ws.cell(row=current_row, column=d + 2)
                    cell.border = thin_border
                    cell.alignment = Alignment(horizontal='center', vertical='center')

                    dow = (calendar.weekday(year, m, d) + 1) % 7
                    is_weekend = dow in [0, 6]
                    is_holiday = date_str in holidays_by_date

                    if sheet_title == 'TOMA DE MUESTRA':
                        ass = tdm_map.get((st['id'], date_str))
                        if ass:
                            cell.value = 'X'
                            cell.font = Font(name='Arial', size=9, bold=True, color='FFFFFF')
                            cell.fill = color_fills['TDM_ASSIGNED']
                        elif is_holiday or is_weekend:
                            cell.fill = color_fills['WEEKEND']
                    else:
                        ev = turns_map.get((st['id'], date_str))
                        if ev:
                            code = ev.get('code', '')
                            ev_type = ev.get('event_type', '')
                            cell.value = code or ('FL' if ev_type == 'VACACIONES' else ('DA' if ev_type == 'ADMINISTRATIVO' else ''))

                            if ev_type == 'VACACIONES':
                                cell.fill = color_fills['VACACIONES']
                                cell.font = Font(name='Arial', size=8, bold=True, color='FFFFFF')
                            elif ev_type == 'ADMINISTRATIVO':
                                cell.fill = color_fills['ADMINISTRATIVO']
                                cell.font = Font(name='Arial', size=8, bold=True, color='854D0E')
                            elif ev_type == 'DEVOLUCION_TIEMPO':
                                cell.fill = color_fills['DEVOLUCION_TIEMPO']
                                cell.font = Font(name='Arial', size=8, bold=True, color='FFFFFF')
                            elif ev_type == 'COMISION_SERVICIO':
                                cell.fill = color_fills['COMISION_SERVICIO']
                                cell.font = Font(name='Arial', size=8, bold=True, color='831843')
                            elif ev_type == 'LICENCIA_MEDICA':
                                cell.fill = color_fills['LICENCIA_MEDICA']
                                cell.font = Font(name='Arial', size=8, bold=True, color='FFFFFF')
                            elif ev_type == 'SIN_GOCE_SUELDO':
                                cell.fill = color_fills['SIN_GOCE_SUELDO']
                                cell.font = Font(name='Arial', size=8, bold=True, color='FFFFFF')
                            elif code == 'L':
                                cell.fill = color_fills['LARGO']
                                cell.font = Font(name='Arial', size=8, bold=True, color='9A3412')
                            elif code == 'N':
                                cell.fill = color_fills['NOCHE']
                                cell.font = Font(name='Arial', size=8, bold=True, color='FFFFFF')
                            else:
                                cell.font = Font(name='Arial', size=8, bold=True)
                        elif is_holiday or is_weekend:
                            cell.fill = color_fills['WEEKEND']

                current_row += 1

            current_row += 2 # Clean separation between months

        # Auto-adjust column widths
        ws.column_dimensions['A'].width = 32
        ws.column_dimensions['B'].width = 16
        for col_idx in range(3, 36):
            ws.column_dimensions[get_column_letter(col_idx)].width = 5.2

    # Add Dotación & Personal Audit Sheet
    ws_dot = wb.create_sheet(title="DOTACIÓN Y PERSONAL")
    ws_dot.views.sheetView[0].showGridLines = True
    ws_dot.cell(row=1, column=1, value="HOSPITAL REGIONAL DE TALCA - DOTACIÓN OFICIAL LABORATORIO").font = Font(name='Arial', size=13, bold=True, color='0F172A')
    ws_dot.cell(row=2, column=1, value=f"Registro consolidado de personal, estamentos y estado de datos ({year})").font = Font(name='Arial', size=10, color='475569')

    headers = ["FUNCIONARIO", "RUT", "ESTAMENTO", "SECCIÓN", "PESTAÑAS ASIGNADAS", "ESTADO"]
    for i, h in enumerate(headers, 1):
        c = ws_dot.cell(row=4, column=i, value=h)
        c.font = Font(name='Arial', size=9, bold=True, color='FFFFFF')
        c.fill = color_fills['HEADER_NAVY']
        c.border = thin_border

    dot_row = 5
    for s in sorted(staff_dict.values(), key=lambda x: (x.get('role', ''), x.get('name', ''))):
        ws_dot.cell(row=dot_row, column=1, value=s['name']).border = thin_border
        ws_dot.cell(row=dot_row, column=2, value=s.get('rut') or 'PENDIENTE').border = thin_border
        ws_dot.cell(row=dot_row, column=3, value=s.get('role', '')).border = thin_border
        ws_dot.cell(row=dot_row, column=4, value=s.get('section', '')).border = thin_border
        ws_dot.cell(row=dot_row, column=5, value=', '.join(s.get('sheets', []))).border = thin_border
        status = 'Completo' if not s.get('missing_fields') else 'Pendiente: ' + ', '.join(s['missing_fields'])
        c_status = ws_dot.cell(row=dot_row, column=6, value=status)
        c_status.border = thin_border
        if s.get('missing_fields'):
            c_status.font = Font(name='Arial', size=8, bold=True, color='B45309')
        else:
            c_status.font = Font(name='Arial', size=8, color='047857')
        dot_row += 1

    ws_dot.column_dimensions['A'].width = 35
    ws_dot.column_dimensions['B'].width = 18
    ws_dot.column_dimensions['C'].width = 18
    ws_dot.column_dimensions['D'].width = 25
    ws_dot.column_dimensions['E'].width = 35
    ws_dot.column_dimensions['F'].width = 25

    wb.save(output_path)
    print(f"Hospital Excel successfully generated at: {output_path}")

if __name__ == '__main__':
    import sys
    target_year = int(sys.argv[1]) if len(sys.argv) > 1 else 2027
    generate_hospital_excel(target_year)
