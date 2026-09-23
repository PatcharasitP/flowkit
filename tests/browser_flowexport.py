# FlowKit v3 เฟส 3: ไฟล์ภาพที่เอาไปใช้ต่อได้จริง ผ่านหน้าเว็บจริง
#   ความคมชัด 1 2 3 เท่า (ขนาดไฟล์ 1:2:3 แต่บนจอขนาดเท่าเดิม) , พื้นใส (alpha มุมภาพ = 0) , ปุ่ม PowerPoint (3 เท่า พื้นใส)
#   ค่าที่ตั้งจำข้ามการโหลดหน้า , ภาพบนจอ = ไฟล์ที่ดาวน์โหลดทุกไบต์ (กติกาเดิมของ FlowKit)
# ‼️ ที่มาของตัวเลข: เฟส 0 ข้อ ค พิสูจน์แล้วว่า scale 1 2 3 ของตัวฝังได้ 534 1068 1602 (PROVEN 23/09/2026)
# ใช้: ../.venv/bin/python tests/browser_flowexport.py   (--selftest = ตัวอ่าน alpha ต้องแยกภาพพื้นขาวกับพื้นใสได้)
import sys, io, pathlib, traceback
from playwright.sync_api import sync_playwright
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from browser_flowkit import preview_png, drawio_xml, wait_ready, img_src
from origin import DRAW

SELFTEST = "--selftest" in sys.argv
P, F = 0, []


def ck(name, ok, detail=""):
    global P
    if ok: P += 1
    else: F.append(name + (f"\n      {detail}" if detail else ""))
    print(f"  {'✅' if ok else '❌'} {name}" + ("" if ok or not detail else f"\n      {detail}"))
    return ok


def size(png): return int.from_bytes(png[16:20], "big"), int.from_bytes(png[20:24], "big")


def corner_alpha(png):
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    return max(im.getpixel((x, y))[3] for x, y in ((1, 1), (im.width - 2, 1), (1, im.height - 2), (im.width - 2, im.height - 2)))


def pick(pg, sel):
    """เปิดกล่องหน้าตาผัง กดตัวเลือก แล้วปิด รอผังรอบใหม่"""
    before = img_src(pg)
    # ‼️ ปิดด้วยปุ่ม × ไม่ใช่ Esc: กด Esc ภายในไม่กี่มิลลิวินาทีหลังติ๊ก ตัววาดซ่อนกำลังรับโฟกัสพอดี Esc ไปไม่ถึงหน้าต่าง (จับค่าจริง 23/09/2026)
    pg.click("#openlook"); pg.click(sel); pg.click("#dlg-look .dlg-x")
    wait_ready(pg, before)


def main():
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(DRAW); wait_ready(pg)

        if SELFTEST:
            print("\n━━ selftest ━━")
            white = preview_png(pg)
            ck("ตัวอ่าน alpha เห็นว่าภาพพื้นขาวทึบ (255)", corner_alpha(white) == 255)
            buf = io.BytesIO(); Image.new("RGBA", (40, 40), (0, 0, 0, 0)).save(buf, "PNG")
            ck("ตัวอ่าน alpha เห็นว่าภาพพื้นใสเป็น 0", corner_alpha(buf.getvalue()) == 0)
            ck("ตัวอ่านขนาดอ่านหัว PNG ถูก", size(buf.getvalue()) == (40, 40))
            b.close(); return finish()

        print("\n━━ ความคมชัด 1 2 3 เท่า ━━")
        got = {}
        for s in (1, 2, 3):
            pick(pg, f"[name=scale][value='{s}']")
            png = preview_png(pg)
            shown = pg.evaluate("() => { const r = document.querySelector('#png').getBoundingClientRect(); return [Math.round(r.width), document.querySelector('#png').naturalWidth]; }")
            got[s] = (size(png), shown, bool(drawio_xml(png)))
        w1 = got[1][0][0]
        ck(f"ขนาดไฟล์ 1:2:3 ({got[1][0][0]} , {got[2][0][0]} , {got[3][0][0]})",
           all(abs(got[s][0][0] - w1 * s) <= 2 and abs(got[s][0][1] - got[1][0][1] * s) <= 2 for s in (2, 3)), str(got))
        ck("บนจอแสดงขนาดเท่ากันทุกค่า (srcset ตามความคมชัด)", len({got[s][1][1] for s in got}) == 1, str({s: got[s][1] for s in got}))
        ck("ทุกค่ายังฝังผัง draw.io ไว้ในไฟล์ เปิดแก้ต่อได้", all(got[s][2] for s in got))

        print("\n━━ พื้นใส ━━")
        pick(pg, "#look-clear")
        png = preview_png(pg)
        ck("ติ๊กพื้นใสแล้ว มุมภาพโปร่งใส (alpha 0)", corner_alpha(png) == 0, str(corner_alpha(png)))
        ck("ยังเป็นความคมชัดที่เลือกไว้ (3 เท่า)", abs(size(png)[0] - w1 * 3) <= 2, str(size(png)))
        with pg.expect_download() as d:
            pg.click("#dl")
        ck("ไฟล์ที่ดาวน์โหลด = ภาพบนจอทุกไบต์", pathlib.Path(d.value.path()).read_bytes() == png)
        pg.reload(); wait_ready(pg)
        ck("โหลดหน้าใหม่ ค่าที่ตั้งยังอยู่ (3 เท่า พื้นใส)", corner_alpha(preview_png(pg)) == 0 and abs(size(preview_png(pg))[0] - w1 * 3) <= 2)
        pick(pg, "#look-clear"); pick(pg, "[name=scale][value='2']")
        ck("กลับค่าตั้งต้น (2 เท่า พื้นขาว) แล้วไม่เหลือค่าค้างในเครื่อง", pg.evaluate("() => localStorage.getItem('fk-export')") is None
           and corner_alpha(preview_png(pg)) == 255)

        print("\n━━ ปุ่ม PowerPoint ━━")
        two = preview_png(pg)
        with pg.expect_download() as d:
            pg.click("#dlppt")
        ppt = pathlib.Path(d.value.path()).read_bytes()
        ck("ได้ภาพ 3 เท่า (กว้าง 1.5 เท่าของภาพบนจอ 2 เท่า)", abs(size(ppt)[0] - size(two)[0] * 1.5) <= 2, f"{size(ppt)} {size(two)}")
        ck("พื้นใส และยังฝังผังไว้", corner_alpha(ppt) == 0 and bool(drawio_xml(ppt)))
        ck("ชื่อไฟล์บอกว่าเป็นของ PowerPoint", d.value.suggested_filename.endswith("-PowerPoint.drawio.png"), d.value.suggested_filename)
        ck("ภาพบนจอไม่เปลี่ยนหลังกด (ยังเป็นค่าที่ตั้งไว้)", preview_png(pg) == two)
        ck("ไม่มี error บนหน้า", not errs, str(errs[:2]))
        b.close()
    return finish()


def finish():
    print("\n" + "━" * 62)
    print(f"ผ่าน {P} ข้อ, ตก {len(F)} ข้อ")
    if F:
        for i, x in enumerate(F, 1): print(f"  {i}. {x}")
        return 1
    print("✅ ตัวตรวจจับของผิดได้" if SELFTEST else "✅ ส่งออกได้ครบทุกแบบ")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        traceback.print_exc()
        sys.exit(1)
