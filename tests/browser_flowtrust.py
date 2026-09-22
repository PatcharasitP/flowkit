# ตัวเลขทุกตัวที่หน้าแรก FlowKit อ้าง ต้องตรงกับของจริงเสมอ ไม่ใช่จริงแค่วันที่เขียน (แผนเว็บ FlowKit แยก ข้อ 8.2)
#
# ‼️ วินัยเดียวกับ FileKit/tests/browser_trust.py (ศึกษาจาก kob-ui.com 20/09/2026): ทุกคำอ้างมีตัวเลขที่วัดจริงกำกับ
#    แต่ตัวเลขบนหน้าเว็บผิดได้เงียบ ๆ เพิ่มเทสชุดที่ 16 แล้วลืมแก้เลข 15 = โกหกผู้ใช้โดยไม่มีใครรู้
# ตรวจ ① 5 ชนิดผัง = ปุ่มชนิดในหน้าวาด ② 15 จุดเริ่ม = การ์ดที่เห็น ③ N ชุดทดสอบ = ไฟล์เทสที่มีจริง
#      ④ 64 เครื่องมือในประตู = เครื่องมือบนหน้าแรก FileKit ⑤ ทุกการ์ดตรวจเองได้มีเทสรองรับจริง ⑥ คำแปลครบ
# --selftest เพิ่มของจริงทีละหนึ่ง (แกล้งให้ไม่ตรงกับที่พิมพ์ไว้) ตัวตรวจตัวเลขต้องแดงทุกตัว
import sys, os, re, pathlib, traceback
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from origin import FLOWKIT, DRAW, FILEKIT

HOME = FLOWKIT + "/"
TESTS = pathlib.Path(__file__).resolve().parent
SELFTEST = "--selftest" in sys.argv
BUMP = 1 if SELFTEST else 0
MUST_FAIL = {"① ชนิดผังที่อ้าง = ปุ่มชนิดในหน้าวาด", "② จุดเริ่มที่อ้าง = การ์ดที่เห็น", "③ ชุดทดสอบที่อ้าง = ไฟล์เทสที่มีจริง", "④ เครื่องมือ FileKit ที่อ้าง = บนหน้าแรก FileKit"}
P, F = 0, []

# การ์ดตรวจเองได้ทุกใบต้องมีเทสที่ตรวจเรื่องนั้นจริง (ไฟล์ , ข้อความที่ต้องมีในไฟล์)
BACKED = {
    "ข้อความไม่เคยถูกส่งออก": ("browser_flowkit.py", "ข้อความที่พิมพ์ไม่อยู่ในคำขอใดเลย"),
    "ไฟล์เดียววางสไลด์ได้ เปิดแก้ได้": ("browser_flowkit.py", "def drawio_xml"),
    "flow ของ Power Automate ไม่รั่ว": ("browser_flowpa.py", "ของลับ"),
    "โค้ดเปิดให้ตรวจ": ("browser_flowtrust.py", "③ ชุดทดสอบที่อ้าง"),
}


def ck(name, ok, detail=""):
    global P
    if ok: P += 1
    else: F.append(name)
    print(f"  {'✅' if ok else '❌'} {name}" + (f"  ({detail})" if detail else ""))


def main():
    real_tests = len(list(TESTS.glob("browser_*.py"))) + len(list(TESTS.glob("*.test.mjs")))
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1440, "height": 900}); pg = ctx.new_page()
        pg.goto(HOME); pg.wait_for_selector("#tools a.pill")
        facts = pg.inner_text(".facts").replace("\n", " ")
        trust = pg.inner_text(".trust").replace("\n", " ")
        door = pg.evaluate("() => document.querySelector('a.door').textContent")
        cards = pg.evaluate("() => document.querySelectorAll('#tools a.pill').length")
        all_n = pg.evaluate("() => +document.querySelector('#cats .cat[data-kind=\"all\"] b').textContent")
        stage = pg.inner_text("#stageh")
        en_missing = pg.evaluate("""() => [...document.querySelectorAll('.trust b, .trust span, .trust h2, .trust p, .facts span, .door span, .stage-f')]
            .filter((e) => !e.getAttribute('data-en') && /[\\u0E00-\\u0E7F]/.test(e.textContent)).map((e) => e.textContent.trim().slice(0, 28))""")
        pg.goto(DRAW); pg.wait_for_selector("#types .type")
        kinds = pg.evaluate("() => document.querySelectorAll('#types .type').length")
        pg.goto(FILEKIT + "/"); pg.wait_for_selector("#tools .pill", timeout=30000)
        fk_tools = pg.evaluate("() => new Set([...document.querySelectorAll('#tools .pill[data-id]')].map((e) => e.dataset.id)).size")
        b.close()

    print("\n━━ ตัวเลขบนหน้าแรก ตรงของจริง ━━")
    claim = [int(n) for n in re.findall(r"(\d+)\s*ชนิดผัง", facts)]
    ck("① ชนิดผังที่อ้าง = ปุ่มชนิดในหน้าวาด", claim and all(c == kinds + BUMP for c in claim), f"อ้าง {claim} มีจริง {kinds + BUMP}")
    claim = [int(n) for n in re.findall(r"(\d+)\s*จุดเริ่ม", stage)] + [all_n]
    ck("② จุดเริ่มที่อ้าง = การ์ดที่เห็น", len(claim) == 2 and all(c == cards + BUMP for c in claim), f"อ้าง {claim} เห็น {cards + BUMP}")
    claim = [int(n) for n in re.findall(r"(\d+)\s*ชุด", trust)]
    ck("③ ชุดทดสอบที่อ้าง = ไฟล์เทสที่มีจริง", claim and all(c == real_tests + BUMP for c in claim), f"อ้าง {claim} มีจริง {real_tests + BUMP}")
    claim = [int(n) for n in re.findall(r"(\d+)\s*ตัว", door)]
    ck("④ เครื่องมือ FileKit ที่อ้าง = บนหน้าแรก FileKit", claim and all(c == fk_tools + BUMP for c in claim), f"อ้าง {claim} มีจริง {fk_tools + BUMP}")

    print("\n━━ ทุกคำอ้างมีเทสรองรับ ━━")
    for card, (f, needle) in BACKED.items():
        ck(f"⑤ '{card}' มีเทสรองรับใน {f}", card in trust and needle in (TESTS / f).read_text(encoding="utf-8"))
    ck("⑤ '0 ข้อความที่ถูกส่งออก' มีเทสรองรับ (ตัวเดียวกับการ์ดใบแรก)", "0 ข้อความที่ถูกส่งออก" in facts)
    ck("⑥ ตัวเลขกับคำอ้างทุกชิ้นมีคำแปลอังกฤษ", not en_missing, str(en_missing[:3]))

    print("\n" + "━" * 62)
    if SELFTEST:
        missed = MUST_FAIL - set(F)
        print("selftest:", "✅ ตัวตรวจตัวเลขแดงครบทุกตัว" if not missed else f"❌ ตัวตรวจไม่แดง {missed}")
        return 0 if not missed else 1
    print(f"ผ่าน {P} ข้อ, ตก {len(F)} ข้อ")
    return 0 if not F else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        traceback.print_exc()
        sys.exit(1)
