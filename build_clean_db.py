import openpyxl, json, re, sys, os
from collections import defaultdict
sys.stdout.reconfigure(encoding='utf-8')

os.makedirs('data', exist_ok=True)

# 1. Load Dotación
wb_dot = openpyxl.load_workbook(r'C:\Users\Admin\Documents\GRC\Lista de asistencia 2026.xlsx', data_only=True)
ws_dot = wb_dot['Dotación ']
dot_by_rut = {}
dot_by_name = {}

def norm(s):
    if not s: return ""
    s = s.upper().strip()
    for a, b in [('Á','A'),('É','E'),('Í','I'),('Ó','O'),('Ú','U'),('Ñ','N')]:
        s = s.replace(a, b)
    s = re.sub(r'[^A-Z0-9 ]', ' ', s)
    return ' '.join(s.split())

for r in range(2, ws_dot.max_row + 1):
    rut = str(ws_dot.cell(row=r, column=1).value or '').strip()
    dv = str(ws_dot.cell(row=r, column=2).value or '').strip()
    full_rut = f"{rut}-{dv}" if dv else rut
    name = str(ws_dot.cell(row=r, column=3).value or '').strip()
    planta = str(ws_dot.cell(row=r, column=4).value or '').strip()
    unidad = str(ws_dot.cell(row=r, column=5).value or '').strip()
    if name:
        rec = {'rut': full_rut, 'rut_num': rut, 'name': name, 'planta': planta, 'unidad': unidad}
        dot_by_rut[rut] = rec
        dot_by_name[norm(name)] = rec

# 2. Non-person patterns to ignore as staff
NON_PERSON_PATTERNS = [
    r'^8:00', r'^8:30', r'^7:30', r'^TOMA DE MUESTRA', r'^URGENCIA \(7-8\)', r'^LICENCIAS',
    r'^FUNCIONES ADMINISTRATIVAS', r'^MÁXIMO', r'^MAXIMO', r'^HORARIO', r'^RECEPCIÓN',
    r'^RECEPCION', r'^ENCARGADA', r'^ORIENTADOR', r'^TURNOS', r'^PROFESIONALES', r'^TENS', r'^ABRIL'
]

# Alias map to canonize names
CANON_MAP = {
    'ANHAIS': 'Anahis Albornoz',
    'ANHAIS ALBORNOZ': 'Anahis Albornoz',
    'ANAHIS ALBORNOZ': 'Anahis Albornoz',
    'ELIESER': 'Elieser Valdebenito',
    'ELISER VALDEBENITO': 'Elieser Valdebenito',
    'ELIESER VALDEBENITO': 'Elieser Valdebenito',
    'ELIZABEL': 'Elizabel Sanchez',
    'ELIZABEL SANCHEZ': 'Elizabel Sanchez',
    'ELIZABEL SANCHEZ  7:30-8:00': 'Elizabel Sanchez',
    'ELIZABEL SANCHEZ (7-8)': 'Elizabel Sanchez',
    'MURIEL': 'Muriel Correa',
    'MURIEL CORREA': 'Muriel Correa',
    'NICOL': 'Nicol Riquelme Galvez',
    'NICOL RIQUELME': 'Nicol Riquelme Galvez',
    'NICOL RIQUELME GALVEZ': 'Nicol Riquelme Galvez',
    'NICOL RIQUELME  RECEPCION': 'Nicol Riquelme Galvez',
    'YESSENIA': 'Yessenia Caceres',
    'YESSENIA CACERES': 'Yessenia Caceres',
    'CONSUELO': 'Consuelo Alarcon',
    'CONSUELO ALARCON': 'Consuelo Alarcon',
    'INGRID': 'Ingrid Silva Valdivia',
    'INGRID SILVA VALDIVIA': 'Ingrid Silva Valdivia',
    'KATALINA': 'Katalina Barrera',
    'BARRERA KATALINA': 'Katalina Barrera',
    'KATALINA 7-8': 'Katalina Barrera',
    'LUCIA': 'Lucia Peña',
    'LUCIA PEÑA': 'Lucia Peña',
    'MARY': 'María Riquelme',
    'MARY RIQUELME': 'María Riquelme',
    'MARÍA RIQUELME': 'María Riquelme',
    'MARIA RIQUELME': 'María Riquelme',
    'ORIENTADOR MARY RIQUELME': 'María Riquelme',
    'MERLAM': 'Merlam Espinoza',
    'MERLAM ESPINOZA': 'Merlam Espinoza',
    'PATRICIA': 'Patricia Morales Rojas',
    'PATRICIA MORALES': 'Patricia Morales Rojas',
    'MORALES ROJAS PATRICIA': 'Patricia Morales Rojas',
    'ROSA BERNAL MUÑOZ': 'Rosa Bernal Muñoz',
    'ROSITA BERNAL': 'Rosa Bernal Muñoz',
    'ROSITA BERNAL (SOS)': 'Rosa Bernal Muñoz',
    'ROSITA (DE SER NECESARIO)': 'Rosa Bernal Muñoz',
    'RUTH': 'Ruth Jara Lara',
    'RUTH JARA': 'Ruth Jara Lara',
    'RUTH JARA LARA': 'Ruth Jara Lara',
    'RUTH JARA CAPACITACIÓN': 'Ruth Jara Lara',
    'ORIENTADOR Y APOYO RUTH JARA': 'Ruth Jara Lara',
    'ORIENTADOR Y APOYO CONSTANZA G': 'Constanza Gomez Sepulveda',
    'ORIENTADOR Y APOYO  CONSTANZA GOMEZ': 'Constanza Gomez Sepulveda',
    'CONTANZA GOMEZ': 'Constanza Gomez Sepulveda',
    'CONSTANZA GOMEZ': 'Constanza Gomez Sepulveda',
    'CONSTANZA GOMEZ SEPULVEDA': 'Constanza Gomez Sepulveda',
    'ORIENTADOR Y APOYO BARBARA A': 'Barbara Alcantara',
    'BARBARA ALCANTARA': 'Barbara Alcantara',
    'BÁRBARA ALCANTARA': 'Barbara Alcantara',
    'ORIENTADOR Y APOYO ESMERALDA': 'Esmeralda Abarza',
    'ESMERALDA': 'Esmeralda Abarza',
    'ESMERALDA ABARZA': 'Esmeralda Abarza',
    'ESMERALDA ABARZA RECEPCION': 'Esmeralda Abarza',
    'LAURA PEREZ': 'Laura Perez',
    'LAURA PEREZ RECEPCIÓN': 'Laura Perez',
    'JIMENA GONZALEZ': 'Jimena Gonzalez',
    'JIMENA GONZALEZ RECEPCION': 'Jimena Gonzalez',
    'TM CONSTANZA RIQUELME': 'Constanza Riquelme',
    'TM CONSTANZA RIQUELME SOS': 'Constanza Riquelme',
    'TM CONSTANZA RIQUELME (S0S)': 'Constanza Riquelme',
    'CONSTANZA RIQUELME': 'Constanza Riquelme',
    'CONSTANZA RIQUELME (PM)': 'Constanza Riquelme',
    'RIQUELME CONSTANZA': 'Constanza Riquelme',
    'TM SUSANA SANTOS': 'Susana Santos',
    'TM SUSANA SANTOS SOS': 'Susana Santos',
    'TM SUSANA SANTOS (SOS)': 'Susana Santos',
    'SUSANA SANTOS': 'Susana Santos',
    'SUSANA SANTOS (PM)': 'Susana Santos',
    'SUSANA': 'Susana Santos',
    'SAN MARTIN JEANETTE': 'Jeanette San Martín',
    'JEANETTE SAN MARTIN': 'Jeanette San Martín',
    'JEANETTE SAN MARTÍN': 'Jeanette San Martín',
    'ARLETT HORMAZABAL': 'Arlett Hormazabal Cardenas',
    'HORMAZABAL CARDENAS ARLETT': 'Arlett Hormazabal Cardenas',
    'CERDA WEHINGER CONSUELO': 'Consuelo Cerda Wehinger',
    'CERPA CASTILLO JUAN': 'Juan Cerpa Castillo',
    'DIAZ ESPINOZA ROMINA': 'Romina Diaz Espinoza',
    'SALGADO CARREÑO MARCELA': 'Marcela Salgado Carreño',
    'MIRYAM ESPINA HERRERA': 'Miryam Espina Herrera',
    'ARANCIBIA JARA CAROLINA': 'Carolina Arancibia Jara',
    'ARANCIBIA JARA CAROLINA (AUTOINMUNIDAD)': 'Carolina Arancibia Jara',
    'VORPHAL VASQUEZ M. ALEJANDRA': 'Alejandra Vorphal Vasquez',
    'VORPHAL VASQUEZ M. ALEJANDRA (AUTOINMUNIDAD)': 'Alejandra Vorphal Vasquez',
    'ROJAS VERDUGO DIEGO': 'Diego Rojas Verdugo',
    'CAMILA GONZALEZ': 'Camila Gonzalez',
    'SCHULZ DANIEL': 'Daniel Schulz',
    'CAMILA GUTIERREZ': 'Camila Gutierrez',
    'SEPULVEDA FRANCISCO': 'Francisco Sepulveda',
    'CAMILA REYES VIVERO': 'Camila Reyes Vivero',
    'CAMILA REYES': 'Camila Reyes Vivero',
    'CAMILA WALKER': 'Camila Reyes Vivero',
    'DIAZ RIOS LORETO': 'Loreto Diaz Rios',
    'CALDERON CALDERON DANIEL': 'Daniel Calderon Calderon',
    'CANALES MEJIAS MELISSA': 'Melissa Canales Mejias',
    'CAMILA MEJIAS': 'Melissa Canales Mejias',
    'MEJIAS CAMILA': 'Melissa Canales Mejias',
    'FUENZALIDA IBANEZ BARBARA': 'Barbara Fuenzalida Ibañez',
    'HERNANDEZ  NORAMBUENA NICOLE': 'Nicole Hernandez Norambuena',
    'BENAVENTE CONTRERAS RODRIGO': 'Rodrigo Benavente Contreras',
    'DIAZ PONCE CAROLINA': 'Carolina Diaz Ponce',
    'GARRIDO MINO ARLETTE': 'Arlette Garrido Miño',
    'GUILLERMO RIVERA': 'Guillermo Rivera',
    'REEMPLAZO (ESTEBAN)': 'Esteban Canales',
    'REEMPLAZO ESTEBAN': 'Esteban Canales',
    'ESTEBAN': 'Esteban Canales',
    'ESTEBAN CANALES': 'Esteban Canales',
    'REEMPLAZO (MARIA ELIZABETH)': 'Maria Elizabeth',
    'Reemplazo (Maria Elizabeth)': 'Maria Elizabeth',
    'Reemplazo (María Elizabeth)': 'Maria Elizabeth',
    'MARIA JOSE PEÑAILILLO': 'Maria Jose Peñailillo',
    'TM MARIA JOSE PEÑAILILLO': 'Maria Jose Peñailillo',
    'REEMPLAZO CRISTIAN ANDRADE': 'Cristian Andrade',
    'CRISTIAN ANDRADE': 'Cristian Andrade',
    'REEMPLAZO IGNACIO': 'Ignacio Brunel',
    'IGNACIO BRUNEL': 'Ignacio Brunel',
    'IGNACIO': 'Ignacio Brunel',
    'REEMPLAZO TAMARA': 'Tamara Lara',
    'TAMARA LARA': 'Tamara Lara',
    'TAMARA': 'Tamara Lara',
    'JORGE MORAGA': 'Jorge Moraga',
    'TIARA ARAYA': 'Tiara Araya',
    'ERICA SANTELICES': 'Erica Santelices',
    'GABRIELA CHANDIA': 'Gabriela Chandia',
    'JORGE PEREZ': 'Jorge Perez',
    'OCIEL BELTRAN': 'Ociel Beltran',
    'SERGIO BRAVO': 'Sergio Bravo Caroca',
    'DANIELA CASTILLO': 'Daniela Castillo',
    'JAVIER MALPICA': 'Javier Malpica',
    'OLIVIA BELEN ROSALES': 'Olivia Belen Rosales',
    'LETICIA OLIVA': 'Leticia Oliva Albornoz',
    'VALENTINO BECERRA': 'Valentino Becerra',
    'NICOLAS BLANCO': 'Nicolas Blanco',
    'SALOMON CONEJERA': 'Salomon Conejera',
    'SUSANA SEPULVEDA': 'Susana Sepulveda',
    'PAMELA ALVAREZ': 'Pamela Alvarez Valdes',
    'CECILIA MEDEL': 'Cecilia Medel',
    'DEISY MORENO': 'Deisy Moreno',
    'SERGIO ROJO': 'Sergio Rojo',
    'ANA TOLEDO': 'Ana Toledo Ramos',
    'CAROLINA CAMPOS': 'Carolina Campos',
    'MICHELLE MIÑO': 'Michelle Miño',
    'ROSSANA ALBORNOZ': 'Rossana Albornoz Arenas',
    'LORETO RAMIREZ': 'Loreto Ramirez',
    'BARBARA CEPEDA': 'Barbara Cepeda Martinez',
    'BARBARA GUTIERREZ': 'Barbara Gutierrez Gomez',
    'CAROLINA VALENZUELA': 'Carolina Valenzuela Ramirez',
    'GUILLERMO ACUÑA': 'Guillermo Acuña Gonzalez',
    'JIMENA CACERES VALDES': 'Jimena Caceres Valdes',
    'VALERIA MONTES': 'Valeria Montes',
    'RODRIGO CANTERO': 'Rodrigo Cantero',
    'FRANCISCA CAMPOS': 'Francisca Campos Sepulveda',
    'FRANCISCA CAMPOS SEPULVEDA': 'Francisca Campos Sepulveda',
    'TM INT. JUAN BRAVO NOVOA': 'Juan Bravo Novoa (Interno TM)',
    'TM INT. FERNANDA TORRES COFRÉ': 'Fernanda Torres Cofré (Interna TM)',
    'TM INT. FERNANDO BARRERA C.': 'Fernando Barrera C. (Interno TM)',
    'TM INT. FRANCISCA URZÚA G.': 'Francisca Urzúa G. (Interna TM)',
    'TM INT. FRANCISCO SAN MARTÍN A.': 'Francisco San Martín A. (Interno TM)',
    'TM INT. JOHANA VALDÉS CARRASCO': 'Johana Valdés Carrasco (Interna TM)',
    'TM INT. LUCAS VALENZUELA R.': 'Lucas Valenzuela R. (Interno TM)',
    'TM INT. MAKARENA ZURITA O.': 'Makarena Zurita O. (Interna TM)',
    'TM INT. MARCIA VEGA C.': 'Marcia Vega C. (Interna TM)',
    'TM INT. MELISSA SILVA VILLAGRA': 'Melissa Silva Villagra (Interna TM)',
    'TM MARTIN MUÑOZ D.': 'Martin Muñoz D. (Interno TM)',
}

def is_non_person(name):
    clean = name.strip()
    for pat in NON_PERSON_PATTERNS:
        if re.search(pat, clean, flags=re.I):
            return True
    return False

# Manual known RUT dictionary
KNOWN_RUTS = {
    'Guillermo Rivera': '18.892.014-4',
    'Jorge Moraga': '17.795.876-K',
    'Tiara Araya': '18.982.762-8',
    'Erica Santelices': '19.805.795-9',
    'Gabriela Chandia': '18.893.934-1',
    'Jorge Perez': '17.884.899-2',
    'Ociel Beltran': '20.367.852-5',
    'Sergio Bravo Caroca': '12.869.248-7',
    'Daniela Castillo': '18.981.532-8',
    'Javier Malpica': '18.905.196-4',
    'Olivia Belen Rosales': '17.171.464-8',
    'Leticia Oliva Albornoz': '17.825.088-4',
    'Valentino Becerra': '18.543.174-6',
    'Susana Santos': '18.474.372-8',
    'Nicolas Blanco': '20.305.562-5',
    'Jeanette San Martín': '18.474.938-6',
    'Arlett Hormazabal Cardenas': '18.573.118-9',
    'Consuelo Cerda Wehinger': '16.858.185-8',
    'Juan Cerpa Castillo': '17.481.858-4',
    'Romina Diaz Espinoza': '16.452.193-1',
    'Marcela Salgado Carreño': '15.598.712-1',
    'Miryam Espina Herrera': '11.643.219-5',
    'Carolina Arancibia Jara': '13.305.532-K',
    'Alejandra Vorphal Vasquez': '15.597.023-5',
    'Daniel Calderon Calderon': '16.325.454-9',
    'Melissa Canales Mejias': '18.891.582-5',
    'Barbara Fuenzalida Ibañez': '13.201.301-2',
    'Nicole Hernandez Norambuena': '17.824.912-6',
    'Rodrigo Benavente Contreras': '15.596.995-4',
    'Carolina Diaz Ponce': '15.599.121-6',
    'Arlette Garrido Miño': '16.275.312-6',
    'Salomon Conejera': '10.105.861-1',
    'Susana Sepulveda': '10.892.073-4',
    'Pamela Alvarez Valdes': '11.893.938-7',
    'Rosa Bernal Muñoz': '13.372.467-2',
    'Jimena Caceres Valdes': '10.237.028-7',
    'Consuelo Alarcon': '17.684.739-5',
    'Guillermo Acuña Gonzalez': '18.571.660-3',
    'Constanza Gomez Sepulveda': '19.172.843-2',
    'Carolina Valenzuela Ramirez': '16.729.277-1',
    'Lucia Peña': '11.147.047-2',
    'Ana Toledo Ramos': '13.205.345-6',
    'Rossana Albornoz Arenas': '14.295.792-2',
    'Sergio Rojo': '15.596.799-4',
    'Loreto Ramirez': '16.270.558-K',
    'Deisy Moreno': '16.453.944-K',
    'Barbara Gutierrez Gomez': '17.497.764-K',
    'Elieser Valdebenito': '17.845.030-1',
    'Barbara Cepeda Martinez': '18.225.862-8',
    'Michelle Miño': '19.473.563-4',
    'Carolina Campos': '19.696.154-2',
    'Esmeralda Abarza': '20.070.227-1',
    'Francisca Campos Sepulveda': '19.473.128-0',
    'Juan Bravo Novoa (Interno TM)': '21.381.113-4',
    'Fernanda Torres Cofré (Interna TM)': '21.480.189-2',
    'Fernando Barrera C. (Interno TM)': '20.194.193-8',
    'Francisca Urzúa G. (Interna TM)': '20.350.835-2',
    'Francisco San Martín A. (Interno TM)': '21.028.706-K',
    'Johana Valdés Carrasco (Interna TM)': '21.432.595-0',
    'Lucas Valenzuela R. (Interno TM)': '20.926.367-K',
    'Makarena Zurita O. (Interna TM)': '19.748.642-2',
    'Marcia Vega C. (Interna TM)': '20.349.105-0',
    'Melissa Silva Villagra (Interna TM)': '21.604.468-1',
    'Martin Muñoz D. (Interno TM)': '21.003.614-8'
}

staff_db = {}

def register_person(raw_name, rut_hint="", role_hint="", section_hint="", sheet=""):
    if not raw_name or is_non_person(raw_name):
        return None
        
    canon_name = CANON_MAP.get(raw_name.strip().upper(), None)
    if not canon_name:
        # Check partial
        clean_upper = re.sub(r'\(.*?\)', '', raw_name).strip().upper()
        canon_name = CANON_MAP.get(clean_upper, None)
    if not canon_name:
        canon_name = raw_name.strip().title()
        
    pid = re.sub(r'[^a-z0-9]', '_', norm(canon_name).lower())
    
    if pid not in staff_db:
        # Determine rut
        rut = KNOWN_RUTS.get(canon_name, "")
        if not rut and rut_hint:
            rut = rut_hint
            
        role = role_hint
        if not role or role == 'Personal':
            if 'Intern' in canon_name:
                role = 'Interno TM'
            elif any(s in sheet for s in ['PROFESIONALES']):
                role = 'Profesional'
            elif any(s in sheet for s in ['TENS']):
                role = 'TENS'
            elif any(s in sheet for s in ['AUXILIAR']):
                role = 'Auxiliar'
            else:
                role = 'TENS'
                
        section = section_hint or ('Urgencia' if 'URGENCIA' in sheet else ('Rutina TENS' if 'TENS' in sheet else ('Profesionales' if 'PROFESIONAL' in sheet else 'Auxiliares')))
        
        missing = []
        if not rut:
            missing.append('RUT pendiente')
        if len(canon_name.split()) < 2:
            missing.append('Segundo apellido pendiente')
            
        staff_db[pid] = {
            'id': pid,
            'name': canon_name,
            'rut': rut,
            'role': role,
            'section': section,
            'sheets': [sheet],
            'missing_fields': missing,
            'is_intern': 'Intern' in canon_name,
            'is_replacement': 'reemplazo' in raw_name.lower() or 'cristian andrade' in raw_name.lower() or 'esteban' in raw_name.lower() or 'elizabeth' in raw_name.lower() or 'tamara' in raw_name.lower()
        }
    else:
        if sheet not in staff_db[pid]['sheets']:
            staff_db[pid]['sheets'].append(sheet)
        if not staff_db[pid]['rut'] and rut_hint:
            staff_db[pid]['rut'] = rut_hint
            if 'RUT pendiente' in staff_db[pid]['missing_fields']:
                staff_db[pid]['missing_fields'].remove('RUT pendiente')
                
    return staff_db[pid]

# Now let us systematically parse each sheet with correct logic
turns_2026 = []
tdm_2026 = []

wb = openpyxl.load_workbook("TURNOS 2026.xlsx", data_only=True)
months_es = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']

COLOR_MAP = {
    'FFFF0000': 'VACACIONES',         # Red (Feriado legal)
    'FFFFFF00': 'ADMINISTRATIVO',     # Yellow (Dias administrativos)
    'FF00B0F0': 'PERMISO_TARDE',      # Cyan
    'FFFF00FF': 'DEVOLUCION_TIEMPO',  # Magenta (Horas extras / devolucion)
    'FFD5A6BD': 'COMISION_SERVICIO',  # Pink / Comision (*)
    'FF000000': 'NO_CUMPLIDO_SN',    # Black
    'FFB7B7B7': 'ENCARGADO_TURNO',    # Grey
    'FF0B5394': 'SIN_GOCE_SUELDO',    # Dark Blue
    'FFFFC000': 'FIN_SEMANA',         # Orange header
}

for sheetname in wb.sheetnames:
    ws = wb[sheetname]
    current_month = None
    day_cols = {}
    current_section = ""
    current_role = "Profesional" if "PROFESIONAL" in sheetname.upper() else ("TENS" if "TENS" in sheetname.upper() else ("Auxiliar" if "AUXILIAR" in sheetname.upper() else "TENS"))
    
    for r in range(1, ws.max_row + 1):
        c1 = str(ws.cell(row=r, column=1).value or '').strip()
        c2 = str(ws.cell(row=r, column=2).value or '').strip()
        c3 = str(ws.cell(row=r, column=3).value or '').strip()
        c4 = str(ws.cell(row=r, column=4).value or '').strip()
        row_str = f"{c1} {c2} {c3} {c4}".upper()
        
        # Month detection
        for m_idx, m_name in enumerate(months_es):
            if f"TURNOS {m_name}" in row_str or (row_str.strip() == m_name) or (f"{m_name} 2026" in row_str):
                current_month = m_idx + 1
                day_cols = {}
                break
                
        # Section detection
        if any(s in c2.upper() for s in ['HEMATOLOG', 'INMUNOQU', 'MICROBIOLOG', 'URGENCIA Y BIOLOG', 'ADMINISTRATIVA']):
            current_section = c2.title()
            continue
            
        if "PROFESIONALES" in c1.upper() or "PROFESIONALES" in c2.upper():
            current_role = "Profesional"
        elif "TENS" in c1.upper() or "TENS" in c2.upper():
            current_role = "TENS"
            
        # Day row detection
        nums_found = {}
        for c in range(2, min(ws.max_column + 1, 38)):
            val = ws.cell(row=r, column=c).value
            if isinstance(val, (int, float)) and 1 <= int(val) <= 31:
                nums_found[c] = int(val)
        if len(nums_found) >= 15:
            day_cols = nums_found
            continue
            
        if current_month and day_cols:
            person_raw = ""
            rut_hint = ""
            time_slot = ""
            
            if sheetname == 'LAB. URGENCIA':
                person_raw = c1
                rut_hint = c2 if re.search(r'\d', c2) else ""
            elif sheetname in ['TENS RUTINA', 'PROFESIONALES RUTINA']:
                person_raw = c2 if c2 else c1
            elif sheetname == 'AUXILIARES ':
                person_raw = c1
            elif sheetname == 'TOMA DE MUESTRA':
                time_slot = c1
                person_raw = c2
                
            staff_obj = register_person(person_raw, rut_hint=rut_hint, role_hint=current_role, section_hint=current_section, sheet=sheetname)
            if not staff_obj:
                continue
                
            for c_idx, day_num in day_cols.items():
                cell = ws.cell(row=r, column=c_idx)
                val = str(cell.value or '').strip()
                color = None
                if cell.fill and cell.fill.start_color and cell.fill.start_color.rgb:
                    color = COLOR_MAP.get(str(cell.fill.start_color.rgb), None)
                    
                if val or (color and color in ['VACACIONES', 'ADMINISTRATIVO', 'PERMISO_TARDE', 'DEVOLUCION_TIEMPO', 'COMISION_SERVICIO', 'SIN_GOCE_SUELDO']):
                    date_str = f"2026-{current_month:02d}-{day_num:02d}"
                    event_type = "TURNO"
                    if color == 'VACACIONES': event_type = "VACACIONES"
                    elif color == 'ADMINISTRATIVO': event_type = "ADMINISTRATIVO"
                    elif color == 'DEVOLUCION_TIEMPO': event_type = "DEVOLUCION_TIEMPO"
                    elif color == 'COMISION_SERVICIO': event_type = "COMISION_SERVICIO"
                    elif color == 'SIN_GOCE_SUELDO': event_type = "SIN_GOCE_SUELDO"
                    elif color == 'PERMISO_TARDE': event_type = "PERMISO_TARDE"
                    
                    item = {
                        'date': date_str,
                        'month': current_month,
                        'day': day_num,
                        'staff_id': staff_obj['id'],
                        'staff_name': staff_obj['name'],
                        'role': staff_obj['role'],
                        'section': staff_obj['section'],
                        'sheet': sheetname,
                        'code': val,
                        'event_type': event_type,
                        'time_slot': time_slot,
                        'color_tag': color
                    }
                    if sheetname == 'TOMA DE MUESTRA':
                        tdm_2026.append(item)
                    else:
                        turns_2026.append(item)

print(f"Refined Staff count: {len(staff_db)}")
print(f"Refined Shifts count: {len(turns_2026)}")
print(f"Refined TDM assignments: {len(tdm_2026)}")

# Save to clean JSON
with open('data/staff_master.json', 'w', encoding='utf-8') as f:
    json.dump(staff_db, f, ensure_ascii=False, indent=2)

with open('data/turns_2026.json', 'w', encoding='utf-8') as f:
    json.dump(turns_2026, f, ensure_ascii=False, indent=2)

with open('data/tdm_2026.json', 'w', encoding='utf-8') as f:
    json.dump(tdm_2026, f, ensure_ascii=False, indent=2)

# Generate Chilean Holidays for 2026 and 2027
holidays = {
    '2026': [
        {'date': '2026-01-01', 'name': 'Año Nuevo'},
        {'date': '2026-04-03', 'name': 'Viernes Santo'},
        {'date': '2026-04-04', 'name': 'Sábado Santo'},
        {'date': '2026-05-01', 'name': 'Día del Trabajador'},
        {'date': '2026-05-21', 'name': 'Día de las Glorias Navales'},
        {'date': '2026-06-21', 'name': 'Día Nacional de los Pueblos Indígenas'},
        {'date': '2026-06-29', 'name': 'San Pedro y San Pablo'},
        {'date': '2026-07-16', 'name': 'Día de la Virgen del Carmen'},
        {'date': '2026-08-15', 'name': 'Asunción de la Virgen'},
        {'date': '2026-09-18', 'name': 'Independencia Nacional'},
        {'date': '2026-09-19', 'name': 'Día de las Glorias del Ejército'},
        {'date': '2026-10-12', 'name': 'Encuentro de Dos Mundos'},
        {'date': '2026-10-31', 'name': 'Día de las Iglesias Evangélicas'},
        {'date': '2026-11-01', 'name': 'Día de Todos los Santos'},
        {'date': '2026-12-08', 'name': 'Inmaculada Concepción'},
        {'date': '2026-12-25', 'name': 'Navidad'}
    ],
    '2027': [
        {'date': '2027-01-01', 'name': 'Año Nuevo'},
        {'date': '2027-03-26', 'name': 'Viernes Santo'},
        {'date': '2027-03-27', 'name': 'Sábado Santo'},
        {'date': '2027-05-01', 'name': 'Día del Trabajador'},
        {'date': '2027-05-21', 'name': 'Día de las Glorias Navales'},
        {'date': '2027-06-21', 'name': 'Día Nacional de los Pueblos Indígenas'},
        {'date': '2027-06-28', 'name': 'San Pedro y San Pablo'},
        {'date': '2027-07-16', 'name': 'Día de la Virgen del Carmen'},
        {'date': '2027-08-15', 'name': 'Asunción de la Virgen'},
        {'date': '2027-09-17', 'name': 'Feriado Adicional Fiestas Patrias'},
        {'date': '2027-09-18', 'name': 'Independencia Nacional'},
        {'date': '2027-09-19', 'name': 'Día de las Glorias del Ejército'},
        {'date': '2027-10-11', 'name': 'Encuentro de Dos Mundos'},
        {'date': '2027-10-31', 'name': 'Día de las Iglesias Evangélicas'},
        {'date': '2027-11-01', 'name': 'Día de Todos los Santos'},
        {'date': '2027-12-08', 'name': 'Inmaculada Concepción'},
        {'date': '2027-12-25', 'name': 'Navidad'}
    ]
}

with open('data/holidays_chile.json', 'w', encoding='utf-8') as f:
    json.dump(holidays, f, ensure_ascii=False, indent=2)

print("Database completely built and saved.")
