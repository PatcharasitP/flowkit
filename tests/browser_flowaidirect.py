# FlowKit ฝัง AI เฟส 2: กล่อง "ให้ AI ช่วยร่าง" ปุ่มร่างผังเลยด้วย key ของคนใช้ (แผน .claude/plans/2026-10-24-flowkit-ai-direct.md)
#
# ดักคำขอที่ไป api.anthropic.com แล้วตอบเองทุกครั้ง ไม่ยิงของจริง ไม่เสียเงิน
# ‼️ ก่อนกดปุ่มร่าง ต้องไม่มีคำขอไป Anthropic เลย (คำสัญญาข้อความไม่ออกจากเครื่องถ้าคุณไม่สั่ง)
# ‼️ กดแล้วคำเล่าไปที่ Anthropic ที่เดียว ไม่ติดไปในคำขออื่น (เช่น draw.io)
# ‼️ key ไม่ลง localStorage จนกว่าจะติ๊กจำ เอาติ๊กออกแล้วต้องหายจริง
# ‼️ ต้องต่อเน็ตได้ (draw.io วาดผัง)
#
# --selftest ให้ตัวดักตอบผิด (ซ่อมแล้วยังพัง , 401 กลายเป็น 200) ข้อที่เกี่ยวต้องแดง

import sys, os, json, pathlib, traceback
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from browser_flowkit import drawn
from origin import DRAW

SELFTEST = "--selftest" in sys.argv
KEY = "sk-ant-api03-flowkit-test-not-real"
DESC = "เบิกเงินสดย่อยผ่านหัวหน้าทดสอบแล้วไปบัญชีทดสอบ"
GOOD = "ชื่อ: เบิกเงินสด\nยื่นใบเบิก\nหัวหน้าอนุมัติ?\n  อนุมัติ: บัญชีจ่ายเงิน\n  ไม่อนุมัติ: จบ\nแจ้งผล"
BAD = "ยื่นใบเบิก\n    ย่อหน้าลึกผิดที่"
CORS = {"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS"}
P, F = 0, []


def ck(name, ok, detail=""):
    global P
    if ok: P += 1
    else: F.append(name + (f"\n      {detail}" if detail else ""))
    print(f"  {'✅' if ok else '❌'} {name}" + ("" if ok or not detail else f"\n      {detail}"))
    return ok


def model_boxes(pg, text, kind="steps"):
    return pg.evaluate("""async ([t, k]) => { const { parseText } = await import('../src/parse.js'); const r = parseText(t, k);
        return r.model ? r.model.nodes.map((n) => n.text) : null; }""", [text, kind])


class Fake:
    """ตัวตอบแทน Anthropic: queue ของ (status, ข้อความ) ตอบตามลำดับ ตัวสุดท้ายตอบซ้ำ , hold=True ค้างไว้ไม่ตอบ"""
    def __init__(self):
        self.queue, self.calls, self.hold, self.held = [(200, GOOD)], [], False, []

    def __call__(self, route):
        rq = route.request
        if rq.method == "OPTIONS":
            return route.fulfill(status=204, headers=CORS)
        self.calls.append({"headers": rq.headers, "body": json.loads(rq.post_data or "{}")})
        if self.hold:
            self.held.append(route); return
        st, text = self.queue[min(len(self.calls) - 1, len(self.queue) - 1)]
        body = ({"content": [{"type": "text", "text": text}], "stop_reason": "end_turn", "usage": {"input_tokens": 1500, "output_tokens": 90}}
                if st == 200 else {"type": "error", "error": {"type": "authentication_error", "message": text}})
        route.fulfill(status=st, headers={**CORS, "content-type": "application/json"}, body=json.dumps(body))


def open_ai(pg):
    pg.click("#openai"); pg.wait_for_function("() => document.querySelector('#dlg-ai').open")


def main():
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport={"width": 1440, "height": 900})
        pg = ctx.new_page()
        errs, reqs = [], []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        ctx.on("request", lambda r: reqs.append(r))
        fake = Fake()
        pg.route("https://api.anthropic.com/**", fake)
        pg.goto(DRAW)
        pg.wait_for_function("() => document.querySelector('#canvas').dataset.state === 'ready'", timeout=60000)

        print("\n━━ ก. ก่อนกดร่าง ━━")
        open_ai(pg)
        ck("ช่อง key ซ่อนตัวอักษร ไม่ติ๊กจำ ค่าเริ่มต้นคือ อัตโนมัติ",
           pg.get_attribute("#ai-key", "type") == "password" and not pg.is_checked("#ai-remember") and pg.is_checked("input[name=ai-model][value=auto]"))
        pg.fill("#ai-desc", DESC)
        pg.wait_for_timeout(400)
        ck("พิมพ์คำเล่าแล้วยังไม่มีคำขอไป Anthropic", not [r for r in reqs if "anthropic.com" in r.url])
        pg.click("#ai-go"); pg.wait_for_timeout(300)
        ck("ไม่มี key กดร่าง: บอกให้ใส่ key ไม่ยิง และพาไปช่อง key",
           "ใส่ API key" in pg.inner_text("#ai-status") and not fake.calls and pg.evaluate("() => document.activeElement.id") == "ai-key",
           pg.inner_text("#ai-status"))

        print("\n━━ ข. ร่างสำเร็จ ━━")
        before = pg.input_value("#src")
        pg.fill("#ai-key", KEY)
        fake.queue = [(200, BAD), (200, BAD)] if SELFTEST else [(200, GOOD)]
        pg.click("#ai-go")
        pg.wait_for_function("() => !document.querySelector('#dlg-ai').open", timeout=15000)
        c = fake.calls[0] if fake.calls else {"headers": {}, "body": {}}
        ck("ยิงครั้งเดียว ส่ง key ที่ใส่ อัตโนมัติกับผังขั้นตอนได้ Opus 5.5 ขอเป็นโครงข้อมูล และคำเล่าอยู่ในคำสั่ง",
           len(fake.calls) == 1 and c["headers"].get("x-api-key") == KEY and c["body"].get("model") == "claude-opus-5-5"
           and "output_config" in c["body"] and DESC in c["body"]["messages"][0]["content"], f"{len(fake.calls)} ครั้ง {c['body'].get('model')}")
        ck("ข้อความผังลงช่องพิมพ์", pg.input_value("#src") == GOOD, pg.input_value("#src")[:60])
        want = model_boxes(pg, GOOD)
        got = drawn(pg, want, 45000)
        ck(f"ได้ผังที่วาดเสร็จ กล่องครบ {len(want)} กล่อง", got == sorted(want), str(got))
        ck("key ไม่ลง localStorage เมื่อไม่ได้ติ๊กจำ", pg.evaluate("() => localStorage.getItem('flowkit.aiKey')") is None)
        leaks = [r.url for r in reqs if "anthropic.com" not in r.url and (DESC in (r.post_data or "") or DESC in r.url)]
        ck(f"คำเล่าไม่ติดไปคำขออื่นนอกจาก Anthropic (ตรวจ {len(reqs)} คำขอ)", not leaks, str(leaks[:3]))
        open_ai(pg)
        ck("เปิดกล่องอีกครั้งเห็นรุ่นกับราคาร่างล่าสุด", "ร่างล่าสุด (Opus) ใช้ไปราว" in pg.inner_text("#ai-status"), pg.inner_text("#ai-status"))
        pg.keyboard.press("Escape")
        pg.focus("#src"); pg.keyboard.press("Control+z"); pg.wait_for_timeout(300)
        ck("กด Ctrl+Z ได้ข้อความก่อนให้ AI ร่างคืน", pg.input_value("#src") == before, pg.input_value("#src")[:40])

        print("\n━━ ค. ซ่อมคำตอบที่อ่านไม่ผ่าน ━━")
        fake.calls.clear(); fake.queue = [(200, BAD), (200, BAD)] if SELFTEST else [(200, BAD), (200, GOOD)]
        open_ai(pg); pg.click("#ai-go")
        pg.wait_for_function("() => !document.querySelector('#dlg-ai').open", timeout=15000)
        ck("อ่านไม่ผ่านรอบแรก ส่งกลับให้แก้ แล้วได้ผังที่อ่านผ่าน", len(fake.calls) == 2 and pg.input_value("#src") == GOOD, f"{len(fake.calls)} ครั้ง")

        print("\n━━ ง. Opus , จำ key ━━")
        fake.calls.clear(); fake.queue = [(200, GOOD)]
        open_ai(pg)
        pg.check("input[name=ai-model][value=opus]")
        pg.check("#ai-remember")
        ck("ติ๊กจำแล้ว key ลง localStorage", pg.evaluate("() => localStorage.getItem('flowkit.aiKey')") == KEY)
        pg.click("#ai-go")
        pg.wait_for_function("() => !document.querySelector('#dlg-ai').open", timeout=15000)
        ck("เลือก Opus แล้วยิงรุ่น claude-opus-5-5", fake.calls and fake.calls[0]["body"].get("model") == "claude-opus-5-5")
        pg.reload(); pg.wait_for_function("() => document.querySelector('#canvas').dataset.state", timeout=60000)
        open_ai(pg)
        ck("โหลดหน้าใหม่ key กับรุ่นยังอยู่", pg.input_value("#ai-key") == KEY and pg.is_checked("#ai-remember") and pg.is_checked("input[name=ai-model][value=opus]"))
        pg.uncheck("#ai-remember")
        ck("เอาติ๊กจำออก key หายจาก localStorage ทันที", pg.evaluate("() => localStorage.getItem('flowkit.aiKey')") is None)

        print("\n━━ จ. error กับยกเลิก ━━")
        src0 = pg.input_value("#src")
        pg.fill("#ai-desc", DESC)                    # คำเล่าไม่จำข้ามการโหลดหน้า (ตั้งใจ อาจเป็นเรื่องลับ)
        fake.calls.clear(); fake.queue = [(200, GOOD)] if SELFTEST else [(401, "invalid x-api-key")]
        pg.click("#ai-go"); pg.wait_for_timeout(1500)
        ck("key ถูกปฏิเสธ: บอกเป็นคำไทย สีเตือน กล่องยังเปิด ช่องพิมพ์ไม่เปลี่ยน",
           "key ใช้ไม่ได้" in pg.inner_text("#ai-status") and pg.get_attribute("#ai-status", "data-tone") == "bad"
           and pg.evaluate("() => document.querySelector('#dlg-ai').open") and pg.input_value("#src") == src0, pg.inner_text("#ai-status"))
        fake.calls.clear(); fake.hold = True
        if not pg.evaluate("() => document.querySelector('#dlg-ai').open"): open_ai(pg); pg.fill("#ai-desc", DESC)   # selftest: 200 ปิดกล่องไปแล้ว
        pg.click("#ai-go"); pg.wait_for_timeout(500)
        busy = pg.is_disabled("#ai-go") and pg.is_visible("#ai-stop")
        pg.click("#ai-stop"); pg.wait_for_timeout(500)
        ck("ระหว่างรอ ปุ่มร่างกดซ้ำไม่ได้ มีปุ่มยกเลิก กดแล้วบอกยกเลิก ปุ่มกลับมากดได้",
           busy and "ยกเลิกแล้ว" in pg.inner_text("#ai-status") and pg.is_enabled("#ai-go") and not pg.is_visible("#ai-stop"), pg.inner_text("#ai-status"))
        fake.hold = False
        for r in fake.held:
            try: r.abort()
            except Exception: pass

        print("\n━━ ฉ. แก้ผังในช่องพิมพ์ (เฟส 3) ━━")
        GOOD2 = GOOD + "\nเก็บเอกสาร"
        cur = pg.input_value("#src")
        fake.calls.clear(); fake.queue = [(200, GOOD2)]
        pg.check("input[name=ai-model][value=haiku]")
        pg.fill("#ai-desc", "เพิ่มขั้นเก็บเอกสารท้ายสุด")
        pg.click("#ai-edit")
        pg.wait_for_function("() => !document.querySelector('#dlg-ai').open", timeout=15000)
        sent = fake.calls[0]["body"]["messages"][0]["content"] if fake.calls else ""
        ck("กดแก้ผัง: ส่งผังในช่องพิมพ์ทั้งผังกับสิ่งที่อยากแก้ แล้วได้ผังใหม่ลงช่องพิมพ์",
           bool(cur.strip()) and cur.strip() in sent and "เพิ่มขั้นเก็บเอกสารท้ายสุด" in sent and pg.input_value("#src") == (GOOD if SELFTEST else GOOD2),
           f"ส่งผังเดิม {cur.strip()[:20] in sent} ได้ {pg.input_value('#src')[-20:]}")
        pg.focus("#src"); pg.keyboard.press("Control+a"); pg.keyboard.press("Delete"); pg.wait_for_timeout(300)
        fake.calls.clear()
        open_ai(pg); pg.click("#ai-edit"); pg.wait_for_timeout(400)
        ck("ช่องพิมพ์ว่างแล้วกดแก้ผัง: บอกให้ใช้ร่างผังเลย ไม่ยิง", "ยังไม่มีผังให้แก้" in pg.inner_text("#ai-status") and not fake.calls, pg.inner_text("#ai-status"))
        ck("ไม่มี error บนหน้า", not errs, str(errs[:3]))
        b.close()
    return finish()


def finish():
    print("\n" + "━" * 62)
    print(f"ผ่าน {P} ข้อ, ตก {len(F)} ข้อ")
    if SELFTEST:
        need = {"ยิงครั้งเดียว", "ข้อความผังลงช่องพิมพ์", "ได้ผังที่วาดเสร็จ", "อ่านไม่ผ่านรอบแรก", "key ถูกปฏิเสธ", "กดแก้ผัง"}
        hit = {n for n in need if any(x.startswith(n) for x in F)}
        ok = hit == need
        print(f"✅ selftest: แดงครบ {len(need)} ข้อที่ป้อนของเสีย" if ok else f"❌ selftest: ไม่แดง {sorted(need - hit)} ตัวตรวจตาบอด")
        return 0 if ok else 1
    if F:
        print("\nข้อที่ไม่ผ่าน:")
        for i, x in enumerate(F, 1): print(f"  {i}. {x}")
        return 1
    print("✅ ร่างผังด้วย key ของคนใช้ทำงานครบ ไม่มีอะไรออกก่อนกด")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        traceback.print_exc()
        sys.exit(1)
