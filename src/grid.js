// ─────────────────────────────────────────────────────────────────────────────
// เครื่องยนต์ตาราง (แผน FlowKit v3 เฟส 2 , D1) ผัง "ใครทำอะไร" (swimlane) จาก FlowModel ของผังขั้นตอน
//
// ทำไมไม่ผ่าน Mermaid: Mermaid ทำลู่ไม่ได้ ได้แค่กรอบกลุ่มที่เหลื่อมกัน และตัวจัดวางของ draw.io ไม่รู้จักลู่ (PROVEN 22/09 P3 P4)
// ตัวนี้คำนวณตำแหน่งเองทั้งหมด (ลู่ = แถว , ลำดับขั้น = คอลัมน์) แล้วเขียน XML ของ draw.io ตรง ๆ
// ส่งเข้าตัวฝังตัวเดิมทาง load xml (พิสูจน์แล้ว 23/09 เฟส 0 ข้อ ก: ลู่จาก XML ที่เขียนเองวาดถูก เปิดกลับได้)
//
// ‼️ ข้อความเดิม = XML เดิมทุกไบต์ (ไม่มีสุ่ม ไม่มีเวลา) เทสเทียบ snapshot ได้
// ‼️ กล่องกับเส้นใช้ mermaidId แบบเดียวกับผังจาก Mermaid (n:n3 , e:n3->n4#0) ค่าตั้งต้นใน defaults.js จึงใช้ได้ทันทีไม่ต้องเขียนใหม่
// ‼️ ความกว้างกล่องมาจาก measure() ที่ผู้เรียกส่งมา หน้าเว็บใช้ canvas measureText ฟอนต์ Sarabun (PROVEN 23/09 ข้อ 5: ตรงกับที่ draw.io วาด)
//    ไม่ใช้สูตรนับตัวอักษร (คลาด 7 ถึง 20px)
// ─────────────────────────────────────────────────────────────────────────────
import { tr } from "./shared.js";
import { backEdges } from "./defaults.js";

const FONT = `fontFamily=Sarabun;fontSource=${encodeURIComponent("https://fonts.googleapis.com/css?family=Sarabun")}`;
export const PX = 14;                       // ขนาดตัวอักษรในกล่อง (ค่าที่พิสูจน์ความพอดีแล้วในเฟส 0)
const PAD = 14, MINW = 120, MAXW = 220, LINE = 20;
const HEAD = 130;                           // หัวลู่ด้านซ้าย (แบบแนวนอน) กว้างพอให้ชื่อฝ่ายไทยไม่ต้องหมุน
const HEAD_V = 40;                          // หัวลู่ด้านบน (แบบแนวตั้ง)
const INSET = 28;                           // ระยะจากขอบลู่ถึงกล่องแรก
const GAP = 56, GAP_V = 56;                 // ช่องระหว่างคอลัมน์ / แถว (กว้างขึ้นเองเมื่อเส้นในช่องนั้นมีป้าย เฟส 0 ข้อ ก: ป้ายเบียด)
const LANE_PAD = 26;                        // ขอบบนล่างในลู่ (ล่างใช้เป็นทางเดินของเส้นวนกลับ)
export const MAX_LANES = 8, MAX_COLS = 14;  // เกินนี้กว้างเกินสไลด์ (SPEC 3.1)
const ASK_DIAMOND_MAX = 13;                 // กติกาเดียวกับ to-mermaid.js คำถามสั้น = ข้าวหลามตัด ยาว = หกเหลี่ยม

const INK = "#14161c", LINE_COL = "#8a8f98";
const LANE_LINE = "light-dark(#cfccc5,#4a505c)";
/* แถบหัวลู่สีจางตามฝ่าย (แบบ ค ของ W7) วนสีเมื่อฝ่ายเกิน ทุกสีจางพอให้ตัวหนังสือดำอ่านได้ */
const TINTS = ["#eef2fb", "#eef7f1", "#fbf3e8", "#f6eefa", "#eaf6f7", "#fbeeee", "#f3f4e6", "#eef0f3"];
const UNASSIGNED = "#f1f1f1";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** ข้อความในกล่อง: html=1 จึงต้องกัน HTML ของผู้ใช้ก่อน แล้ว " | " = ขึ้นบรรทัด (กติกาเดิมของ FlowKit) */
const label = (t) => String(t).split(" | ").map((s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")).join("<br>");
const visibleLen = (t) => [...String(t)].filter((c) => !/\p{M}/u.test(c)).length;

/** ขนาดกล่องจากความกว้างข้อความจริง */
function boxSize(node, measure) {
  const lines = String(node.text).split(" | ");
  const tw = Math.max(...lines.map((l) => measure(l, PX)));
  if (node.shape === "ask") {
    if (visibleLen(node.text) <= ASK_DIAMOND_MAX && lines.length === 1) return { w: Math.max(120, Math.ceil(tw * 1.5 + 40)), h: 76, shape: "diamond" };
    const w = Math.min(260, Math.max(130, Math.ceil(tw + 2 * PAD + 30)));
    const n = lines.reduce((a, l) => a + Math.max(1, Math.ceil(measure(l, PX) * 1.08 / (w - 2 * PAD - 30))), 0);
    return { w, h: Math.max(56, n * LINE + 22), shape: "hexagon" };
  }
  const w = Math.min(MAXW, Math.max(MINW, Math.ceil(tw + 2 * PAD)));
  const inner = w - 2 * PAD;
  const n = lines.reduce((a, l) => a + Math.max(1, Math.ceil(measure(l, PX) * (measure(l, PX) > inner ? 1.08 : 1) / inner)), 0);
  return { w, h: Math.max(44, n * LINE + 20), shape: "box" };
}

/**
 * @param {object} model FlowModel ของผังขั้นตอน (กล่องมี group = ฝ่าย)
 * @param {{ measure: (text: string, px: number) => number, look?: "h" | "v" | "hc" }} opts
 *   look: h = ลู่แนวนอนหัวซ้าย , hc = แบบ h แต่หัวลู่สีจางตามฝ่าย , v = ลู่แนวตั้งหัวบน
 * @returns {{ xml: string|null, lanes: number, cols: number, warnings: {line, text}[] }}
 *   xml = null เมื่อทั้งผังไม่มี [ฝ่าย] เลย (ผู้เรียกวาดเป็นผังขั้นตอนธรรมดาแทน)
 */
export function toGridXml(model, { measure, look = "h" } = {}) {
  const warnings = [];
  const nodes = model.nodes;
  if (!nodes.some((n) => n.group)) {
    warnings.push({ line: 0, text: tr("ยังไม่มีฝ่ายสักขั้น เขียน [ชื่อฝ่าย] หน้าขั้นที่เปลี่ยนคนทำ เช่น [บัญชี] ตรวจเอกสาร ตอนนี้วาดเป็นผังขั้นตอนธรรมดาไปก่อน",
      "No team on any step yet. Write [team] before the step where the owner changes, like [Finance] Check the papers. Drawn as a normal process for now") });
    return { xml: null, lanes: 0, cols: 0, warnings };
  }

  /* ── ลู่: ฝ่ายละลู่ เรียงตามลำดับที่เจอครั้งแรก (คนพิมพ์ตั้งใจเรียงมาแล้ว) ขั้นที่ไม่มีฝ่ายไปลู่ "ไม่ระบุฝ่าย" ── */
  const title = new Map(model.groups.map((g) => [g.id, g.title]));
  const laneKeys = [];
  for (const n of nodes) { const k = n.group || ""; if (!laneKeys.includes(k)) laneKeys.push(k); }
  const laneOf = new Map(nodes.map((n) => [n.id, laneKeys.indexOf(n.group || "")]));
  const orphans = nodes.filter((n) => !n.group);
  if (orphans.length) warnings.push({ line: 0, text: tr(`มี ${orphans.length} ขั้นที่ยังไม่ได้ระบุฝ่าย (เช่น "${orphans[0].text}") อยู่ในลู่สีเทา ใส่ [ชื่อฝ่าย] หน้าขั้นนั้น`,
    `${orphans.length} step(s) have no team yet (like "${orphans[0].text}"), they sit in the grey lane. Put [team] before the step`) });

  /* ── คอลัมน์: ทางเดินที่ยาวที่สุดจากต้นผัง ไม่นับเส้นวนกลับ กิ่งของคำถามอยู่คอลัมน์เดียวกัน จุดบรรจบอยู่ถัดกิ่งที่ยาวสุด ── */
  const back = backEdges(model);
  const fwd = model.edges.filter((e) => !back.has(`${e.from}>${e.to}`));
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of fwd) indeg.set(e.to, indeg.get(e.to) + 1);
  const col = new Map(nodes.map((n) => [n.id, 0]));
  const queue = nodes.filter((n) => !indeg.get(n.id)).map((n) => n.id);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const e of fwd) if (e.from === id) {
      col.set(e.to, Math.max(col.get(e.to), col.get(id) + 1));
      indeg.set(e.to, indeg.get(e.to) - 1);
      if (!indeg.get(e.to)) queue.push(e.to);
    }
  }
  const nCols = Math.max(...col.values()) + 1;

  /* ── แถวย่อยในลู่: กล่องที่อยู่ลู่เดียวกันคอลัมน์เดียวกัน (กิ่งขนาน) ซ้อนลงไปทีละแถว ลู่สูงขึ้นเอง ── */
  const sub = new Map(), slots = new Map();
  for (const n of nodes) {
    const k = `${laneOf.get(n.id)}:${col.get(n.id)}`;
    const i = slots.get(k) || 0;
    sub.set(n.id, i); slots.set(k, i + 1);
  }
  const laneRows = laneKeys.map((_, l) => Math.max(1, ...nodes.filter((n) => laneOf.get(n.id) === l).map((n) => sub.get(n.id) + 1)));

  if (laneKeys.length > MAX_LANES || nCols > MAX_COLS) warnings.push({ line: 0, text: tr(
    `มี ${laneKeys.length} ลู่ ${nCols} คอลัมน์ ผังจะกว้างเกินสไลด์ (ไม่เกิน ${MAX_LANES} ลู่ ${MAX_COLS} คอลัมน์อ่านง่ายกว่า) ลองแบ่งเป็นสองผัง`,
    `${laneKeys.length} lanes and ${nCols} columns will be wider than a slide (up to ${MAX_LANES} lanes and ${MAX_COLS} columns reads better), try splitting it`) });

  /* ── ขนาด ── */
  const size = new Map(nodes.map((n) => [n.id, boxSize(n, measure)]));
  const colW = Array.from({ length: nCols }, (_, c) => Math.max(0, ...nodes.filter((n) => col.get(n.id) === c).map((n) => size.get(n.id).w)));
  const colH = Array.from({ length: nCols }, (_, c) => Math.max(0, ...nodes.filter((n) => col.get(n.id) === c).map((n) => size.get(n.id).h)));
  const labelW = (c) => Math.max(0, ...fwd.filter((e) => e.label && col.get(e.from) === c).map((e) => measure(e.label, PX - 1)));
  const vert = look === "v";
  const gap = Array.from({ length: nCols }, (_, c) => Math.ceil(vert ? Math.max(GAP_V, labelW(c) ? 64 : 0) : Math.max(GAP, labelW(c) + 36)));
  const maxH = Math.max(...[...size.values()].map((s) => s.h));
  const maxW = Math.max(...[...size.values()].map((s) => s.w));
  const ROW = maxH + 36;                    // แถวย่อยในลู่แนวนอน
  const SUBW = maxW + 40;                   // คอลัมน์ย่อยในลู่แนวตั้ง

  /* ── ตำแหน่ง: แนวนอน ลู่เป็นแถว คอลัมน์ไล่ซ้ายไปขวา / แนวตั้ง ลู่เป็นคอลัมน์ ขั้นไล่บนลงล่าง ── */
  const along = [];                         // ตำแหน่งเริ่มของแต่ละคอลัมน์ตามทิศเดิน
  let run = (vert ? HEAD_V : HEAD) + INSET;
  for (let c = 0; c < nCols; c++) { along.push(run); run += (vert ? colH[c] : colW[c]) + (c < nCols - 1 ? gap[c] : 0); }
  const flowLen = run + INSET;
  const lanes = [];                          // { x, y, w, h } สัมบูรณ์
  let acc = 0;
  for (let l = 0; l < laneKeys.length; l++) {
    const thick = vert ? laneRows[l] * SUBW + 2 * 12 : laneRows[l] * ROW - 36 + 2 * LANE_PAD;
    lanes.push(vert ? { x: acc, y: 0, w: thick, h: flowLen } : { x: 0, y: acc, w: flowLen, h: thick });
    acc += thick;
  }
  const pos = new Map();                     // ตำแหน่งกล่องนับจากมุมลู่ของมัน
  for (const n of nodes) {
    const s = size.get(n.id), c = col.get(n.id), r = sub.get(n.id);
    pos.set(n.id, vert
      ? { x: 12 + r * SUBW + (SUBW - s.w) / 2, y: along[c] + (colH[c] - s.h) / 2 }
      : { x: along[c] + (colW[c] - s.w) / 2, y: LANE_PAD + r * ROW + (ROW - 36 - s.h) / 2 });
  }
  const abs = (id) => { const p = pos.get(id), L = lanes[laneOf.get(id)], s = size.get(id); return { x: L.x + p.x, y: L.y + p.y, w: s.w, h: s.h }; };

  /* ── XML ── */
  const r2 = (v) => Math.round(v * 100) / 100;
  const out = ['<mxGraphModel dx="0" dy="0" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>'];
  laneKeys.forEach((k, l) => {
    const L = lanes[l], name = k ? title.get(k) : tr("ไม่ระบุฝ่าย", "No team");
    const tint = !k ? UNASSIGNED : look === "hc" ? TINTS[l % TINTS.length] : "light-dark(#f4f3f0,#23262d)";
    if (vert) {
      out.push(`<mxCell id="L${l + 1}" value="${esc(label(name))}" style="swimlane;horizontal=1;startSize=${HEAD_V};html=1;whiteSpace=wrap;collapsible=0;fillColor=${tint};swimlaneFillColor=none;strokeColor=${LANE_LINE};fontColor=${INK};fontStyle=1;fontSize=${PX};${FONT};" vertex="1" parent="1"><mxGeometry x="${r2(L.x)}" y="${r2(L.y)}" width="${r2(L.w)}" height="${r2(L.h)}" as="geometry"/></mxCell>`);
    } else {
      out.push(`<mxCell id="L${l + 1}" value="" style="rounded=0;html=1;container=1;collapsible=0;fillColor=none;strokeColor=${LANE_LINE};" vertex="1" parent="1"><mxGeometry x="${r2(L.x)}" y="${r2(L.y)}" width="${r2(L.w)}" height="${r2(L.h)}" as="geometry"/></mxCell>`);
      out.push(`<mxCell id="H${l + 1}" value="${esc(label(name))}" style="rounded=0;html=1;whiteSpace=wrap;fillColor=${tint};strokeColor=${LANE_LINE};fontColor=${INK};fontStyle=1;fontSize=${PX};spacing=8;${FONT};" vertex="1" parent="L${l + 1}"><mxGeometry x="0" y="0" width="${HEAD}" height="${r2(L.h)}" as="geometry"/></mxCell>`);
    }
  });
  const outgoing = new Set(model.edges.map((e) => e.from));
  const first = nodes[0].id;
  for (const n of nodes) {
    const s = size.get(n.id), p = pos.get(n.id);
    const capsule = n.shape !== "ask" && (n.shape === "start" || n.shape === "end" || n.id === first || !outgoing.has(n.id));
    const shape = s.shape === "diamond" ? "rhombus;" : s.shape === "hexagon" ? "shape=hexagon;perimeter=hexagonPerimeter2;fixedSize=1;size=12;"
      : capsule ? "rounded=1;arcSize=50;" : "rounded=0;";
    const st = `${shape}html=1;whiteSpace=wrap;fillColor=default;strokeColor=${LINE_COL};strokeWidth=1;fontColor=${INK};fontSize=${PX};${FONT};`;
    out.push(`<UserObject label="${esc(label(n.text))}" mermaidId="n:${n.id}" id="${n.id}"><mxCell style="${st}" vertex="1" parent="L${laneOf.get(n.id) + 1}"><mxGeometry x="${r2(p.x)}" y="${r2(p.y)}" width="${s.w}" height="${s.h}" as="geometry"/></mxCell></UserObject>`);
  }
  /* ── เส้น ──
     ‼️ เส้นข้ามลู่ปล่อยให้ตัวหักฉากของ draw.io เลือกทางเองแล้วทะลุกล่องที่อยู่คอลัมน์เดียวกันในลู่อื่น (ภาพ parallel-hc.png , spec-approval-v.png 23/09/2026)
        จึงกำหนดทางเอง: ออกด้านหน้า (ขวา หรือ ล่าง) เดินใน "ทางเดิน" คือช่องว่างระหว่างคอลัมน์ ซึ่งไม่มีกล่องแน่นอน แล้วเข้าด้านหลังของปลายทาง
        ลองทางเดินหน้าปลายทางก่อน ชนกล่อง ลองทางเดินหลังต้นทาง ชนทั้งคู่ใช้ทางแรก
     ทำงานในพิกัด u (ตามทิศเดิน) v (ขวางทิศเดิน) แล้วค่อยแปลงเป็น x y ตามแบบลู่ */
  const U = (r) => vert ? { u: r.y, v: r.x, lu: r.h, lv: r.w } : { u: r.x, v: r.y, lu: r.w, lv: r.h };
  const XY = (u, v) => vert ? `x="${r2(v)}" y="${r2(u)}"` : `x="${r2(u)}" y="${r2(v)}"`;
  const colEnd = (c) => along[c] + (vert ? colH[c] : colW[c]);
  const rects = nodes.map((n) => ({ id: n.id, ...U(abs(n.id)) }));
  const hits = (pts, skip) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      const u0 = Math.min(a.u, b.u), u1 = Math.max(a.u, b.u), v0 = Math.min(a.v, b.v), v1 = Math.max(a.v, b.v);
      if (rects.some((r) => !skip.includes(r.id) && u0 < r.u + r.lu - 2 && r.u + 2 < u1 + 0.01 && v0 < r.v + r.lv - 2 && r.v + 2 < v1 + 0.01)) return true;
    }
    return false;
  };
  const PIN_FWD = vert ? "exitX=0.5;exitY=1;entryX=0.5;entryY=0;" : "exitX=1;exitY=0.5;entryX=0;entryY=0.5;";
  const seen = new Map();
  for (const e of model.edges) {
    const key = `${e.from}->${e.to}`, k = seen.get(key) || 0; seen.set(key, k + 1);
    const isBack = back.has(`${e.from}>${e.to}`);
    const a = U(abs(e.from)), b = U(abs(e.to));
    let pin = PIN_FWD, pts = [];
    if (isBack) {
      /* เส้นวนกลับ: อ้อมใต้ลู่ (แนวนอน) หรือขวาลู่ (แนวตั้ง) ไม่ลากทะลุกล่องที่อยู่ระหว่างทาง */
      const La = U(lanes[laneOf.get(e.from)]), Lb = U(lanes[laneOf.get(e.to)]);
      const vb = Math.max(La.v + La.lv, Lb.v + Lb.lv) - 8;
      pin = vert ? "exitX=1;exitY=0.5;entryX=1;entryY=0.5;" : "exitX=0.5;exitY=1;entryX=0.5;entryY=1;";
      pts = [{ u: a.u + a.lu / 2, v: vb }, { u: b.u + b.lu / 2, v: vb }];
    } else {
      const sv = a.v + a.lv / 2, tv = b.v + b.lv / 2;
      if (Math.abs(sv - tv) > 0.5) {
        const cs = col.get(e.from), ct = col.get(e.to);
        const before = ct > 0 ? along[ct] - gap[ct - 1] / 2 : b.u - INSET / 2;
        const after = colEnd(cs) + gap[cs] / 2;
        const path = (m) => [{ u: a.u + a.lu, v: sv }, { u: m, v: sv }, { u: m, v: tv }, { u: b.u, v: tv }];
        const m = !hits(path(before), [e.from, e.to]) ? before : !hits(path(after), [e.from, e.to]) ? after : before;
        pts = [{ u: m, v: sv }, { u: m, v: tv }];
      }
    }
    const arr = pts.length ? `<Array as="points">${pts.map((p) => `<mxPoint ${XY(p.u, p.v)}/>`).join("")}</Array>` : "";
    /* ‼️ พื้นป้ายขาวทึบ (ไม่ใช่ default) ไม่งั้นเส้นที่หักผ่านตรงป้ายขีดทับตัวหนังสือ (ภาพ 05-swimlane-h.png "ไม่จำเป็น") */
    const st = `edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;endSize=7;strokeColor=${LINE_COL};strokeWidth=1;fontColor=#585d68;fontSize=${PX - 1};labelBackgroundColor=light-dark(#ffffff,#16181d);${pin}${FONT};`;
    out.push(`<UserObject label="${esc(label(e.label || ""))}" mermaidId="e:${esc(key)}#${k}" id="e${out.length}"><mxCell style="${st}" edge="1" parent="1" source="${e.from}" target="${e.to}"><mxGeometry relative="1" as="geometry">${arr}</mxGeometry></mxCell></UserObject>`);
  }
  out.push("</root></mxGraphModel>");
  return { xml: out.join(""), lanes: laneKeys.length, cols: nCols, warnings };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ผังตาราง 3 แบบ (แผน v3 เฟส 5) โหมด "ตารางล้วน" ไม่มีเส้นเชื่อม ช่องเป็นสี่เหลี่ยมชิดกันแบบตาราง
 * ✋W9 (พี่ปอนด์เคาะ 23/09/2026 ตามที่ฟ้าแนะนำ): สีจางตามคำเฉพาะตารางอำนาจ (ทำ ตรวจ อนุมัติ ต่างกันเห็นทันที) ที่เหลือขาวดำ
 * ───────────────────────────────────────────────────────────────────────────── */
/** คำในช่องของตารางอำนาจ → สีจาง (รองรับ RACI ด้วย) คำอื่นไม่มีสี */
const ROLE_TINT = [
  [/^(ทำ|ผู้ทำ|จัดทำ|r|do|does|responsible)$/i, "#eef2fb"],
  [/^(ตรวจ|ตรวจสอบ|ให้ความเห็น|เสนอ|c|review|reviews|consulted|check|checks)$/i, "#fbf3e8"],
  [/^(อนุมัติ|ผู้อนุมัติ|ลงนาม|a|approve|approves|accountable|sign|signs)$/i, "#eef7f1"],
  [/^(รับทราบ|แจ้ง|i|informed|fyi)$/i, "#f6eefa"],
];
export const roleTint = (t) => (ROLE_TINT.find(([re]) => re.test(String(t).trim())) || [null, null])[1];

/**
 * @param {object} model FlowModel ที่มี table (parse-table.js)
 * @param {{ measure: (text: string, px: number) => number }} opts
 * @returns {{ xml: string, rows: number, cols: number }}
 */
export function toTableXml(model, { measure }) {
  const t = model.table, quad = t.variant === "quadrant";
  const grid = [[t.corner, ...t.cols], ...t.rows.map((r) => [r.label, ...r.cells])];
  const lines = (s) => String(s === "-" ? "" : s).split(" | ");
  const MIN_W = quad ? 170 : 96, MAX_W = quad ? 240 : 220, MIN_H = quad ? 110 : 44;
  const nC = grid[0].length;
  const colW = Array.from({ length: nC }, (_, c) => Math.min(MAX_W, Math.max(c === 0 && quad ? 110 : MIN_W,
    Math.ceil(Math.max(...grid.map((row) => Math.max(...lines(row[c]).map((l) => measure(l, PX))))) + 2 * PAD))));
  const rowH = grid.map((row, r) => Math.max(r === 0 ? 44 : MIN_H, Math.max(...row.map((v, c) =>
    lines(v).reduce((a, l) => a + Math.max(1, Math.ceil(measure(l, PX) * 1.08 / (colW[c] - 2 * PAD))), 0) * LINE + 20))));
  const r2 = (v) => Math.round(v * 100) / 100;
  const out = ['<mxGraphModel dx="0" dy="0" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>'];
  let y = 0;
  grid.forEach((row, r) => {
    let x = 0;
    row.forEach((v, c) => {
      const head = r === 0 || c === 0;
      const tint = head ? (r === 0 && c === 0 && !v ? "none" : "light-dark(#f4f3f0,#23262d)")
        : t.variant === "authority" ? (roleTint(v) || "default") : "default";
      const st = `rounded=0;html=1;whiteSpace=wrap;fillColor=${tint};strokeColor=${LANE_LINE};fontColor=${INK};fontSize=${PX};${head ? "fontStyle=1;" : ""}`
        + `${quad && !head ? "verticalAlign=top;align=left;spacingLeft=10;spacingTop=8;" : ""}${FONT};`;
      const val = v === "-" ? "" : label(v);
      out.push(`<mxCell id="c${r}_${c}" value="${esc(val)}" style="${st}" vertex="1" parent="1"><mxGeometry x="${r2(x)}" y="${r2(y)}" width="${colW[c]}" height="${rowH[r]}" as="geometry"/></mxCell>`);
      x += colW[c];
    });
    y += rowH[r];
  });
  out.push("</root></mxGraphModel>");
  return { xml: out.join(""), rows: grid.length, cols: nC };
}
