// ─────────────────────────────────────────────────────────────────────────────
// ผังตาราง 3 แบบ (แผน FlowKit v3 เฟส 5 , SPEC 3.4) ปุ่มเดียว "ตาราง" รู้แบบจากบรรทัดแรกเอง
//
//   ตารางอำนาจ   งาน \ ตำแหน่ง: เจ้าหน้าที่, หัวหน้างาน, ผู้จัดการ     ← บรรทัดแรกมี \ = หัวมุม \ หัวคอลัมน์
//                ซื้อไม่เกิน 10,000: ทำ, อนุมัติ, -                   ← ชื่อแถว: ค่าตามคอลัมน์ (- = ว่าง)
//   สี่ช่อง       แกนนอน: ด่วน | ไม่ด่วน   แกนตั้ง: สำคัญ | ไม่สำคัญ   ด่วน+สำคัญ: ทำเอง, วันนี้
//   เส้นทางลูกค้า  ช่วง: รู้จัก, สนใจ   แล้ว ทำอะไร: เห็นโฆษณา, เข้าเว็บ   (มิติ: ค่าตามช่วง)
//
// ‼️ , คั่นช่อง (คงกติกาเดิม " | " = ขึ้นบรรทัดในกล่อง ยกเว้นบรรทัดแกนของสี่ช่องที่ | คั่นสองฝั่ง)
// ‼️ จำนวนช่องต้องตรงหัว ไม่ตรง = บอกบรรทัดและจำนวนที่ต้องมี ไม่เติมหรือตัดให้เงียบ ๆ
// ผลเป็น FlowModel ที่มี table = { variant, corner, cols, rows: [{ label, cells }] } ตัววาดคือ toTableXml ใน grid.js
// ─────────────────────────────────────────────────────────────────────────────
import { tr } from "./shared.js";
import { newModel, FlowError } from "./model.js";

const AXIS_X = /^(แกนนอน|แนวนอน|x|horizontal)\s*[:：]\s*(.+)$/i;
const AXIS_Y = /^(แกนตั้ง|แนวตั้ง|y|vertical)\s*[:：]\s*(.+)$/i;
const STAGES = /^(ช่วง|ขั้น|stages?|phases?)\s*[:：]\s*(.+)$/i;
/* ‼️ จุลภาคที่ตามด้วยเลข 3 ตัวคือหลักพัน (1,000) ไม่ใช่ตัวคั่นช่อง */
const splitCells = (s) => s.split(/[,，](?!\d{3}(?:\D|$))/).map((c) => c.trim());
const splitAxis = (s) => s.split(/\s+\|\s+/).map((c) => c.trim()).filter(Boolean);
const rowOf = (line) => {
  const m = line.text.match(/^(.+?)\s*[:：]\s*(.*)$/);
  if (!m) throw new FlowError(line.no, tr("แถวต้องเขียนเป็น ชื่อแถว: ค่า, ค่า, ค่า", "A row is written as row name: value, value, value"),
    tr(`เช่น ${line.text}: ทำ, อนุมัติ`, `For example: ${line.text}: do, approve`));
  return { label: m[1].trim(), cells: m[2] ? splitCells(m[2]) : [] };
};

export function parseTable(lines, warnings = []) {
  const m = newModel("table");
  m.warnings.push(...warnings);
  for (const l of lines) if (l.indent) throw new FlowError(l.no, tr("ตารางไม่ใช้ย่อหน้า ทุกบรรทัดชิดซ้าย", "Tables use no indents, keep every line flush left"),
    tr("ลบวรรคหน้าบรรทัดนี้", "Remove the spaces at the start of this line"));
  const first = lines[0];
  let t;
  if (AXIS_X.test(first.text) || AXIS_Y.test(first.text)) t = quadrant(lines);
  else if (STAGES.test(first.text)) t = grid(lines, "journey");
  else if (/\\/.test(first.text.split(/[:：]/)[0])) t = grid(lines, "authority");
  else throw new FlowError(first.no, tr("บรรทัดแรกของตารางบอกไม่ได้ว่าเป็นตารางแบบไหน", "The first line does not say what kind of table this is"),
    tr("ตารางอำนาจ: งาน \\ ตำแหน่ง: ก, ข   สี่ช่อง: แกนนอน: ด่วน | ไม่ด่วน   เส้นทางลูกค้า: ช่วง: รู้จัก, สนใจ",
       "Authority: task \\ role: A, B   Four boxes: x: urgent | not urgent   Journey: stages: aware, interested"));
  m.table = t;
  /* กล่องในโมเดล = ทุกช่องที่มีข้อความ (นับกล่อง ตั้งชื่อไฟล์ ข้อความอ่านหน้าจอ ใช้ร่วมกับผังชนิดอื่น) */
  const add = (text) => { if (text && text !== "-") m.nodes.push({ id: "n" + (m.nodes.length + 1), text, shape: "cell", group: null }); };
  add(t.corner); t.cols.forEach(add); for (const r of t.rows) { add(r.label); r.cells.forEach(add); }
  return m;
}

/** ตารางอำนาจกับเส้นทางลูกค้า: บรรทัดแรก = หัวคอลัมน์ บรรทัดต่อไป = แถว */
function grid(lines, variant) {
  const head = variant === "journey" ? lines[0].text.match(STAGES) : lines[0].text.match(/^(.+?)\s*[:：]\s*(.+)$/);
  if (!head) throw new FlowError(lines[0].no, tr("บรรทัดแรกต้องมีหัวคอลัมน์หลัง :", "The first line needs the column names after :"));
  const corner = variant === "journey" ? head[1].trim() : head[1].trim();
  const cols = splitCells(head[2]);
  if (cols.length < 2) throw new FlowError(lines[0].no, tr("ต้องมีอย่างน้อย 2 คอลัมน์ คั่นด้วย ,", "At least 2 columns, separated by ,"));
  if (lines.length < 2) throw new FlowError(lines[0].no, tr("ยังไม่มีแถว เขียนแถวถัดจากบรรทัดนี้", "No rows yet, write them below this line"),
    variant === "journey" ? tr("เช่น ทำอะไร: เห็นโฆษณา, เข้าเว็บ", "For example: doing: sees an ad, visits the site")
                          : tr("เช่น ซื้อไม่เกิน 10,000: ทำ, อนุมัติ", "For example: buy up to 10,000: do, approve"));
  const rows = lines.slice(1).map((l) => {
    const r = rowOf(l);
    if (r.cells.length !== cols.length) throw new FlowError(l.no,
      tr(`แถวนี้มี ${r.cells.length} ช่อง แต่หัวมี ${cols.length} คอลัมน์`, `This row has ${r.cells.length} values but there are ${cols.length} columns`),
      tr("ใส่ค่าให้ครบทุกคอลัมน์ ช่องที่ว่างใส่ -", "Give every column a value, use - for an empty one"));
    return r;
  });
  return { variant, corner, cols, rows };
}

/** สี่ช่อง: แกนนอน 2 ค่า แกนตั้ง 2 ค่า แล้ว ค่านอน+ค่าตั้ง: รายการ (สลับข้างของ + ได้) */
function quadrant(lines) {
  let xs = null, ys = null;
  const put = [];
  for (const l of lines) {
    const x = l.text.match(AXIS_X), y = l.text.match(AXIS_Y);
    if (x || y) {
      const v = splitAxis((x || y)[2]);
      if (v.length !== 2) throw new FlowError(l.no, tr(`แกนต้องมี 2 ค่า คั่นด้วย | (มี ${v.length})`, `An axis needs 2 values separated by | (found ${v.length})`),
        tr("เช่น แกนนอน: ด่วน | ไม่ด่วน", "For example: x: urgent | not urgent"));
      if (x) xs = v; else ys = v;
      continue;
    }
    put.push(l);
  }
  if (!xs || !ys) throw new FlowError(lines[0].no, tr("สี่ช่องต้องมีทั้ง แกนนอน: และ แกนตั้ง:", "Four boxes need both x: and y:"),
    tr("เช่น แกนนอน: ด่วน | ไม่ด่วน แล้วบรรทัดถัดไป แกนตั้ง: สำคัญ | ไม่สำคัญ", "For example x: urgent | not urgent, then y: important | not important"));
  const cells = [[[], []], [[], []]];            // [แถวแกนตั้ง][คอลัมน์แกนนอน]
  for (const l of put) {
    const r = rowOf(l);
    const parts = r.label.split(/\s*\+\s*/);
    const xi = parts.findIndex((p) => xs.includes(p)), yi = parts.findIndex((p) => ys.includes(p));
    if (parts.length !== 2 || xi < 0 || yi < 0 || xi === yi) throw new FlowError(l.no, tr(`"${r.label}" ไม่ตรงกับช่องไหน`, `"${r.label}" does not match any box`),
      tr(`เขียนเป็น ค่าแกนนอน+ค่าแกนตั้ง เช่น ${xs[0]}+${ys[0]}: รายการ`, `Write x value+y value, like ${xs[0]}+${ys[0]}: items`));
    cells[ys.indexOf(parts[yi])][xs.indexOf(parts[xi])].push(...r.cells.filter((c) => c && c !== "-"));
  }
  return { variant: "quadrant", corner: "", cols: xs, rows: ys.map((label, i) => ({ label, cells: cells[i].map((c) => c.join(" | ") || "-") })) };
}
