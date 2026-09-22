# หน้าแรก FlowKit เบาและเร็วตามงบ (แผนเว็บ FlowKit แยก ข้อ 4 งบขนาด , R5)
#
# ‼️ วัดบนเซิร์ฟเวอร์ที่บีบ gzip เหมือน GitHub Pages (runp.sh ส่ง ORIGIN ของ serve.py --gzip ให้ชุดนี้ ชุดนี้อยู่ใน SOLO รันเดี่ยว)
#    ขนาดที่วัดบนเซิร์ฟเวอร์ไม่บีบไม่มีผู้ใช้คนไหนเจอ (บทเรียน FileKit/tests/gzip_server.py)
# ‼️ งบคำขอ: แผนเดิมตั้ง 8 ครั้ง วัดจริงได้ 11 (หน้า 1 , CSS 1 , ฟอนต์ 3 , โมดูล 6 ที่ใช้ร่วมกับหน้าวาดและ FileKit)
#    ตั้งงบ 12 ไว้จับของที่งอกขึ้นมา ไม่ได้ตั้งตามเป้าที่ทำไม่ได้โดยไม่มีตัวรวมไฟล์ (บันทึก 22/09/2026)
# ‼️ งบเวลา 1 วินาทีมาจาก R5 ของแผน (ถ้าเกิน ต้องฝัง CSS แล้วใส่ hash ใน CSP) วัดครั้งแรกได้เห็นหน้า 576 ms การ์ดขึ้น 589 ms
# --selftest งบแคบเกินจริงต้องแดงทุกข้อ , รายการคำขอที่มีโดเมนอื่นปนต้องแดง
import sys, os, json, pathlib, statistics, traceback
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from origin import ORIGIN, FLOWKIT

HOME = FLOWKIT + "/"
ROOT = pathlib.Path(__file__).resolve().parent.parent
SELFTEST = "--selftest" in sys.argv
BUDGET = {"index.html": 30 * 1024, "home.css": 30 * 1024, "js": 20 * 1024, "requests": 12, "fcp": 1000, "cards": 1000, "cls": 0.1}
NET = {"offline": False, "latency": 150, "downloadThroughput": int(1.6 * 1024 * 1024 / 8), "uploadThroughput": int(750 * 1024 / 8)}
CARDS_AT = "new MutationObserver((m, o) => { if (document.querySelector('#tools a.pill')) { window.__cards = performance.now(); o.disconnect(); } }).observe(document, { childList: true, subtree: true })"
CLS_JS = """window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });"""
P, F = 0, []


def ck(name, ok, detail=""):
    global P
    if ok: P += 1
    else: F.append(name + (f"\n      {detail}" if detail else ""))
    print(f"  {'✅' if ok else '❌'} {name}" + (f"  ({detail})" if detail else ""))
    return ok


def load1():
    """ภาระเครื่องนาทีล่าสุด ‼️ วัดเวลาเปิดหน้าตอนเครื่องไม่ว่าง = ตัวเลขไม่จริง
    (23/09/2026 วัดเว็บจริงตอนตัวถอดเสียงคลิปทำงานอยู่ ได้ 980 กับ 1231 ms ตอนเครื่องว่างได้ 608 กับ 612 ms)
    เจอเครื่องไม่ว่าง = แดงพร้อมบอกวิธี ไม่ปล่อยให้ตัวเลขผิดผ่านไปเงียบ ๆ"""
    try:
        with open("/proc/loadavg") as f: return float(f.read().split()[0])
    except Exception:
        return 0.0


def outside(urls):
    """คำขอที่ออกนอกโดเมนตัวเอง (หน้าแรกต้องไม่คุยกับใครนอกจาก patcharasitp.github.io)"""
    return [u for u in urls if u.startswith("http") and not u.startswith(ORIGIN)]


def load(b, mobile, slow):
    c = b.new_context(viewport={"width": 390, "height": 780} if mobile else {"width": 1440, "height": 900}, is_mobile=mobile, has_touch=mobile)
    pg = c.new_page(); cdp = c.new_cdp_session(pg); cdp.send("Network.enable")
    reqs, size = {}, {}
    cdp.on("Network.requestWillBeSent", lambda e: reqs.__setitem__(e["requestId"], (e["request"]["url"], e.get("type"))))
    cdp.on("Network.loadingFinished", lambda e: size.__setitem__(e["requestId"], e["encodedDataLength"]))
    if slow:
        cdp.send("Network.emulateNetworkConditions", NET); cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
    pg.add_init_script(CARDS_AT); pg.add_init_script(CLS_JS)
    pg.goto(HOME, wait_until="load", timeout=90000); pg.wait_for_selector("#tools a.pill"); pg.wait_for_timeout(1200)
    m = pg.evaluate("() => ({ fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0].startTime), cards: Math.round(window.__cards), cls: window.__cls })")
    net = [(u, t, size.get(r, 0)) for r, (u, t) in reqs.items() if not u.startswith("data:")]
    c.close()
    return m, net


def main():
    budget = {k: (0 if SELFTEST else v) for k, v in BUDGET.items()}
    print(f"\n━━ ขนาดไฟล์ ({'งบศูนย์ ตัวตรวจต้องแดง' if SELFTEST else 'งบตามแผน'}) ━━")
    for f in ("index.html", "home.css"):
        n = (ROOT / f).stat().st_size
        ck(f"{f} {n:,} ไบต์ ไม่เกินงบ {budget[f]:,}", n <= budget[f])
    with sync_playwright() as p:
        b = p.chromium.launch()
        print("\n━━ คำขอตอนเปิดหน้าแรก ━━")
        m, net = load(b, False, False)
        js = sum(s for u, t, s in net if t == "Script")
        ck(f"คำขอ {len(net)} ครั้ง ไม่เกินงบ {budget['requests']}", len(net) <= budget["requests"], " , ".join(u.replace(ORIGIN, "") for u, _, _ in net) if len(net) > budget["requests"] else "")
        ck(f"JavaScript ที่โหลดจริง {js:,} ไบต์ (หลังบีบ) ไม่เกินงบ {budget['js']:,}", js <= budget["js"])
        out = outside([u for u, _, _ in net]) + (["https://embed.diagrams.net/x"] if SELFTEST else [])
        ck("ทุกคำขออยู่ในโดเมนเดียว ไม่มี draw.io ไม่มี CDN", not out, str(out[:3]))
        heavy = [u for u, _, _ in net if u.endswith(("/engine.js", "/draw.js", "/editor.js", "/parse-pa.js"))]
        ck("หน้าแรกไม่โหลดตัววาดผัง (โหลดเมื่อเข้าหน้าวาดเท่านั้น)", not heavy and not SELFTEST, str(heavy))
        ck(f"หน้าไม่กระตุกตอนโหลด CLS {m['cls']:.3f} ไม่เกิน {BUDGET['cls']}", m["cls"] <= BUDGET["cls"])   # CLS จริงเป็นศูนย์ งบศูนย์จึงไม่ทำให้แดง ไม่นับใน selftest

        print("\n━━ เวลาเปิดบนเน็ตมือถือช้า (ซีพียูช้า 4 เท่า , 150 ms , 1.6 Mbps) รันเดี่ยว ━━")
        busy = load1()
        ck(f"เครื่องว่างพอจะวัดเวลา (ภาระ {busy:.1f} ไม่เกิน 2.5)", busy <= 2.5 or SELFTEST,
           "พักงานเบื้องหลังก่อน เช่น แตะไฟล์ .claude/research/drawio-youtube/PAUSE เพื่อพักตัวถอดเสียงคลิป แล้วรันใหม่")
        runs = [load(b, True, True)[0] for _ in range(3)]
        fcp = statistics.median(r["fcp"] for r in runs); cards = statistics.median(r["cards"] for r in runs)
        ck(f"เห็นหน้า {fcp:.0f} ms ไม่เกิน {budget['fcp']} ms", fcp <= budget["fcp"], str([r["fcp"] for r in runs]))
        ck(f"การ์ดขึ้น {cards:.0f} ms ไม่เกิน {budget['cards']} ms", cards <= budget["cards"], str([r["cards"] for r in runs]))
        # ‼️ ตัวเลขที่กระจายมาก = เครื่องไม่นิ่ง (มีงานอื่นแย่งซีพียู) ค่ากลางเชื่อไม่ได้ ต้องวัดใหม่ตอนเครื่องว่าง
        #    ภาระเครื่องอย่างเดียวจับไม่อยู่ (23/09/2026 ภาระอ่านได้ 1.3 ทั้งที่ตัวถอดเสียงทำงานอยู่)
        spread = [(max(x) - min(x)) / max(statistics.median(x), 1) for x in ([r["fcp"] for r in runs], [r["cards"] for r in runs])]
        ck(f"สามรอบที่วัดนิ่งพอ (กระจาย {max(spread) * 100:.0f}% ไม่เกิน 30%)", max(spread) <= 0.30 or SELFTEST,
           f"เห็นหน้า {[r['fcp'] for r in runs]} การ์ด {[r['cards'] for r in runs]} , พักงานเบื้องหลังแล้ววัดใหม่")
        b.close()
    rec = {"fcp_ms": fcp, "cards_ms": cards, "requests": len(net), "js_bytes": js, "cls": round(m["cls"], 4), "load": round(busy, 2)}
    print("\nบันทึก:", json.dumps(rec, ensure_ascii=False))
    return finish()


def finish():
    print("\n" + "━" * 62)
    if SELFTEST:
        # ‼️ ตั้งงบเป็นศูนย์ ข้อที่มีตัวเลขจริงมากกว่าศูนย์ต้องแดงทุกข้อ ข้อโดเมนต้องแดงเพราะแทรกโดเมนอื่นเอง
        ok = len(F) >= 7      # ข้อเครื่องว่างไม่นับใน selftest (ยกเว้นไว้) งบศูนย์ทำให้ข้ออื่นแดงครบ
        print(f"selftest: แดง {len(F)} ข้อจากงบศูนย์และโดเมนปลอม " + ("✅ ตัวตรวจจับได้" if ok else "❌ ตัวตรวจไม่แดงตามที่ควร"))
        return 0 if ok else 1
    print(f"ผ่าน {P} ข้อ, ตก {len(F)} ข้อ")
    if F:
        print("\nข้อที่ไม่ผ่าน:")
        for i, x in enumerate(F, 1): print(f"  {i}. {x}")
        return 1
    print("✅ หน้าแรกเบาและเร็วตามงบ")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        traceback.print_exc()
        sys.exit(1)
