/* FlowKit v3 เฟส 2: เครื่องยนต์ตาราง (src/grid.js) ผังลู่ "ใครทำอะไร"
 * อ่าน XML ที่ได้แล้วเช็คเรขาคณิตจริง: กล่องอยู่ในลู่ของฝ่ายตัวเอง , ไม่มีกล่องทับกัน , เส้นครบและไม่ทะลุกล่อง ,
 * คอลัมน์ตามลำดับขั้น , ข้อความเดิมได้ XML เดิมทุกไบต์ , คำเตือน (ไม่มีฝ่าย , ขั้นที่ไม่มีฝ่าย , กว้างเกินสไลด์)
 * ภาพจริงของทุกเคส: .claude/evidence/flowkit-v3-2026-09-23/phase2/shots/ (เทสนี้จับ "ถูกที่" ภาพจับ "ดูดี")
 * รัน: node tests/flow_grid.test.mjs   (--selftest = ตัวตรวจต้องจับของผิดได้) */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
await import("./_loader/register.mjs");
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const { toGridXml, MAX_LANES } = await imp("src/grid.js");
const { parseText } = await imp("src/parse.js");
const { TEMPLATES } = await imp("src/templates.js");
const { applyDefaults } = await imp("src/defaults.js");
const SELFTEST = process.argv.includes("--selftest");
const SNAP = "1a63d9d18c99cd1b";   // sha256 16 ตัวแรกของ XML ผัง lane-complaint แบบ h (ดูข้อ snapshot ข้างล่าง)

let pass = 0; const fail = [];
const ck = (ok, msg, detail = "") => {
  if (ok) { pass++; console.log("  ✅ " + msg); }
  else { fail.push(msg); console.log("  ❌ " + msg + (detail ? "\n      " + detail : "")); }
};
/* ความกว้างข้อความแบบคงที่ (node ไม่มี canvas) หน้าเว็บใช้ measureText จริง เทสนี้เช็คตรรกะการวาง ไม่ใช่ความพอดีของตัวอักษร */
const measure = (t, px) => [...String(t)].filter((c) => !/\p{M}/u.test(c)).length * px * 0.6;
const gold = (n) => readFileSync(join(ROOT, "tests/flow_golden", n + ".txt"), "utf8");
const tpl = (id, lang = "th") => TEMPLATES.find((t) => t.id === id).text[lang];

const CASES = {
  "05-swimlane": gold("05-swimlane"),
  "lane-approval": tpl("lane-approval"), "lane-approval-en": tpl("lane-approval", "en"),
  "lane-complaint": tpl("lane-complaint"), "lane-complaint-en": tpl("lane-complaint", "en"),
  loop: "[ผู้ขอ] ส่งเอกสาร\n[ธุรการ] ตรวจเอกสาร\nครบไหม?\n  ไม่ครบ: [ผู้ขอ] แก้เอกสาร\n    กลับไป: ตรวจเอกสาร\n  ครบ: [บัญชี] ตั้งเบิก\n[การเงิน] โอนเงิน",
  parallel: "[ขาย] รับคำสั่งซื้อ\n[คลัง] ตรวจสต็อก\nพร้อมกัน:\n  [คลัง] แพ็กสินค้า\n  [บัญชี] ออกใบกำกับภาษี\n  [ขนส่ง] จองรถขนส่ง\n[ขนส่ง] ส่งของ\n[ขาย] แจ้งเลขพัสดุให้ลูกค้า",
  nested: "[ทีมงาน] ส่งงาน\n[ผู้ตรวจ] หลักฐานครบไหม?\n  ไม่ครบ: [ทีมงาน] แก้ตามคอมเมนต์\n    กลับไป: ส่งงาน\n  ครบ: ลองใช้งานจริง\n    ผ่านไหม?\n      ผ่าน: [เจ้าของงาน] อนุมัติ\n      ไม่ผ่าน: [ทีมงาน] จับค่าจริงแล้วแก้\n        กลับไป: ลองใช้งานจริง\n[ทีมงาน] ปิดงาน",
};

/** แกะ XML: ลู่ , กล่อง (พิกัดสัมบูรณ์) , เส้น (ต้นทาง ปลายทาง จุดหัก จุดเสียบ) */
function read(xml) {
  const lanes = new Map(), boxes = [], edges = [];
  const num = (s, k) => { const m = s.match(new RegExp(`\\s${k}="([^"]*)"`)); return m ? Number(m[1]) : 0; };
  for (const m of xml.matchAll(/<mxCell id="(L\d+)"[^>]*>\s*<mxGeometry([^>]*)>/g)) lanes.set(m[1], { x: num(m[2], "x"), y: num(m[2], "y"), w: num(m[2], "width"), h: num(m[2], "height") });
  for (const m of xml.matchAll(/<mxCell id="H(\d+)" value="([^"]*)"/g)) lanes.get("L" + m[1]).title = m[2];
  for (const m of xml.matchAll(/<mxCell id="(L\d+)" value="([^"]+)" style="swimlane/g)) lanes.get(m[1]).title = m[2];
  for (const m of xml.matchAll(/<UserObject label="([^"]*)" mermaidId="n:(n\d+)"[^>]*><mxCell style="([^"]*)" vertex="1" parent="(L\d+)"><mxGeometry([^>]*)>/g)) {
    const L = lanes.get(m[4]);
    boxes.push({ id: m[2], text: m[1], style: m[3], lane: m[4], x: L.x + num(m[5], "x"), y: L.y + num(m[5], "y"), w: num(m[5], "width"), h: num(m[5], "height") });
  }
  for (const m of xml.matchAll(/<UserObject label="([^"]*)" mermaidId="e:([^"]+)"[^>]*><mxCell style="([^"]*)" edge="1" parent="1" source="(n\d+)" target="(n\d+)"><mxGeometry[^>]*>(.*?)<\/mxGeometry>/g)) {
    const pts = [...m[6].matchAll(/<mxPoint x="([-\d.]+)" y="([-\d.]+)"\/>/g)].map((p) => ({ x: +p[1], y: +p[2] }));
    edges.push({ label: m[1], from: m[4], to: m[5], style: m[3], pts });
  }
  return { lanes, boxes, edges };
}
const overlap = (a, b, pad = 0) => a.x - pad < b.x + b.w && b.x < a.x + a.w + pad && a.y - pad < b.y + b.h && b.y < a.y + a.h + pad;
/** ทางเดินจริงของเส้น (จุดออก → จุดหัก → จุดเข้า) จากจุดเสียบในสไตล์ เส้นที่ไม่มีจุดหักและอยู่แถวเดียวกันเป็นเส้นตรง */
function path(e, byId) {
  const a = byId.get(e.from), b = byId.get(e.to);
  const g = (k) => { const m = e.style.match(new RegExp(`(^|;)${k}=([\\d.]+)`)); return m ? +m[2] : null; };
  const p0 = { x: a.x + a.w * (g("exitX") ?? 1), y: a.y + a.h * (g("exitY") ?? 0.5) };
  const p1 = { x: b.x + b.w * (g("entryX") ?? 0), y: b.y + b.h * (g("entryY") ?? 0.5) };
  return [p0, ...e.pts, p1];
}
function throughBoxes(e, boxes, byId) {
  const p = path(e, byId), hit = [];
  for (let i = 0; i + 1 < p.length; i++) {
    const s = { x: Math.min(p[i].x, p[i + 1].x), y: Math.min(p[i].y, p[i + 1].y) };
    s.w = Math.abs(p[i].x - p[i + 1].x) || 0.01; s.h = Math.abs(p[i].y - p[i + 1].y) || 0.01;
    for (const bx of boxes) if (bx.id !== e.from && bx.id !== e.to && overlap(s, { x: bx.x + 2, y: bx.y + 2, w: bx.w - 4, h: bx.h - 4 })) hit.push(bx.text);
  }
  return hit;
}

/* --selftest: ทำ XML ให้ผิดโดยตั้งใจ ตัวตรวจแต่ละข้อต้องแดง */
const BREAK = SELFTEST ? {
  lane: (x) => x.replace(/(mermaidId="n:n2"[^>]*><mxCell style="[^"]*" vertex="1" parent=")L\d+/, "$1L1"),           // ย้ายกล่องไปผิดลู่
  overlap: (x) => x.replace(/(mermaidId="n:n3"[\s\S]*?<mxGeometry )x="[\d.]+" y="[\d.]+"/, (m, a) => {
    const n2 = x.match(/mermaidId="n:n2"[\s\S]*?<mxGeometry x="([\d.]+)" y="([\d.]+)"/); return `${a}x="${n2[1]}" y="${n2[2]}"`; }),   // วางทับกล่องก่อนหน้า
  edges: (x) => x.replace(/<UserObject label="[^"]*" mermaidId="e:[^"]+"[\s\S]*?<\/UserObject>/, ""),                  // เส้นหายหนึ่งเส้น
  route: (x) => x.replace(/<Array as="points">[\s\S]*?<\/Array>/g, "").replace(/exitX=1;exitY=0.5;entryX=0;entryY=0.5;/g, ""), // ปล่อยให้เดินตรง
} : {};
const gridOf = (text, look) => {
  const m = parseText(text, "lane").model;
  let g = toGridXml(m, { measure, look });
  if (g.xml) for (const f of Object.values(BREAK)) g = { ...g, xml: f(g.xml) };
  return { m, g };
};

for (const look of ["h", "v", "hc"]) {
  console.log(`\n━━ แบบ ${look} ━━`);
  for (const [name, text] of Object.entries(CASES)) {
    const { m, g } = gridOf(text, look);
    const { lanes, boxes, edges } = read(g.xml || "");
    const byId = new Map(boxes.map((b) => [b.id, b]));
    const titles = [...new Set(m.nodes.map((n) => m.groups.find((x) => x.id === n.group)?.title))];
    const wrongLane = boxes.filter((b) => lanes.get(b.lane).title !== (m.groups.find((x) => x.id === m.nodes.find((n) => n.id === b.id).group)?.title));
    const clashes = []; for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (overlap(boxes[i], boxes[j], 8)) clashes.push(`${boxes[i].text}/${boxes[j].text}`);
    const outside = boxes.filter((b) => { const L = lanes.get(b.lane); return b.x < L.x || b.y < L.y || b.x + b.w > L.x + L.w || b.y + b.h > L.y + L.h; });
    const through = edges.flatMap((e) => throughBoxes(e, boxes, byId).map((t) => `${byId.get(e.from).text} → ${byId.get(e.to).text} ทะลุ ${t}`));
    const fine = g.xml && lanes.size === titles.length && boxes.length === m.nodes.length;
    ck(fine, `[${name}] ${titles.length} ลู่ตามฝ่ายที่เจอ เรียงตามลำดับที่เขียน ${m.nodes.length} กล่อง`,
      `ลู่ ${lanes.size} (${[...lanes.values()].map((l) => l.title)}) กล่อง ${boxes.length}`);
    ck([...lanes.values()].map((l) => l.title).join() === titles.join(), `[${name}] ลำดับลู่ = ลำดับที่ฝ่ายโผล่ครั้งแรก`);
    ck(!wrongLane.length && !outside.length, `[${name}] ทุกกล่องอยู่ในลู่ของฝ่ายตัวเองและไม่ล้นลู่`, [...wrongLane, ...outside].map((b) => b.text).join());
    ck(!clashes.length, `[${name}] ไม่มีกล่องทับหรือชิดกันเกิน 8px`, clashes.join(" | "));
    ck(edges.length === m.edges.length, `[${name}] เส้นครบ ${m.edges.length} เส้น`, `ได้ ${edges.length}`);
    ck(!through.length, `[${name}] ไม่มีเส้นทะลุกล่อง`, through.join(" | "));
  }
}

console.log("\n━━ คอลัมน์ตามลำดับขั้น (แบบ h) ━━");
{
  const { m, g } = gridOf(CASES["lane-approval"], "h");
  const { boxes } = read(g.xml);
  const cx = (t) => { const b = boxes.find((x) => x.text === t); return b.x + b.w / 2; };
  ck(cx("อนุมัติ") === cx("อนุมัติวงเงินสูง"), "สองกิ่งของคำถามอยู่คอลัมน์เดียวกัน (คนละลู่)");
  ck(cx("ออกใบสั่งซื้อ") > cx("อนุมัติวงเงินสูง") && cx("ยื่นใบขอซื้อ") < cx("ตรวจใบขอซื้อ"), "ขั้นถัดไปอยู่ขวาเสมอ จุดบรรจบอยู่ถัดกิ่ง");
  ck(g.cols === 7 && g.lanes === 5, `7 คอลัมน์ 5 ลู่ (${g.cols} , ${g.lanes})`);
  const p = gridOf(CASES.parallel, "h"), pb = read(p.g.xml).boxes;
  const pc = (t) => pb.find((x) => x.text === t).x + pb.find((x) => x.text === t).w / 2;
  ck(pc("แพ็กสินค้า") === pc("ออกใบกำกับภาษี") && pc("ออกใบกำกับภาษี") === pc("จองรถขนส่ง"), "งานขนาน 3 งานอยู่คอลัมน์เดียวกัน");
  const lp = gridOf(CASES.loop, "h"), le = read(lp.g.xml).edges;
  const back = le.find((e) => e.pts.length && /exitY=1;entryX=0.5;entryY=1/.test(e.style));
  ck(!!back, "เส้นวนกลับออกใต้กล่อง อ้อมใต้ลู่ แล้วเข้าใต้กล่องปลายทาง");
  ck(/dashed=1/.test(applyDefaults(lp.g.xml, lp.m)), "ค่าตั้งต้น เส้นวนกลับเป็นเส้นประ ใช้กับผังลู่ได้ทันที");
  ck(/light-dark\(#3f9a63/.test(applyDefaults(lp.g.xml, lp.m)), "ค่าตั้งต้น สีกล่องเริ่ม ใช้กับผังลู่ได้ทันที");
  const flo = applyDefaults(lp.g.xml, lp.m);
  ck((flo.match(/exitX=/g) || []).length === (lp.g.xml.match(/exitX=/g) || []).length, "ค่าตั้งต้น เส้นลอยตัว ไม่ล้างจุดเสียบของผังลู่ (ไม่งั้นเส้นกลับไปทะลุกล่อง)");
}

console.log("\n━━ ข้อความเดิม = XML เดิมทุกไบต์ ━━");
{
  const a = gridOf(CASES["lane-complaint"], "h").g.xml, b = gridOf(CASES["lane-complaint"], "h").g.xml;
  ck(a === b, "วาดสองรอบได้ XML เหมือนกันทุกไบต์");
  const h = createHash("sha256").update(a).digest("hex").slice(0, 16);
  /* ‼️ เปลี่ยน grid.js แล้วเลขนี้เปลี่ยน = ตั้งใจเปลี่ยนหน้าตา ต้องเปิดภาพดูก่อน (phase2/lane.py) แล้วค่อยอัปเดตเลข */
  ck(SELFTEST || h === SNAP, `snapshot lane-complaint ${h}`, `เดิม ${SNAP}`);
}

console.log("\n━━ คำเตือนและของพัง ━━");
{
  const none = toGridXml(parseText("เริ่ม\nทำงาน\nจบงาน", "lane").model, { measure });
  ck(none.xml === null && none.warnings.length === 1 && /\[/.test(none.warnings[0].text), "ไม่มีฝ่ายเลย: ไม่วาดลู่ว่าง บอกวิธีใส่ [ฝ่าย]");
  const orphan = toGridXml(parseText("รับเรื่อง\n[บัญชี] ตรวจ\n[การเงิน] จ่าย", "lane").model, { measure });
  const or = read(orphan.xml);
  ck(orphan.warnings.some((w) => w.text.includes("รับเรื่อง")) && [...or.lanes.values()][0].title === "ไม่ระบุฝ่าย", "ขั้นที่ไม่มีฝ่าย: ลู่ ไม่ระบุฝ่าย พร้อมคำเตือนที่บอกชื่อขั้น");
  const many = Array.from({ length: MAX_LANES + 1 }, (_, i) => `[ฝ่าย${i + 1}] งาน${i + 1}`).join("\n");
  ck(toGridXml(parseText(many, "lane").model, { measure }).warnings.some((w) => /สไลด์/.test(w.text)), `เกิน ${MAX_LANES} ลู่ เตือนว่ากว้างเกินสไลด์`);
  const html = read(toGridXml(parseText("[ฝ่าย <b>] <img src=x onerror=alert(1)> & ต่อ\n[คลัง] ส่ง | ของ", "lane").model, { measure }).xml);
  ck(html.boxes[0].text === "&amp;lt;img src=x onerror=alert(1)&amp;gt; &amp;amp; ต่อ" && [...html.lanes.values()][0].title === "ฝ่าย &amp;lt;b&amp;gt;",
    "ข้อความผู้ใช้ถูกกัน HTML ก่อนเข้า html=1 (ไม่กลายเป็นแท็ก)", html.boxes[0].text + " | " + [...html.lanes.values()][0].title);
  ck(html.boxes[1].text === "ส่ง&lt;br&gt;ของ", "ขีดตั้ง | ในข้อความ = ขึ้นบรรทัดในกล่อง (กติกาเดิม)", html.boxes[1].text);
}

console.log(`\n${fail.length ? "❌" : "✅"} ${pass} ผ่าน , ${fail.length} ไม่ผ่าน`);
if (SELFTEST) {
  const want = ["ทุกกล่องอยู่ในลู่ของฝ่ายตัวเอง", "ไม่มีกล่องทับ", "เส้นครบ", "ไม่มีเส้นทะลุกล่อง"];
  const miss = want.filter((w) => !fail.some((f) => f.includes(w)));
  console.log(miss.length ? `❌ selftest: ตัวตรวจไม่จับ ${miss.join(" , ")}` : `✅ selftest: ของผิดทุกแบบถูกจับ (${fail.length} ข้อแดง)`);
  process.exit(miss.length ? 1 : 0);
}
process.exit(fail.length ? 1 : 0);
