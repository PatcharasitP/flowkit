// ─────────────────────────────────────────────────────────────────────────────
// ทางเข้า ① พิมพ์เป็นข้อความ → FlowModel  (ชนิดผังจากหัวไฟล์ ผัง: ... ก่อน ไม่มีค่อยใช้ปุ่มที่เลือกบนจอ)
// ─────────────────────────────────────────────────────────────────────────────
import { tr } from "./shared.js";
import { FlowError } from "./model.js";
import { prepare } from "./parse-common.js";
import { parseSteps } from "./parse-steps.js";
import { parseOrg } from "./parse-org.js";
import { parseSystem } from "./parse-system.js";
import { parseTimeline } from "./parse-timeline.js";
import { parseTable } from "./parse-table.js";
import { parseMindmap } from "./parse-mindmap.js";

/* ผังลู่ (ใครทำอะไร , แผน v3 D3) ใช้ตัวอ่านผังขั้นตอนตัวเดียวกันทุกกติกา ต่างกันแค่ตัววาด (grid.js แทน Mermaid) */
const PARSERS = { steps: parseSteps, lane: parseSteps, org: parseOrg, system: parseSystem, timeline: parseTimeline, table: parseTable, mindmap: parseMindmap };
/** ผังใหญ่เกินเท่านี้ใส่สไลด์เดียวอ่านยาก (D6 , หลุม H3) */
export const BIG_DIAGRAM = 25;

/** ป้ายตอนชี้ของบรรทัด → กล่องที่ข้อความของบรรทัดนั้นลงท้ายด้วยข้อความของกล่อง (หลัง ป้ายกิ่ง: หรือ [ฝ่าย]) เลือกกล่องที่ยาวสุดที่ตรง
 *  บรรทัดที่ไม่ใช่กล่อง (เช่นเส้นของผังระบบ A -> B: ส่งข้อมูล) เตือนแทนการเดา */
function attachTips(model, lines) {
  for (const l of lines) {
    if (!l.tip) continue;
    const hit = model.nodes.filter((n) => l.text === n.text || l.text.endsWith(" " + n.text) || l.text.endsWith("]" + n.text) || l.text.endsWith(":" + n.text))
      .sort((a, b) => b.text.length - a.text.length)[0];
    if (hit) hit.tip = hit.tip ? `${hit.tip} | ${l.tip}` : l.tip;
    else model.warnings.push({ line: l.no, text: tr("ป้ายตอนชี้ (( )) ใส่ได้ท้ายบรรทัดที่เป็นกล่อง บรรทัดนี้ไม่มีกล่อง จึงไม่ได้ใส่ป้าย",
      "A hover note (( )) goes at the end of a line that is a box, this line has no box so the note was left out") });
  }
}

/** @returns {{ model } | { error: FlowError }} ไม่โยนออกไป หน้าเว็บจะได้โชว์ข้อผิดพลาดพร้อมเลขบรรทัดได้เสมอ */
export function parseText(text, uiKind = "steps") {
  try {
    const { head, lines, warnings } = prepare(text);
    if (!lines.length) return { empty: true, kind: head.kind || uiKind };
    const kind = head.kind || uiKind;
    const model = PARSERS[kind](lines, warnings);
    model.kind = kind;
    if (kind === "table") {
      /* ช่องตารางไม่มีป้ายตอนชี้ บอกตรง ๆ ไม่ใส่ผิดช่องเงียบ ๆ */
      for (const l of lines) if (l.tip) model.warnings.push({ line: l.no, text: tr("ตารางยังไม่มีป้ายตอนชี้ (( )) ข้อความในวงเล็บคู่ถูกข้ามไป", "Tables have no hover notes yet, the (( )) text was left out") });
    } else attachTips(model, lines);
    if (head.title) model.title = head.title;
    if (head.dir) model.dir = head.dir;
    if (model.nodes.length > BIG_DIAGRAM) {
      model.warnings.push({ line: 0, text: tr(`มี ${model.nodes.length} กล่อง เกิน ${BIG_DIAGRAM} ใส่สไลด์เดียวจะอ่านยาก ลองแบ่งเป็นสองผัง`,
        `${model.nodes.length} boxes, more than ${BIG_DIAGRAM} is hard to read on one slide, try splitting it`) });
    }
    return { model };
  } catch (e) {
    if (e instanceof FlowError) return { error: e };
    throw e;
  }
}
