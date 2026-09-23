// ─────────────────────────────────────────────────────────────────────────────
// ค่าตั้งต้นให้ผังอ่านง่าย (แผน FlowKit v3 เฟส 1 , D2) ขั้นแก้ XML ที่ "ปิดได้ทีละข้อ"
//
// ทุกข้อเป็นฟังก์ชัน xml → xml ที่ไม่แตะอย่างอื่น ใส่ท้ายท่อของ engine.js (หลังฟอนต์ กรอบ และยืดผัง)
// ที่มาของแต่ละข้อคือคลิปของช่อง draw.io ที่พูดซ้ำหลายคลิป (.claude/research/drawio-youtube/DIGEST.md)
// ‼️ อ่าน XML ด้วย regex แบบเดียวกับ engine.js (เทสรันใน node ที่ไม่มี DOMParser)
//    กล่องกับเส้นจาก Mermaid ห่อด้วย <UserObject mermaidId="n:n8"> / "e:n8->n5#0" ซึ่งเป็น id ของเราเอง (to-mermaid.js)
// ‼️ แก้ทั้ง style และ mermaidBaseStyle คู่กันเสมอ ไม่งั้นแก้กล่องในห้องแก้ไขแล้วสไตล์เด้งกลับ (บทเรียน restyleFont)
// ─────────────────────────────────────────────────────────────────────────────

/** สวิตช์ทั้งหมด เรียงตามแผงปรับแต่ง ค่าเริ่มต้น = เปิด (W8 ถ้าพี่ปอนด์ไม่ชอบข้อไหน เปลี่ยน on ของข้อนั้นเป็น false) */
export const DEFAULTS = [
  { key: "jumps", on: true },       // เส้นตัดกันกระโดดข้าม
  { key: "floating", on: true },    // เส้นเกาะขอบกล่องที่ใกล้สุด ไม่ตรึงจุด
  { key: "uniform", on: true },     // กล่องที่เรียงแถวเดียวกันกว้างเท่ากัน
  { key: "semantic", on: true },    // กล่องเริ่มขอบเขียว กล่องจบขอบแดง
  { key: "loops", on: true },       // เส้นวนกลับเป็นเส้นประ
];

const BLOCK = /<UserObject\b[^>]*>[\s\S]*?<\/UserObject>/g;
const attr = (s, k) => { const m = s.match(new RegExp(`\\s${k}="([^"]*)"`)); return m ? m[1] : null; };
const unesc = (s) => s.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");

/** แก้สไตล์ในบล็อกเดียว (ทั้ง style ของ mxCell และ mermaidBaseStyle) */
function restyle(block, fn) {
  return block.replace(/(\s(?:style|mermaidBaseStyle)=")([^"]*)(")/g, (_, a, st, b) => a + fn(st) + b);
}
/** ตั้งค่าสไตล์ key=value ทับของเดิม หรือเติมท้าย */
function setKeys(st, kv) {
  let out = st;
  for (const [k, v] of Object.entries(kv)) {
    const re = new RegExp(`(^|;)${k}=[^;]*`);
    out = re.test(out) ? out.replace(re, `$1${k}=${v}`) : `${out}${out && !out.endsWith(";") ? ";" : ""}${k}=${v};`;
  }
  return out;
}
const edgeIds = (block) => {
  const m = unesc(attr(block, "mermaidId") || "").match(/^e:(\w+)->(\w+)/);
  return m ? { from: m[1], to: m[2] } : null;
};
const isEdge = (block) => /<mxCell\b[^>]*\bedge="1"/.test(block);

/** ① เส้นตัดกันกระโดดข้าม (รอยโค้งเล็ก ๆ ตรงจุดตัด) ‼️ draw.io วาดรอยเฉพาะจุดที่ตัดกันจริง ผังที่ไม่มีเส้นตัดกันภาพไม่เปลี่ยน */
export function lineJumps(xml) {
  return String(xml).replace(BLOCK, (b) => isEdge(b) ? restyle(b, (st) => setKeys(st, { jumpStyle: "arc", jumpSize: "6" })) : b);
}

/** ② เส้นลอยตัว: ล้างจุดเสียบที่ Mermaid ตรึงไว้ (กลางก้น → กลางหัว) ให้ draw.io เลือกขอบที่ใกล้สุดเอง
 *  ‼️ เฉพาะผังขั้นตอนกับระบบ ผังองค์กรต้องคงจุดตายตัว (elbowEdges ใช้จุดหักร่วม) ผัง Power Automate มีกรอบซ้อนที่ fixNestedEdges ตั้งจุดไว้แล้ว
 *     ผังลู่ (grid.js) กำหนดทางเดินของเส้นเองให้ไม่ทะลุกล่อง ล้างจุดแล้วเส้นกลับไปทะลุกล่อง */
const PIN = /(^|;)(exitX|exitY|entryX|entryY|exitDx|exitDy|entryDx|entryDy|exitPerimeter|entryPerimeter)=[^;]*/g;
export function floatingEdges(xml, kind) {
  if (kind !== "steps" && kind !== "system") return String(xml);
  return String(xml).replace(BLOCK, (b) => isEdge(b) ? restyle(b, (st) => st.replace(PIN, "").replace(/^;+/, "")) : b);
}

/** ③ กล่องที่เรียงเป็นแนวเดียวกันกว้างเท่ากัน (กล่องที่กว้างสุดในแนว ไม่ใช่ทั้งผัง กันกล่องยาวกล่องเดียวลากทุกกล่อง)
 *  แนว = กล่องที่ตรงกลางอยู่แนวตั้งเดียวกัน (ผังบนลงล่าง) หรือแนวนอนเดียวกัน (ผังองค์กร พี่น้องเรียงแถว)
 *  ขยายรอบจุดกลางเดิม เส้นที่เสียบกลางกล่องจึงไม่ขยับ · ขยายแล้วชนกล่องอื่น = ข้ามแนวนั้นทั้งแนว (ไม่ขยับผัง)
 *  เฉพาะกล่องสี่เหลี่ยมกับแคปซูล (ข้าวหลามตัด หกเหลี่ยม วงกลม ขนาดตามรูปทรงของมันเอง) */
const GAP = 12;
/* ‼️ รูปทรงอยู่กลางสไตล์ได้ (จริง: "html=1;shape=hexagon;..." ภาพ 12-torture หกเหลี่ยมถูกยืด 23/09/2026) ต้องหาทั้งสาย ไม่ใช่แค่ต้นสาย */
const SHAPED = /(^|;)(rhombus|ellipse|hexagon)(;|$)|(^|;)shape=(hexagon|rhombus|ellipse|doubleEllipse)/;
/* ‼️ กล่องยาวผิดปกติ (กว้างเกิน 1.6 เท่าของค่ากลางในแนว) ไม่ใช้เป็นเป้าและไม่ถูกยืด
   ไม่งั้นกล่องข้อความยาวกล่องเดียวลากทุกกล่องในแนวยาว 940px (ภาพ 12-torture 23/09/2026) */
const OUTLIER = 1.6;
const ALIGN = 6;             // จุดกลางที่ Mermaid วางคลาดกันได้ถึง 4px ในแนวเดียวกัน (ภาพ 12-torture)
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export function uniformWidth(xml, kind) {
  xml = String(xml);
  const boxes = [];
  for (const m of xml.matchAll(BLOCK)) {
    const b = m[0];
    if (!/mermaidId="n:n\d+"/.test(b) || !/\bvertex="1"/.test(b)) continue;
    const st = attr(b.slice(b.indexOf("<mxCell")), "style") || "";
    const g = b.match(/<mxGeometry\b[^>]*>/);
    if (!g) continue;
    const num = (k) => Number(attr(g[0], k) || 0);
    boxes.push({ id: attr(b, "id"), parent: attr(b.slice(b.indexOf("<mxCell")), "parent"), rectish: !SHAPED.test(st),
      x: num("x"), y: num("y"), w: num("width"), h: num("height") });
  }
  const rows = kind === "org";
  const lines = new Map();
  for (const bx of boxes) {
    if (!bx.rectish) continue;
    const c = rows ? bx.y + bx.h / 2 : bx.x + bx.w / 2;
    let hit = null;
    for (const [k, v] of lines) if (v.parent === bx.parent && Math.abs(v.c - c) <= ALIGN) { hit = k; break; }
    if (hit == null) lines.set(lines.size, { parent: bx.parent, c, list: [bx] }); else lines.get(hit).list.push(bx);
  }
  const newW = new Map();
  for (let { list } of lines.values()) {
    const mid = median(list.map((b) => b.w));
    list = list.filter((b) => b.w <= mid * OUTLIER);
    if (list.length < 2) continue;
    const W = Math.max(...list.map((b) => b.w));
    if (list.every((b) => b.w === W)) continue;
    const grown = list.map((b) => ({ ...b, x: b.x - (W - b.w) / 2, w: W }));
    const clash = grown.some((g) => boxes.some((o) => o.parent === g.parent && o.id !== g.id && !list.some((l) => l.id === o.id) &&
      g.x - GAP < o.x + o.w && o.x < g.x + g.w + GAP && g.y - GAP < o.y + o.h && o.y < g.y + g.h + GAP));
    if (!clash) for (const g of grown) newW.set(g.id, g);
  }
  if (!newW.size) return xml;
  return xml.replace(BLOCK, (b) => {
    const g = newW.get(attr(b, "id"));
    if (!g || !/mermaidId="n:n\d+"/.test(b)) return b;
    return b.replace(/<mxGeometry\b[^>]*>/, (t) => t.replace(/\sx="[^"]*"/, ` x="${round(g.x)}"`).replace(/\swidth="[^"]*"/, ` width="${round(g.w)}"`));
  });
}
const round = (n) => Math.round(n * 100) / 100;

/** กล่องเริ่มกับกล่องจบของผังขั้นตอน (กติกาเดียวกับแคปซูลใน to-mermaid.js) และของผัง Power Automate (ตัวเริ่มกับ Terminate) */
export function startEnd(model) {
  const start = new Set(), end = new Set();
  if (!model || !["steps", "lane", "pa"].includes(model.kind)) return { start, end };
  const outgoing = new Set(model.edges.map((e) => e.from));
  model.nodes.forEach((n, i) => {
    if (n.shape === "start") start.add(n.id);
    else if (n.shape === "end") end.add(n.id);
    else if (model.kind !== "pa" && n.shape !== "ask") {
      if (i === 0) start.add(n.id);
      else if (!outgoing.has(n.id)) end.add(n.id);
    }
  });
  return { start, end };
}

/** ④ สีตามความหมาย: ขอบเขียวที่กล่องเริ่ม ขอบแดงที่กล่องจบ (ขอบเท่านั้น ไม่ถมสี ตามรสนิยม โปร่ง บาง จาง)
 *  light-dark() ให้ห้องแก้ไขธีมมืดสลับเอง ภาพที่ส่งออกใช้สีฝั่งสว่าง */
export const SEMANTIC = { start: "light-dark(#3f9a63,#6cc28c)", end: "light-dark(#c4574f,#e8877f)" };
export function semanticColor(xml, model) {
  const { start, end } = startEnd(model);
  if (!start.size && !end.size) return String(xml);
  return String(xml).replace(BLOCK, (b) => {
    const m = (attr(b, "mermaidId") || "").match(/^n:(n\d+)$/);
    const col = m && (start.has(m[1]) ? SEMANTIC.start : end.has(m[1]) ? SEMANTIC.end : null);
    return col ? restyle(b, (st) => setKeys(st, { strokeColor: col, strokeWidth: "1.5" })) : b;
  });
}

/** เส้นที่วนกลับไปหาขั้นก่อนหน้า = เส้นที่ปิดวงในกราฟ (เดินลึกจากกล่องแรกแล้วเจอกล่องที่ยังอยู่บนทางเดิน)
 *  คิดจากโมเดล ไม่ต้องให้ตัวอ่านข้อความจำว่าเส้นไหนมาจาก กลับไป: (บรรจบกิ่งไปกล่องที่อยู่ข้างหน้าไม่นับ) */
export function backEdges(model) {
  const out = new Set();
  if (!model || !model.nodes.length) return out;
  const next = new Map();
  for (const e of model.edges) (next.get(e.from) || next.set(e.from, []).get(e.from)).push(e.to);
  const state = new Map();             // 1 = อยู่บนทางเดิน , 2 = เดินจบแล้ว
  const visit = (id) => {
    state.set(id, 1);
    for (const to of next.get(id) || []) {
      if (state.get(to) === 1) out.add(`${id}>${to}`);
      else if (!state.has(to)) visit(to);
    }
    state.set(id, 2);
  };
  for (const n of model.nodes) if (!state.has(n.id)) visit(n.id);
  return out;
}

/** ⑤ เส้นวนกลับเป็นเส้นประ เห็นทันทีว่าเป็นทางย้อน ไม่ใช่ทางเดินหลัก */
export function dashedLoops(xml, model) {
  /* ‼️ เฉพาะผังขั้นตอน ผังระบบวนไปกลับเป็นเรื่องปกติของข้อมูลที่ไหลสองทาง (เห็นจากภาพ 08-system เส้นประขึ้นมั่ว 23/09/2026) */
  if (!model || (model.kind !== "steps" && model.kind !== "lane")) return String(xml);
  const back = backEdges(model);
  if (!back.size) return String(xml);
  return String(xml).replace(BLOCK, (b) => {
    const e = isEdge(b) && edgeIds(b);
    return e && back.has(`${e.from}>${e.to}`) ? restyle(b, (st) => setKeys(st, { dashed: "1", dashPattern: "6 4" })) : b;
  });
}

/** ท่อรวม on = { jumps, floating, uniform, semantic, loops } ข้อที่ไม่ได้ส่งมาถือว่าเปิด
 *  ‼️ พังข้อไหน คืน xml ก่อนข้อนั้น ผังต้องวาดได้เสมอแม้ค่าตั้งต้นพัง */
export function applyDefaults(xml, model, on = {}) {
  const kind = model && model.kind;
  const steps = [
    ["loops", (x) => dashedLoops(x, model)],
    ["semantic", (x) => semanticColor(x, model)],
    ["uniform", (x) => uniformWidth(x, kind)],
    ["floating", (x) => floatingEdges(x, kind)],
    ["jumps", (x) => lineJumps(x)],
  ];
  let out = String(xml);
  for (const [k, fn] of steps) {
    if (on[k] === false) continue;
    try { out = fn(out); } catch { /* ข้ามข้อนี้ */ }
  }
  return out;
}
