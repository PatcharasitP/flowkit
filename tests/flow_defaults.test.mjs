/* FlowKit v3 เฟส 1: ค่าตั้งต้นให้ผังอ่านง่าย (src/defaults.js) ป้อน XML จริงที่ draw.io ตัวฝังคืนมา (tests/flow_defaults/*.xml
 * ได้จาก .claude/evidence/flowkit-v3-2026-09-23/phase1/sheet.py แบบปิดค่าตั้งต้นหมด) แล้วเช็คสไตล์ที่ออกมาทีละสวิตช์
 * ภาพก่อน-หลังของทุกข้อดูได้ที่ ba-*.png ในโฟลเดอร์เดียวกัน (เทสนี้จับว่า "ใส่ถูกที่" ภาพจับว่า "ดูดี")
 * รัน: node tests/flow_defaults.test.mjs   (--selftest = ตัวตรวจต้องจับของผิดได้) */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
await import("./_loader/register.mjs");
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const D = await imp("src/defaults.js");
const { parseText } = await imp("src/parse.js");
const { parsePA } = await imp("src/parse-pa.js");
const SELFTEST = process.argv.includes("--selftest");

let pass = 0; const fail = [];
const ck = (ok, msg, detail = "") => {
  if (ok) { pass++; console.log("  ✅ " + msg); }
  else { fail.push(msg); console.log("  ❌ " + msg + (detail ? "\n      " + detail : "")); }
};
const xmlOf = (n) => readFileSync(join(ROOT, "tests/flow_defaults", n + ".xml"), "utf8");
const txt = (n) => readFileSync(join(ROOT, "tests/flow_golden", n + ".txt"), "utf8");
const model = (n) => parseText(txt(n), "steps").model;
const OFF = Object.fromEntries(D.DEFAULTS.map((d) => [d.key, false]));
const only = (k) => ({ ...OFF, [k]: true });

/** บล็อกทุกตัวใน XML: { mid, edge, style, base, geo } */
function blocks(xml) {
  return [...xml.matchAll(/<UserObject\b[^>]*>[\s\S]*?<\/UserObject>/g)].map(([b]) => {
    const a = (s, k) => { const m = s.match(new RegExp(`\\s${k}="([^"]*)"`)); return m ? m[1] : null; };
    const cell = b.slice(b.indexOf("<mxCell")); const g = (b.match(/<mxGeometry\b[^>]*>/) || [""])[0];
    return { mid: (a(b, "mermaidId") || "").replace(/&gt;/g, ">"), edge: /\bedge="1"/.test(cell), style: a(cell, "style") || "", base: a(b, "mermaidBaseStyle") || "",
      parent: a(cell, "parent"), x: +a(g, "x"), y: +a(g, "y"), w: +a(g, "width"), h: +a(g, "height") };
  });
}
const vertices = (xml) => blocks(xml).filter((b) => /^n:n\d+$/.test(b.mid));
const edges = (xml) => blocks(xml).filter((b) => b.edge);
const overlaps = (list) => {
  const out = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.parent === b.parent && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) out.push(`${a.mid}/${b.mid}`);
  }
  return out;
};

/* ตัวตรวจแบบทำพังโดยตั้งใจ: --selftest ใช้ฟังก์ชันที่ผิดแทนของจริง ข้อที่ตรงกันต้องแดง */
const F = SELFTEST ? {
  ...D,
  dashedLoops: (x) => x.replace(/(e:n1-&gt;n2#0"[\s\S]*?style=")/, "$1dashed=1;"),            // ประผิดเส้น
  semanticColor: (x) => x,                                                                    // ไม่ใส่สีเลย
  uniformWidth: (x) => x.replace(/width="\d+(\.\d+)?"/g, 'width="900"'),                      // กว้างจนชนกัน
  floatingEdges: (x) => x,                                                                    // ไม่ล้างจุด
  lineJumps: (x) => D.lineJumps(x).replace(/(<mxCell\b[^>]*\bstyle=")(?=[^"]*"[^>]*\bvertex="1")/, "$1jumpStyle=arc;"), // ใส่ที่กล่องด้วย
} : D;

console.log("\n━━ ปิดหมด = ไม่แตะสักตัวอักษร ━━");
for (const n of ["02-renewal", "06-team-org", "08-system", "13-parallel"]) {
  const k = n === "06-team-org" ? "06-team-org" : n;
  const m = n === "08-system" ? parseText(txt(n), "steps").model : model(k);
  ck(D.applyDefaults(xmlOf(n), m, OFF) === xmlOf(n), `[${n}] ทุกสวิตช์ปิด XML เหมือนเดิมทุกตัวอักษร`);
}

console.log("\n━━ ① เส้นกระโดด ━━");
{
  const out = F.lineJumps(xmlOf("02-renewal"));
  const es = edges(out);
  ck(es.length > 0 && es.every((e) => /jumpStyle=arc/.test(e.style) && /jumpStyle=arc/.test(e.base)), `ทุกเส้น (${es.length}) ได้ jumpStyle=arc ทั้ง style และ mermaidBaseStyle`);
  ck(!vertices(out).some((v) => /jumpStyle/.test(v.style)), "กล่องไม่ถูกแตะ");
  ck(F.lineJumps(out) === out, "ใส่ซ้ำสองรอบได้ผลเท่าเดิม (ไม่ต่อท้ายซ้ำ)");
}

console.log("\n━━ ② เส้นลอยตัว ━━");
{
  const pin = /(^|;)(exit|entry)[XY]=/;
  ck(edges(xmlOf("02-renewal")).some((e) => pin.test(e.style)), "ก่อนแก้ ผังขั้นตอนมีจุดตรึงจริง (ตัวอย่างใช้ได้)");
  const out = F.floatingEdges(xmlOf("02-renewal"), "steps");
  ck(edges(out).every((e) => !pin.test(e.style) && !pin.test(e.base)), "ผังขั้นตอน: ไม่เหลือ exitX/entryX ในเส้นไหนเลย");
  ck(edges(out).every((e) => /endArrow=block/.test(e.style)), "สไตล์อื่นของเส้นยังอยู่ (หัวลูกศร)");
  ck(F.floatingEdges(xmlOf("06-team-org"), "org") === xmlOf("06-team-org"), "ผังองค์กรคงจุดตายตัว (ไม่แตะ)");
  ck(F.floatingEdges(xmlOf("pa-trycatch"), "pa") === xmlOf("pa-trycatch"), "ผัง Power Automate ไม่แตะ (กรอบซ้อนตั้งจุดไว้แล้ว)");
}

console.log("\n━━ ③ กล่องแนวเดียวกันกว้างเท่ากัน ━━");
for (const [n, kind] of [["02-renewal", "steps"], ["13-parallel", "steps"], ["06-team-org", "org"], ["pa-trycatch", "pa"]]) {
  const before = vertices(xmlOf(n)), out = F.uniformWidth(xmlOf(n), kind), after = vertices(out);
  const key = (v) => kind === "org" ? v.y + v.h / 2 : v.x + v.w / 2;
  const changed = after.filter((v, i) => v.w !== before[i].w);
  ck(changed.length > 0, `[${n}] มีกล่องถูกปรับจริง ${changed.length} กล่อง`);
  ck(after.every((v, i) => Math.abs(key(v) - key(before[i])) < 0.02), `[${n}] จุดกลางทุกกล่องอยู่ที่เดิม (เส้นไม่ขยับ)`);
  ck(overlaps(after).length === 0, `[${n}] ไม่มีกล่องทับกัน`, overlaps(after).join(" "));
  ck(changed.every((v) => !/^(rhombus|hexagon)/.test(v.style)), `[${n}] ข้าวหลามตัดกับหกเหลี่ยมไม่ถูกยืด`);
  ck(changed.every((v) => after.some((o) => o !== v && o.parent === v.parent && Math.abs(key(o) - key(v)) <= 6 && o.w === v.w)), `[${n}] กล่องที่ยืดกว้างเท่ากล่องอื่นในแนวเดียวกัน`);
}
{
  // ‼️ ภาพจริง 23/09/2026 (ba-12-torture.png): กล่องข้อความยาว 940px กล่องเดียวลากทุกกล่องในแนวยาวตาม และหกเหลี่ยมถูกยืด
  const before = vertices(xmlOf("12-torture")), after = vertices(F.uniformWidth(xmlOf("12-torture"), "steps"));
  const longest = Math.max(...before.map((v) => v.w));
  const hexB = before.filter((v) => /shape=hexagon/.test(v.style)), hexA = after.filter((v) => /shape=hexagon/.test(v.style));
  ck(hexB.length > 0 && hexA.every((v, i) => v.w === hexB[i].w), "[12-torture] หกเหลี่ยม (shape= อยู่กลางสไตล์) ไม่ถูกยืด");
  ck(after.filter((v) => v.w === longest).length === 1, `[12-torture] กล่องยาว ${longest}px กล่องเดียวไม่ลากกล่องอื่นให้ยาวตาม`,
    after.filter((v) => v.w === longest).map((v) => v.mid).join());
  ck(after.some((v, i) => v.w !== before[i].w), "[12-torture] กล่องที่เหลือยังถูกทำให้เท่ากัน");
}
{
  // ผังที่ยืดแล้วชนกล่องข้าง ๆ ต้องข้ามแนวนั้น: บีบกล่องสองกล่องให้อยู่แนวเดียวกันแต่มีกล่องที่สามขวาง
  const mk = (id, x, y, w) => `<UserObject label="" mermaidId="n:${id}" id="${id}"><mxCell parent="1" style="rounded=0;" vertex="1"><mxGeometry height="40" width="${w}" x="${x}" y="${y}" as="geometry" /></mxCell></UserObject>`;
  const x = `<root>${mk("n1", 100, 0, 100)}${mk("n2", 50, 100, 200)}${mk("n3", 115, 0, 0)}${mk("n4", 170, 0, 20)}</root>`;
  ck(F.uniformWidth(x, "steps") === x, "ยืดแล้วชนกล่องอื่น = ไม่ยืดแนวนั้นเลย");
}

console.log("\n━━ ④ สีเริ่ม-จบ ━━");
{
  const m = model("02-renewal"), out = F.semanticColor(xmlOf("02-renewal"), m), vs = vertices(out);
  const col = (id) => (vs.find((v) => v.mid === "n:" + id) || {}).style || "";
  const { start, end } = D.startEnd(m);
  ck([...start].join() === "n1" && [...end].sort().join() === "n11,n13", "กล่องเริ่ม n1 กล่องจบ n11 n13 (ตรงกับแคปซูลในภาพ)", `${[...start]} | ${[...end]}`);
  ck(col("n1").includes(D.SEMANTIC.start), "กล่องแรกขอบเขียว");
  ck(col("n11").includes(D.SEMANTIC.end) && col("n13").includes(D.SEMANTIC.end), "กล่องจบทั้งสองขอบแดง");
  ck(vs.filter((v) => /3f9a63|c4574f/.test(v.style)).length === 3, "กล่องอื่นไม่ได้สี (ได้สี 3 กล่องพอดี)");
  ck(!/fillColor=light-dark\(#3f9a63/.test(out), "ไม่ถมพื้น เปลี่ยนแค่ขอบ");
  const pm = parsePA(readFileSync(join(ROOT, "tests/flow_pa/trycatch.json"), "utf8")).model;
  const pv = vertices(F.semanticColor(xmlOf("pa-trycatch"), pm));
  ck(pv.filter((v) => v.style.includes(D.SEMANTIC.start)).length === 1 && pv.filter((v) => v.style.includes(D.SEMANTIC.end)).length === 1,
    "Power Automate: ตัวเริ่ม flow เขียว Terminate แดง อย่างละกล่อง");
  const om = parseText(txt("06-team-org"), "org").model;
  ck(F.semanticColor(xmlOf("06-team-org"), om) === xmlOf("06-team-org"), "ผังองค์กรไม่มีเริ่ม-จบ ไม่แตะ");
}

console.log("\n━━ ⑤ เส้นวนกลับเป็นเส้นประ ━━");
{
  const m = model("02-renewal");
  ck([...D.backEdges(m)].join() === "n8>n5", "เส้นวนกลับของ 02-renewal คือ ไม่อนุมัติ → เจรจาค่าเช่า เส้นเดียว", [...D.backEdges(m)].join());
  ck(D.backEdges(model("13-parallel")).size === 0, "งานขนานบรรจบกัน ไม่ใช่วนกลับ");
  ck(D.backEdges(model("04-approval")).size === 0, "กิ่งบรรจบไปกล่องข้างหน้า ไม่ใช่วนกลับ");
  const es = edges(F.dashedLoops(xmlOf("02-renewal"), m));
  const dashed = es.filter((e) => /dashed=1/.test(e.style)).map((e) => e.mid);
  ck(dashed.length === 1 && dashed[0].startsWith("e:n8->n5"), "ประเฉพาะเส้น n8 → n5", dashed.join());
  const sm = parseText(txt("08-system"), "steps").model;
  ck(D.backEdges(sm).size > 0 && F.dashedLoops(xmlOf("08-system"), sm) === xmlOf("08-system"), "ผังระบบมีวงจริงแต่ไม่ทำเส้นประ (ข้อมูลไหลสองทางเป็นเรื่องปกติ)");
}

console.log("\n━━ ป้ายตอนชี้ (แผน v3 เฟส 4) ━━");
{
  const m = model("02-renewal");
  m.nodes.find((n) => n.id === "n5").tip = 'ห้ามเกิน "10%" <ปีละครั้ง> & ต้องมีบันทึก | ลงชื่อสองฝ่าย';
  const out = D.addTips(xmlOf("02-renewal"), m);
  const tag = (out.match(/<UserObject\b[^>]*mermaidId="n:n5"[^>]*>/) || [""])[0];
  ck(tag.includes('tooltip="ห้ามเกิน &quot;10%&quot; &lt;ปีละครั้ง&gt; &amp; ต้องมีบันทึก&#10;ลงชื่อสองฝ่าย"'), "tooltip อยู่บนกล่องที่ถูกตัว อักขระพิเศษถูกกัน | เป็นขึ้นบรรทัด", tag.slice(0, 200));
  ck((out.match(/tooltip="/g) || []).length === 1, "กล่องอื่นไม่ได้ป้าย");
  ck(D.addTips(out, m) === out, "ใส่ซ้ำไม่ซ้อน");
  ck(D.applyDefaults(xmlOf("02-renewal"), m, OFF).includes('tooltip="'), "ปิดค่าตั้งต้นทุกข้อ ป้ายที่ผู้ใช้พิมพ์ยังอยู่ (ไม่ใช่ค่าตั้งต้น)");
}

console.log("\n━━ หน้าตาแผนผังความคิด (แผน v3 เฟส 6) ━━");
{
  /* XML จริงจากตัวฝัง (.claude/evidence/flowkit-v3-2026-09-23/phase6/mm-entity.xml) ราก 1 กิ่งหลัก 3 (กิ่งแรกมีลูก 1) */
  const x = xmlOf("mindmap");
  const out = D.mindmapLook(x);
  ck(!/mermaidId="[ne]:[^"]*mm\d/.test(out) && /mermaidId="n:n1"/.test(out) && /mermaidId="e:n1-&gt;n2#0"/.test(out), "id mm0 mm1 ของ draw.io กลายเป็น n1 n2 ของเรา (ป้ายตอนชี้ใช้ได้)");
  const vs = vertices(out), fill = (id) => (vs.find((v) => v.mid === "n:" + id).style.match(/fillColor=([^;]*)/) || [])[1];
  ck(fill("n1") === "default" && /fontStyle=1/.test(vs.find((v) => v.mid === "n:n1").style), "หัวข้อกลางพื้นขาว ตัวหนา");
  ck(fill("n2") === fill("n3") && fill("n2") !== fill("n4") && fill("n4") !== fill("n5"), "กิ่งย่อยใช้สีของกิ่งหลัก กิ่งหลักแต่ละกิ่งคนละสี", ["n2", "n3", "n4", "n5"].map(fill).join());
  ck(/#0000EC/i.test(x) && !/#0000EC|#FFFF78|#D7FF86|#C286FF/i.test(out) && !/strokeWidth=11/.test(out), "สีจัดกับเส้นหนา 11 ของ Mermaid หายทั้งสไตล์ที่ใช้วาดและ mermaidBaseStyle");
  ck(edges(out).every((e) => /strokeWidth=2(;|$)/.test(e.style)), "เส้นบาง 2");
  const mm = parseText("หัวข้อ\n  ก\n    ก1\n  ข\n  ค\n  ง", "mindmap").model;
  ck(D.applyDefaults(x, mm, OFF) !== x && /mermaidId="n:n1"/.test(D.applyDefaults(x, mm, OFF)), "ปิดค่าตั้งต้นทุกข้อ หน้าตาแผนผังความคิดยังใช้ (ไม่ใช่สวิตช์)");
}

console.log("\n━━ ท่อรวมกับของพัง ━━");
{
  const m = model("02-renewal");
  const all = D.applyDefaults(xmlOf("02-renewal"), m);
  ck(/jumpStyle=arc/.test(all) && /dashed=1/.test(all) && all.includes(D.SEMANTIC.start), "ไม่ส่งสวิตช์ = เปิดทุกข้อ");
  ck(!/jumpStyle/.test(D.applyDefaults(xmlOf("02-renewal"), m, { jumps: false })), "ปิดข้อเดียว ข้อนั้นไม่โผล่");
  for (const bad of ["", "<mxGraphModel><root>", "ไม่ใช่ xml", "<UserObject mermaidId=\"e:n1->\"><mxCell edge=\"1\" style=\"a\"></UserObject>"]) {
    let ok = true, out = null;
    try { out = D.applyDefaults(bad, m); } catch { ok = false; }
    ck(ok && typeof out === "string", `XML ผิดรูป ${JSON.stringify(bad.slice(0, 24))} ไม่พัง`);
  }
  ck(D.applyDefaults(xmlOf("02-renewal"), null) !== undefined, "ไม่มีโมเดล (ผังที่แก้ด้วยมือ) ไม่พัง");
}

console.log(`\n${fail.length ? "❌" : "✅"} ${pass} ผ่าน , ${fail.length} ไม่ผ่าน`);
if (SELFTEST) {
  /* โหมดพิสูจน์ตัวตรวจ: ของผิด 5 แบบต้องทำให้แดงอย่างน้อยแบบละข้อ */
  const want = ["กล่องไม่ถูกแตะ", "ไม่เหลือ exitX", "ไม่มีกล่องทับกัน", "กล่องแรกขอบเขียว", "ประเฉพาะเส้น n8"];
  const miss = want.filter((w) => !fail.some((f) => f.includes(w)));
  console.log(miss.length ? `❌ selftest: ตัวตรวจไม่จับ ${miss.join(" , ")}` : `✅ selftest: ของผิดทุกแบบถูกจับ (${fail.length} ข้อแดง)`);
  process.exit(miss.length ? 1 : 0);
}
process.exit(fail.length ? 1 : 0);
