# 🏥 Sistema de Gestión de Turnos y Calendario 2027 - Laboratorio Clínico HRT
### Hospital Regional de Talca

Modernización integral de la planilla de turnos, ausentismos (vacaciones, días administrativos, licencias) y asignación diaria de Toma de Muestras (TDM) para el Laboratorio Clínico del Hospital Regional de Talca.

---

## 📋 1. Resumen del Proyecto y Diagnóstico de la Planilla Original ("TURNOS 2026")

Se analizó en profundidad el archivo histórico **"TURNOS 2026"** proveniente de Google Sheets, identificando su estructura operativa de 5 pestañas:

1. **`LAB. URGENCIA`**:
   - Sistema de **4to turno rotativo** diurno y nocturno (`L` = Largo 08:00 a 20:00, `N` = Noche 20:00 a 08:00, Saliente y Libre).
   - Dividido en dos estamentos: **Profesionales** (Tecnólogos Médicos, Bioquímicos) y **TENS**.
   - Integra turnos de reemplazo e internos de Tecnología Médica (`TM INT.`).

2. **`PROFESIONALES RUTINA`**:
   - Funcionarios organizados por sub-secciones clínicas:
     - *Hematología y Técnicas Especiales*
     - *Inmunoquímica*
     - *Microbiología*
     - *Urgencia y Biología Molecular*
     - *Autoinmunidad*
     - *Sección Administrativa / Jefatura*
   - Registro de devoluciones horarias (ej: `16:00-17:00`, `H+5`, `H+6`), comisiones de servicio (`*`), turnos `M` (mañana) y `T` (tarde).

3. **`TENS RUTINA`**:
   - Técnicos Paramédicos y TENS de laboratorio de rutina.
   - Incluye secciones especiales de funciones administrativas, reemplazos y control de licencias.
   - Contiene la regla crítica de dotación del servicio: **"Máximo 4 a 5 ausencias diarias"**.

4. **`AUXILIARES`**:
   - Personal auxiliar de laboratorio (Susana Sepúlveda, Salomón Conejera, Pamela Álvarez, Esteban Canales).
   - Turnos de apoyo especial y fines de semana (`H+6`, `H+9`, `16:30`).

5. **`TOMA DE MUESTRA (TDM)`** *(Pestaña Diferenciada de Coordinación)*:
   - **Propósito clave**: No es un estamento independiente, sino una **matriz de designación diaria de puestos y horarios**.
   - Los funcionarios asignados provienen de las listas de TENS Rutina, Urgencia o Profesionales.
   - Asigna puestos fijos: *Box Apertura 07:30*, *Boxes Ambulatorios 08:00*, *Refuerzo Horario Punta 08:30*, *Recepción de Muestras CDT*, *Orientador en Sala*, y *Refuerzo Urgencia (07:00-08:00)*.

---

## 👥 2. Auditoría de Dotación y Datos Pendientes

Se cruzó la base de datos de funcionarios de la planilla con la **Dotación Oficial del Hospital Regional de Talca (`Lista de asistencia 2026.xlsx`)**, estandarizando nombres y validando RUTs.

### ⚠️ Funcionarios que requieren completar RUT o Segundo Apellido:

| Funcionario en Planilla | Estamento / Sección | RUT Registrado | Estado / Observación |
| :--- | :--- | :--- | :--- |
| **Katalina Barrera** | Profesional / Microbiología | *Pendiente* | Figura como `BARRERA KATALINA` / `KATALINA`. Requiere RUT. |
| **Ignacio Brunel** | Profesional / Reemplazo | *Pendiente* | Figura como `REEMPLAZO IGNACIO`. Requiere RUT. |
| **Tamara Lara** | Profesional / Reemplazo | *Pendiente* | Figura como `REEMPLAZO TAMARA` / `TAMARA LARA`. Requiere RUT. |
| **Cristian Andrade** | Profesional / Reemplazo | *Pendiente* | Figura como `REEMPLAZO CRISTIAN ANDRADE`. Requiere RUT. |
| **María José Peñailillo** | Profesional/TENS / TDM | *Pendiente* | Registrada en Toma de Muestra como `TM MARIA JOSE PEÑAILILLO`. |
| **Esteban Canales** | Auxiliar / Reemplazo | *Pendiente* | Figura como `reemplazo (Esteban)` / `ESTEBAN CANALES`. |
| **María Elizabeth** | Auxiliar / Reemplazo | *Pendiente* | Figura como `Reemplazo (Maria Elizabeth)`. Requiere apellido y RUT. |
| **Valeria Montes** | TENS / Rutina | *Pendiente* | Figura en sección de Licencias TENS. Requiere RUT. |
| **Laura Pérez** | TENS / Rutina | *Pendiente* | Figura en Rutina y Recepción TDM. Requiere RUT. |
| **Anahis Albornoz** | TENS / Urgencia | *Pendiente* | Figura como `ANHAIS` / `ANHAIS ALBORNOZ`. Requiere RUT oficial. |

> 💡 **Nota**: En la nueva aplicación web, puedes hacer clic en la pestaña **"👥 Dotación & Personal"** y luego en **"Editar"** sobre cualquier funcionario para ingresar o actualizar su RUT y nombres de forma instantánea.

---

## 🚀 3. Características de la Nueva Plataforma Web (2027)

1. **Selector de Año (2026 Histórico vs 2027 Planificación)**:
   - Permite consultar todo el año 2026 tal como estaba en la planilla original para comparar o auditar.
   - Permite planificar el año **2027** completo con validaciones automáticas.
   - Botón **"Importar Plantilla 2026 a 2027"** para duplicar la dotación activa y comenzar a programar de inmediato.

2. **Matriz Interactiva con Edición en Un Clic**:
   - Navegación mensual fluida (Enero a Diciembre) con cálculo automático de días de la semana y feriados de Chile para 2027.
   - Al hacer clic en cualquier celda, se abre el **Selector Rápido de Turno / Ausentismo**:
     - 🔴 **Feriado Legal (Vacaciones)**
     - 🟡 **Día Administrativo (DA)**
     - 🟣 **Devolución de Tiempo / Horas Extras** (con ingreso de horas ej. `H+6` o rango `16:00-17:00`)
     - 🌸 **Comisión de Servicio (`*`)**
     - 🟠 **Licencia Médica (LM)**
     - 🔵 **Permiso sin Goce de Sueldo**
     - ☀️ **Turno Largo (`L`)**
     - 🌙 **Turno Noche (`N`)**
     - 🌅 **Mañana (`M`)** / 🌆 **Tarde (`T`)**
     - 🗑️ **Limpiar Día (Libre)**

3. **Módulo Especial de Toma de Muestras (TDM)**:
   - **Tablero Diario por Puestos**:
     - *07:30 Box Apertura*
     - *08:00 Boxes 1 al 4 (Ambulatorio)*
     - *08:30 Box Refuerzo Punta*
     - *Recepción de Muestras CDT*
     - *Orientador y Apoyo en Sala*
     - *Refuerzo Urgencia (07:00 a 08:00)*
   - **Detección Inteligente de Conflictos**: Si intentas asignar a un colega que en ese mismo día tiene **Vacaciones**, **Licencia Médica**, **Día Administrativo** o está saliente de **Turno Noche**, el sistema despliega una alerta preventiva destacada en rojo (`⚠️ Juan Pérez (En Vacaciones / Turno Noche)`).

4. **Monitoreo de Ausentismos y Regla de Dotación TENS**:
   - Alerta visible sobre la regla hospitalaria: *"Máximo 4 a 5 ausencias diarias en TENS"*.
   - Panel de estadísticas con contadores de días de vacaciones utilizados, administrativos solicitados y turnos de noche por funcionario.

5. **Exportación e Importación**:
   - **Exportar a Excel (`.xlsx`)**: Genera un archivo Excel multipestaña compatible con el formato hospitalario oficial mediante un solo clic.
   - **Copia de Seguridad JSON**: Guarda o restaura todo el sistema para respaldos locales.
   - **Persistencia Automática**: Todo cambio realizado en el navegador se guarda automáticamente en `localStorage`.

---

## 💻 4. Cómo Iniciar y Usar la Aplicación

### Opción A: Servidor Local Python (Recomendado)
Abre PowerShell o terminal en la carpeta del proyecto y ejecuta:
```bash
python server.py
```
*Se iniciará el servidor local y se abrirá automáticamente tu navegador en `http://localhost:8000`.*

### Opción B: Directo en el Navegador (Sin servidor)
Haz doble clic sobre el archivo **`index.html`**. La aplicación está diseñada para funcionar 100% offline y sin bloqueos de red o CORS.

### Opción C: Exportar Calendario 2027 a Excel vía Python
Si deseas generar un archivo Excel formateado desde la consola:
```bash
python export_excel.py
```
*Generará `TURNOS_LABORATORIO_HRT_2027.xlsx` con todas las pestañas formateadas con colores y bordes institucionales.*

---

## 🌐 5. Estructura de Archivos del Repositorio

```text
Proyecto Turnos/
├── index.html                     # Interfaz web principal moderna y responsiva
├── styles.css                     # Estilos institucionales, matriz sticky y colores de turnos
├── app.js                         # Controlador de la aplicación, lógica de calendario y TDM
├── server.py                      # Servidor HTTP local con apertura automática de navegador
├── export_excel.py                # Generador de Excel institucional (.xlsx) con openpyxl
├── assets/
│   ├── xlsx.full.min.js          # Librería SheetJS para exportar a Excel offline
│   └── lucide.min.js              # Iconografía médica e institucional offline
├── data/
│   ├── data_bundle.js             # Base de datos empaquetada para carga offline inmediata
│   ├── staff_master.json          # Directorio depurado de los 100 funcionarios del laboratorio
│   ├── turns_2026.json            # 7.612 registros históricos de turnos de 2026
│   ├── tdm_2026.json              # 1.193 asignaciones históricas de Toma de Muestras 2026
│   └── holidays_chile.json        # Feriados nacionales oficiales de Chile 2026 y 2027
└── TURNOS 2026.xlsx               # Planilla original descargada desde Google Drive
```
