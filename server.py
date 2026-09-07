import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8000

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and disable aggressive caching for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    handler = CustomHandler
    
    # Try port 8000, fallback to 8080 or next available
    port = PORT
    for attempt in range(10):
        try:
            with socketserver.TCPServer(("", port), handler) as httpd:
                print(f"===========================================================")
                print(f"  SISTEMA DE TURNOS Y CALENDARIO - LABORATORIO CLÍNICO HRT")
                print(f"  Servidor iniciado en: http://localhost:{port}")
                print(f"  Presiona Ctrl + C para detener el servidor")
                print(f"===========================================================")
                webbrowser.open(f"http://localhost:{port}")
                httpd.serve_forever()
                break
        except OSError:
            port += 1

if __name__ == "__main__":
    main()
