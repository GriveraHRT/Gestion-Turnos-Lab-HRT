# Despliegue Web y Co-Propiedad Institucional — Sistema de Turnos Laboratorio HRT

Este sistema ya se encuentra **100% publicado y operativo** en doble canal (GitHub Pages + Google Apps Script / Google Drive / Google Sheets), con derechos y autorización total compartidos entre **`grivera@hospitaldetalca.cl`** y **`laboratoriohrt@hospitaldetalca.cl`**.

---

## 🌐 Enlaces Oficiales en Producción

1. **Aplicación Web Principal (GitHub Pages — Acceso Rápido Institucional):**
   - 🔗 **[https://griverahrt.github.io/Gestion-Turnos-Lab-HRT/](https://griverahrt.github.io/Gestion-Turnos-Lab-HRT/)**
   - *Recomendado para compartir por WhatsApp, correo o código QR con todo el personal.*

2. **Hoja de Cálculo de Google Sheets (Bitácora de Trazabilidad en Vivo):**
   - 📊 **[Abrir Hoja de Cálculo y Bitácora en Google Sheets](https://docs.google.com/spreadsheets/d/1kgffDsCAawpxk3_8e35iFf-iro8bGtrnA-z1eJ1GVgQ/edit)**
   - *Compartida con permisos totales de Edición para `grivera@hospitaldetalca.cl` y `laboratoriohrt@hospitaldetalca.cl`.*

3. **Proyecto de Google Apps Script (Backend y API):**
   - ⚙️ **[Abrir Editor de Google Apps Script](https://script.google.com/d/1hzY6mXgi2b3_SXmyyw1gb9RUugF3szF861rv90VKXSmjyW0GuIgMn0eo/edit)**
   - **URL del Endpoint Web App (`DEFAULT_GAS_URL`):**
     `https://script.google.com/macros/s/AKfycbwKsDWxQplfuJMlgeCIJl0D9Rt0woCx7HlWytvnnH6lcJQt57m-kT2QHej--lQp-soO/exec`

4. **Base de Datos Maestra en Google Drive (`TURNOS_HRT_DB.json`):**
   - 🗄️ ID de Archivo en Drive: `18-57r81QgQ6kqg5f6q-4dG6uncYpPL7z`
   - *Compartido automáticamente con permisos de lectura/escritura para `grivera@hospitaldetalca.cl` y `laboratoriohrt@hospitaldetalca.cl`.*

---

## 🔐 Cuentas Administradoras y de Jefatura Configuradas

Dentro de la aplicación web (botón **`🔐 Acceso Jefatura`** arriba a la derecha), ambas cuentas institucionales tienen **Rol Administrador con Permisos Totales**:

| Usuario / Correo | Contraseña Inicial | Rol | Permisos |
| :--- | :--- | :--- | :--- |
| **`grivera@hospitaldetalca.cl`** *(o `grivera`)* | `admin2026` | 🛡️ **Administrador** | Permisos totales (Turnos, Ausencias, Trazabilidad, Crear/Editar Usuarios, Dotación y Base de Datos) |
| **`laboratoriohrt@hospitaldetalca.cl`** *(o `laboratoriohrt`)* | `admin2026` | 🛡️ **Administrador** | Permisos totales (Turnos, Ausencias, Trazabilidad, Crear/Editar Usuarios, Dotación y Base de Datos) |
| **`admin`** | `admin2026` | 🛡️ **Administrador** | Permisos totales |
| **`jefatura`** | `jefe2026` | 🩺 **Jefatura** | Marcar días/ausencias (`FL`, `DA`, `LM`, `DC`, `DT`), asignar turnos/rotaciones, TDM y ver `📋 Trazabilidad` |

*(Cualquier contraseña o nuevo usuario de jefatura se puede modificar o agregar en cualquier momento desde el botón **`🔑 Usuarios`** en la barra superior).*

---

## 🔄 Flujo de Actualización Técnica (Para Futuras Mejoras)

Si en el futuro se realizan cambios en el código desde este computador:

```powershell
# 1. Regenerar paquete de Apps Script y subirlo
python build_gas_bundle.py
cd google_apps_script
cmd /c clasp push -f
cmd /c clasp deploy -i AKfycbwKsDWxQplfuJMlgeCIJl0D9Rt0woCx7HlWytvnnH6lcJQt57m-kT2QHej--lQp-soO -d "Actualizacion"
cd ..

# 2. Publicar cambios en GitHub Pages
git add .
git commit -m "Actualizacion sistema de turnos"
git push origin master
```
