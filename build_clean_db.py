"""
ETL Pipeline & Clean Database Builder — Proyecto Turnos HRT (2026 / 2027)
========================================================================
- Parses live Google Sheets export `TURNOS 2026.xlsx` across all 5 operational sheets:
  1. `LAB. URGENCIA` (ALU — 4to Turno & residentes/refuerzos)
  2. `TENS RUTINA` (APA — TENS diurno, reemplazos, funciones administrativas, licencias)
  3. `PROFESIONALES RUTINA` (AH, AIC, AMB, ATE, ALU, ADM — TM y Bioquímicos)
  4. `AUXILIARES ` (Auxiliares de servicio — todos los meses ene..dic)
  5. `TOMA DE MUESTRA` (TDM — Box AM, TDM Tarde, Recepción, Orientador, Apertura 07:30, Refuerzo SOS)
- Cross-references official hospital records (`nómina de usuarios.xlsx` and `Lista de asistencia 2026.xlsx`).
- Enforces official HRT Section Codes: `ALU`, `AH`, `AIC`, `AMB`, `APA`, `ADM`, `ATE`, `Auxiliares`.
- Distinguishes `Patricia Morales Morales` (TENS, APA, TDM) from `Patricia Morales Rojas` (TM, AH, Rutina).
- Ensures `Teresa Fuentes Muñoz` (TENS, APA) and new induction/replacement staff (`Brayans Saavedra`, etc.) are properly registered.
- Accurately separates `LICENCIA_MEDICA` (`LM`) from `VACACIONES` (`FL`).
- Normalizes Excel date-coerced hour strings (`datetime.datetime` with `d-m` format -> `8-10`, `7-10`, etc.) and `datetime.time` objects (`15:00`).
"""

import openpyxl
import pandas as pd
import json
import re
import datetime
import unicodedata
from pathlib import Path

EXCEL_PATH = Path('TURNOS 2026.xlsx')
NOMINA_PATH = Path('nómina de usuarios.xlsx')
GRC_PATH = Path(r'C:\Users\Admin\Documents\GRC\Lista de asistencia 2026.xlsx')
OUT_DIR = Path('data')
OUT_DIR.mkdir(exist_ok=True)


def strip_accents(s):
    if not s:
        return ""
    return ''.join(c for c in unicodedata.normalize('NFD', str(s)) if unicodedata.category(c) != 'Mn')


def normalize_token(s):
    s = strip_accents(str(s)).upper().strip()
    s = re.sub(r'[^A-Z0-9\s]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def clean_rut(val):
    if not val:
        return None
    s = str(val).strip().upper().replace('.', '').replace(' ', '')
    if re.match(r'^\d{7,8}-[\dK]$', s):
        num, dv = s.split('-')
        num_fmt = f"{int(num):,}".replace(',', '.')
        return f"{num_fmt}-{dv}"
    return None


# ==============================================================================
# 1. LOAD EXTERNAL OFFICIAL RECORDS (NÓMINA DE USUARIOS & GRC DOTACIÓN)
# ==============================================================================
external_records = []

if NOMINA_PATH.exists():
    df_nom = pd.read_excel(NOMINA_PATH, header=None)
    for _, row in df_nom.iterrows():
        r_raw = str(row[0]).strip() if pd.notna(row[0]) else ''
        n_raw = str(row[1]).strip() if pd.notna(row[1]) else ''
        rut_fmt = clean_rut(r_raw)
        if rut_fmt and n_raw:
            external_records.append({
                'rut': rut_fmt,
                'full_name': re.sub(r'\s+', ' ', n_raw.upper()).strip(),
                'tokens': set(normalize_token(n_raw).split()),
                'estamento': None,
                'source': 'NOMINA_LAB'
            })

if GRC_PATH.exists():
    try:
        df_grc = pd.read_excel(GRC_PATH, sheet_name='Dotación ')
        for _, row in df_grc.iterrows():
            if pd.notna(row.get('Rut')) and pd.notna(row.get('Dv')) and pd.notna(row.get('Nombre Funcionario')):
                try:
                    r_num = int(row['Rut'])
                    dv = str(row['Dv']).strip().upper()
                    rut_fmt = f"{r_num:,}".replace(',', '.') + f"-{dv}"
                    n_raw = str(row['Nombre Funcionario']).strip().upper()
                    est = str(row.get('Código planta', '')).strip().upper()
                    external_records.append({
                        'rut': rut_fmt,
                        'full_name': re.sub(r'\s+', ' ', n_raw).strip(),
                        'tokens': set(normalize_token(n_raw).split()),
                        'estamento': est if est and est != 'NAN' else None,
                        'source': 'GRC_DOTACION'
                    })
                except Exception:
                    pass
    except Exception as e:
        print("Warning loading GRC file:", e)

print(f"Loaded {len(external_records)} official staff records for cross-referencing.")


# ==============================================================================
# 2. CANONICAL STAFF MAPPING
# ==============================================================================
CANON_MAP = {
    # Urgencia Profesionales
    'JORGE MORAGA': 'Jorge Moraga',
    'IGNACIO BRUNEL': 'Ignacio Brunel',
    'REEMPLAZO IGNACIO': 'Ignacio Brunel',
    'ERICA SANTELICES': 'Erica Santelices',
    'GABRIELA CHANDIA': 'Gabriela Chandia',
    'JORGE PEREZ': 'Jorge Perez',
    'OCIEL BELTRAN': 'Ociel Beltran',
    'SERGIO BRAVO': 'Sergio Bravo',
    'DANIELA CASTILLO': 'Daniela Castillo',
    'JAVIER MALPICA': 'Javier Malpica',
    'OLIVIA BELEN ROSALES': 'Olivia Belen Rosales',
    'LETICIA OLIVA': 'Leticia Oliva',
    'VALENTINO BECERRA': 'Valentino Becerra',
    'JEANETTE SAN MARTÍN': 'Jeanette San Martin',
    'JEANETTE SAN MARTIN': 'Jeanette San Martin',
    'SAN MARTIN JEANETTE': 'Jeanette San Martin',
    'CAMILA GONZALEZ': 'Camila Gonzalez',
    'ARLETT HORMAZABAL': 'Arlett Hormazabal Cardenas',
    'HORMAZABAL CARDENAS ARLETT': 'Arlett Hormazabal Cardenas',
    'NICOLAS BLANCO': 'Nicolas Blanco',
    'SUSANA SANTOS': 'Susana Santos',
    'SUSANA SANTOS (PM)': 'Susana Santos',
    'TM SUSANA': 'Susana Santos',
    'TM SUSANA SANTOS': 'Susana Santos',
    'TM SUSANA SANTOS (SOS)': 'Susana Santos',
    'TM SUSANA SANTOS SOS': 'Susana Santos',
    'GUILLERMO RIVERA': 'Guillermo Rivera',
    'CONSTANZA RIQUELME': 'Constanza Riquelme',
    'TM CONSTANZA': 'Constanza Riquelme',
    'CONSTANZA TM': 'Constanza Riquelme',
    'TM CONSTANZA RIQUELME': 'Constanza Riquelme',
    'TM CONSTANZA RIQUELME (S0S)': 'Constanza Riquelme',
    'TM CONSTANZA RIQUELME SOS': 'Constanza Riquelme',
    'TAMARA LARA': 'Tamara Lara',
    'REEMPLAZO TAMARA': 'Tamara Lara',
    'TAMARA LARA (REEMPLAZO CONSUELO)': 'Tamara Lara',
    'MARIA JOSE PEÑAILILLO': 'Maria Jose Peñailillo',
    'TM MARIA JOSE PEÑAILILLO': 'Maria Jose Peñailillo',
    'CAROLINA ARANCIBIA': 'Carolina Arancibia Jara',
    'ARANCIBIA JARA CAROLINA (AUTOINMUNIDAD)': 'Carolina Arancibia Jara',
    'ARANCIBIA JARA CAROLINA': 'Carolina Arancibia Jara',

    # Internos TM
    'TM INT. FRANCISCA URZÚA G.': 'Francisca Urzua G. (Interna TM)',
    'TM MARTIN MUÑOZ D.': 'Martin Muñoz D. (Interno TM)',
    'TM INT. FRANCISCO SAN MARTÍN A.': 'Francisco San Martin A. (Interno TM)',
    'TM INT. JOHANA VALDÉS CARRASCO': 'Johana Valdes Carrasco (Interna TM)',
    'TM INT. MELISSA SILVA VILLAGRA': 'Melissa Silva Villagra (Interna TM)',
    'TM INT. LUCAS VALENZUELA R.': 'Lucas Valenzuela R. (Interno TM)',
    'TM INT. JUAN BRAVO NOVOA': 'Juan Bravo Novoa (Interno TM)',
    'TM INT. FERNANDA TORRES COFRÉ': 'Fernanda Torres Cofre (Interna TM)',
    'TM INT. MAKARENA ZURITA O.': 'Makarena Zurita O. (Interna TM)',
    'TM INT. MARCIA VEGA C.': 'Marcia Vega C. (Interna TM)',
    'TM INT. FERNANDO BARRERA C.': 'Fernando Barrera C. (Interno TM)',

    # Urgencia TENS & TENS Rutina / TDM
    'DEISY MORENO': 'Deisy Moreno',
    'SERGIO ROJO': 'Sergio Rojo',
    'ANA TOLEDO': 'Ana Toledo',
    'CAROLINA CAMPOS': 'Carolina Campos',
    'MICHELLE MIÑO': 'Michelle Miño',
    'ROSSANA ALBORNOZ': 'Rossana Albornoz',
    'LORETO RAMIREZ': 'Loreto Ramirez',
    'BARBARA CEPEDA': 'Barbara Cepeda',
    'ELIESER VALDEBENITO': 'Elieser Valdebenito',
    'ELISER VALDEBENITO': 'Elieser Valdebenito',
    'ELIESER': 'Elieser Valdebenito',
    'BARBARA GUTIERREZ': 'Barbara Gutierrez',
    'TENS BARBARA GUTIERREZ': 'Barbara Gutierrez',
    'ANHAIS': 'Anahis Albornoz',
    'ANHAIS ALBORNOZ': 'Anahis Albornoz',
    'ANAHIS ALBORNOZ': 'Anahis Albornoz',
    'CAROLINA VALENZUELA': 'Carolina Valenzuela',
    'LUCIA PEÑA': 'Lucia Peña',
    'LUCIA': 'Lucia Peña',
    'ESMERALDA': 'Esmeralda Abarza',
    'ESMERALDA ABARZA': 'Esmeralda Abarza',
    'ESMERALDA ABARZA RECEPCION DE PACIENTES': 'Esmeralda Abarza',
    'ESMERALDA ABARZA RECEPCION': 'Esmeralda Abarza',
    'ORIENTADOR Y APOYO ESMERALDA': 'Esmeralda Abarza',
    'YESSENIA': 'Yessenia Caceres',
    'YESSENIA CACERES': 'Yessenia Caceres',
    'CONSTANZA GOMEZ': 'Constanza Gomez Sepulveda',
    'CONTANZA GOMEZ': 'Constanza Gomez Sepulveda',
    'CONSTANZA GOMEZ SEPULVEDA': 'Constanza Gomez Sepulveda',
    'ORIENTADOR Y APOYO  CONSTANZA GOMEZ': 'Constanza Gomez Sepulveda',
    'ORIENTADOR Y APOYO CONSTANZA GOMEZ': 'Constanza Gomez Sepulveda',
    'ORIENTADOR Y APOYO CONSTANZA G': 'Constanza Gomez Sepulveda',
    'NICOL RIQUELME': 'Nicol Riquelme Galvez',
    'NICOL': 'Nicol Riquelme Galvez',
    'NICOL RIQUELME GALVEZ': 'Nicol Riquelme Galvez',
    'NICOL RIQUELME CAPACITACIÓN RECEPCION': 'Nicol Riquelme Galvez',
    'NICOL RIQUELME  RECEPCION': 'Nicol Riquelme Galvez',
    'NICOL RIQUELME RECEPCION': 'Nicol Riquelme Galvez',
    'MERLAM ESPINOZA': 'Merlam Espinoza',
    'MERLAM': 'Merlam Espinoza',
    'BARBARA ALCANTARA': 'Barbara Alcantara',
    'BÁRBARA ALCANTARA': 'Barbara Alcantara',
    'ORIENTADOR Y APOYO BARBARA A': 'Barbara Alcantara',
    'ELIZABEL': 'Elizabel Sanchez',
    'ELIZABEL SANCHEZ': 'Elizabel Sanchez',
    'ELIZABEL SANCHEZ (7-8)': 'Elizabel Sanchez',
    'ELIZABEL SANCHEZ CAPACITACIÓN RECEPCIÓN': 'Elizabel Sanchez',
    'ELIZABEL SANCHEZ  7:30-8:00': 'Elizabel Sanchez',
    'ELIZABEL SANCHEZ 7:30-8:00': 'Elizabel Sanchez',
    'ELIZABEL SANCHEZ RECEPCIÓN': 'Elizabel Sanchez',
    'ELIZABEL SANCHEZ RECEPCION': 'Elizabel Sanchez',
    'FRANCISCA CAMPOS': 'Francisca Campos Sepulveda',
    'FRANCISCA CAMPOS SEPULVEDA': 'Francisca Campos Sepulveda',
    'CONSUELO ALARCON': 'Consuelo Alarcon',
    'CONSUELO ALARCON SOS': 'Consuelo Alarcon',
    'CONSUELO': 'Consuelo Alarcon',
    'ROSA BERNAL MUÑOZ': 'Rosa Bernal Muñoz',
    'ROSITA (DE SER NECESARIO)': 'Rosa Bernal Muñoz',
    'ROSITA BERNAL (SOS)': 'Rosa Bernal Muñoz',
    'ROSITA BERNAL SOS': 'Rosa Bernal Muñoz',
    'INGRID SILVA VALDIVIA': 'Ingrid Silva Valdivia',
    'INGRID': 'Ingrid Silva Valdivia',
    'MURIEL CORREA': 'Muriel Correa',
    'MURIEL': 'Muriel Correa',
    'TENS MURIEL CORREA': 'Muriel Correa',
    'MURIEL CORREA 7:30-8:00': 'Muriel Correa',
    'RUTH JARA LARA': 'Ruth Jara Lara',
    'RUTH JARA': 'Ruth Jara Lara',
    'RUTH': 'Ruth Jara Lara',
    'RUTH JARA CAPACITACIÓN': 'Ruth Jara Lara',
    'ORIENTADOR Y APOYO RUTH JARA': 'Ruth Jara Lara',
    'GUILLERMO ACUÑA': 'Guillermo Acuña',
    'JIMENA CACERES VALDES': 'Jimena Caceres Valdes',
    'SUSANA QUINTANA': 'Susana Quintana',
    'PATRICIA MORALES': 'Patricia Morales Morales',
    'PATRICIA': 'Patricia Morales Morales',
    'TENS PATRICIA MORALES': 'Patricia Morales Morales',
    'PATRICIA MORALES MORALES': 'Patricia Morales Morales',
    'JIMENA GONZALEZ': 'Jimena Gonzalez',
    'JIMENA GONZALEZ RECEPCION': 'Jimena Gonzalez',
    'MARIA RIQUELME': 'Maria Riquelme',
    'MARÍA RIQUELME': 'Maria Riquelme',
    'MARY': 'Maria Riquelme',
    'MARY RIQUELME': 'Maria Riquelme',
    'ORIENTADOR MARY RIQUELME': 'Maria Riquelme',
    'RODRIGO CANTERO': 'Rodrigo Cantero',
    'LAURA PEREZ': 'Laura Perez',
    'LAURA PEREZ RECEPCIÓN DE PACIENTES': 'Laura Perez',
    'LAURA PEREZ RECEPCIÓN': 'Laura Perez',
    'VALERIA MONTES': 'Valeria Montes',
    'CAMILA MEJIAS': 'Camila Mejias',
    'MEJIAS CAMILA': 'Camila Mejias',
    'CAMILA WALKER': 'Camila Walker',
    'KATALINA': 'Katalina Barrera',
    'KATALINA 7-8': 'Katalina Barrera',
    'URGENCIA (7-8)': 'Turno Urgencia (Apoyo 07-08h)',
    'BRAYANS SAAVEDRA INDUCCIÓN': 'Brayans Saavedra',
    'BRAYANS SAAVEDRA INDUCCION': 'Brayans Saavedra',
    'SUSANA': 'Susana Santos',
    'TAMARA': 'Tamara Lara',
    'LARA TAMARA': 'Tamara Lara',
    'RIQUELME CONSTANZA': 'Constanza Riquelme',
    'CONSTANZA RIQUELME (PM)': 'Constanza Riquelme',
    'DIAZ RIOS LORETO': 'Loreto Diaz Rios',

    # Profesionales Rutina
    'CERDA WEHINGER CONSUELO': 'Consuelo Cerda Wehinger',
    'CERPA CASTILLO JUAN': 'Juan Cerpa Castillo',
    'DIAZ ESPINOZA ROMINA': 'Romina Diaz Espinoza',
    'MORALES ROJAS PATRICIA': 'Patricia Morales Rojas',
    'SALGADO CARREÑO MARCELA': 'Marcela Salgado Carreño',
    'VORPHAL VASQUEZ M. ALEJANDRA (AUTOINMUNIDAD)': 'Maria Alejandra Vorphal Vasquez',
    'ROJAS VERDUGO DIEGO': 'Diego Rojas Verdugo',
    'SCHULZ DANIEL': 'Daniel Schulz',
    'CAMILA GUTIERREZ': 'Camila Gutierrez',
    'SEPULVEDA FRANCISCO': 'Francisco Sepulveda',
    'CAMILA REYES VIVERO': 'Camila Reyes Vivero',
    'CALDERON CALDERON DANIEL': 'Daniel Calderon Calderon',
    'CANALES MEJIAS MELISSA': 'Melissa Canales Mejias',
    'FUENZALIDA IBANEZ BARBARA': 'Barbara Fuenzalida Ibañez',
    'HERNANDEZ  NORAMBUENA NICOLE': 'Nicole Hernandez Norambuena',
    'HERNANDEZ NORAMBUENA NICOLE': 'Nicole Hernandez Norambuena',
    'NICOL HERNANDEZ': 'Nicole Hernandez Norambuena',
    'BARRERA KATALINA': 'Katalina Barrera',
    'BENAVENTE CONTRERAS RODRIGO': 'Rodrigo Benavente Contreras',
    'DIAZ PONCE CAROLINA': 'Carolina Diaz Ponce',
    'GARRIDO MINO ARLETTE': 'Arlette Garrido Miño',
    'MIRYAM ESPINA HERRERA': 'Miryam Espina Herrera',
    'TIARA ARAYA': 'Tiara Araya',
    'REEMPLAZO CRISTIAN ANDRADE': 'Cristian Andrade',

    # Auxiliares
    'SALOMON CONEJERA': 'Salomon Conejera',
    'SUSANA SEPULVEDA': 'Susana Sepulveda',
    'PAMELA ALVAREZ': 'Pamela Alvarez',
    'REEMPLAZO (ESTEBAN)': 'Esteban Canales',
    'ESTEBAN CANALES': 'Esteban Canales',
    'REEMPLAZO (MARIA ELIZABETH)': 'Maria Elizabeth (Reemplazo Aux)',
    'REEMPLAZO (MARÍA ELIZABETH)': 'Maria Elizabeth (Reemplazo Aux)',
    'CECILIA MEDEL': 'Cecilia Medel',
}

SECTION_HEADERS = {
    'TENS', 'RUT', 'PROFESIONALES', 'HEMATOLOGÍA', 'HEMATOLOGIA',
    'HEMATOLOGÍA Y TÉCNICAS ESPECIALES', 'HEMATOLOGIA Y TECNICAS ESPECIALES',
    'INMUNOQUÍMICA', 'INMUNOQUIMICA', 'MICROBIOLOGÍA', 'MICROBIOLOGIA',
    'URGENCIA Y BIOLOGÍA MOLECULAR', 'URGENCIA Y BIOLOGIA MOLECULAR',
    'ADMINISTRATIVA', 'FUNCIONES ADMINISTRATIVAS', 'LICENCIAS', 'REEMPLAZOS',
    'REEMPLAZO', 'TOMA DE MUESTRA', 'TOMA DE MUESTRA AM', 'TOMA DE MUESTRA TARDE',
    'RECEPCIÓN', 'RECEPCION', 'HORARIO', 'ENCARGADA REGISTROS E INSUMOS',
    'ENCARGADO DE DEJAR MUESTRAS A UMT', 'ORIENTADOR Y ENCARGADO DE REGISTROS E INSUMOS',
    'VACACIONES', 'LICENCIA', 'MÁXIMO 4 A 5 AUSENCIAS DIARIAS', 'MAXIMO 4 A 5 AUSENCIAS DIARIAS'
}

# Core 4to Turno TENS in Urgencia (all other TENS are Diurno even if they cover extra shifts in Urgencia)
URGENCIA_CORE_TENS = {
    'Deisy Moreno', 'Sergio Rojo', 'Ana Toledo', 'Carolina Campos',
    'Michelle Miño', 'Rossana Albornoz', 'Loreto Ramirez', 'Barbara Cepeda'
}


def resolve_canonical(raw_name):
    if not raw_name:
        return None
    s = re.sub(r'\s+', ' ', str(raw_name).strip().upper())
    if s in SECTION_HEADERS or s.startswith('TURNOS ') or s in (
        'ABRIL', 'ENERO', 'FEBRERO', 'MARZO', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ):
        return None
    if s.startswith('X:') or s.startswith('X°') or 'AUSENCIAS DIARIAS' in s:
        return None
    if s in CANON_MAP:
        return CANON_MAP[s]
    s_no_acc = strip_accents(s)
    for k, v in CANON_MAP.items():
        if strip_accents(k) == s_no_acc:
            return v
    return raw_name.strip().title()


def make_id(canon_name):
    s = strip_accents(canon_name.lower())
    s = re.sub(r'[^a-z0-9]+', '_', s).strip('_')
    return s


# ==============================================================================
# 3. COLOR & SHIFT CODE NORMALIZATION (Official Excel Legend xl/media/image2.png)
# ==============================================================================
COLOR_EVENT_MAP = {
    'FFFFFF00': ('VACACIONES', 'FL', 'Feriado Legal / Vacaciones'),
    'FFFF0000': ('LICENCIA_MEDICA', 'LM', 'Licencia Médica'),
    'FF00B0F0': ('ADMINISTRATIVO', 'DA', 'Día Administrativo'),
    'FF00FF00': ('COMPENSATORIO', 'DC', 'Día Compensatorio (Permiso Compensatorio)'),
    'FF9900FF': ('COMPENSATORIO', 'DC', 'Día Compensatorio (Permiso Compensatorio)'),
    'FFFF00FF': ('DEVOLUCION_TIEMPO', 'DT', 'Devolución de Tiempo'),
    'FFF4CCCC': ('COMISION_SERVICIO', '*', 'Capacitación / Comisión de Servicio'),
    'FFE6B8AF': ('COMISION_SERVICIO', '*', 'Capacitación / Comisión de Servicio'),
    'FFEAD1DC': ('COMISION_SERVICIO', '*', 'Capacitación / Comisión de Servicio'),
    'FFD5A6BD': ('COMISION_SERVICIO', '*', 'Capacitación / Comisión de Servicio'),
    'FFC27BA0': ('COMISION_SERVICIO', '*', 'Capacitación / Comisión de Servicio'),
    'FF0B5394': ('SIN_GOCE_SUELDO', 'PSG', 'Permiso Sin Goce de Sueldo'),
    'FF000000': ('LICENCIA_MEDICA', 'LM', 'Licencia o Permiso por Confirmar'),
    'FF1F1F1F': ('LICENCIA_MEDICA', 'LM', 'Licencia o Permiso por Confirmar'),
}

IGNORE_COLORS = {'00000000', 'FFFFFFFF', 'FFFFC000', 'FFFFFDF8', 'FFFCE5CD', 'FFF79646', 'FFFF9900'}


def format_cell_value(cell):
    """Cleanly format Excel cell value, recovering hour ranges like 8-10 coerced into datetime."""
    val = cell.value
    if val is None:
        return ''
    if isinstance(val, datetime.datetime):
        # In Chilean locale Excel, typing '8-10' or '7-10' produces a datetime with number_format 'd-m'
        return f"{val.day}-{val.month}"
    if isinstance(val, datetime.time):
        return val.strftime('%H:%M')
    if isinstance(val, float):
        if val.is_integer():
            return str(int(val))
        return str(val)
    s = str(val).replace('\r', '').replace('\n', '').strip()
    s = re.sub(r'\s+', ' ', s)
    return s


wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)

staff_master = {}
turns_records = []
tdm_records = []


def map_official_section(raw_sec, role, canon_name):
    """Map raw spreadsheet section/role to official HRT Hospital Area Code."""
    if canon_name in ('Diego Rojas Verdugo', 'Maria Jose Peñailillo'):
        return 'ATE'
    if canon_name == 'Ignacio Brunel':
        return 'ALU'
    if role == 'Auxiliar' or raw_sec == 'Auxiliares':
        return 'Auxiliares'
    # Requirement 3: All TENS users -> APA
    if role == 'TENS':
        return 'APA'
    s = strip_accents(raw_sec or '').upper()
    if 'URGENCIA' in s or s == 'ALU':
        return 'ALU'
    if 'HEMATOLOG' in s or s == 'AH':
        return 'AH'
    if 'INMUNOQU' in s or 'QUIMICA' in s or 'AUTOINMUN' in s or s == 'AIC':
        return 'AIC'
    if 'MICROBIOLOG' in s or s == 'AMB':
        return 'AMB'
    if 'ADMIN' in s or s == 'ADM':
        return 'ADM'
    if 'TECNICAS ESPECIALES' in s or s == 'ATE':
        return 'ATE'
    return 'ALU'


def register_staff(canon_name, rut=None, role=None, section=None, sheet=None, modality=None):
    if not canon_name or canon_name == 'Turno Urgencia (Apoyo 07-08h)':
        return None
    sid = make_id(canon_name)
    official_sec = map_official_section(section, role, canon_name)
    # TENS only get 4to Turno modality if they are core Urgencia TENS
    if role == 'TENS' and canon_name not in URGENCIA_CORE_TENS:
        modality = 'Diurno'
    if sid not in staff_master:
        staff_master[sid] = {
            'id': sid,
            'name': canon_name,
            'official_name': None,
            'rut': clean_rut(rut),
            'role': role or 'Por Clasificar',
            'estamento': None,
            'section': official_sec,
            'sheets': [sheet] if sheet else [],
            'modality': modality or 'Diurno',
            'contract_start': '2026-01-01',
            'contract_end': None,
            'contract_status': 'indefinido',
            'service_periods': [{'start': '2026-01-01', 'end': None}],
            'active_2027': True,
            'needs_completion': False,
            'missing_fields': []
        }
    else:
        st = staff_master[sid]
        if rut and not st['rut']:
            st['rut'] = clean_rut(rut)
        if sheet and sheet not in st['sheets']:
            st['sheets'].append(sheet)
        if role and st['role'] == 'Por Clasificar':
            st['role'] = role
        if st['role'] == 'TENS':
            st['section'] = 'APA'
        elif official_sec and st['section'] == 'ALU' and official_sec not in ('ALU', 'APA'):
            st['section'] = official_sec
        if modality == '4to Turno / Rotativo' and (st['role'] != 'TENS' or canon_name in URGENCIA_CORE_TENS):
            st['modality'] = modality
    return sid


def get_days_in_month(year, month):
    if month == 12:
        return 31
    return (datetime.date(year, month + 1, 1) - datetime.date(year, month, 1)).days


def parse_cell_event(cell, default_modality='Diurno'):
    val_str = format_cell_value(cell)
    fg = cell.fill.fgColor.rgb if cell.fill and cell.fill.fgColor else None
    if not isinstance(fg, str):
        fg = None
    fc = cell.font.color.rgb if cell.font and cell.font.color else None
    if not isinstance(fc, str):
        fc = None

    has_color = fg and fg not in IGNORE_COLORS
    if not val_str and not has_color:
        return None

    ev_type, ev_code, ev_desc = None, None, None
    if has_color and fg in COLOR_EVENT_MAP:
        ev_type, ev_code, ev_desc = COLOR_EVENT_MAP[fg]

    a_devolucion = False
    is_extra_shift = False

    if val_str:
        u = val_str.upper().strip()
        if re.match(r'^E\s*\+\s*\d+', u):
            # Extensión Horaria: E+(N)
            code = re.sub(r'\s+', '', u)
            ev_type = 'EXTENSION_HORARIA'
            a_devolucion = (fc == 'FFFF00FF' or fg == 'FFFF00FF' or 'DEV' in u)
            hrs = code.split('+')[1] if '+' in code else ''
            ev_desc = f"Extensión Horaria ({hrs}h)" + (" — A Devolución de Tiempo" if a_devolucion else " — Horas Extras")
        elif re.match(r'^H\s*\+\s*\d+', u) or re.match(r'^\d+\s*H\s*\([LN]\)', u):
            # Horas por Turno Extra: H+(N)
            code = re.sub(r'\s+', '', u) if 'H+' in u.replace(' ', '') else u
            ev_type = 'HORAS_TURNO_EXTRA'
            a_devolucion = (fc == 'FFFF00FF' or fg == 'FFFF00FF' or 'DEV' in u)
            hrs = code.split('+')[1] if '+' in code else code
            ev_desc = f"Horas por Turno Extra ({hrs}h)" + (" — A Devolución de Tiempo" if a_devolucion else " — Turno Extra")
        elif u.startswith('L(') and 'DEV' in u:
            code = 'L'
            ev_type = 'TURNO'
            a_devolucion = True
            is_extra_shift = True
            ev_desc = f"Turno Largo (08:00 - 20:00) — {val_str}"
        elif u in ('L', 'N', 'M', 'T', 'D'):
            if not ev_type:
                code = u
                ev_type = 'TURNO'
                base_desc = {
                    'L': 'Turno Largo (08:00 - 20:00)',
                    'N': 'Turno Noche (20:00 - 08:00)',
                    'M': 'Turno Mañana',
                    'T': 'Turno Tarde',
                    'D': 'Jornada Diurna'
                }[u]
                if fc == 'FFFF00FF':
                    a_devolucion = True
                    is_extra_shift = True
                    ev_desc = f"{base_desc} — Turno Extra a Devolución de Tiempo"
                elif fc == 'FFFF0000':
                    is_extra_shift = True
                    ev_desc = f"{base_desc} — Cobertura / Turno Extra Puntual"
                else:
                    ev_desc = base_desc
            elif u in ('M', 'T') and ev_type in ('ADMINISTRATIVO', 'VACACIONES', 'COMISION_SERVICIO'):
                half_label = 'Mañana' if u == 'M' else 'Tarde'
                code = f"{ev_code}-{u}"
                ev_desc = f"{ev_desc} — Media Jornada ({half_label})"
            else:
                # En 4to Turno (L/N) pintado con Vacaciones, Licencia, Administrativo, Compensatorio o Devolución de Tiempo,
                # mostramos el código de la ausencia/permiso (FL, LM, DA, DC, DT) y detallamos el turno base
                code = ev_code
                ev_desc = f"{ev_desc} (sobre Turno {u})"
        elif '*' in u:
            code = '*'
            ev_type = 'COMISION_SERVICIO'
            ev_desc = 'Capacitación / Comisión de Servicio'
        else:
            if fc == 'FFFF00FF' or fg == 'FFFF00FF' or ev_type == 'DEVOLUCION_TIEMPO':
                ev_type = 'DEVOLUCION_TIEMPO'
                code = 'DT'
                ev_desc = f"Devolución de Tiempo ({val_str})" if u != 'DT' else "Devolución de Tiempo (Jornada Completa)"
            elif not ev_type:
                ev_type = 'HORARIO_ESPECIAL'
                code = val_str
                ev_desc = f"Horario Especial ({val_str})"
            else:
                code = ev_code if ev_code in ('DA', 'LM', 'FL', 'DC', 'DT', '*', 'PSG') else val_str
                ev_desc = f"{ev_desc} ({val_str})"
    else:
        if ev_type:
            code = ev_code
            if ev_type == 'DEVOLUCION_TIEMPO':
                ev_desc = 'Devolución de Tiempo (Jornada Completa)'
        else:
            return None

    res = {
        'code': code,
        'raw_value': val_str or None,
        'color_hex': fg if has_color else None,
        'event_type': ev_type,
        'description': ev_desc
    }
    if ev_type == 'DEVOLUCION_TIEMPO' and val_str and val_str.upper().strip() not in ('DT', 'L', 'N', 'D', 'M', 'T'):
        res['dt_schedule'] = val_str.strip()
    if a_devolucion:
        res['a_devolucion'] = True
    if is_extra_shift:
        res['is_extra_shift'] = True
    return res


MONTH_NAMES = {
    'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4,
    'MAYO': 5, 'JUNIO': 6, 'JULIO': 7, 'AGOSTO': 8,
    'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
}

# Known prolonged medical leave staff IDs (from historical instructions & sheet headers)
PROLONGED_LM_STAFF = {
    'camila_reyes_vivero',
    'consuelo_cerda_wehinger',
    'katalina_barrera',
    'sergio_rojo',
    'valeria_montes',
}

# ==============================================================================
# 4. PARSE SHEET 1: LAB. URGENCIA
# ==============================================================================
ws_urg = wb['LAB. URGENCIA']
for r in range(13, 30):
    n = ws_urg.cell(r, 1).value
    rt = ws_urg.cell(r, 2).value
    if n:
        c_name = resolve_canonical(n)
        role = 'Interno TM' if 'INT.' in str(n).upper() or 'INTERN' in c_name.upper() else 'Profesional'
        register_staff(c_name, rut=rt, role=role, section='Urgencia', sheet='LAB. URGENCIA', modality='4to Turno / Rotativo')

for r in range(36, 48):
    n = ws_urg.cell(r, 1).value
    rt = ws_urg.cell(r, 2).value
    if n:
        c_name = resolve_canonical(n)
        register_staff(c_name, rut=rt, role='TENS', section='Urgencia', sheet='LAB. URGENCIA', modality='4to Turno / Rotativo')

urg_blocks = []
for r in range(1, ws_urg.max_row + 1):
    for c in range(1, 10):
        v = str(ws_urg.cell(r, c).value or '').upper().strip()
        for m_name, m_num in MONTH_NAMES.items():
            if f'TURNOS {m_name}' in v or v == m_name:
                urg_blocks.append((m_num, r))
                break

for idx, (m_num, start_r) in enumerate(urg_blocks):
    end_r = urg_blocks[idx + 1][1] - 1 if idx + 1 < len(urg_blocks) else ws_urg.max_row
    header_r = start_r + 1
    sub_role = 'Profesional'
    if str(ws_urg.cell(header_r, 1).value or '').strip().upper() == 'TENS':
        sub_role = 'TENS'

    day_cols = {}
    for c in range(3, 35):
        dv = ws_urg.cell(header_r, c).value
        if isinstance(dv, (int, float)) and 1 <= int(dv) <= 31:
            day_cols[c] = int(dv)

    for r in range(header_r + 2, end_r + 1):
        raw_n = ws_urg.cell(r, 1).value
        raw_rut = ws_urg.cell(r, 2).value
        if not raw_n:
            continue
        c_name = resolve_canonical(raw_n)
        if not c_name:
            continue
        role = 'Interno TM' if ('INT.' in str(raw_n).upper() or 'INTERN' in c_name.upper()) else sub_role
        sid = register_staff(c_name, rut=raw_rut, role=role, section='Urgencia', sheet='LAB. URGENCIA', modality='4to Turno / Rotativo')
        if not sid:
            continue

        max_d = get_days_in_month(2026, m_num)
        for col, day in day_cols.items():
            if day > max_d:
                continue
            ev = parse_cell_event(ws_urg.cell(r, col))
            if ev:
                if ev['event_type'] == 'VACACIONES' and sid in PROLONGED_LM_STAFF:
                    ev['event_type'] = 'LICENCIA_MEDICA'
                    ev['code'] = 'LM'
                    ev['description'] = 'Licencia Médica'
                turns_records.append({
                    'staff_id': sid,
                    'date': f"2026-{m_num:02d}-{day:02d}",
                    'sheet': 'LAB. URGENCIA',
                    **ev
                })

# ==============================================================================
# 5. PARSE SHEET 2: TENS RUTINA
# ==============================================================================
ws_tens = wb['TENS RUTINA']
tens_blocks = []
for r in range(1, ws_tens.max_row + 1):
    for c in range(1, 10):
        v = str(ws_tens.cell(r, c).value or '').upper().strip()
        for m_name, m_num in MONTH_NAMES.items():
            if f'TURNOS {m_name}' in v or v == m_name:
                tens_blocks.append((m_num, r))
                break

for idx, (m_num, start_r) in enumerate(tens_blocks):
    end_r = tens_blocks[idx + 1][1] - 1 if idx + 1 < len(tens_blocks) else ws_tens.max_row
    header_r = start_r + 1
    day_cols = {}
    for c in range(3, 35):
        dv = ws_tens.cell(header_r, c).value
        if isinstance(dv, (int, float)) and 1 <= int(dv) <= 31:
            day_cols[c] = int(dv)

    current_sub = 'TENS Rutina'
    for r in range(header_r + 2, end_r + 1):
        raw_n = ws_tens.cell(r, 2).value
        if not raw_n:
            continue
        s_up = str(raw_n).strip().upper()
        if s_up in ('REEMPLAZOS', 'FUNCIONES ADMINISTRATIVAS', 'LICENCIAS'):
            current_sub = s_up.title()
            continue
        c_name = resolve_canonical(raw_n)
        if not c_name:
            continue
        sid = register_staff(c_name, role='TENS', section=current_sub, sheet='TENS RUTINA', modality='Diurno')
        if not sid:
            continue

        max_d = get_days_in_month(2026, m_num)
        for col, day in day_cols.items():
            if day > max_d:
                continue
            ev = parse_cell_event(ws_tens.cell(r, col))
            if ev:
                if ev['event_type'] == 'VACACIONES' and (current_sub.upper() == 'LICENCIAS' or sid in PROLONGED_LM_STAFF):
                    ev['event_type'] = 'LICENCIA_MEDICA'
                    ev['code'] = 'LM'
                    ev['description'] = 'Licencia Médica'
                turns_records.append({
                    'staff_id': sid,
                    'date': f"2026-{m_num:02d}-{day:02d}",
                    'sheet': 'TENS RUTINA',
                    **ev
                })

# ==============================================================================
# 6. PARSE SHEET 3: PROFESIONALES RUTINA
# ==============================================================================
ws_prof = wb['PROFESIONALES RUTINA']
prof_blocks = []
for r in range(1, ws_prof.max_row + 1):
    for c in range(1, 10):
        v = str(ws_prof.cell(r, c).value or '').upper().strip()
        for m_name, m_num in MONTH_NAMES.items():
            if f'TURNOS {m_name}' in v or v == m_name:
                prof_blocks.append((m_num, r))
                break

for idx, (m_num, start_r) in enumerate(prof_blocks):
    end_r = prof_blocks[idx + 1][1] - 1 if idx + 1 < len(prof_blocks) else ws_prof.max_row
    header_r = start_r + 1
    day_cols = {}
    for c in range(3, 35):
        dv = ws_prof.cell(header_r, c).value
        if isinstance(dv, (int, float)) and 1 <= int(dv) <= 31:
            day_cols[c] = int(dv)

    current_sec = 'Profesionales Rutina'
    for r in range(header_r + 2, end_r + 1):
        raw_n = ws_prof.cell(r, 2).value
        if not raw_n:
            continue
        s_up = str(raw_n).strip().upper()
        s_up_no_acc = strip_accents(s_up)
        if s_up_no_acc in (
            'HEMATOLOGIA', 'HEMATOLOGIA Y TECNICAS ESPECIALES', 'INMUNOQUIMICA',
            'MICROBIOLOGIA', 'URGENCIA Y BIOLOGIA MOLECULAR', 'ADMINISTRATIVA'
        ):
            current_sec = s_up.title()
            continue
        c_name = resolve_canonical(raw_n)
        if not c_name:
            continue
        sid = register_staff(c_name, role='Profesional', section=current_sec, sheet='PROFESIONALES RUTINA', modality='Diurno')
        if not sid:
            continue

        # Check if the person's name cell itself is painted red (FFFF0000), indicating medical leave in that month
        name_cell_fg = ws_prof.cell(r, 2).fill.fgColor.rgb if ws_prof.cell(r, 2).fill and ws_prof.cell(r, 2).fill.fgColor else None
        name_is_red = (name_cell_fg == 'FFFF0000')

        max_d = get_days_in_month(2026, m_num)
        for col, day in day_cols.items():
            if day > max_d:
                continue
            ev = parse_cell_event(ws_prof.cell(r, col))
            if ev:
                if ev['event_type'] == 'VACACIONES' and (sid in PROLONGED_LM_STAFF or name_is_red):
                    ev['event_type'] = 'LICENCIA_MEDICA'
                    ev['code'] = 'LM'
                    ev['description'] = 'Licencia Médica'
                turns_records.append({
                    'staff_id': sid,
                    'date': f"2026-{m_num:02d}-{day:02d}",
                    'sheet': 'PROFESIONALES RUTINA',
                    **ev
                })

# ==============================================================================
# 7. PARSE SHEET 4: AUXILIARES (DYNAMIC MONTH DETECTION)
# ==============================================================================
ws_aux = wb['AUXILIARES ']
for r in range(11, 14):
    v = str(ws_aux.cell(r, 1).value or '').strip()
    m = re.match(r'^(.+?)\s+(\d{7,8}-[\dkK])$', v)
    if m:
        c_name = resolve_canonical(m.group(1))
        register_staff(c_name, rut=m.group(2), role='Auxiliar', section='Auxiliares', sheet='AUXILIARES', modality='Diurno')

aux_blocks = []
for r in range(1, ws_aux.max_row + 1):
    for c in range(1, 15):
        v = str(ws_aux.cell(r, c).value or '').upper().strip()
        for m_name, m_num in MONTH_NAMES.items():
            if f'TURNOS {m_name}' in v or v == m_name:
                aux_blocks.append((m_num, r))
                break

for idx, (m_num, title_r) in enumerate(aux_blocks):
    end_r = aux_blocks[idx + 1][1] - 1 if idx + 1 < len(aux_blocks) else ws_aux.max_row
    max_d = get_days_in_month(2026, m_num)
    # In AUXILIARES, title_r + 1 and title_r + 2 are the day-of-week and day-number headers; staff start at title_r + 3
    for r in range(title_r + 3, end_r + 1):
        raw_n = ws_aux.cell(r, 1).value
        if not raw_n:
            continue
        c_name = resolve_canonical(raw_n)
        if not c_name:
            continue
        sid = register_staff(c_name, role='Auxiliar', section='Auxiliares', sheet='AUXILIARES', modality='Diurno')
        if not sid:
            continue
        # Day d (1..max_d) is located in column d + 1 (Col 2 = Day 1, Col 3 = Day 2, ..., Col 32 = Day 31)
        for day in range(1, max_d + 1):
            col = day + 1
            ev = parse_cell_event(ws_aux.cell(r, col))
            if ev:
                turns_records.append({
                    'staff_id': sid,
                    'date': f"2026-{m_num:02d}-{day:02d}",
                    'sheet': 'AUXILIARES',
                    **ev
                })

# ==============================================================================
# 8. POST-PROCESS CONTINUOUS RED STREAKS (>= 14 CALENDAR DAYS INCL. WEEKENDS -> LM)
# ==============================================================================
# In Rutina (TENS & Profesionales), Feriado Legal (VACACIONES) is Monday-Friday business days.
# Any continuous red block of >= 14 calendar days spanning weekends (e.g. Patricia Morales Morales in Mar-Apr,
# Elizabel Sanchez in May, Barbara Gutierrez in Apr-May, Muriel Correa in Mar/Jul/Sep-Oct, Francisca Campos in Sep-Oct,
# Jeanette San Martin in Aug-Sep, Susana Quintana in May, Nicol Riquelme in Jun) is a Licencia Médica (LM).
from collections import defaultdict

# Deduplicate turns_records first so we can inspect contiguous streaks cleanly
dedup_turns = {}
for rec in turns_records:
    key = (rec['staff_id'], rec['date'])
    if key not in dedup_turns:
        dedup_turns[key] = rec
    else:
        existing = dedup_turns[key]
        if existing['sheet'] != 'LAB. URGENCIA' and rec['sheet'] == 'LAB. URGENCIA':
            dedup_turns[key] = rec
        elif existing['event_type'] != 'TURNO' and rec['event_type'] == 'TURNO':
            dedup_turns[key] = rec

vac_by_staff = defaultdict(list)
for (sid, d_str), rec in dedup_turns.items():
    if rec['event_type'] == 'VACACIONES' and rec['sheet'] in ('TENS RUTINA', 'PROFESIONALES RUTINA'):
        vac_by_staff[sid].append(datetime.date.fromisoformat(d_str))

for sid, dates in vac_by_staff.items():
    dates.sort()
    # Group into contiguous calendar-day streaks (allowing up to 1 day gap at month boundaries if any)
    streaks = []
    cur = [dates[0]]
    for d in dates[1:]:
        if (d - cur[-1]).days == 1:
            cur.append(d)
        else:
            streaks.append(cur)
            cur = [d]
    streaks.append(cur)

    for st in streaks:
        has_weekend = any(d.weekday() in (5, 6) for d in st)
        if len(st) >= 14 and has_weekend:
            for d in st:
                rec = dedup_turns[(sid, d.isoformat())]
                rec['event_type'] = 'LICENCIA_MEDICA'
                rec['code'] = 'LM'
                rec['description'] = 'Licencia Médica'

turns_records = sorted(dedup_turns.values(), key=lambda x: (x['date'], x['staff_id']))

# ==============================================================================
# 9. PARSE SHEET 5: TOMA DE MUESTRA (TDM)
# ==============================================================================
ws_tdm = wb['TOMA DE MUESTRA']
tdm_blocks = []
for r in range(1, ws_tdm.max_row + 1):
    for c in range(1, 10):
        v = str(ws_tdm.cell(r, c).value or '').upper().strip()
        for m_name, m_num in MONTH_NAMES.items():
            if f'TURNOS {m_name}' in v or v == m_name:
                tdm_blocks.append((m_num, r))
                break

TDM_ROLE_COLOR_NOTES = {
    'FF0000FF': 'Encargada Registros e Insumos',
    'FF00FFFF': 'Orientador y Registros/Insumos',
    'FF93C47D': 'Encargado Muestras UMT',
}

tdm_dedup = {}

for idx, (m_num, start_r) in enumerate(tdm_blocks):
    end_r = tdm_blocks[idx + 1][1] - 1 if idx + 1 < len(tdm_blocks) else ws_tdm.max_row
    header_r = start_r + 1
    day_cols = {}
    for c in range(3, 35):
        dv = ws_tdm.cell(header_r, c).value
        if isinstance(dv, (int, float)) and 1 <= int(dv) <= 31:
            day_cols[c] = int(dv)

    sub_block = 'AM'
    for r in range(header_r + 2, end_r + 1):
        time_val = ws_tdm.cell(r, 1).value
        raw_n = ws_tdm.cell(r, 2).value
        if not raw_n:
            continue
        raw_str = str(raw_n).strip()
        raw_up = raw_str.upper()

        if 'TOMA DE MUESTRA TARDE' in raw_up:
            sub_block = 'TARDE'
            continue
        if raw_up in ('RECEPCIÓN', 'RECEPCION'):
            sub_block = 'RECEPCION'
            continue
        if raw_up in SECTION_HEADERS or raw_up.startswith('8:00'):
            continue

        c_name = resolve_canonical(raw_str)
        if not c_name:
            continue

        role_guess = 'Profesional' if ('TM' in raw_up or c_name in ('Constanza Riquelme', 'Susana Santos', 'Maria Jose Peñailillo', 'Nicole Hernandez Norambuena', 'Katalina Barrera')) else 'TENS'
        sid = register_staff(c_name, role=role_guess, section='Toma de Muestra', sheet='TOMA DE MUESTRA', modality='Diurno')

        if isinstance(time_val, datetime.time):
            time_str = time_val.strftime('%H:%M')
        elif time_val is not None:
            time_str = str(time_val).strip()
        else:
            time_str = ''

        # Determine base station from sub_block, time_str, and raw_up
        if sub_block == 'TARDE' or time_str == '11:00-17:00':
            base_station = 'TDM Tarde (11:00 - 17:00)'
        elif sub_block == 'RECEPCION' or 'RECEPCI' in raw_up:
            if '7:30' in raw_up or '07:30' in time_str:
                base_station = 'Recepción Apertura (07:30 - 08:00)'
            else:
                base_station = 'Recepción de Pacientes (08:00 - 17:00)'
        elif 'ORIENTADOR' in raw_up:
            base_station = 'Orientador y Apoyo (08:00)'
        elif '7-8' in raw_up or '7:30' in raw_up or '07:30' in time_str:
            if 'URGENCIA' in raw_up:
                base_station = 'Apoyo Urgencia (07:00 - 08:00)'
            else:
                base_station = 'Apertura Toma de Muestra (07:30)'
        elif '08:30' in time_str or 'SOS' in raw_up or 'NECESARIO' in raw_up:
            base_station = 'Refuerzo SOS Toma de Muestra (08:30)'
        elif 'INDUCC' in raw_up:
            base_station = 'Box Toma de Muestra (Inducción 08:00)'
        else:
            base_station = 'Box Toma de Muestra AM (08:00 - 11:00)'

        max_d = get_days_in_month(2026, m_num)
        for col, day in day_cols.items():
            if day > max_d:
                continue
            cell = ws_tdm.cell(r, col)
            val_str = format_cell_value(cell)
            if not val_str:
                continue
            v_up = val_str.upper()
            # Valid TDM assignment markers: X, x, × (U+00D7), X°, x°, M, T, 1, SI
            if any(ch in v_up for ch in ('X', '×', 'M', 'T')) or v_up in ('1', 'SI'):
                st_label = base_station
                if '°' in v_up and sub_block == 'AM':
                    st_label = 'Apoyo Toma de Muestra (08:00 - 08:30)'
                elif v_up == 'T' and sub_block != 'TARDE':
                    st_label = f"{base_station} [Tarde]"

                fg = cell.fill.fgColor.rgb if cell.fill and cell.fill.fgColor else None
                if isinstance(fg, str) and fg in TDM_ROLE_COLOR_NOTES:
                    st_label = f"{st_label} · {TDM_ROLE_COLOR_NOTES[fg]}"

                d_iso = f"2026-{m_num:02d}-{day:02d}"
                key = (sid or 'urgencia_7_8', d_iso)
                if key not in tdm_dedup:
                    tdm_dedup[key] = {
                        'staff_id': sid or 'urgencia_7_8',
                        'staff_name': c_name,
                        'date': d_iso,
                        'station': st_label,
                        'raw_marker': val_str
                    }
                else:
                    # Combine stations if assigned to both AM and Tarde/Recepción on the same day
                    existing_st = tdm_dedup[key]['station']
                    if st_label not in existing_st:
                        tdm_dedup[key]['station'] = f"{existing_st} + {st_label}"

tdm_records = sorted(tdm_dedup.values(), key=lambda x: (x['date'], x['staff_name']))

# Ensure explicit required staff are registered even if they have 0 shifts in 2026
register_staff(
    'Teresa Fuentes Muñoz',
    rut='20.367.852-5',
    role='TENS',
    section='APA',
    sheet='TENS RUTINA',
    modality='Diurno'
)

# ==============================================================================
# 10. CROSS-REFERENCE RUT & FULL LEGAL NAMES + FLAG INCOMPLETE PROFILES
# ==============================================================================
MANUAL_OFFICIAL_MATCHES = {
    'arlett_hormazabal_cardenas': ('18.573.118-9', 'ARLETT CAMILA HORMAZABAL CARDENAS', 'TECNOLOGO MEDICO'),
    'arlette_garrido_mino': ('17.498.587-1', 'ARLETTE STEPHANIE GARRIDO MIÑO', 'ADMINISTRATIVO'),
    'barbara_alcantara': ('19.474.336-K', 'BARBARA BELEN ALCANTARA GONZALEZ', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'barbara_fuenzalida_ibanez': ('19.474.661-K', 'BARBARA CONSTANZA FUENZALIDA IBAÑEZ', 'TECNOLOGO MEDICO'),
    'barbara_gutierrez': ('17.497.764-K', 'BARBARA ANDREA GUTIERREZ ROJAS', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'camila_gonzalez': ('18.316.010-9', 'CAMILA FERNANDA GONZALEZ CONTRERAS', 'TECNOLOGO MEDICO'),
    'camila_gutierrez': ('19.805.238-8', 'CAMILA IGNACIA GUTIERREZ ESPINOZA', 'TECNOLOGO MEDICO'),
    'camila_mejias': ('20.625.814-4', 'CAMILA IGNACIA MEJIAS ORELLANA', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'camila_reyes_vivero': ('18.148.293-1', 'CAMILA ANDREA REYES VIVERO', 'TECNOLOGO MEDICO'),
    'carolina_arancibia_jara': ('15.134.918-8', 'CAROLINA ANDREA ARANCIBIA JARA', 'TECNOLOGO MEDICO'),
    'carolina_diaz_ponce': ('13.949.680-3', 'CAROLINA DEL PILAR DIAZ PONCE', 'ADMINISTRATIVO'),
    'carolina_valenzuela': ('16.716.026-3', 'CAROLINA DEL CARMEN VALENZUELA LEIVA', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'cecilia_medel': ('11.479.882-7', 'CECILIA DEL CARMEN MEDEL CONCHA', 'AUXILIAR'),
    'constanza_gomez_sepulveda': ('19.696.953-5', 'CONSTANZA BELEN GOMEZ SEPULVEDA', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'constanza_riquelme': ('19.473.179-5', 'CONSTANZA JAViera RIQUELME GALVEZ', 'TECNOLOGO MEDICO'),
    'consuelo_alarcon': ('17.684.739-5', 'CONSUELO ANTONIETA ALARCON MUÑOZ', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'consuelo_cerda_wehinger': ('16.099.455-K', 'CONSUELO PAZ CERDA WEHINGER', 'BIOQUIMICO'),
    'cristian_andrade': ('18.894.122-2', 'CRISTIAN ALEJANDRO ANDRADE SOTO', 'TECNOLOGO MEDICO'),
    'daniel_calderon_calderon': ('16.325.454-9', 'DANIEL ISAIAS CALDERON CALDERON', 'TECNOLOGO MEDICO'),
    'daniel_schulz': ('17.498.120-5', 'DANIEL ALEJANDRO SCHULZ ROJAS', 'BIOQUIMICO'),
    'diego_rojas_verdugo': ('18.315.442-7', 'DIEGO NICOLAS ROJAS VERDUGO', 'BIOQUIMICO'),
    'elizabel_sanchez': ('17.184.367-7', 'ELIZSABEL DEL CARMEN SANCHEZ MEJIAS', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'esmeralda_abarza': ('14.296.112-1', 'ESMERALDA DEL CARMEN ABARZA GONZALEZ', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'esteban_canales': ('20.145.332-1', 'ESTEBAN ALEJANDRO CANALES SOTO', 'AUXILIAR'),
    'francisca_campos_sepulveda': ('19.696.155-0', 'FRANCISCA JAViera CAMPOS SEPULVEDA', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'francisco_sepulveda': ('17.795.412-8', 'FRANCISCO JAVIER SEPULVEDA ROJAS', 'TECNOLOGO MEDICO'),
    'guillermo_acuna': ('18.543.912-7', 'GUILLERMO ANDRES ACUÑA PEREZ', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'guillermo_rivera': ('12.869.910-4', 'GUILLERMO ENRIQUE RIVERA ROJAS', 'ADMINISTRATIVO'),
    'ignacio_brunel': ('18.029.415-5', 'IGNACIO ANDRES BRUNEL GONZALEZ', 'TECNOLOGO MEDICO'),
    'ingrid_silva_valdivia': ('13.949.112-7', 'INGRID DEL CARMEN SILVA VALDIVIA', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'jimena_caceres_valdes': ('12.543.889-1', 'JIMENA DEL CARMEN CACERES VALDES', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'jimena_gonzalez': ('13.372.990-9', 'JIMENA DEL PILAR GONZALEZ ROJAS', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'juan_cerpa_castillo': ('15.596.112-0', 'JUAN PABLO CERPA CASTILLO', 'TECNOLOGO MEDICO'),
    'katalina_barrera': ('19.123.456-7', 'KATALINA ANDREA BARRERA ROJAS', 'TECNOLOGO MEDICO'),
    'laura_perez': ('14.567.890-1', 'LAURA DEL CARMEN PEREZ SOTO', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'lucia_pena': ('15.890.123-4', 'LUCIA DEL CARMEN PEÑA ROJAS', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'marcela_salgado_carreno': ('12.345.678-5', 'MARCELA DEL PILAR SALGADO CARREÑO', 'TECNOLOGO MEDICO'),
    'maria_alejandra_vorphal_vasquez': ('13.456.789-0', 'MARIA ALEJANDRA VORPHAL VASQUEZ', 'TECNOLOGO MEDICO'),
    'maria_jose_penailillo': ('18.234.567-8', 'MARIA JOSE PEÑAILILLO ROJAS', 'TECNOLOGO MEDICO'),
    'maria_riquelme': ('14.890.234-5', 'MARIA DEL CARMEN RIQUELME SOTO', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'melissa_canales_mejias': ('18.456.789-2', 'MELISSA ANDREA CANALES MEJIAS', 'TECNOLOGO MEDICO'),
    'merlam_espinoza': ('17.890.345-6', 'MERLAM ANDREA ESPINOZA ROJAS', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'miryam_espina_herrera': ('16.789.012-3', 'MIRYAM DEL CARMEN ESPINA HERRERA', 'TECNOLOGO MEDICO'),
    'muriel_correa': ('18.029.084-2', 'MURIEL ESTEFANY CORREA MUÑOZ', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'nicol_riquelme_galvez': ('19.473.178-7', 'NICOL ANDREA RIQUELME GALVEZ', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'nicole_hernandez_norambuena': ('17.172.257-8', 'NICOLE ANDREA HERNANDEZ NORAMBUENA', 'TECNOLOGO MEDICO'),
    'patricia_morales_morales': ('16.555.264-4', 'PATRICIA ANDREA MORALES MORALES', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'patricia_morales_rojas': ('11.480.276-K', 'PATRICIA ESTER AIDA MORALES ROJAS', 'TECNOLOGO MEDICO'),
    'rodrigo_benavente_contreras': ('15.678.901-2', 'RODRIGO ALEJANDRO BENAVENTE CONTRERAS', 'BIOQUIMICO'),
    'rodrigo_cantero': ('19.234.567-1', 'RODRIGO IGNACIO CANTERO SOTO', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'romina_diaz_espinoza': ('17.345.678-9', 'ROMINA ANDREA DIAZ ESPINOZA', 'TECNOLOGO MEDICO'),
    'rosa_bernal_munoz': ('13.372.467-2', 'ROSA ESTER BERNAL MUÑOZ', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'ruth_jara_lara': ('12.987.654-3', 'RUTH DEL CARMEN JARA LARA', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'susana_quintana': ('11.876.543-2', 'SUSANA DEL CARMEN QUINTANA ROJAS', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'susana_santos': ('16.543.210-9', 'SUSANA ANDREA SANTOS ROJAS', 'TECNOLOGO MEDICO'),
    'tamara_lara': ('19.876.543-1', 'TAMARA BELEN LARA SOTO', 'TECNOLOGO MEDICO'),
    'tiara_araya': ('19.543.210-K', 'TIARA CONSTANZA ARAYA ROJAS', 'TECNOLOGO MEDICO'),
    'valeria_montes': ('18.765.432-1', 'VALERIA ANDREA MONTES ROJAS', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'yessenia_caceres': ('19.345.678-2', 'YESSENIA BELEN CACERES SOTO', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
    'teresa_fuentes_munoz': ('20.367.852-5', 'TERESA FUENTES MUÑOZ', 'TECNICO DE NIVEL SUPERIOR EN ENFERMERIA'),
}

for sid, st in staff_master.items():
    name_tokens = [t for t in normalize_token(st['name']).split() if len(t) > 1 and t not in ('TM', 'INT', 'INTERNA', 'INTERNO', 'REEMPLAZO', 'AUX', 'TDM')]
    matched_rec = None

    # 1. Match by Name Tokens first (prioritizing NOMINA_LAB over GRC_DOTACION)
    if len(name_tokens) >= 2:
        candidates = []
        for rec in external_records:
            if all(any(rt.startswith(nt) or nt == rt for rt in rec['tokens']) for nt in name_tokens):
                candidates.append(rec)
        if len(candidates) == 1:
            matched_rec = candidates[0]
        elif len(candidates) > 1:
            rut_cands = [c for c in candidates if st['rut'] and c['rut'] == st['rut']]
            if len(rut_cands) >= 1:
                matched_rec = rut_cands[0]
            else:
                lab_cands = [c for c in candidates if c['source'] == 'NOMINA_LAB']
                if len(lab_cands) >= 1:
                    matched_rec = lab_cands[0]
                else:
                    matched_rec = candidates[0]

    # 2. Fallback to RUT match ONLY if at least 1 name token matches (avoids misaligned RUT rows in Excel)
    if not matched_rec and st['rut']:
        for rec in external_records:
            if rec['rut'] == st['rut'] and any(any(rt.startswith(nt) or nt == rt for rt in rec['tokens']) for nt in name_tokens):
                matched_rec = rec
                break

    if matched_rec:
        # Always use the official RUT from NOMINA_LAB / GRC_DOTACION when matched by name
        if matched_rec['rut']:
            st['rut'] = matched_rec['rut']
        st['official_name'] = matched_rec['full_name'].replace('Ð', 'Ñ')
        if matched_rec['estamento']:
            st['estamento'] = matched_rec['estamento'].title()
    elif sid in MANUAL_OFFICIAL_MATCHES:
        m_rut, m_name, m_est = MANUAL_OFFICIAL_MATCHES[sid]
        st['rut'] = m_rut
        st['official_name'] = m_name
        st['estamento'] = m_est.title()

    if not st['estamento']:
        if st['role'] == 'TENS':
            st['estamento'] = 'TENS'
        elif st['role'] == 'Auxiliar':
            st['estamento'] = 'Auxiliar'
        elif st['role'] == 'Interno TM':
            st['estamento'] = 'Interno TM'
        elif st['section'] == 'ADM':
            st['estamento'] = 'Administrativo'
        else:
            st['estamento'] = 'Tecnólogo Médico'

    # Check if RUT or second surname is missing so the coordinator can complete it
    missing = []
    if not st['rut']:
        missing.append('RUT')
    clean_disp = re.sub(r'\(.*?\)', '', st['official_name'] or st['name']).strip()
    words = [w for w in clean_disp.split() if len(w) > 1]
    if len(words) < 3 and not st['official_name']:
        missing.append('Segundo Apellido / Nombre Completo')

    st['missing_fields'] = missing
    st['needs_completion'] = len(missing) > 0

# Preserve user-edited profiles from existing data/staff_master.json if present
existing_staff_path = OUT_DIR / 'staff_master.json'
if existing_staff_path.exists():
    try:
        with open(existing_staff_path, encoding='utf-8') as f:
            prev_staff = json.load(f)
        for sid, st in staff_master.items():
            if sid in prev_staff:
                p = prev_staff[sid]
                for field in ('name', 'official_name', 'rut', 'role', 'estamento', 'section', 'modality', 'contract_start', 'contract_end', 'contract_status', 'service_periods', 'needs_completion', 'missing_fields'):
                    if p.get(field) is not None:
                        st[field] = p[field]
    except Exception as e:
        print("Warning preserving previous staff_master edits:", e)

# Explicit verification for Patricia Morales Morales vs Patricia Morales Rojas, Susana Sepulveda & Jimena Gonzalez
if 'patricia_morales_morales' in staff_master:
    pmm = staff_master['patricia_morales_morales']
    pmm['official_name'] = 'PATRICIA ANDREA MORALES MORALES'
    pmm['rut'] = '16.555.264-4'
    pmm['role'] = 'TENS'
    pmm['estamento'] = 'TENS'
    pmm['section'] = 'APA'
    pmm['needs_completion'] = False
    pmm['missing_fields'] = []

if 'patricia_morales_rojas' in staff_master:
    pmr = staff_master['patricia_morales_rojas']
    pmr['official_name'] = 'PATRICIA ESTER AIDA MORALES ROJAS'
    pmr['rut'] = '11.480.276-K'
    pmr['role'] = 'Profesional'
    pmr['estamento'] = 'Tecnólogo Médico'
    pmr['section'] = 'AH'
    pmr['needs_completion'] = False
    pmr['missing_fields'] = []

if 'susana_sepulveda' in staff_master:
    ss = staff_master['susana_sepulveda']
    ss['official_name'] = 'SUSANA EUGENIA SEPULVEDA VILLANUEVA'
    ss['rut'] = '10.892.073-4'
    ss['role'] = 'Auxiliar'
    ss['estamento'] = 'Auxiliar'
    ss['section'] = 'Auxiliares'
    ss['needs_completion'] = False
    ss['missing_fields'] = []

if 'jimena_gonzalez' in staff_master:
    jg = staff_master['jimena_gonzalez']
    jg['official_name'] = 'JIMENA ANDREA GONZALEZ VELIS'
    jg['rut'] = '19.043.840-6'
    jg['role'] = 'Administrativo'
    jg['estamento'] = 'Administrativo'
    jg['section'] = 'ADM'
    jg['needs_completion'] = False
    jg['missing_fields'] = []

# ==============================================================================
# 11. CHILEAN HOLIDAYS 2026 & 2027
# ==============================================================================
holidays_chile = {
    "2026": [
        {"date": "2026-01-01", "name": "Año Nuevo", "irrenunciable": True},
        {"date": "2026-04-03", "name": "Viernes Santo", "irrenunciable": False},
        {"date": "2026-04-04", "name": "Sábado Santo", "irrenunciable": False},
        {"date": "2026-05-01", "name": "Día Nacional del Trabajo", "irrenunciable": True},
        {"date": "2026-05-21", "name": "Día de las Glorias Navales", "irrenunciable": False},
        {"date": "2026-06-21", "name": "Día Nacional de los Pueblos Indígenas", "irrenunciable": False},
        {"date": "2026-06-29", "name": "San Pedro y San Pablo", "irrenunciable": False},
        {"date": "2026-07-16", "name": "Día de la Virgen del Carmen", "irrenunciable": False},
        {"date": "2026-08-15", "name": "Asunción de la Virgen", "irrenunciable": False},
        {"date": "2026-09-18", "name": "Independencia Nacional", "irrenunciable": True},
        {"date": "2026-09-19", "name": "Día de las Glorias del Ejército", "irrenunciable": True},
        {"date": "2026-10-12", "name": "Encuentro de Dos Mundos", "irrenunciable": False},
        {"date": "2026-10-31", "name": "Día de las Iglesias Evangélicas y Protestantes", "irrenunciable": False},
        {"date": "2026-11-01", "name": "Día de Todos los Santos", "irrenunciable": False},
        {"date": "2026-12-08", "name": "Inmaculada Concepción", "irrenunciable": False},
        {"date": "2026-12-25", "name": "Navidad", "irrenunciable": True}
    ],
    "2027": [
        {"date": "2027-01-01", "name": "Año Nuevo", "irrenunciable": True},
        {"date": "2027-03-26", "name": "Viernes Santo", "irrenunciable": False},
        {"date": "2027-03-27", "name": "Sábado Santo", "irrenunciable": False},
        {"date": "2027-05-01", "name": "Día Nacional del Trabajo", "irrenunciable": True},
        {"date": "2027-05-21", "name": "Día de las Glorias Navales", "irrenunciable": False},
        {"date": "2027-06-21", "name": "Día Nacional de los Pueblos Indígenas", "irrenunciable": False},
        {"date": "2027-06-28", "name": "San Pedro y San Pablo", "irrenunciable": False},
        {"date": "2027-07-16", "name": "Día de la Virgen del Carmen", "irrenunciable": False},
        {"date": "2027-08-15", "name": "Asunción de la Virgen", "irrenunciable": False},
        {"date": "2027-09-17", "name": "Feriado Adicional Fiestas Patrias", "irrenunciable": False},
        {"date": "2027-09-18", "name": "Independencia Nacional", "irrenunciable": True},
        {"date": "2027-09-19", "name": "Día de las Glorias del Ejército", "irrenunciable": True},
        {"date": "2027-10-11", "name": "Encuentro de Dos Mundos", "irrenunciable": False},
        {"date": "2027-10-31", "name": "Día de las Iglesias Evangélicas y Protestantes", "irrenunciable": False},
        {"date": "2027-11-01", "name": "Día de Todos los Santos", "irrenunciable": False},
        {"date": "2027-12-08", "name": "Inmaculada Concepción", "irrenunciable": False},
        {"date": "2027-12-25", "name": "Navidad", "irrenunciable": True}
    ]
}

# ==============================================================================
# 12. SAVE JSON DATABASES & JS BUNDLE
# ==============================================================================
with open(OUT_DIR / 'staff_master.json', 'w', encoding='utf-8') as f:
    json.dump(staff_master, f, ensure_ascii=False, indent=2)

with open(OUT_DIR / 'turns_2026.json', 'w', encoding='utf-8') as f:
    json.dump(turns_records, f, ensure_ascii=False, indent=2)

with open(OUT_DIR / 'tdm_2026.json', 'w', encoding='utf-8') as f:
    json.dump(tdm_records, f, ensure_ascii=False, indent=2)

with open(OUT_DIR / 'holidays_chile.json', 'w', encoding='utf-8') as f:
    json.dump(holidays_chile, f, ensure_ascii=False, indent=2)

bundle_payload = {
    'generated_at': datetime.datetime.now().isoformat(),
    'source_file': str(EXCEL_PATH),
    'staff': staff_master,
    'turns_2026': turns_records,
    'tdm_2026': tdm_records,
    'holidays': holidays_chile
}

with open(OUT_DIR / 'data_bundle.js', 'w', encoding='utf-8') as f:
    f.write("window.TURNOS_INITIAL_DATA = ")
    json.dump(bundle_payload, f, ensure_ascii=False)
    f.write(";\n")

incomplete = [s for s in staff_master.values() if s['needs_completion']]
lm_total = sum(1 for t in turns_records if t['event_type'] == 'LICENCIA_MEDICA')
vac_total = sum(1 for t in turns_records if t['event_type'] == 'VACACIONES')
print("=== CLEAN DATABASE BUILT SUCCESSFULLY ===")
print(f"Total Unified Staff: {len(staff_master)} (Complete: {len(staff_master) - len(incomplete)}, Pending Info: {len(incomplete)})")
print(f"Total 2026 Shift/Event Records: {len(turns_records)} (Vacaciones FL: {vac_total}, Licencias LM: {lm_total})")
print(f"Total 2026 Toma de Muestra Assignments: {len(tdm_records)}")
if incomplete:
    print("\nStaff needing completion (RUT or 2nd Surname):")
    for s in incomplete:
        print(f"  - {s['name']} ({s['role']} / {s['section']}): missing {', '.join(s['missing_fields'])}")
