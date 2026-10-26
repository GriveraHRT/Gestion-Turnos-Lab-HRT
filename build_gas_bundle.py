"""
Generador de Paquete para Google Apps Script (Index.html)
=========================================================
Este script combina index.html, styles.css, la base de datos comprimida en Gzip+Base64
(`window.TURNOS_GZIP_B64`, ~108 KB) y app.js en un único archivo autocontenido
`google_apps_script/Index.html` (~388 KB, cumpliendo holgadamente el límite de 1 MB por archivo de Apps Script).
De esta forma, el link de Google Apps Script carga el 100% de los funcionarios y turnos al instante
sin depender de servicios externos ni reemplazos en servidor.
"""

import base64
import gzip
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
GAS_DIR = BASE_DIR / "google_apps_script"


def build_gas_index():
    GAS_DIR.mkdir(exist_ok=True)

    html = (BASE_DIR / "index.html").read_text(encoding="utf-8")
    css = (BASE_DIR / "styles.css").read_text(encoding="utf-8")
    app_js = (BASE_DIR / "app.js").read_text(encoding="utf-8")
    raw_bundle = (BASE_DIR / "data" / "data_bundle.js").read_text(encoding="utf-8")

    prefix = "window.TURNOS_INITIAL_DATA = "
    json_str = raw_bundle[len(prefix):].strip().rstrip(";") if raw_bundle.startswith(prefix) else raw_bundle
    gz_bytes = gzip.compress(json_str.encode("utf-8"), compresslevel=9)
    b64_str = base64.b64encode(gz_bytes).decode("ascii")

    # Reemplazar <link rel="stylesheet" href="styles.css" /> por <style>...</style>
    html = html.replace(
        '<link rel="stylesheet" href="styles.css" />',
        f"<style>\n{css}\n</style>"
    ).replace(
        '<link rel="stylesheet" href="styles.css">',
        f"<style>\n{css}\n</style>"
    )

    # Incrustar la base de datos completa comprimida directamente dentro de Index.html
    html = html.replace(
        '<script src="data/data_bundle.js"></script>',
        f'<script>\nwindow.TURNOS_GZIP_B64 = "{b64_str}";\n</script>'
    )
    html = html.replace(
        '<script src="app.js"></script>',
        f"<script>\n{app_js}\n</script>"
    )

    out_path = GAS_DIR / "Index.html"
    out_path.write_text(html, encoding="utf-8")
    print(f"[OK] Archivo generado exitosamente: {out_path} ({out_path.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    build_gas_index()
