"""
Generador de Paquete para Google Apps Script (Index.html)
=========================================================
Este script combina index.html, styles.css y app.js en `google_apps_script/Index.html`
y enlaza la semilla inicial desde GitHub Pages (`https://griverahrt.github.io/Gestion-Turnos-Lab-HRT/data/data_bundle.js`),
manteniendo el archivo liviano (~260 KB) para cumplir con el límite por archivo de Google Apps Script (`clasp push`).
"""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
GAS_DIR = BASE_DIR / "google_apps_script"
GH_PAGES_BUNDLE_URL = "https://griverahrt.github.io/Gestion-Turnos-Lab-HRT/data/data_bundle.js"


def build_gas_index():
    GAS_DIR.mkdir(exist_ok=True)

    html = (BASE_DIR / "index.html").read_text(encoding="utf-8")
    css = (BASE_DIR / "styles.css").read_text(encoding="utf-8")
    app_js = (BASE_DIR / "app.js").read_text(encoding="utf-8")

    # Reemplazar <link rel="stylesheet" href="styles.css" /> por <style>...</style>
    html = html.replace(
        '<link rel="stylesheet" href="styles.css" />',
        f"<style>\n{css}\n</style>"
    ).replace(
        '<link rel="stylesheet" href="styles.css">',
        f"<style>\n{css}\n</style>"
    )

    # Apuntar data_bundle.js al CDN institucional de GitHub Pages y embebir app.js
    html = html.replace(
        '<script src="data/data_bundle.js"></script>',
        f'<script src="{GH_PAGES_BUNDLE_URL}"></script>'
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
