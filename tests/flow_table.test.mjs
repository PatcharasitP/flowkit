/* FlowKit v3 เฟส 5: ผังตาราง 3 แบบ (src/parse-table.js + toTableXml ใน src/grid.js)
 * ตัวอ่าน: รู้แบบจากบรรทัดแรก , ตัวคั่น , กับ - , หลักพันไม่ถูกตัด , จำนวนช่องไม่ตรง = บอกบรรทัด , สี่ช่องจับคู่แกนถูก
 * ตัววาด: ช่องเรียงชิดกันเป็นตารางไม่ทับไม่เว้น , สีจางเฉพาะตารางอำนาจ (✋W9) , ข้อความเดิม = XML เดิม
 * ภาพจริง: .claude/evidence/flowkit-v3-2026-09-23/phase5/
 * รัน: node tests/flow_table.test.mjs   (--selftest = ตัวตรวจต้องจับของผิดได้) */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
await import("./_loader/register.mjs");
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const { parseText } = await imp("src/parse.js");
const { toTableXml, roleTint } = await imp("src/grid.js");
const { TEMPLATES } = await imp("src/templates.js");
const SELFTEST = process.argv.includes("--selftest");

let pass = 0; const fail = [];
const ck = (ok, msg, detail = "") => {
  if (ok) { pass++; console.log("  ✅ " + msg); }
  else { fail.push(msg); console.log("  ❌ " + msg + (detail ? "\n      " + detail : "")); }
};
const measure = (t, px) => [...String(t)].filter((c) => !/\p{M}/u.test(c)).length * px * 0.6;
const tbl = (t) => parseText(t, "table");
/** ช่องทุกช่องใน XML: { r, c, x, y, w, h, value, fill } */
function cellsOf(xml) {
  return [...xml.matchAll(/<mxCell id="c(\d+)_(\d+)" value="([^"]*)" style="([^"]*)"[^>]*><mxGeometry x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)]
    .map((m) => ({ r: +m[1], c: +m[2], value: m[3], fill: (m[4].match(/fillColor=([^;]*)/) || [])[1], x: +m[5], y: +m[6], w: +m[7], h: +m[8] }));
}
/* --selftest: ทำ XML ให้ผิดโดยตั้งใจ */
const draw = (m) => {
  let x = toTableXml(m, { measure }).xml;
  if (SELFTEST) x = x.replace(/(<mxCell id="c1_1"[^>]*><mxGeometry x=")([\d.]+)/, (_, a, v) => a + (Number(v) + 30))   // ช่องเหลื่อม
                   .replace(/fillColor=#eef2fb/g, "fillColor=default")                                           // สีตามคำหาย
                   .replace(/<mxCell id="c2_2"[\s\S]*?<\/mxCell>/, "");                                        // ช่องหาย
  return x;
};

console.log("\n━━ ตัวอ่าน ━━");
{
  const a = tbl("งาน \\ ตำแหน่ง: เจ้าหน้าที่, หัวหน้างาน, ผู้จัดการ\nซื้อไม่เกิน 10,000: ทำ, อนุมัติ, -\nจ่ายค่าบริการ 1,500 บาท: ทำ, 1,000 ต่อครั้ง, -");
  ck(a.model && a.model.table.variant === "authority" && a.model.table.corner === "งาน \\ ตำแหน่ง" && a.model.table.cols.length === 3, "บรรทัดแรกมี \\ = ตารางอำนาจ หัวมุมกับ 3 คอลัมน์");
  ck(a.model.table.rows[1].label === "จ่ายค่าบริการ 1,500 บาท" && a.model.table.rows[1].cells[1] === "1,000 ต่อครั้ง", "หลักพัน 1,000 ไม่ถูกตัดเป็นสองช่อง", JSON.stringify(a.model.table.rows[1]));
  ck(a.model.table.rows[0].cells[2] === "-" && !a.model.nodes.some((n) => n.text === "-"), "- = ช่องว่าง ไม่นับเป็นกล่อง");
  const q = tbl("แกนนอน: ด่วน | ไม่ด่วน\nแกนตั้ง: สำคัญ | ไม่สำคัญ\nสำคัญ+ไม่ด่วน: วางแผน\nด่วน+สำคัญ: ทำเอง, วันนี้");
  ck(q.model.table.variant === "quadrant" && q.model.table.rows[0].cells[0] === "ทำเอง | วันนี้" && q.model.table.rows[0].cells[1] === "วางแผน" && q.model.table.rows[1].cells.every((c) => c === "-"),
    "สี่ช่อง จับคู่แกนถูก (สลับข้างของ + ได้) หลายรายการขึ้นบรรทัดในช่อง ช่องที่ไม่เขียน = ว่าง", JSON.stringify(q.model.table.rows));
  const j = tbl("ช่วง: รู้จัก, สนใจ\nทำอะไร: เห็นโฆษณา, เข้าเว็บ");
  ck(j.model.table.variant === "journey" && j.model.table.corner === "ช่วง" && j.model.table.rows[0].label === "ทำอะไร", "บรรทัดแรก ช่วง: = เส้นทางลูกค้า");
  ck(tbl("ผัง: เส้นทางลูกค้า\nstages: a, b\nrow: 1, 2").model.kind === "table" && parseText("ผัง: ตารางอำนาจ\nx \\ y: a, b\nr: 1, 2").model.kind === "table", "หัวไฟล์ ผัง: ตารางอำนาจ / เส้นทางลูกค้า ได้ชนิดตาราง");
  const ERR = [
    ["ช่องไม่ครบ", "งาน \\ ตำแหน่ง: ก, ข, ค\nแถวหนึ่ง: ทำ, อนุมัติ", 2, "ใส่ -"],
    ["ช่องเกิน", "ช่วง: ก, ข\nทำอะไร: 1, 2, 3", 2, "ใส่ -"],
    ["บรรทัดแรกบอกแบบไม่ได้", "ตารางของฉัน\nก: 1", 1, "งาน \\ ตำแหน่ง"],
    ["แกนมี 3 ค่า", "แกนนอน: ก | ข | ค\nแกนตั้ง: ง | จ", 1, "ด่วน | ไม่ด่วน"],
    ["ไม่มีแกนตั้ง", "แกนนอน: ก | ข\nก+ง: x", 1, "แกนตั้ง"],
    ["ช่องสี่ช่องไม่ตรงแกน", "แกนนอน: ก | ข\nแกนตั้ง: ค | ง\nก+จ: x", 3, "ก+ค"],
    ["ย่อหน้าในตาราง", "ช่วง: ก, ข\n  แถว: 1, 2", 2, "ลบวรรค"],
    ["มีแต่หัว", "ช่วง: ก, ข", 1, "ทำอะไร"],
  ];
  for (const [name, text, line, hint] of ERR) {
    const r = tbl(text);
    ck(r.error && r.error.line === line && (r.error.hint || "").includes(hint), `ผิด: ${name} บอกบรรทัด ${line} พร้อมวิธีแก้`, r.error ? `บรรทัด ${r.error.line} ${r.error.message} | ${r.error.hint}` : "ไม่มี error");
  }
  const tip = tbl("ช่วง: ก, ข\nแถว: 1, 2 ((ป้าย))");
  ck(tip.model && tip.model.warnings.some((w) => w.line === 2), "ป้ายตอนชี้ในตาราง เตือนว่ายังไม่รองรับ ไม่ใส่ผิดช่อง");
}

console.log("\n━━ ตัววาด ━━");
for (const t of TEMPLATES.filter((x) => x.kind === "table")) for (const lang of ["th", "en"]) {
  const m = parseText(t.text[lang], "table").model;
  const xml = draw(m), cs = cellsOf(xml), T = m.table;
  const R = T.rows.length + 1, C = T.cols.length + 1;
  ck(cs.length === R * C, `[${t.id} ${lang}] ช่องครบ ${R} x ${C}`, `ได้ ${cs.length}`);
  /* ช่องชิดกันแบบตาราง: ทุกช่องในแถวเดียวกันสูงเท่ากันและ y เดียวกัน , ช่องถัดไปเริ่มตรงขอบขวาของช่องก่อน */
  const bad = [];
  for (const c of cs) {
    const right = cs.find((o) => o.r === c.r && o.c === c.c + 1), below = cs.find((o) => o.c === c.c && o.r === c.r + 1);
    if (right && (Math.abs(right.x - (c.x + c.w)) > 0.01 || right.y !== c.y || right.h !== c.h)) bad.push(`${c.r},${c.c}→ขวา`);
    if (below && (Math.abs(below.y - (c.y + c.h)) > 0.01 || below.x !== c.x || below.w !== c.w)) bad.push(`${c.r},${c.c}→ล่าง`);
  }
  ck(!bad.length, `[${t.id} ${lang}] ช่องชิดกันเป็นตาราง ไม่ทับ ไม่เว้น`, bad.slice(0, 4).join(" "));
  const body = cs.filter((c) => c.r > 0 && c.c > 0);
  if (T.variant === "authority") {
    const tinted = body.filter((c) => roleTint(c.value));
    ck(tinted.length > 0 && tinted.every((c) => c.fill === roleTint(c.value)) && body.filter((c) => !roleTint(c.value)).every((c) => c.fill === "default"),
      `[${t.id} ${lang}] สีจางตามคำ (ทำ ตรวจ อนุมัติ รับทราบ) ช่องอื่นขาว`, JSON.stringify(body.map((c) => [c.value, c.fill]).slice(0, 5)));
  } else {
    ck(body.every((c) => c.fill === "default"), `[${t.id} ${lang}] ขาวดำล้วน ไม่มีสีตามคำ (W9)`);
  }
  ck(toTableXml(m, { measure }).xml === toTableXml(m, { measure }).xml, `[${t.id} ${lang}] วาดสองรอบได้ XML เดียวกันทุกไบต์`);
}
{
  const x = toTableXml(tbl("ช่วง: <b>ก</b>, ข & ค\nแถว: \"1\", -").model, { measure }).xml;
  ck(x.includes('value="&amp;lt;b&amp;gt;ก&amp;lt;/b&amp;gt;"') && x.includes('value="ข &amp;amp; ค"') && !/<b>/.test(x), "ข้อความผู้ใช้ถูกกัน HTML (ไม่กลายเป็นแท็ก)");
}

console.log(`\n${fail.length ? "❌" : "✅"} ${pass} ผ่าน , ${fail.length} ไม่ผ่าน`);
if (SELFTEST) {
  const want = ["ช่องครบ", "ช่องชิดกันเป็นตาราง", "สีจางตามคำ"];
  const miss = want.filter((w) => !fail.some((f) => f.includes(w)));
  console.log(miss.length ? `❌ selftest: ตัวตรวจไม่จับ ${miss.join(" , ")}` : `✅ selftest: ของผิดทุกแบบถูกจับ (${fail.length} ข้อแดง)`);
  process.exit(miss.length ? 1 : 0);
}
process.exit(fail.length ? 1 : 0);
