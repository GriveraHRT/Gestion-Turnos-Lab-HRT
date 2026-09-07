import sqlite3, shutil, tempfile, os, sys
import requests

p_prof = os.path.expandvars(r"%APPDATA%\Mozilla\Firefox\Profiles\ykqiepeq.default-release")
p_cookies = os.path.join(p_prof, "cookies.sqlite")

tmp = tempfile.mktemp()
shutil.copy2(p_cookies, tmp)
conn = sqlite3.connect(tmp)
c = conn.cursor()

session = requests.Session()
for host, name, val, path in c.execute("SELECT host, name, value, path FROM moz_cookies WHERE host LIKE '%google.com'"):
    session.cookies.set(name, val, domain=host, path=path)

conn.close()
if os.path.exists(tmp): os.remove(tmp)

url = "https://docs.google.com/spreadsheets/d/1Q5Prpd8a8-Ub6Yq6ji8O4UkKMebFAKw6ruNM-NavAEg/export?format=xlsx"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0"
}

resp = session.get(url, headers=headers, allow_redirects=True)
print("Status code:", resp.status_code)
print("Content-Type:", resp.headers.get("Content-Type"))
print("Content length:", len(resp.content))

if resp.status_code == 200 and "spreadsheet" in resp.headers.get("Content-Type", "") or resp.content[:4] == b"PK\x03\x04":
    with open("TURNOS 2026.xlsx", "wb") as f:
        f.write(resp.content)
    print("SUCCESS: 'TURNOS 2026.xlsx' downloaded successfully! File size:", len(resp.content))
else:
    print("Failed response preview:", resp.text[:300])
