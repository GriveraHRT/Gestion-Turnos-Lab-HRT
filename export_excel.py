import json
import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def generate_hospital_excel(year=2027, output_path=None):
    if output_path is None:
        output_path = f"TURNOS_LABORATORIO_HRT_{year}.xlsx"

    # Load staff and planned turns
    with open('data/staff_master.json', 'r', encoding='utf-8') as f:
        staff_dict = json.load(f)

    # Check if 2027 turns exist
    turns_file = f"data/turns_{year}.json"
    turns = []
    if os.path.exists(turns_file):
        with open(turns_file, 'r', encoding='utf-8') as f:
            turns = json.load(f)
    elif os.path.exists("data/turns_2026.json"):
        with open("data/turns_2026.json", 'r', encoding='utf-8') as f:
            turns = json.load(f)

    # Check TDM
    tdm_file = f"data/tdm_{year}.json"
    tdm = []
    if os.path.exists(tdm_file):
        with open(tdm_file, 'r', encoding='utf-8') as f:
            tdm = json.load(f)
    elif os.path.exists("data/tdm_2026.json"):
        with open("data/tdm_2026.json", 'r', encoding='utf-8') as f:
            tdm = json.load(f)

    wb = openpyxl.Workbook()
    # Remove default sheet
    wb.remove(wb.active)

    month_names = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
    day_letters = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

    thin_border = Border(
        left=Side(style='thin', color='E2E8F0'),
        right=Side(style='thin', color='E2E8F0'),
        top=Side(style='thin', color='E2E8F0'),
        bottom=Side(style='thin', color='E2E8F0')
    )

    color_fills = {
        'VACACIONES': PatternFill(start_color='EF4444', end_color='EF4444', fill_type='solid'),
        'ADMINISTRATIVO': PatternFill(start_color='FACC15', end_color='FACC15', fill_type='solid'),
        'DEVOLUCION_TIEMPO': PatternFill(start_color='C084FC', end_color='C084FC', fill_type='solid'),
        'COMISION_SERVICIO': PatternFill(start_color='F472B6', end_color='F472B6', fill_type='solid'),
        'LICENCIA_MEDICA': PatternFill(start_color='FB923C', end_color='FB923C', fill_type='solid'),
        'SIN_GOCE_SUELDO': PatternFill(start_color='1E3A8A', end_color='1E3A8A', fill_type='solid'),
        'LARGO': PatternFill(start_color='FED7AA', end_color='FED7AA', fill_type='solid'),
        'NOCHE': PatternFill(start_color='334155', end_color='334155', fill_type='solid'),
        'WEEKEND': PatternFill(start_color='FFF7ED', end_color='FFF7ED', fill_type='solid'),
        'HEADER_WEEKEND': PatternFill(start_color='EA580C', end_color='EA580C', fill_type='solid'),
        'HEADER_NAVY': PatternFill(start_color='0F172A', end_color='0F172A', fill_type='solid'),
        'SECTION_HEADER': PatternFill(start_color='F1F5F9', end_color='F1F5F9', fill_type='solid')
    }

    sheets_to_generate = [
        ('LAB. URGENCIA', ['Urgencia']),
        ('PROFESIONALES RUTINA', ['Hematología', 'Inmunoquímica', 'Microbiología', 'Urgencia y Biología Molecular', 'Autoinmunidad', 'Administrativa']),
        ('TENS RUTINA', ['Rutina TENS']),
        ('AUXILIARES ', ['Auxiliares']),
        ('TOMA DE MUESTRA', ['TDM'])
    ]

    import calendar

    for sheet_title, target_sections in sheets_to_generate:
        ws = wb.create_sheet(title=sheet_title[:31])
        ws.views.sheetView[0].showGridLines = True

        # Sheet Header
        ws.cell(row=1, column=1, value="HOSPITAL REGIONAL DE TALCA - UNIDAD DE LABORATORIO CLÍNICO")
        ws.cell(row=1, column=1).font = Font(name='Arial', size=14, bold=True, color='0F172A')
        ws.cell(row=2, column=1, value=f"PLANIFICACIÓN DE TURNOS Y AUSENTISMOS {year} - {sheet_title}")
        ws.cell(row=2, column=1).font = Font(name='Arial', size=11, bold=True, color='64748B')

        current_row = 4

        # Filter staff
        if sheet_title == 'LAB. URGENCIA':
            sheet_staff = [s for s in staff_dict.values() if 'LAB. URGENCIA' in s.get('sheets', []) or 'urgencia' in s.get('section', '').lower()]
        elif sheet_title == 'PROFESIONALES RUTINA':
            sheet_staff = [s for s in staff_dict.values() if s.get('role') == 'Profesional' and 'urgencia' not in s.get('section', '').lower()]
        elif sheet_title == 'TENS RUTINA':
            sheet_staff = [s for s in staff_dict.values() if s.get('role') == 'TENS' and 'urgencia' not in s.get('section', '').lower()]
        elif sheet_title == 'AUXILIARES ':
            sheet_staff = [s for s in staff_dict.values() if s.get('role') == 'Auxiliar']
        else: # TDM
            sheet_staff = [s for s in staff_dict.values() if 'TOMA DE MUESTRA' in s.get('sheets', [])]

        sheet_staff.sort(key=lambda x: (x.get('section', ''), x.get('name', '')))

        for m in range(1, 13):
            days_in_month = calendar.monthrange(year, m)[1]
            month_name = month_names[m - 1]

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
                cell = ws.cell(row=current_row, column=d + 2, value=d)
                cell.font = Font(name='Arial', size=9, bold=True, color='FFFFFF')
                dow = (calendar.weekday(year, m, d) + 1) % 7 # 0=Domingo
                if dow in [0, 6]:
                    cell.fill = color_fills['HEADER_WEEKEND']
                else:
                    cell.fill = color_fills['HEADER_NAVY']
                cell.alignment = Alignment(horizontal='center', vertical='center')

            current_row += 1

            # Day Letters Header
            ws.cell(row=current_row, column=1, value="")
            ws.cell(row=current_row, column=2, value="")
            for d in range(1, days_in_month + 1):
                dow = (calendar.weekday(year, m, d) + 1) % 7
                d_letter = day_letters[dow]
                cell = ws.cell(row=current_row, column=d + 2, value=d_letter)
                cell.font = Font(name='Arial', size=8, bold=True, color='FFFFFF')
                if dow in [0, 6]:
                    cell.fill = color_fills['HEADER_WEEKEND']
                else:
                    cell.fill = color_fills['HEADER_NAVY']
                cell.alignment = Alignment(horizontal='center', vertical='center')

            current_row += 1

            # Staff Rows
            for st in sheet_staff:
                ws.cell(row=current_row, column=1, value=st['name']).font = Font(name='Arial', size=9, bold=True)
                ws.cell(row=current_row, column=1).border = thin_border
                ws.cell(row=current_row, column=2, value=st.get('rut', '')).font = Font(name='Arial', size=8)
                ws.cell(row=current_row, column=2).border = thin_border

                for d in range(1, days_in_month + 1):
                    date_str = f"{year}-{m:02d}-{d:02d}"
                    cell = ws.cell(row=current_row, column=d + 2)
                    cell.border = thin_border
                    cell.alignment = Alignment(horizontal='center', vertical='center')

                    dow = (calendar.weekday(year, m, d) + 1) % 7
                    is_weekend = dow in [0, 6]

                    if sheet_title == 'TOMA DE MUESTRA':
                        ass = next((a for a in tdm if a.get('staff_id') == st['id'] and a.get('date') == date_str), None)
                        if ass:
                            cell.value = 'X'
                            cell.font = Font(name='Arial', size=9, bold=True, color='FFFFFF')
                            cell.fill = PatternFill(start_color='10B981', end_color='10B981', fill_type='solid')
                        elif is_weekend:
                            cell.fill = color_fills['WEEKEND']
                    else:
                        ev = next((t for t in turns if t.get('staff_id') == st['id'] and t.get('date') == date_str), None)
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
                                cell.font = Font(name='Arial', size=8, bold=True, color='4C1D95')
                            elif ev_type == 'COMISION_SERVICIO':
                                cell.fill = color_fills['COMISION_SERVICIO']
                                cell.font = Font(name='Arial', size=8, bold=True, color='831843')
                            elif code == 'L':
                                cell.fill = color_fills['LARGO']
                                cell.font = Font(name='Arial', size=8, bold=True, color='9A3412')
                            elif code == 'N':
                                cell.fill = color_fills['NOCHE']
                                cell.font = Font(name='Arial', size=8, bold=True, color='FFFFFF')
                        elif is_weekend:
                            cell.fill = color_fills['WEEKEND']

                current_row += 1

            current_row += 2 # separation between months

        # Column widths
        ws.column_dimensions['A'].width = 30
        ws.column_dimensions['B'].width = 15
        for col_idx in range(3, 36):
            ws.column_dimensions[get_column_letter(col_idx)].width = 5.5

    wb.save(output_path)
    print(f"Hospital Excel successfully generated at: {output_path}")

if __name__ == '__main__':
    generate_hospital_excel(2027)
