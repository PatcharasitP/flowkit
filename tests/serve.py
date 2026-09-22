#!/usr/bin/env python3
"""เซิร์ฟเวอร์เทสของ FlowKit: เสิร์ฟสองเว็บใต้ที่อยู่เดียว ให้ที่อยู่ทุกตัวตรงกับ patcharasitp.github.io จริง

‼️ ทำไมต้องมี (แผนเว็บ FlowKit แยก ข้อ 8.4 , 22/09/2026)
   บนเว็บจริง หน้า /flowkit/ import ไฟล์กลางของ FileKit (/filekit/src/i18n.js) ได้เพราะอยู่โดเมนเดียวกัน
   http.server ธรรมดาเสิร์ฟได้แค่โฟลเดอร์เดียว ตัวนี้ mount สองโฟลเดอร์ (สอง repo) ให้เหมือนเว็บจริง
‼️ ตัวพิมพ์ใหญ่เล็กต้องตรงเหมือน GitHub Pages
   ดิสก์ /mnt/c ไม่สนตัวพิมพ์ ขอ /filekit/SRC/i18n.js ก็ได้ไฟล์ แต่เว็บจริงตอบ 404
   โฟลเดอร์ในเครื่องชื่อ FileKit ตัวใหญ่ บนเว็บชื่อ filekit ตัวเล็ก ถ้าไม่บังคับตรงนี้ เทสเขียวในเครื่องแต่เว็บจริงพัง
‼️ แบบเดียวกับ GitHub Pages อีก 3 ข้อ: ขอโฟลเดอร์ไม่มี / ท้าย = 301 เติม / , ไม่เจอ = 404 พร้อม 404.html ของเว็บนั้น ,
   --gzip บีบไฟล์ข้อความ (เว็บจริงบีบทุกไฟล์ ขนาดกับเวลาที่วัดบนเซิร์ฟเวอร์ไม่บีบไม่มีผู้ใช้คนไหนเจอ ดู FileKit/tests/gzip_server.py)

ใช้:  python3 tests/serve.py PORT [--flowkit DIR] [--filekit DIR] [--mount /ที่อยู่/=DIR]... [--gzip] [--delay /ที่อยู่ MS]...
      ค่าตั้งต้น --flowkit = repo นี้ , --filekit = โฟลเดอร์ FileKit ข้าง ๆ (../FileKit)
      --mount ทับที่อยู่ย่อยได้ ที่อยู่ยาวกว่าชนะ (เช่น --mount /filekit/flow/=หน้าส่งต่อ ลองหน้าส่งต่อโดยไม่แตะ FileKit)
      PORT 0 = หาพอร์ตว่างเอง แล้วพิมพ์ "PORT <เลข>" เป็นบรรทัดแรก
รันพิสูจน์: python3 tests/serve.py --selftest
"""
import argparse
import gzip
import http.server
import os
import pathlib
import shutil
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
         ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json",
         ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
         ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
         ".xml": "application/xml", ".wasm": "application/wasm", ".map": "application/json", ".pdf": "application/pdf",
         ".mmd": "text/plain; charset=utf-8", ".drawio": "application/xml"}
ZIP = (".html", ".css", ".js", ".mjs", ".json", ".svg", ".txt", ".xml", ".webmanifest", ".map")


def exact(base, rel):
    """ไฟล์หรือโฟลเดอร์ที่ทุกชื่อตรงตัวพิมพ์จริงบนดิสก์ ไม่มี = None (ห้าม .. หนีออกนอกโฟลเดอร์)"""
    cur = pathlib.Path(base)
    for part in [p for p in rel.split("/") if p]:
        if part in (".", ".."):
            return None
        try:
            names = os.listdir(cur)
        except OSError:
            return None
        if part not in names:
            return None
        cur = cur / part
    return cur


class Site:
    def __init__(self, mounts, gz=False, delays=None):
        # ที่อยู่ยาวกว่ามาก่อน ทับที่อยู่สั้นได้
        self.mounts = sorted(((p, pathlib.Path(d)) for p, d in mounts), key=lambda m: -len(m[0]))
        self.gz, self.delays, self._zcache = gz, dict(delays or {}), {}

    def find(self, path):
        for pre, d in self.mounts:
            if pre.endswith("/"):
                if path.startswith(pre):
                    return pre, d, path[len(pre):]
                if path == pre[:-1]:
                    return pre, d, None                  # /flowkit ไม่มี / ท้าย
            elif path == pre:
                return pre, d.parent, d.name             # mount ไฟล์เดี่ยว
        return None, None, None

    def page404(self, pre, d):
        if pre and pre.endswith("/"):
            f = exact(d, "404.html")
            if f and f.is_file():
                return f.read_bytes()
        return b"<!DOCTYPE html><title>404</title><p>404</p>"

    def body(self, f, accept):
        raw = f.read_bytes()
        if not (self.gz and f.suffix in ZIP and "gzip" in accept):
            return raw, None
        key = (str(f), f.stat().st_mtime_ns)
        if key not in self._zcache:
            self._zcache[key] = gzip.compress(raw, 6)
        return self._zcache[key], "gzip"


def handler_for(site, quiet=True):
    class H(http.server.BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *a):
            if not quiet:
                super().log_message(*a)

        def send(self, code, data=b"", ctype="text/html; charset=utf-8", extra=None, head=False):
            self.send_response(code)
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            if not head:
                self.wfile.write(data)

        def go(self, head=False):
            u = urllib.parse.urlsplit(self.path)
            path = urllib.parse.unquote(u.path)
            q = ("?" + u.query) if u.query else ""
            for pat, ms in site.delays.items():
                if path == pat:
                    time.sleep(ms / 1000)
            if path == "/":
                return self.send(302, extra={"Location": "/flowkit/"}, head=head)
            pre, d, rel = site.find(path)
            if pre is None:
                return self.send(404, site.page404(None, None), head=head)
            if rel is None:
                return self.send(301, extra={"Location": pre + q}, head=head)
            f = exact(d, rel)
            if f is not None and f.is_dir():
                if not path.endswith("/"):
                    return self.send(301, extra={"Location": path + "/" + q}, head=head)
                f = exact(f, "index.html")
            if f is None or not f.is_file():
                return self.send(404, site.page404(pre, d), head=head)
            data, enc = site.body(f, self.headers.get("Accept-Encoding", ""))
            extra = {"Content-Encoding": enc, "Vary": "Accept-Encoding"} if enc else {}
            return self.send(200, data, TYPES.get(f.suffix.lower(), "application/octet-stream"), extra, head)

        def do_GET(self):
            self.go()

        def do_HEAD(self):
            self.go(head=True)

    return H


def serve(port, site, quiet=True):
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler_for(site, quiet))
    srv.daemon_threads = True
    return srv


def selftest():
    """ทุกกติกาข้างบนต้องจับของผิดได้จริง ‼️ โฟลเดอร์ทดลองต้องอยู่บน /mnt/c (ดิสก์ไม่สนตัวพิมพ์)
    ไม่งั้นข้อตัวพิมพ์ผ่านเพราะดิสก์ ไม่ใช่เพราะตัวตรวจ"""
    tmp = pathlib.Path(tempfile.mkdtemp(prefix=".serve-selftest-", dir=ROOT / "tests"))
    ok = bad = 0

    def ck(name, cond, detail=""):
        nonlocal ok, bad
        ok += bool(cond); bad += not cond
        print(f"  {'✅' if cond else '❌'} {name}" + (f"  ({detail})" if detail and not cond else ""))

    try:
        fl, fi, ov = tmp / "flow", tmp / "file", tmp / "over"
        for p, t in {fl / "index.html": "HOME", fl / "draw/index.html": "DRAW", fl / "404.html": "FLOW404", fl / "src/a.js": "export const a=1",
                     fi / "src/i18n.js": "export const tr=1", fi / "vendor/fonts/x.woff2": "WOFF", fi / "flow/index.html": "OLD",
                     ov / "index.html": "REDIRECT", tmp / "one.html": "ONE", fl / "slow.js": "x"}.items():
            p.parent.mkdir(parents=True, exist_ok=True); p.write_text(t, encoding="utf-8")
        case_blind = (fi / "SRC" / "i18n.js").exists()
        site = Site([("/flowkit/", fl), ("/filekit/", fi), ("/filekit/flow/", ov), ("/filekit/one.html", tmp / "one.html")],
                    gz=True, delays={"/flowkit/slow.js": 300})
        srv = serve(0, site)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{srv.server_address[1]}"

        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *a, **k):
                return None
        op = urllib.request.build_opener(NoRedirect)

        def get(path, enc=False):
            req = urllib.request.Request(base + path, headers={"Accept-Encoding": "gzip"} if enc else {})
            try:
                r = op.open(req, timeout=10)
                return r.status, r.headers, r.read()
            except urllib.error.HTTPError as e:
                return e.code, e.headers, e.read()

        s, h, b = get("/flowkit/"); ck("/flowkit/ ได้หน้าแรก", s == 200 and b == b"HOME" and h["Content-Type"].startswith("text/html"), f"{s} {b[:20]}")
        s, h, _ = get("/flowkit"); ck("/flowkit ไม่มี / ท้าย ได้ 301 ไป /flowkit/", s == 301 and h["Location"] == "/flowkit/", f"{s} {h.get('Location')}")
        s, h, _ = get("/flowkit/draw?kind=org"); ck("โฟลเดอร์ไม่มี / ท้าย 301 เติม / และเก็บ ? ไว้", s == 301 and h["Location"] == "/flowkit/draw/?kind=org", f"{s} {h.get('Location')}")
        s, h, _ = get("/"); ck("/ พาไป /flowkit/", s == 302 and h["Location"] == "/flowkit/", f"{s}")
        s, h, b = get("/filekit/src/i18n.js"); ck("ไฟล์ของ FileKit ได้ชนิด JavaScript", s == 200 and h["Content-Type"].startswith("text/javascript"), f"{s} {h.get('Content-Type')}")
        s, h, _ = get("/filekit/vendor/fonts/x.woff2"); ck("ฟอนต์ได้ชนิด font/woff2", s == 200 and h["Content-Type"] == "font/woff2", f"{h.get('Content-Type')}")
        s, _, _ = get("/filekit/SRC/i18n.js")
        ck("‼️ ตัวพิมพ์ไม่ตรง = 404 เหมือนเว็บจริง" + ("" if case_blind else " (ดิสก์นี้แยกตัวพิมพ์เอง ข้อนี้พิสูจน์ได้น้อยลง)"), s == 404, f"{s}")
        ck("ดิสก์ที่ทดลองไม่สนตัวพิมพ์จริง (ข้อบนจึงพิสูจน์ตัวตรวจ ไม่ใช่ดิสก์)", case_blind)
        s, _, b = get("/filekit/flow/"); ck("--mount ทับที่อยู่ย่อย ที่อยู่ยาวกว่าชนะ", s == 200 and b == b"REDIRECT", f"{s} {b[:20]}")
        s, _, b = get("/filekit/one.html"); ck("--mount ไฟล์เดี่ยว", s == 200 and b == b"ONE", f"{s} {b[:20]}")
        s, _, b = get("/flowkit/nope"); ck("ไม่เจอ = 404 พร้อม 404.html ของเว็บนั้น", s == 404 and b == b"FLOW404", f"{s} {b[:20]}")
        s, _, _ = get("/flowkit/../file/src/i18n.js"); s2, _, _ = get("/flowkit/%2e%2e/file/src/i18n.js")
        ck("หนีออกนอกโฟลเดอร์ด้วย .. ไม่ได้", s == 404 and s2 == 404, f"{s} {s2}")
        s, h, b = get("/flowkit/src/a.js", enc=True)
        ck("--gzip บีบไฟล์ข้อความ แกะแล้วได้ของเดิม", h.get("Content-Encoding") == "gzip" and gzip.decompress(b) == b"export const a=1", f"{h.get('Content-Encoding')}")
        s, h, b = get("/filekit/vendor/fonts/x.woff2", enc=True); ck("ฟอนต์ไม่ถูกบีบซ้ำ", h.get("Content-Encoding") is None and b == b"WOFF")
        t0 = time.time(); get("/flowkit/slow.js"); dt = (time.time() - t0) * 1000
        ck("--delay หน่วงเฉพาะที่อยู่ที่สั่ง", dt >= 290, f"{dt:.0f} ms")
        srv.shutdown()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"\nselftest ผ่าน {ok} ตก {bad}")
    return 0 if bad == 0 else 1


def main():
    if "--selftest" in sys.argv:
        sys.exit(selftest())
    ap = argparse.ArgumentParser()
    ap.add_argument("port", type=int)
    ap.add_argument("--flowkit", default=str(ROOT))
    ap.add_argument("--filekit", default=str(ROOT.parent / "FileKit"))
    ap.add_argument("--mount", action="append", default=[], help="/ที่อยู่/=โฟลเดอร์ หรือ /ที่อยู่/ไฟล์=ไฟล์")
    ap.add_argument("--delay", nargs=2, action="append", default=[], metavar=("PATH", "MS"))
    ap.add_argument("--gzip", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    a = ap.parse_args()
    for d in (a.flowkit, a.filekit):
        if not pathlib.Path(d).is_dir():
            sys.exit(f"❌ ไม่เจอโฟลเดอร์ {d} (FileKit ต้อง clone ไว้ข้าง ๆ FlowKit)")
    mounts = [("/flowkit/", a.flowkit), ("/filekit/", a.filekit)] + [tuple(m.split("=", 1)) for m in a.mount]
    srv = serve(a.port, Site(mounts, a.gzip, {p: int(ms) for p, ms in a.delay}), quiet=not a.verbose)
    print(f"PORT {srv.server_address[1]}", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
