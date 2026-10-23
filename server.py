import http.server
import socketserver
import webbrowser
import os
import json
import datetime
from pathlib import Path

PORT = 8000
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / 'data'


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and disable aggressive caching for local development & network sync
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        if self.path.rstrip('/') == '/api/save-db':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                raw_body = self.rfile.read(content_length)
                payload = json.loads(raw_body.decode('utf-8'))

                DATA_DIR.mkdir(exist_ok=True)

                staff = payload.get('staff')
                turns_2026 = payload.get('turns_2026')
                tdm_2026 = payload.get('tdm_2026')
                turns_2027 = payload.get('turns_2027')
                tdm_2027 = payload.get('tdm_2027')
                holidays = payload.get('holidays')
                users = payload.get('users')
                audit_log = payload.get('audit_log')

                if staff is not None:
                    with open(DATA_DIR / 'staff_master.json', 'w', encoding='utf-8') as f:
                        json.dump(staff, f, ensure_ascii=False, indent=2)

                if turns_2026 is not None:
                    with open(DATA_DIR / 'turns_2026.json', 'w', encoding='utf-8') as f:
                        json.dump(turns_2026, f, ensure_ascii=False, indent=2)

                if tdm_2026 is not None:
                    with open(DATA_DIR / 'tdm_2026.json', 'w', encoding='utf-8') as f:
                        json.dump(tdm_2026, f, ensure_ascii=False, indent=2)

                if turns_2027 is not None:
                    with open(DATA_DIR / 'turns_2027.json', 'w', encoding='utf-8') as f:
                        json.dump(turns_2027, f, ensure_ascii=False, indent=2)

                if tdm_2027 is not None:
                    with open(DATA_DIR / 'tdm_2027.json', 'w', encoding='utf-8') as f:
                        json.dump(tdm_2027, f, ensure_ascii=False, indent=2)

                if holidays is not None:
                    with open(DATA_DIR / 'holidays_chile.json', 'w', encoding='utf-8') as f:
                        json.dump(holidays, f, ensure_ascii=False, indent=2)

                if users is not None:
                    with open(DATA_DIR / 'users.json', 'w', encoding='utf-8') as f:
                        json.dump(users, f, ensure_ascii=False, indent=2)

                if audit_log is not None:
                    with open(DATA_DIR / 'audit_log.json', 'w', encoding='utf-8') as f:
                        json.dump(audit_log, f, ensure_ascii=False, indent=2)

                bundle_payload = {
                    'generated_at': datetime.datetime.now().isoformat(),
                    'source_file': 'TURNOS 2026.xlsx + Ediciones Web',
                    'staff': staff or {},
                    'turns_2026': turns_2026 or [],
                    'tdm_2026': tdm_2026 or [],
                    'turns_2027': turns_2027 or [],
                    'tdm_2027': tdm_2027 or [],
                    'holidays': holidays or {},
                    'users': users or [],
                    'audit_log': audit_log or []
                }

                with open(DATA_DIR / 'data_bundle.js', 'w', encoding='utf-8') as f:
                    f.write("window.TURNOS_INITIAL_DATA = ")
                    json.dump(bundle_payload, f, ensure_ascii=False)
                    f.write(";\n")

                resp = json.dumps({
                    'ok': True,
                    'saved_at': bundle_payload['generated_at'],
                    'staff_count': len(staff or {})
                }).encode('utf-8')

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
            except Exception as e:
                err = json.dumps({'ok': False, 'error': str(e)}).encode('utf-8')
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(err)))
                self.end_headers()
                self.wfile.write(err)
        else:
            self.send_response(404)
            self.end_headers()


def main():
    os.chdir(str(BASE_DIR))
    handler = CustomHandler

    port = PORT
    for _ in range(10):
        try:
            with socketserver.TCPServer(("", port), handler) as httpd:
                print("===========================================================")
                print("  SISTEMA DE TURNOS Y CALENDARIO - LABORATORIO CLÍNICO HRT")
                print(f"  Servidor iniciado en: http://localhost:{port}")
                print("  Auto-guardado en disco (carpeta data/) ACTIVADO")
                print("  Presiona Ctrl + C para detener el servidor")
                print("===========================================================")
                if '--no-browser' not in os.sys.argv:
                    webbrowser.open(f"http://localhost:{port}")
                httpd.serve_forever()
                break
        except OSError:
            port += 1


if __name__ == "__main__":
    main()
