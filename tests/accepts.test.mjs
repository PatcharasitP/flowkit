/* กติกาหน้าเว็บของ FlowKit ที่ตรวจได้จากไฟล์ โดยไม่ต้องเปิดเบราว์เซอร์ (แผนเว็บ FlowKit แยก ข้อ 8.2)
 * ถอดมาจาก FileKit/tests/accepts.test.mjs ส่วน FlowKit แล้วขยายไปหน้าแรก
 *
 * ‼️ ของที่ยังเป็นสองชุด (FileKit กับ FlowKit) ต้องมีเทสเทียบ ไม่งั้นแยกทางกันเงียบ ๆ (แผน D6)
 *    สีทั้งสองธีม , แถบเว็บในเครือ , สคริปต์ตั้งธีมและภาษาก่อนวาดจอ
 * ‼️ ถ้าผิดจะรู้ได้ยังไง: --selftest ป้อนของผิดทีละข้อ (จุดกลาง , hash ไม่ตรง , สีเพี้ยน , ลิงก์หาย , style ในแท็ก ,
 *    การ์ดชี้เทมเพลตที่ไม่มี , sitemap ขาดหน้า) ตัวตรวจทุกตัวต้องแดง
 * รัน: node tests/accepts.test.mjs  (หรือ --selftest) */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
await import("./_loader/register.mjs");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FK = process.env.FILEKIT_DIR || join(ROOT, "..", "FileKit");
const SELFTEST = process.argv.includes("--selftest");
const rd = (p) => readFileSync(join(ROOT, p), "utf8");
const PAGES = ["index.html", "draw/index.html", "404.html"];

let pass = 0; const fail = [];
const ck = (ok, msg, detail = "") => {
  if (ok) { pass++; console.log("  ✅ " + msg); }
  else { fail.push(msg); console.log("  ❌ " + msg + (detail ? "\n      " + detail : "")); }
};

/* ── ตัวตรวจ (รับข้อความ คืนรายการปัญหา) ใช้ทั้งกับไฟล์จริงและของผิดใน --selftest ── */

/** จุดกลางหรือขีดยาวในสตริงของ JS (เดินทีละตัวอักษร จำสถานะ สตริง/คอมเมนต์/regex/template ซ้อน) ลอกจาก FileKit */
const prevOf = (t, i) => { let k = i - 1; while (k >= 0 && /\s/.test(t[k])) k--; return k >= 0 ? t[k] : ""; };
function middotsInStrings(txt, banned = "·—") {
  const hits = []; let line = 1, mode = "code", quote = "", depth = 0, prev = ""; const stack = [];
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i], n = txt[i + 1];
    if (c === "\n") line++;
    if (mode === "code" && !/\s/.test(c) && !(c === "/" && (n === "/" || n === "*"))) { if (i > 0) prev = prevOf(txt, i); }
    if (mode === "line") { if (c === "\n") mode = "code"; continue; }
    if (mode === "block") { if (c === "*" && n === "/") { mode = "code"; i++; } continue; }
    if (mode === "str") {
      if (c === "\\") { i++; continue; }
      if (c === quote) { mode = "code"; continue; }
      if (quote === "`" && c === "$" && n === "{") { stack.push({ quote, depth }); mode = "code"; depth = 1; i++; continue; }
      if (banned.includes(c)) hits.push(line);
      continue;
    }
    if (c === "/" && n === "/") { mode = "line"; i++; continue; }
    if (c === "/" && n === "*") { mode = "block"; i++; continue; }
    if (c === "/" && !"})]".includes(prev) && !/[\w$]/.test(prev)) {
      let j = i + 1, cls = false;
      for (; j < txt.length; j++) {
        const r = txt[j];
        if (r === "\\") { j++; continue; }
        if (r === "\n") break;
        if (r === "[") cls = true; else if (r === "]") cls = false;
        else if (r === "/" && !cls) { for (let k = 0; k < j - i; k++) if (txt[i + k] === "\n") line++; i = j; break; }
      }
      if (i === j) continue;
    }
    if (c === '"' || c === "'" || c === "`") { mode = "str"; quote = c; continue; }
    if (stack.length) {
      if (c === "{") depth++;
      else if (c === "}" && --depth === 0) { const top = stack.pop(); quote = top.quote; depth = top.depth; mode = "str"; }
    }
  }
  return hits;
}
/** จุดกลางหรือขีดยาวในข้อความ HTML ที่ผู้ใช้เห็น (ตัวหนังสือ , คำแปล , ป้ายอ่านหน้าจอ , placeholder , title) */
function middotsInHtml(html) {
  const body = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  const out = [];
  for (const m of body.matchAll(/>([^<]*[·—][^<]*)</g)) out.push(m[1].trim().slice(0, 46));
  for (const m of body.matchAll(/\b(?:data-en|data-en-al|data-en-ph|data-en-html|data-tip|data-tip-en|aria-label|title|placeholder|content)="([^"]*[·—][^"]*)"/g)) out.push(m[1].slice(0, 46));
  return out;
}
const cspOf = (html) => (html.match(/http-equiv="Content-Security-Policy"[^>]*content="([\s\S]*?)"/) || [])[1] || "";
const inlineScripts = (html) => [...html.replace(/<!--[\s\S]*?-->/g, "").matchAll(/<script(?![^>]*\b(?:src|type)=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const sha = (s) => "sha256-" + createHash("sha256").update(s, "utf8").digest("base64");
/** สคริปต์ฝังที่ไม่มี hash ใน CSP */
const cspMissing = (html) => inlineScripts(html).map(sha).filter((h) => !cspOf(html).includes(h));
/** สคริปต์ตั้งธีมกับภาษาก่อนวาดจอ (ต้องตรงกับหน้าแรก FileKit ทุกตัวอักษร) */
const bootOf = (html) => {
  const s = inlineScripts(html);
  return { theme: s.find((x) => x.includes('"fk-theme"')), lang: s.find((x) => x.includes('"fk-lang"')) };
};
/** ตัวแปรสีในบล็อก selector ‼️ ไม่สนช่องว่างกับการขึ้นบรรทัด (ตัวคัด CSS จัดบรรทัดใหม่ เคยทำให้หาบล็อกไม่เจอทั้งบล็อก 22/09/2026) */
const flat = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{};])\s*/g, "$1");
const vars = (raw, rawSel) => {
  const css = flat(raw), sel = flat(rawSel);
  const i = css.indexOf(sel); if (i < 0) return {};
  const j = css.indexOf("}", i);
  return Object.fromEntries([...css.slice(i + sel.length, j).matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().replace(/\s+/g, " ")]));
};
const THEME_BLOCKS = [":root{", '@media (prefers-color-scheme: light){ :root:not([data-theme="dark"]){', ':root[data-theme="light"]{'];
/** ตัวแปรสีของ FileKit ที่หายหรือค่าไม่ตรงใน css (all = ต้องมีครบทุกตัว , ไม่งั้นเทียบเฉพาะชื่อที่มีทั้งคู่) */
function colorDiff(fkcss, css, all) {
  const out = []; let compared = 0;
  for (const sel of THEME_BLOCKS) {
    const a = vars(fkcss, sel), b = vars(css, sel);
    for (const k of Object.keys(a)) {
      if (!(k in b)) { if (all) out.push(`${sel.slice(0, 26)} ขาด --${k}`); continue; }
      compared++;
      if (a[k] !== b[k]) out.push(`${sel.slice(0, 26)} --${k} FileKit ${a[k]} , FlowKit ${b[k]}`);
    }
  }
  return { out, compared };
}
/** แถบเว็บในเครือ: [ชื่อ , ที่อยู่เต็ม] แปลงที่อยู่เทียบกับหน้าที่อยู่ */
function navOf(html, pageUrl) {
  const nav = (html.match(/<nav class="network"[\s\S]*?<\/nav>/) || [""])[0];
  return [...nav.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => {
    const href = (m[1].match(/href="([^"]*)"/) || [])[1] || "";
    const name = ((m[1].match(/aria-label="([^"]*)"/) || [])[1] || m[2].replace(/<[^>]+>/g, "")).trim();
    const tip = (m[1].match(/data-tip="([^"]*)"/) || [])[1] || "", tipEn = (m[1].match(/data-tip-en="([^"]*)"/) || [])[1] || "";
    return [name, new URL(href, pageUrl).href.replace("https://patcharasitp.github.io", ""), tip, tipEn];
  });
}
const SELF = new Set(["FileKit", "FlowKit"]);     // ตัวที่เป็นเว็บของตัวเองต่างกันได้ (ตัวหนา , ที่อยู่ของตัวเอง)
function navDiff(a, b) {
  const out = [];
  if (a.map((x) => x[0]).join("|") !== b.map((x) => x[0]).join("|")) out.push(`รายชื่อไม่ตรง ${a.map((x) => x[0]).join(",")} กับ ${b.map((x) => x[0]).join(",")}`);
  for (const [n, h, tip, tipEn] of a) {
    const o = b.find((x) => x[0] === n);
    if (!o) continue;
    if (!SELF.has(n) && o[1] !== h) out.push(`${n} ที่อยู่ ${h} กับ ${o[1]}`);
    /* ‼️ ป้ายตอนชี้ (แบบ sqlbi 23/09/2026) ต้องมีสองภาษาครบ และตรงกันทั้งสองเว็บ */
    if (!tip || !tipEn) out.push(`${n} ไม่มีป้ายครบสองภาษา (${tip} , ${tipEn})`);
    if (o[2] !== tip || o[3] !== tipEn) out.push(`${n} ป้ายไม่ตรงกัน (${tip}|${tipEn} กับ ${o[2]}|${o[3]})`);
  }
  return out;
}
/** ไทยในหน้า HTML ต้องมีคำแปล (data-en) หรือประกาศภาษา (lang) */
function thaiNoEn(html) {
  /* ‼️ ของข้างในแท็กที่มี data-en-html แปลทั้งก้อนแล้ว (h1 ที่มี <em> ข้างใน) ไม่ต้องมีคำแปลซ้ำที่ลูก */
  const body = html.slice(html.indexOf("<body")).replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<([a-z0-9]+)\b[^>]*\bdata-en-html="[^"]*"[^>]*>[\s\S]*?<\/\1>/g, "");
  const out = [];
  for (const m of body.matchAll(/<([a-z0-9]+)((?:\s[^>]*)?)>([^<]*[฀-๿][^<]*)</g)) if (!/\bdata-en(?:-html)?=|\blang=/.test(m[2])) out.push(`<${m[1]}> ${m[3].trim().slice(0, 30)}`);
  for (const m of body.matchAll(/<[a-z0-9]+\b([^>]*\baria-label="[^"]*[฀-๿][^"]*"[^>]*)>/g)) if (!/\bdata-en-al=/.test(m[1])) out.push("aria-label " + m[1].slice(0, 40));
  for (const m of body.matchAll(/<[a-z0-9]+\b([^>]*\bplaceholder="[^"]*[฀-๿][^"]*"[^>]*)>/g)) if (!/\bdata-en-ph=/.test(m[1])) out.push("placeholder " + m[1].slice(0, 40));
  return out;
}
/** CSP หน้าแรกไม่มี unsafe-inline จึงห้าม style ในแท็ก และห้าม JS ตั้ง style ทั้งก้อน */
const styleAttrs = (html) => [...html.replace(/<!--[\s\S]*?-->/g, "").matchAll(/<[a-z][^>]*\sstyle="[^"]*"/g)].map((m) => m[0].slice(0, 50));
/* ‼️ ตัดคอมเมนต์ทั้งสองแบบก่อน ไม่งั้นคอมเมนต์ที่เล่าว่า "ไม่ใช้ setAttribute('style')" โดนจับเอง (เจอจริง 23/09/2026) */
const styleInJs = (js) => [...js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\w])\/\/.*$/gm, "$1").matchAll(/setAttribute\(\s*["']style["']|\.style\.cssText|\bstyle:\s*[`"']/g)].map((m) => m[0]);
/** การ์ดหน้าแรกทุกใบชี้ของที่มีจริงในหน้าวาด */
function catalogProblems(catalog, templates, kinds) {
  const out = [], ids = new Set(), tpl = new Set(templates.map((t) => t.id));
  for (const c of catalog) {
    if (ids.has(c.id)) out.push(`id ซ้ำ ${c.id}`); ids.add(c.id);
    const q = new URLSearchParams(c.href.split("?")[1] || "");
    if (!c.href.startsWith("draw/?")) out.push(`${c.id} ไม่ได้ชี้หน้าวาด ${c.href}`);
    else if (q.has("kind") && !["steps", "lane", "org", "system", "timeline", "table", "mindmap", "pa"].includes(q.get("kind"))) out.push(`${c.id} ชนิด ${q.get("kind")} ไม่มี`);
    else if (q.has("tpl") && !tpl.has(q.get("tpl"))) out.push(`${c.id} เทมเพลต ${q.get("tpl")} ไม่มีใน templates.js`);
    else if (q.has("open") && !["ai", "file"].includes(q.get("open"))) out.push(`${c.id} open=${q.get("open")} ไม่รู้จัก`);
    if (!kinds.some((k) => k.id === c.kind)) out.push(`${c.id} ชนิด ${c.kind} ไม่มีปุ่มหมวด`);
    if (!c.th || !c.en) out.push(`${c.id} ชื่อไม่ครบสองภาษา`);
  }
  return out;
}

async function main() {
  const fkhtml = readFileSync(join(FK, "index.html"), "utf8");
  const fkcss = (fkhtml.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || "";
  const html = Object.fromEntries(PAGES.map((p) => [p, rd(p)]));
  const js = readdirSync(join(ROOT, "src")).filter((n) => n.endsWith(".js"));

  console.log("\n━━ ① ไม่มีจุดกลางหรือขีดยาวในข้อความที่ผู้ใช้เห็น ━━");
  const hits = [];
  for (const n of js) { const t = rd("src/" + n); for (const ln of middotsInStrings(t)) hits.push(`src/${n}:${ln} ${t.split("\n")[ln - 1].trim().slice(0, 46)}`); }
  for (const p of PAGES) for (const h of middotsInHtml(html[p])) hits.push(`${p} ${h}`);
  ck(js.length >= 18, `กวาดโมดูล ${js.length} ไฟล์ กับหน้าเว็บ ${PAGES.length} หน้า (ประชากรต้องไม่เป็นศูนย์)`);
  ck(!hits.length, `ไม่มี · หรือ — (พบ ${hits.length})`, hits.slice(0, 5).join("\n      "));

  console.log("\n━━ ② CSP ทุกหน้า ━━");
  for (const p of PAGES) {
    const csp = cspOf(html[p]);
    ck(!!csp && !/unsafe-inline|unsafe-eval/.test(csp), `${p} มี CSP และไม่มี unsafe-inline หรือ unsafe-eval`);
    const miss = cspMissing(html[p]);
    ck(!miss.length, `${p} สคริปต์ฝัง ${inlineScripts(html[p]).length} ก้อน มี sha256 ใน CSP ครบ`, miss.length ? "ค่าที่ควรใส่: " + miss.join(" ") : "");
  }
  const hcsp = cspOf(html["index.html"]);
  ck(!/frame-src|https?:\/\//.test(hcsp), "หน้าแรกไม่ฝัง frame และไม่อนุญาตโดเมนอื่น (ไม่มี draw.io ไม่มี CDN)");
  const drawio = (rd("src/engine.js").match(/export const DRAWIO = "([^"]+)"/) || [])[1] || "";
  const frame = ((cspOf(html["draw/index.html"]).match(/frame-src ([^;]+);/) || [])[1] || "").trim();
  ck(!!drawio && frame === new URL(drawio).origin, `หน้าวาด frame-src ตรงกับที่อยู่ draw.io ใน engine.js (${frame})`);

  console.log("\n━━ ③ สคริปต์ตั้งธีมกับภาษาก่อนวาดจอ ตรงกับหน้าแรก FileKit ทุกตัวอักษร ━━");
  const fb = bootOf(fkhtml);
  ck(!!fb.theme && !!fb.lang, "เจอสคริปต์ทั้งสองก้อนในหน้าแรก FileKit");
  for (const p of ["index.html", "draw/index.html"]) {
    const b = bootOf(html[p]);
    ck(b.theme === fb.theme && b.lang === fb.lang, `${p} สคริปต์ธีมและภาษาเหมือน FileKit`);
  }

  console.log("\n━━ ④ CSS ━━");
  for (const f of ["home.css", "draw/draw.css"]) {
    const t = rd(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/"(?:[^"\\]|\\.)*"/g, '""');
    let d = 0, bad = 0; for (const ch of t) { if (ch === "{") d++; else if (ch === "}" && --d < 0) bad++; }
    ck(d === 0 && !bad, `${f} วงเล็บปีกกาสมดุล`);
  }
  const home = colorDiff(fkcss, rd("home.css"), true);
  ck(home.compared >= 40 && !home.out.length, `home.css ตัวแปรสีครบและตรงกับ FileKit ทั้งสองธีม (เทียบ ${home.compared} ตัว)`, home.out.slice(0, 4).join("\n      "));
  const draw = colorDiff(fkcss, rd("draw/draw.css"), false);
  ck(draw.compared >= 12 && !draw.out.length, `draw.css ตัวแปรสีที่ชื่อซ้ำตรงกับ FileKit (เทียบ ${draw.compared} ตัว)`, draw.out.slice(0, 4).join("\n      "));
  ck(/url\("\/filekit\/vendor\/fonts\/Sarabun-Regular\.woff2"\)/.test(rd("home.css")), "home.css ฟอนต์ชี้ /filekit/vendor/fonts/");
  /* ‼️ โลโก้หัวเว็บของ FlowKit เป็นม่วง ไม่ใช่สี่เหลี่ยมสีเดียวกับ FileKit (พี่ปอนด์ 23/09/2026) สองหน้าต้องสีเดียวกัน */
  const markBg = (f) => [...rd(f).matchAll(/\.brand \.mark\{[^}]*background:([^;}]+)/g)].map((m) => m[1].trim());
  const violet = (f) => markBg(f).filter((v) => v.startsWith("#")).join(",");
  /* ‼️ home.css คัดมาจาก FileKit จึงมีกฎน้ำเงินของ FileKit ติดมาก่อน แล้วถูกกฎม่วงของ FlowKit ทับทีหลัง ดูค่าที่ชนะ (ชุดท้ายสุด) */
  ck(violet("home.css").endsWith("#6c4fd1,#7c5ce0,#7c5ce0") && violet("draw/draw.css").endsWith("#6c4fd1,#7c5ce0,#7c5ce0"),
     `โลโก้หัวเว็บทั้งสองหน้าจบด้วยสีม่วงชุดเดียวกัน (${violet("home.css")} , ${violet("draw/draw.css")})`);

  console.log("\n━━ ⑤ แถบเว็บในเครือ ตรงกับหน้าแรก FileKit ━━");
  const fknav = navOf(fkhtml, "https://patcharasitp.github.io/filekit/");
  for (const [p, url] of [["index.html", "https://patcharasitp.github.io/flowkit/"], ["draw/index.html", "https://patcharasitp.github.io/flowkit/draw/"]]) {
    const n = navOf(html[p], url);
    const d = navDiff(fknav, n);
    ck(n.length >= 8 && !d.length, `${p} แถบเว็บในเครือ ${n.length} ลิงก์ ตรงกับ FileKit`, d.slice(0, 3).join("\n      "));
    ck(n.find((x) => x[0] === "FlowKit")?.[1] === "/flowkit/" && n.find((x) => x[0] === "FileKit")?.[1] === "/filekit/", `${p} FlowKit ชี้ /flowkit/ , FileKit ชี้ /filekit/`);
  }

  console.log("\n━━ ⑥ ไทยทุกชิ้นมีคำแปล , ไม่มี style ในแท็ก ━━");
  for (const p of PAGES) { const m = thaiNoEn(html[p]); ck(!m.length, `${p} ข้อความไทยมีคำแปลครบ`, m.slice(0, 4).join("\n      ")); }
  const sa = [...styleAttrs(html["index.html"]), ...styleAttrs(html["404.html"])];
  ck(!sa.length, "หน้าแรกกับ 404 ไม่มี style ในแท็ก (CSP บล็อก)", sa.slice(0, 3).join(" | "));
  const sj = ["home.js", "catalog.js", "chrome.js"].flatMap((n) => styleInJs(rd("src/" + n)).map((x) => n + " " + x));
  ck(!sj.length, "โมดูลหน้าแรกไม่ตั้ง style เป็นข้อความ (CSP บล็อก)", sj.join(" | "));

  console.log("\n━━ ⑦ การ์ดหน้าแรก , รุ่น , sitemap ━━");
  const { CATALOG, KINDS } = await import(pathToFileURL(join(ROOT, "src/catalog.js")).href);
  const { TEMPLATES } = await import(pathToFileURL(join(ROOT, "src/templates.js")).href);
  const cp = catalogProblems(CATALOG, TEMPLATES, KINDS);
  ck(CATALOG.length === 8 + TEMPLATES.length + 2 && !cp.length, `การ์ด ${CATALOG.length} ใบ ชี้ของที่มีจริงทุกใบ`, cp.join("\n      "));
  const count = Object.fromEntries(KINDS.map((k) => [k.id, CATALOG.filter((c) => c.kind === k.id).length]));
  ck(JSON.stringify(count) === JSON.stringify({ steps: 7, lane: 3, org: 2, system: 2, timeline: 2, table: 4, mindmap: 2, pa: 1, other: 2 }), `จำนวนต่อหมวดตามแผน ${JSON.stringify(count)}`);
  const ver = (h) => (h.match(/<meta name="flowkit-version" content="([^"]+)">/) || [])[1];
  ck(!!ver(html["index.html"]) && ver(html["index.html"]) === ver(html["draw/index.html"]), `meta รุ่นตรงกันสองหน้า (${ver(html["index.html"])})`);
  const sm = [...rd("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  ck(sm.join(" ") === "https://patcharasitp.github.io/flowkit/ https://patcharasitp.github.io/flowkit/draw/", `sitemap มี 2 หน้า ${sm.join(" , ")}`);
  ck(/Sitemap: https:\/\/patcharasitp\.github\.io\/flowkit\/sitemap\.xml/.test(rd("robots.txt")), "robots.txt ชี้ sitemap");
  ck(/href="\/flowkit\/"/.test(html["404.html"]), "404.html มีลิงก์กลับหน้าแรก");
  for (const [p, url] of [["index.html", "https://patcharasitp.github.io/flowkit/"], ["draw/index.html", "https://patcharasitp.github.io/flowkit/draw/"]]) {
    ck(html[p].includes(`<link rel="canonical" href="${url}">`), `${p} canonical ${url}`);
  }

  console.log("\n━━ ⑧ รายชื่อแอปแชท และโมดูล parse ผ่าน ━━");
  const re = (src) => (src.match(/const MAYBE_IN_APP = \/(.+)\/i;/) || [])[1];
  ck(!!re(rd("src/draw.js")) && re(rd("src/draw.js")) === re(readFileSync(join(FK, "src/app.js"), "utf8")), "รายชื่อแอปแชทใน src/draw.js ตรงกับ FileKit src/app.js");
  const child = `const { readFileSync } = await import("node:fs"); const { SourceTextModule } = await import("node:vm"); const bad = [];
    for (const f of ${JSON.stringify(js.map((n) => join(ROOT, "src", n)))}) { try { new SourceTextModule(readFileSync(f, "utf8")); } catch (e) { bad.push(f + ": " + e.message); } }
    console.log(JSON.stringify(bad));`;
  const r = spawnSync(process.execPath, ["--experimental-vm-modules", "--input-type=module", "-e", child], { encoding: "utf8" });
  let broken = null; try { broken = JSON.parse((r.stdout || "").trim().split("\n").pop()); } catch { /* ตัวตรวจพัง */ }
  ck(Array.isArray(broken) && !broken.length, `ทุกโมดูลใน src parse ผ่าน (${js.length} ไฟล์)`, Array.isArray(broken) ? broken.join("\n      ") : "ตัวตรวจพัง");
}

function selftest() {
  console.log("\n━━ selftest: ตัวตรวจทุกตัวต้องจับของผิดได้ ━━");
  const idx = rd("index.html"), fkhtml = readFileSync(join(FK, "index.html"), "utf8");
  const fkcss = (fkhtml.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || "";
  ck(middotsInStrings('const a = "ผ่าน — ตก"; // — ในคอมเมนต์ไม่นับ').length === 1, "จับขีดยาวในสตริง ไม่จับในคอมเมนต์");
  ck(middotsInStrings("const a = `x ${b ? ` · ${c}` : ''}`;").length === 1, "จับจุดกลางใน template ซ้อนชั้น");
  ck(middotsInHtml('<p data-en="a · b">ก</p>').length === 1 && middotsInHtml("<!-- · --><p>ก</p>").length === 0, "จับใน data-en ไม่จับในคอมเมนต์ HTML");
  ck(cspMissing(idx.replace('"fk-theme")', '"fk-theme") ')).length === 1, "สคริปต์ฝังเปลี่ยนตัวเดียว hash ใน CSP ไม่ตรง จับได้");
  ck(bootOf(idx.replace('"fk-lang")==="en"', '"fk-lang")=="en"')).lang !== bootOf(fkhtml).lang, "สคริปต์ภาษาต่างจาก FileKit จับได้");
  const bent = rd("home.css").replace(/--g-doc:([^;]+);/, "--g-doc:#123456;");
  ck(colorDiff(fkcss, bent, true).out.length >= 1, "สีตัวแปรเพี้ยนหนึ่งตัว จับได้");
  ck(colorDiff(fkcss, rd("home.css").replace(/--g-ppt:[^;]+;/, ""), true).out.some((x) => x.includes("ขาด --g-ppt")), "ตัวแปรสีหายหนึ่งตัว จับได้");
  const nav = navOf(idx, "https://patcharasitp.github.io/flowkit/");
  ck(navDiff(nav, nav.filter((x) => x[0] !== "Excel")).length >= 1, "ลิงก์ในแถบเว็บในเครือหายหนึ่งตัว จับได้");
  ck(navDiff(nav, nav.map((x) => x[0] === "Excel" ? [x[0], "/filekit/#/x", x[2], x[3]] : x)).length === 1, "ลิงก์ชี้ผิดที่ จับได้");
  ck(navDiff(nav, nav.map((x) => x[0] === "Excel" ? [x[0], x[1], "ป้ายอื่น", x[3]] : x)).length === 1, "ป้ายตอนชี้ไม่ตรงกันสองเว็บ จับได้");
  ck(navDiff(nav.map((x) => x[0] === "Excel" ? [x[0], x[1], "", ""] : x), nav).length >= 1, "ป้ายตอนชี้หายไป จับได้");
  ck(thaiNoEn('<body><p>ไทยไม่มีคำแปล</p><p data-en="x">ไทย</p><h1 data-en-html="a<em>b</em>">ก<em>ข</em></h1>').length === 1, "ข้อความไทยไม่มีคำแปล จับได้ (ลูกของ data-en-html ไม่นับ)");
  ck(Object.keys(vars("@media (x){\n:root{--a:1;}\n}", "@media (x){ :root{")).length === 1, "หาบล็อกสีเจอแม้จัดบรรทัดต่างกัน");
  ck(styleAttrs('<div style="--ac:red">').length === 1 && styleInJs('el.setAttribute("style", x)').length === 1
     && styleInJs('/* ห้าม setAttribute("style") */ el.style.setProperty("--tx", v)').length === 0, "style ในแท็กและใน JS จับได้ และไม่จับที่อยู่ในคอมเมนต์");
  ck(catalogProblems([{ id: "a", href: "draw/?tpl=nope", kind: "steps", th: "ก", en: "a" }, { id: "a", href: "x/", kind: "zz", th: "ก", en: "" }],
                     [{ id: "renewal" }], [{ id: "steps" }]).length >= 4, "การ์ดชี้เทมเพลตที่ไม่มี , id ซ้ำ , ไม่ชี้หน้าวาด , ชนิดไม่มี , ขาดคำแปล จับได้");
}

if (SELFTEST) selftest(); else await main();
console.log(`\n${fail.length ? "❌" : "✅"} ผ่าน ${pass} ข้อ, ตก ${fail.length} ข้อ`);
process.exit(fail.length ? 1 : 0);
