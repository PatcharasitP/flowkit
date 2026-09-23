# หน้าแรก FlowKit: การ์ดทุกใบใน catalog.jsพาไปหน้าวาดที่ถูกต้องจริงไหม ค้นหา กรองหมวด การเข้าถึง มือถือ ธีมมืด (แผนเว็บ FlowKit แยก ข้อ 8.2)
#
# ‼️ ทุกข้อถามของที่ผู้ใช้ได้จริง: กดการ์ดแล้วหน้าวาดเปิดชนิดนั้น ใส่เทมเพลตนั้น ผังขึ้นจริง ไม่ใช่แค่ลิงก์มีอยู่
# ‼️ R4 ของแผน: การ์ดเทมเพลตใช้ครั้งเดียว กด F5 แล้วร่างที่แก้ต้องไม่ถูกเทมเพลตทับ
#    และถ้ามีผังที่แก้ด้วยมือค้างอยู่ ต้องเปิดหน้าต่างเทมเพลตพร้อมคำเตือนแทนการทับเงียบ ๆ
# --selftest ทำของผิดทีละข้อบนหน้าจริง (ลบการ์ด , h1 ซ้ำ , ไทยหลงในโหมดอังกฤษ , เลื่อนข้าง , สีตัวหนังสือกลืนพื้น) ตัวตรวจต้องแดง
import sys, os, re, json, traceback
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from origin import ORIGIN, FLOWKIT, DRAW, FILEKIT   # ที่อยู่สองเว็บ ORIGIN=serve.py หรือเว็บจริง

HOME = FLOWKIT + "/"
SELFTEST = "--selftest" in sys.argv
P, F = 0, []


def ck(name, ok, detail=""):
    global P
    if ok: P += 1
    else: F.append(name + (f"\n      {detail}" if detail else ""))
    print(f"  {'✅' if ok else '❌'} {name}" + ("" if ok or not detail else f"\n      {detail}"))
    return ok


def home_ready(pg):
    pg.wait_for_selector("#tools a.pill", timeout=30000)


def draw_ready(pg, ms=60000):
    pg.wait_for_function("""() => { const c = document.querySelector('#canvas'), i = document.querySelector('#png');
        return c && c.dataset.state === 'ready' && !i.hidden && i.naturalWidth > 0; }""", timeout=ms)


CATALOG_JS = "async () => (await import('/flowkit/src/catalog.js')).CATALOG.map((c) => ({ id: c.id, href: c.href, kind: c.kind, th: c.th }))"
TEMPLATES_JS = "async () => (await import('/flowkit/src/templates.js')).TEMPLATES.map((t) => ({ id: t.id, kind: t.kind, th: t.text.th }))"

# ── ตัวตรวจ (อ่านสภาพหน้า คืนค่าที่เทียบได้) ใช้ทั้งรอบจริงและ --selftest ──
H1S = "() => document.querySelectorAll('h1').length"
NAMELESS = """() => [...document.querySelectorAll('a[href], button')].filter((e) => e.offsetParent !== null)
  .filter((e) => !((e.getAttribute('aria-label') || e.textContent || '').trim())).map((e) => e.outerHTML.slice(0, 60))"""
THAI_IN_EN = """() => { const out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) { const p = n.parentElement;
    if (!/[\\u0E00-\\u0E7F]/.test(n.textContent) || !p || p.closest('[lang="th"]') || p.closest('script,style')) continue;
    if (p.offsetParent === null && getComputedStyle(p).position !== 'fixed') continue;
    out.push(n.textContent.trim().slice(0, 30)); }
  for (const e of document.querySelectorAll('[aria-label],[placeholder],[title]')) for (const a of ['aria-label', 'placeholder', 'title'])
    if (/[\\u0E00-\\u0E7F]/.test(e.getAttribute(a) || '') && !e.closest('[lang="th"]')) out.push(a + ' ' + e.getAttribute(a).slice(0, 30));
  if (/[\\u0E00-\\u0E7F]/.test(document.title)) out.push('title ' + document.title);
  return out; }"""
OVERFLOW = "() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth"
TWO_COLS = """() => { const p = [...document.querySelectorAll('#tools a.pill')].slice(0, 4).map((e) => e.getBoundingClientRect());
  return p.length >= 2 && Math.abs(p[0].top - p[1].top) < 2 && p[1].left > p[0].right - 1 && (p.length < 3 || p[2].top > p[0].bottom - 1); }"""
CONTRAST = """() => { const parse = (s) => (s.match(/[\\d.]+/g) || []).map(Number);
  /* ‼️ พื้นใส (alpha 0) ต้องไล่หาพื้นจริงจากแม่ขึ้นไป ไม่ใช่อ่านเป็นสีดำ (ตัวตรวจรุ่นแรกพลาดแบบนี้ 22/09/2026) */
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const v = parse(getComputedStyle(e).backgroundColor); if (v.length >= 3 && (v.length < 4 || v[3] > 0.5)) return v.slice(0, 3); } return [255, 255, 255]; };
  const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const pill = document.querySelector('#tools a.pill'), span = pill.querySelector('span'), cat = document.querySelector('.cat[aria-pressed="false"]');
  return { card: ratio(parse(getComputedStyle(span).color).slice(0, 3), bgOf(pill)),
           cat: ratio(parse(getComputedStyle(cat).color).slice(0, 3), bgOf(cat)),
           stageLum: lum(bgOf(document.querySelector('.stage'))) }; }"""


HERO_ANIMS = """() => { const o = document.querySelector('.hero3d');
  const a = document.getAnimations().filter((x) => x.effect?.target?.closest?.('.hero3d') || x.effect?.target?.parentElement?.closest?.('.hero3d'));
  const names = [...new Set(a.map((x) => x.animationName))].sort();
  const durs = [...new Set(a.map((x) => x.effect.getTiming().duration))].sort((m, n) => m - n);
  return { n: a.length, names, durs, spark: !!o.querySelector('.spark animateMotion'), tiles: o.querySelectorAll('.tile').length,
           pipes: o.querySelectorAll('.pipe').length }; }"""
HERO_STILL = """() => { const o = document.querySelector('.hero3d');
  const running = document.getAnimations().filter((x) => x.effect?.target?.closest?.('.hero3d') || x.effect?.target?.parentElement?.closest?.('.hero3d')).length;
  const tiles = [...o.querySelectorAll('.tile')].filter((e) => e.getBoundingClientRect().width > 20).length;
  const sparkHidden = [...o.querySelectorAll('.spark')].every((e) => getComputedStyle(e).display === 'none');
  return { running, tiles, sparkHidden, ok: running === 0 && tiles === 2 && sparkHidden }; }"""
TILT = """() => { const o = document.querySelector('.hero3d'); return [o.style.getPropertyValue('--tx'), o.style.getPropertyValue('--ty'), getComputedStyle(o).transform]; }"""


def focus_ring_missing(pg, n=30):
    """กด Tab ทีละครั้ง ทุกจุดที่โฟกัสได้ต้องเห็นว่าโฟกัสอยู่ตรงไหน
    ‼️ กรอบอาจอยู่ที่ตัวเองหรือกล่องแม่ (ช่องค้นหาใช้ :focus-within ที่กล่อง .search) จึงเทียบหน้าตาตอนโฟกัสกับตอนไม่โฟกัส
       ของตัวเองและแม่ ต้องต่างกัน ถ้าไม่ต่าง = คนใช้คีย์บอร์ดไม่รู้ว่าอยู่ตรงไหน"""
    pg.evaluate("() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); }")
    miss, seen = [], set()
    for _ in range(n):
        pg.keyboard.press("Tab")
        info = pg.evaluate("""() => { const e = document.activeElement; if (!e || e === document.body) return null;
          const look = () => [e, e.parentElement].map((x) => { const s = getComputedStyle(x); return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor].join('|'); }).join('#');
          /* ‼️ ขอบช่องค้นหาเปลี่ยนสีแบบ transition อ่านทันทีหลัง blur ยังเป็นสีเดิม ปิด transition เฉพาะตอนวัด (ตัวตรวจรุ่นแรกแดงหลอก) */
          const els = [e, e.parentElement]; els.forEach((x) => { x.style.transition = 'none'; });
          const on = look(); e.blur(); const off = look(); e.focus(); els.forEach((x) => { x.style.transition = ''; });
          return { key: e.tagName + (e.id ? '#' + e.id : '') + (e.getAttribute('href') || '') + (e.dataset.id || e.dataset.kind || e.dataset.lang || ''), ring: on !== off }; }""")
        if not info or info["key"] in seen: continue
        seen.add(info["key"])
        if not info["ring"]: miss.append(info["key"])
    return miss, len(seen)


def selftest(b):
    print("\n━━ selftest: ตัวตรวจต้องจับของผิดบนหน้าจริงได้ ━━")
    ctx = b.new_context(viewport={"width": 1440, "height": 900}); pg = ctx.new_page(); pg.goto(HOME); home_ready(pg)
    pg.evaluate("() => document.querySelector('#tools a.pill').remove()")
    ck("ลบการ์ดหนึ่งใบ ตัวนับจับได้", pg.evaluate("() => document.querySelectorAll('#tools a.pill').length") == 14)
    pg.evaluate("() => document.body.append(Object.assign(document.createElement('h1'), { textContent: 'ซ้ำ' }))")
    ck("h1 สองตัว จับได้", pg.evaluate(H1S) == 2)
    pg.evaluate("() => document.body.append(Object.assign(document.createElement('a'), { href: '#x' }))")
    pg.evaluate("() => { const a = document.body.lastElementChild; a.style.display = 'inline-block'; a.style.width = '10px'; a.style.height = '10px'; }")
    ck("ลิงก์ไม่มีชื่อ จับได้", len(pg.evaluate(NAMELESS)) >= 1)
    ctx.close()
    ctx = b.new_context(viewport={"width": 1440, "height": 900}); ctx.add_init_script("try{localStorage.setItem('fk-lang','en')}catch(e){}")
    pg = ctx.new_page(); pg.goto(HOME); home_ready(pg)
    pg.evaluate("() => document.querySelector('.stage-h').append(' ไทยหลง')")
    ck("ไทยหลงในโหมดอังกฤษ จับได้", any("ไทยหลง" in x for x in pg.evaluate(THAI_IN_EN)))
    ctx.close()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = ctx.new_page(); pg.goto(HOME); home_ready(pg)
    pg.evaluate("() => { const d = document.createElement('div'); d.className = 'x'; d.textContent = 'x'.repeat(400); document.querySelector('.stage').append(d); }")
    pg.evaluate("() => { const d = document.querySelector('.stage .x'); d.style.whiteSpace = 'nowrap'; d.style.width = 'max-content'; }")
    ck("หน้าเลื่อนข้างบนมือถือ จับได้", pg.evaluate(OVERFLOW) > 0)
    pg.evaluate("() => document.querySelectorAll('#tools a.pill').forEach((e) => e.style.flexBasis = '100%')")
    ck("การ์ดเหลือคอลัมน์เดียว จับได้", not pg.evaluate(TWO_COLS))
    ctx.close()
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, color_scheme="dark"); pg = ctx.new_page(); pg.goto(HOME); home_ready(pg)
    pg.evaluate("() => { const p = document.querySelector('#tools a.pill'); p.style.background = getComputedStyle(p.querySelector('span')).color; }")
    ck("ตัวหนังสือกลืนพื้นการ์ด จับได้", pg.evaluate(CONTRAST)["card"] < 1.5)
    pg.evaluate("""() => document.querySelectorAll('a, button, input, .search, .langsw, #cats, #tools .pills').forEach((e) => { const s = getComputedStyle(e);
      e.style.outline = 'none'; e.style.boxShadow = 'none'; e.style.borderColor = s.borderColor; e.style.backgroundColor = s.backgroundColor; })""")
    miss, n = focus_ring_missing(pg, 8)
    ck("ไม่มีกรอบโฟกัส จับได้", n >= 3 and len(miss) == n, f"{len(miss)}/{n}")
    ctx.close()
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce"); pg = ctx.new_page(); pg.goto(HOME); home_ready(pg)
    pg.evaluate("() => document.querySelector('.hero3d .t2').remove()")
    ck("ภาพหัวเว็บขาดกล่องหนึ่งก้อน จับได้", not pg.evaluate(HERO_STILL)["ok"])
    ctx.close()


def main():
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        if SELFTEST:
            selftest(b); b.close(); return finish()

        # ── ① หน้าแรกขึ้นครบ ไม่มี error ──
        print("\n━━ ① หน้าแรกขึ้นครบ ━━")
        ctx = b.new_context(viewport={"width": 1440, "height": 900})
        ctx.add_init_script("document.addEventListener('securitypolicyviolation', (e) => { (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + e.blockedURI) })")
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto(HOME); home_ready(pg); pg.wait_for_timeout(600)
        cat = pg.evaluate(CATALOG_JS); tpls = pg.evaluate(TEMPLATES_JS)
        ids = pg.evaluate("() => [...document.querySelectorAll('#tools a.pill')].map((e) => e.dataset.id)")
        ck(f"การ์ดครบ {len(cat)} ใบ เรียงตาม catalog.js", len(cat) == 25 and ids == [c["id"] for c in cat], f"{len(ids)} {ids[:4]}")
        hrefs = pg.evaluate("() => [...document.querySelectorAll('#tools a.pill')].map((e) => e.getAttribute('href'))")
        ck("การ์ดเป็นลิงก์ธรรมดาไปหน้าวาดพร้อมพารามิเตอร์", hrefs == [c["href"] for c in cat])
        ck("ไม่มี error และ CSP ไม่ปฏิเสธอะไร", not errs and not pg.evaluate("() => window.__csp || []"), f"{errs[:2]} {pg.evaluate('() => window.__csp || []')[:2]}")
        heads = pg.evaluate("() => [...document.querySelectorAll('#tools .pill-group')].map((e) => e.textContent.trim())")
        ck("สามกลุ่ม เริ่มจากหน้าว่าง เทมเพลต ทางเข้าอื่น", heads == ["เริ่มจากหน้าว่าง", "เทมเพลต", "ทางเข้าอื่น"], str(heads))
        ck("ป้าย ใหม่ อยู่บนการ์ดชนิดใหม่ (ลู่ ตาราง ความคิด) Power Automate กับ AI (ตามวันที่ since)", pg.evaluate("() => [...document.querySelectorAll('#tools a.pill .new')].map((e) => e.closest('a').dataset.id).join(',')") in ("lane,table,mindmap,pa,ai", "lane,table,mindmap", ""),
           pg.evaluate("() => [...document.querySelectorAll('#tools a.pill .new')].map((e) => e.closest('a').dataset.id).join(',')"))

        # ── ② กรองหมวด ตัวเลขตรงของจริง ──
        print("\n━━ ② กรองหมวด ━━")
        cats = pg.evaluate("() => [...document.querySelectorAll('#cats .cat')].map((e) => [e.dataset.kind, +e.querySelector('b').textContent])")
        ck(f"ปุ่มหมวด 10 ปุ่ม ทั้งหมด = {len(cat)}", len(cats) == 10 and cats[0] == ["all", len(cat)], str(cats))
        bad = []
        for kind, n in cats[1:]:
            pg.click(f'#cats .cat[data-kind="{kind}"]')
            shown = pg.evaluate("() => [...document.querySelectorAll('#tools a.pill')].map((e) => e.dataset.kind)")
            head = pg.inner_text("#stageh"); pressed = pg.get_attribute(f'#cats .cat[data-kind="{kind}"]', "aria-pressed")
            if len(shown) != n or any(k != kind for k in shown) or str(n) not in head or pressed != "true": bad.append(f"{kind} ปุ่มบอก {n} เห็น {len(shown)} หัว {head!r}")
        pg.click(f'#cats .cat[data-kind="{cats[-1][0]}"]')          # กดซ้ำ = ยกเลิกกรอง
        ck("ทุกหมวด ตัวเลขบนปุ่มตรงกับการ์ดที่เห็น และกดซ้ำแล้วกลับมาทั้งหมด",
           not bad and pg.evaluate("() => document.querySelectorAll('#tools a.pill').length") == len(cat), " | ".join(bad))

        # ── ③ ค้นหา ──
        print("\n━━ ③ ค้นหา ━━")
        pg.fill("#q", "สัญญา"); pg.wait_for_timeout(300)
        first = pg.evaluate("() => { const a = document.querySelector('#tools a.pill'); return a && [a.dataset.id, (a.querySelector('mark') || {}).textContent]; }")
        n = pg.evaluate("() => document.querySelectorAll('#tools a.pill').length")
        ck("ค้น สัญญา เจอ ต่อสัญญาเช่า เป็นใบแรก และไฮไลต์คำค้น", first == ["tpl-renewal", "สัญญา"], str(first))
        ck("แถวบอกจำนวนที่เจอ ตรงกับการ์ดที่เห็น", str(n) in pg.inner_text("#hits"), pg.inner_text("#hits"))
        pg.fill("#q", "approval"); pg.wait_for_timeout(300)
        ck("ค้นภาษาอังกฤษบนหน้าไทย เจอ อนุมัติตามวงเงิน", pg.evaluate("() => document.querySelector('#tools a.pill')?.dataset.id") == "tpl-approval")
        pg.fill("#q", "zzqqxx"); pg.wait_for_timeout(300)
        ck("ค้นไม่เจอ บอกตรง ๆ พร้อมปุ่มล้าง", pg.is_visible("#tools .empty") and pg.is_visible("#tools .empty .btn-soft"))
        pg.click("#tools .empty .btn-soft"); pg.wait_for_timeout(200)
        ck("กดล้างแล้วการ์ดกลับมาครบ ช่องค้นหาว่างและได้โฟกัส",
           pg.evaluate("() => document.querySelectorAll('#tools a.pill').length") == len(cat) and pg.input_value("#q") == ""
           and pg.evaluate("() => document.activeElement.id") == "q")
        pg.fill("#q", "องค์กร"); pg.wait_for_timeout(300)
        with pg.expect_navigation():
            pg.press("#q", "Enter")
        ck("พิมพ์แล้วกด Enter ไปการ์ดใบแรก (ผังองค์กร)", "/flowkit/draw/" in pg.url, pg.url)
        pg.goto(HOME); home_ready(pg)

        # ── ④ การเข้าถึง ──
        print("\n━━ ④ การเข้าถึง ━━")
        ck("h1 มีตัวเดียว", pg.evaluate(H1S) == 1)
        nl = pg.evaluate(NAMELESS)
        ck("ทุกปุ่มและลิงก์ที่เห็นมีชื่อ", not nl, str(nl[:2]))
        miss, n = focus_ring_missing(pg, 40)
        ck(f"กด Tab ผ่าน {n} จุด ทุกจุดมีกรอบโฟกัสที่เห็น", n >= 20 and not miss, str(miss[:4]))
        ck("ช่องค้นหาผูกกับแถวบอกผล (aria-describedby=hits)", pg.get_attribute("#q", "aria-describedby") == "hits" and pg.get_attribute("#hits", "role") == "status")
        ck("ลิงก์ข้ามไปเนื้อหามีจริงและชี้การ์ด", pg.get_attribute("a.skip", "href") == "#tools")
        ctx.close()

        # ── ⑤ โหมดอังกฤษ ──
        print("\n━━ ⑤ โหมดอังกฤษ ━━")
        ctx = b.new_context(viewport={"width": 1440, "height": 900}); ctx.add_init_script("try{localStorage.setItem('fk-lang','en')}catch(e){}")
        pg = ctx.new_page(); pg.goto(HOME); home_ready(pg); pg.wait_for_timeout(300)
        th = pg.evaluate(THAI_IN_EN)
        ck("โหมดอังกฤษไม่มีคำไทยหลง (ยกเว้นปุ่มเลือกภาษาไทย)", not th, str(th[:4]))
        ck("การ์ดเป็นชื่ออังกฤษ", pg.evaluate("() => document.querySelector('#tools a.pill[data-id=\"tpl-renewal\"] span').textContent") == "Lease renewal")
        ck("html lang=en", pg.evaluate("() => document.documentElement.lang") == "en")
        ctx.close()

        # ── ⑥ มือถือ ──
        print("\n━━ ⑥ มือถือ 390px ━━")
        ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        pg = ctx.new_page(); pg.goto(HOME); home_ready(pg); pg.wait_for_timeout(500)
        ck("ไม่เลื่อนข้าง", pg.evaluate(OVERFLOW) <= 0, f"{pg.evaluate(OVERFLOW)} px")
        ck("การ์ดสองคอลัมน์", pg.evaluate(TWO_COLS))
        ck("ประตูไป FileKit โผล่และชี้ /filekit/", pg.is_visible("a.door") and pg.get_attribute("a.door", "href") == "/filekit/")
        ck("ภาพหัวเว็บกับแถบเว็บในเครือซ่อนบนจอแคบ", not pg.is_visible(".hero-demo") and not pg.is_visible("nav.network"))
        wrap = pg.evaluate("""() => [...document.querySelectorAll('#tools a.pill .w')].filter((w) => w.getClientRects().length > 1).map((w) => w.textContent)""")
        ck("ชื่อการ์ดไม่ขาดกลางวลี (ตัดบรรทัดได้แค่ที่ช่องว่าง)", not wrap, str(wrap))
        ctx.close()

        # ── ⑦ ธีมมืด ──
        print("\n━━ ⑦ ธีมมืด ━━")
        for scheme in ("dark", "light"):
            ctx = b.new_context(viewport={"width": 1440, "height": 900}, color_scheme=scheme); pg = ctx.new_page(); pg.goto(HOME); home_ready(pg)
            c = pg.evaluate(CONTRAST)
            # ‼️ บอร์ดการ์ดวาดพื้นด้วยภาพไล่สี ไม่ใช่สีพื้น อ่านสีพื้นแล้วได้พื้นหน้าเว็บ จึงวัดแค่ตัวหนังสือที่คนต้องอ่าน
            ck(f"ธีม{'มืด' if scheme == 'dark' else 'สว่าง'} ตัวหนังสือการ์ดกับปุ่มหมวดอ่านออก (≥4.5:1)",
               c["card"] >= 4.5 and c["cat"] >= 4.5, json.dumps({k: round(v, 2) for k, v in c.items()}))
            ctx.close()

        # ── ⑦.5 ภาพหัวเว็บ โลโก้ 3 มิติ (พี่ปอนด์เคาะ 23/09/2026) ──
        print("\n━━ ⑦.5 ภาพหัวเว็บ ━━")
        ctx = b.new_context(viewport={"width": 1440, "height": 900}); pg = ctx.new_page(); pg.goto(HOME); home_ready(pg)
        a = pg.evaluate(HERO_ANIMS)
        ck("ภาพหัวเว็บครบ: กล่องเงิน 2 ก้อน ท่อ 3 ชั้น จุดแสงในท่อ", a["tiles"] == 2 and a["pipes"] == 3 and a["spark"], json.dumps(a, ensure_ascii=False))
        # ‼️ พี่ปอนด์สั่ง 23/09/2026 "เอาแค่วิ่ง ๆ พอ ไม่ต้องยกขึ้น" = มีแค่แสงกวาดผิว (CSS) กับจุดแสงวิ่งในท่อ (SMIL) ห้ามมี c-lift กลับมา
        ck("มีแค่แสงกวาดผิว ไม่มีกล่องลอยขึ้น", a["n"] >= 2 and a["names"] == ["h3-sweep"] and a["durs"] == [6000], json.dumps(a, ensure_ascii=False))
        ck("จุดแสงวิ่งในท่อเป็นสีม่วงของธีม FlowKit", "8b5cf6" in pg.evaluate("() => document.querySelector('.hero3d #wg').outerHTML"))
        # ‼️ โลโก้หัวเว็บต้องม่วงจริงบนจอ และเหมือนกันทั้งสองหน้า (พี่ปอนด์ทัก 23/09/2026 ว่าเดิมเป็นสี่เหลี่ยมสีเดียวกับ FileKit)
        mark = pg.evaluate("() => getComputedStyle(document.querySelector('.brand .mark')).backgroundColor")
        pg.goto(DRAW); pg.wait_for_selector(".brand .mark")
        mark2 = pg.evaluate("() => getComputedStyle(document.querySelector('.brand .mark')).backgroundColor")
        ck("โลโก้หัวเว็บเป็นม่วงจริงบนจอ และเหมือนกันทั้งหน้าแรกกับหน้าวาด", mark == "rgb(108, 79, 209)" and mark == mark2, f"{mark} , {mark2}")
        pg.goto(HOME); home_ready(pg)                      # ‼️ กลับหน้าแรกก่อนข้อถัดไป (เคยลืมแล้วข้อเอียงตามเมาส์พังเพราะอยู่หน้าวาด)
        before = pg.evaluate(TILT)
        pg.mouse.move(1150, 250)
        # ‼️ รอจนค่าเอียงถูกตั้งจริง (ตั้งใน requestAnimationFrame ตอนเครื่องมีงานเยอะมาช้ากว่า 120 ms ได้ เคยแดงหลอก 23/09/2026)
        try: pg.wait_for_function("() => document.querySelector('.hero3d').style.getPropertyValue('--tx') !== ''", timeout=5000)
        except Exception: pass
        pg.wait_for_timeout(350); mid = pg.evaluate(TILT)
        pg.mouse.move(700, 700)                                                # ออกจากฉากเปิด
        try: pg.wait_for_function("() => document.querySelector('.hero3d').style.getPropertyValue('--tx') === '0deg'", timeout=5000)
        except Exception: pass
        pg.wait_for_timeout(350); after = pg.evaluate(TILT)
        ck("ลูกเล่นเอียงตามเมาส์ทำงาน และกลับที่เดิมเมื่อเมาส์ออก", before[0] == "" and mid[0] not in ("", "0deg") and mid[2] != before[2] and after[0] in ("0deg", ""),
           f"{before[:2]} → {mid[:2]} → {after[:2]}")
        ctx.close()
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce"); pg = ctx.new_page(); pg.goto(HOME); home_ready(pg)
        still = pg.evaluate(HERO_STILL)
        ck("‼️ เครื่องที่ตั้งลดการเคลื่อนไหว ภาพหัวเว็บนิ่งสนิท ไม่มีจุดแสง แต่ยังเห็นกล่องครบ", still["ok"], json.dumps(still, ensure_ascii=False))
        pg.mouse.move(1150, 250); pg.wait_for_timeout(200)
        ck("ลดการเคลื่อนไหวแล้วไม่เอียงตามเมาส์", pg.evaluate(TILT)[0] == "")
        ctx.close()

        # ── ⑧ กดการ์ดทุกใบ หน้าวาดเปิดของนั้นจริง ──
        print("\n━━ ⑧ กดการ์ดทุกใบ ━━")
        tpl = {t["id"]: t for t in tpls}
        ctx = b.new_context(viewport={"width": 1440, "height": 900}); pg = ctx.new_page()
        for c in cat:
            pg.goto(HOME); home_ready(pg)
            with pg.expect_navigation():
                pg.click(f'#tools a.pill[data-id="{c["id"]}"]')
            q = c["href"].split("?", 1)[1]
            got = "?"
            try:
                if "open=ai" in q:
                    pg.wait_for_function("() => document.querySelector('#dlg-ai').open", timeout=30000); got = "เปิดหน้าต่าง AI"
                elif "open=file" in q:
                    pg.wait_for_function("() => !document.querySelector('#cvnote').hidden", timeout=30000)
                    ok = pg.evaluate("() => document.activeElement.id === 'openfile' && /ลากไฟล์ผัง/.test(document.querySelector('#cvnote').textContent)")
                    got = "ชี้ปุ่มไฟล์ผังเดิม" if ok else "ไม่ชี้"
                else:
                    draw_ready(pg)
                    kind = pg.evaluate("() => document.querySelector('#types .type[aria-pressed=\"true\"]').dataset.kind")
                    if "tpl=" in q:
                        t = tpl[q.split("=")[1]]
                        got = "ใส่เทมเพลตแล้ว" if pg.input_value("#src") == t["th"] and kind == t["kind"] else f"ช่องพิมพ์ไม่ใช่เทมเพลต ชนิด {kind}"
                    else:
                        got = "ชนิดถูก" if kind == c["kind"] else f"ชนิด {kind}"
            except Exception as e:
                got = f"ไม่ขึ้น {type(e).__name__}"
            left = pg.evaluate("() => location.search")
            ck(f"การ์ด {c['th']} → {got} , ที่อยู่ไม่ค้างพารามิเตอร์", got in ("ชนิดถูก", "ใส่เทมเพลตแล้ว", "เปิดหน้าต่าง AI", "ชี้ปุ่มไฟล์ผังเดิม") and left == "", f"{got} {left}")
        ctx.close()

        # ── ⑨ R4 ใช้ครั้งเดียว กับ ผังแก้ด้วยมือค้าง ──
        print("\n━━ ⑨ การ์ดเทมเพลตใช้ครั้งเดียว ━━")
        ctx = b.new_context(viewport={"width": 1440, "height": 900}); pg = ctx.new_page()
        pg.goto(HOME); home_ready(pg)
        with pg.expect_navigation():
            pg.click('#tools a.pill[data-id="tpl-renewal"]')
        draw_ready(pg)
        pg.click("#src"); pg.keyboard.press("Control+End"); pg.keyboard.type("\nแก้เองหลังการ์ด")
        pg.wait_for_timeout(600); pg.reload(); draw_ready(pg)
        ck("‼️ กด F5 หลังการ์ดเทมเพลต ร่างที่แก้ยังอยู่ ไม่ถูกทับ", "แก้เองหลังการ์ด" in pg.input_value("#src"))
        rec = {"xml": "<mxfile><diagram id=\"a\" name=\"p\"><mxGraphModel><root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/>"
                      "<mxCell id=\"2\" value=\"แก้มือ\" vertex=\"1\" parent=\"1\"><mxGeometry x=\"10\" y=\"10\" width=\"90\" height=\"40\" as=\"geometry\"/></mxCell>"
                      "</root></mxGraphModel></diagram></mxfile>", "text": "a", "kind": "steps", "name": "x.drawio.png"}
        pg.evaluate("(r) => sessionStorage.setItem('fk-flow-edit', JSON.stringify(r))", rec)
        before = pg.input_value("#src")
        pg.goto(DRAW + "?tpl=approval")
        pg.wait_for_function("() => document.querySelector('#dlg-tpl').open", timeout=30000)
        note = pg.inner_text("#tpl-note")
        focused = pg.evaluate("() => document.activeElement.dataset.tpl")
        ck("‼️ มีผังแก้ด้วยมือค้าง การ์ดเทมเพลตเปิดหน้าต่างเทมเพลตพร้อมคำเตือน ไม่ทับเงียบ", "แก้ด้วยมือ" in note and focused == "approval", f"{note[:40]} , โฟกัส {focused}")
        ck("ข้อความเดิมยังไม่ถูกแทน จนกว่าผู้ใช้จะเลือกเอง", pg.input_value("#src") == before)
        ctx.close()
        b.close()
    return finish()


def finish():
    print("\n" + "━" * 62)
    print(f"ผ่าน {P} ข้อ, ตก {len(F)} ข้อ")
    if F:
        print("\nข้อที่ไม่ผ่าน:")
        for i, x in enumerate(F, 1): print(f"  {i}. {x}")
        return 1
    print("✅ ตัวตรวจจับของผิดได้ทุกตัว" if SELFTEST else "✅ หน้าแรกพาไปหน้าวาดถูกทุกการ์ด ค้นหา กรอง มือถือ ธีมมืด ใช้ได้")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        traceback.print_exc()
        sys.exit(1)
