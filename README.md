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
   - Personal auxiliar de laboratorio (Susana Sepúlveda, Salomón Conejera, Pamela Álvarez, Cecilia Medel, Esteban Canales, María Elizabeth).
   - Registro de turnos de apoyo, fines de semana y devoluciones (`H+6`, `H+9`, `16:30`).

5. **`TOMA DE MUESTRA (TDM)`** *(Pestaña Diferenciada de Coordinación)*:
   - **Propósito clave**: No es un estamento independiente, sino una **matriz de designación diaria de puestos y horarios**.
   - Los 22 funcionarios designados provienen de las listas de TENS Rutina, Urgencia o Profesionales (sin duplicación de personas).
   - Asigna puestos fijos: *Box Apertura 07:30*, *Boxes Ambulatorios 1 al 4 (08:00)*, *Refuerzo Horario Punta 08:30 (SOS)*, *Recepción de Muestras CDT*, *Orientador en Sala*, y *Refuerzo Urgencia (07:00-08:00)*.

---

## 👥 2. Auditoría de Dotación y Datos Pendientes

Se cruzó exhaustivamente la base de datos de la planilla con la **Dotación Oficial del Hospital Regional de Talca (`Lista de asistencia 2026.xlsx`)**:

### ✅ Funcionarios Validados y Completados con RUT Oficial de Dotación:
- **Valeria Montes** (TENS): RUT `17.932.887-9`
- **Elizabel Sánchez** (TENS): RUT `17.184.367-7` (*Elizsabel del Carmen Sánchez Mejías*)
- **Muriel Correa** (TENS): RUT `18.029.084-2`
- **Merlam Espinoza** (TENS): RUT `16.270.882-1`
- **Nicol Riquelme Gálvez** (TENS): RUT `19.473.178-7`
- **Ruth Jara Lara** (TENS): RUT `16.731.595-K`
- **Ingrid Silva Valdivia** (TENS): RUT `15.138.825-6`
- **Patricia Morales Rojas** (TM): RUT `11.480.276-K`
- **Susana Quintana** (TENS): RUT `14.018.629-5`
- **Jimena González** (Administrativo): RUT `19.043.840-6`
- **Camila Reyes Vivero** (Bioquímico): RUT `17.186.419-4`
- **Loreto Díaz Ríos** (TM): RUT `16.899.801-5`
- **Diego Rojas Verdugo** (TM): RUT `18.572.806-4`
- **Francisco Sepúlveda** (TM): RUT `17.685.105-8`
- **Salomón Conejera** (Auxiliar): RUT `10.105.861-1`
- **Susana Sepúlveda** (Auxiliar): RUT `10.892.073-4`
- **Pamela Álvarez Valdés** (Auxiliar): RUT `11.893.938-7`

### ⚠️ Colegas de Reemplazo o Contrato Externo Pendientes de RUT / Apellido:

| Funcionario en Planilla | Estamento / Sección | Estado / Observación |
| :--- | :--- | :--- |
| **Katalina Barrera** | Profesional / Microbiología | Reemplazo TM. Requiere registrar RUT oficial. |
| **Ignacio Brunel** | Profesional / Reemplazo | Reemplazo TM en Urgencia/Rutina. Requiere RUT oficial. |
| **Tamara Lara** | Profesional / Reemplazo | Reemplazo TM. Requiere registrar RUT oficial. |
| **Cristian Andrade** | Profesional / Reemplazo | Reemplazo TM en Microbiología. Requiere RUT oficial. |
| **María José Peñailillo** | Profesional / TDM | Tecnólogo Médico en Toma de Muestra. Requiere registrar RUT. |
| **Esteban Canales** | Auxiliar / Reemplazo | Auxiliar de reemplazo. Requiere registrar RUT. |
| **María Elizabeth** | Auxiliar / Reemplazo | Auxiliar de reemplazo. Requiere apellido paterno/materno y RUT. |
| **Cecilia Medel** | Auxiliar / Laboratorio | Auxiliar. Requiere registrar RUT oficial. |
| **Laura Pérez** | TENS / Rutina y TDM | TENS en toma de muestras. Requiere registrar RUT. |
| **Anahis Albornoz** | TENS / Urgencia y Rutina | TENS reemplazo. Requiere registrar RUT oficial. |
| **Camila Walker** | TENS / Reemplazo Rutina | Reemplazo TENS en horario administrativo. Requiere registrar RUT. |
| **Camila Gutiérrez** | Profesional / Inmunoquímica | Profesional de reemplazo. Requiere registrar RUT. |
| **Camila González** | Profesional / Urgencia | Profesional TM de reemplazo. Requiere registrar RUT. |
| **Daniel Schulz** | Profesional / Inmunoquímica | Profesional de reemplazo. Requiere registrar RUT. |
| **Rodrigo Cantero** | TENS / Urgencia y Rutina | Reemplazo TENS. Requiere registrar RUT oficial. |
| **Yessenia Cáceres** | TENS / Urgencia y Rutina | TENS de laboratorio. Requiere registrar RUT oficial. |
| **Bárbara Alcántara** | TENS / Urgencia y TDM | TENS apoyo toma de muestras. Requiere registrar RUT oficial. |
| **Constanza Riquelme** | Profesional / Rutina y TDM | Tecnólogo Médico en TDM y Rutina. Requiere registrar RUT. |

> 💡 **Nota**: En la aplicación web, puedes acceder a la pestaña **"👥 Dotación & Personal"** y hacer clic en **"Editar"** sobre cualquiera de ellos para registrar su RUT y apellidos con actualización instantánea.

---

## 🚀 3. Características de la Nueva Plataforma Web (2027)

1. **Selector de Año (2026 Histórico vs 2027 Planificación)**:
   - Permite consultar todo el año 2026 tal como estaba en la planilla original para comparar o auditar (7.801 turnos y 1.015 puestos de TDM).
   - Permite planificar el año **2027** completo con validaciones automáticas.
   - Botón **"Importar Plantilla 2026 a 2027"** para duplicar la dotación activa y comenzar a programar de inmediato.

2. **Matriz Interactiva con Búsqueda Instantánea O(1)**:
   - Navegación mensual fluida (Enero a Diciembre) con cálculo automático de días de la semana y feriados de Chile para 2027.
   - Al hacer clic en cualquier celda, se abre el **Selector Rápido de Turno / Ausentismo**:
     - 🔴 **Feriado Legal (Vacaciones)**
     - 🟡 **Día Administrativo (DA)**
     - 🟣 **Devolución de Tiempo / Horas Extras** (ej. `H+6` o rango `16:00-17:00`)
     - 🌸 **Comisión de Servicio (`*`)**
     - 🟠 **Licencia Médica (LM)**
     - 🔵 **Permiso sin Goce de Sueldo**
     - ☀️ **Turno Largo (`L`)**
     - 🌙 **Turno Noche (`N`)**
     - 🌅 **Mañana (`M`)** / 🌆 **Tarde (`T`)**
     - 🗑️ **Limpiar Día (Libre)**

3. **Módulo Especial de Toma de Muestras (TDM)**:
   - **Tablero Diario por Puestos Operativos**:
     - *07:30 Box Apertura*
     - *08:00 Boxes 1 al 4 (Punción Ambulatoria)*
     - *08:30 Box Refuerzo Punta (SOS)*
     - *Recepción de Muestras CDT*
     - *Orientador y Apoyo en Sala*
     - *Refuerzo Urgencia (07:00 a 08:00)*
   - **Detección Inteligente de Conflictos Clínicos**:
     - Alerta si un funcionario tiene **Vacaciones**, **Licencia Médica** o **Día Administrativo**.
     - Alerta si está en **Turno Noche Activo** o es **Saliente de Turno Noche (08:00 AM)** del día anterior.
     - Impide asignar a la misma persona a dos puestos distintos el mismo día sin confirmación explícita.
   - **Resumen Mensual TDM**: Muestra asignaciones `X` junto al estado del funcionario en los días que no está en TDM (`FL`, `DA`, `N`, `L`).

4. **Monitoreo de Ausentismos y Regla de Dotación TENS**:
   - Alerta visible sobre la regla hospitalaria: *"Máximo 4 a 5 ausencias diarias en TENS"*.
   - Panel de estadísticas con contadores de días de vacaciones utilizados, administrativos solicitados y turnos de noche por funcionario.

5. **Exportación e Importación**:
   - **Exportar a Excel (`.xlsx`)**: Genera un archivo Excel multipestaña compatible con el formato hospitalario oficial mediante un solo clic, incluyendo la pestaña de auditoría **"DOTACIÓN Y PERSONAL"**.
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
Haz doble clic sobre el archivo **`index.html`**. La aplicación funciona 100% offline sin bloqueos de red o CORS.

### Opción C: Exportar Calendario a Excel vía Python
Para generar los libros institucionales formateados:
```bash
# Exportar año 2027
python export_excel.py 2027

# Exportar archivo histórico 2026
python export_excel.py 2026
```

---

## 🌐 5. Estructura de Archivos del Repositorio

```text
Proyecto Turnos/
├── index.html                     # Interfaz web principal moderna y responsiva
├── styles.css                     # Estilos institucionales, matriz sticky y colores de turnos
├── app.js                         # Controlador de la aplicación, lógica de calendario y TDM
├── server.py                      # Servidor HTTP local con apertura automática de navegador
├── export_excel.py                # Generador de Excel institucional (.xlsx) de alto rendimiento
├── assets/
│   ├── xlsx.full.min.js          # Librería SheetJS para exportar a Excel offline
│   └── lucide.min.js              # Iconografía médica e institucional offline
├── data/
│   ├── data_bundle.js             # Base de datos empaquetada para carga offline inmediata
│   ├── staff_master.json          # Directorio depurado de los 98 funcionarios del laboratorio
│   ├── turns_2026.json            # 7.801 registros históricos de turnos de 2026 (incluye Auxiliares)
│   ├── tdm_2026.json              # 1.015 asignaciones de Toma de Muestras mapeadas a puestos
│   └── holidays_chile.json        # Feriados nacionales oficiales de Chile 2026 y 2027
├── TURNOS 2026.xlsx               # Planilla original descargada desde Google Drive
├── TURNOS_LABORATORIO_HRT_2026.xlsx # Excel generado histórico 2026 completo
└── TURNOS_LABORATORIO_HRT_2027.xlsx # Excel generado plantilla 2027 institucional
```
