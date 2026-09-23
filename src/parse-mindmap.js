// ─────────────────────────────────────────────────────────────────────────────
// แผนผังความคิด mind map (แผน FlowKit v3 เฟส 6) ย่อหน้า = กิ่ง แบบเดียวกับผังองค์กร
// ต่างจากผังองค์กร 2 ข้อ: ① ข้อความซ้ำคนละกิ่ง = คนละกล่อง (mind map เป็นต้นไม้ ไม่รวมกล่อง)
//                         ② หัวข้อกลางได้หัวข้อเดียว (บรรทัดชิดซ้ายบรรทัดเดียว)
// พิสูจน์ 23/09/2026 (PROVEN เฟส 0 ข้อ ฉ) ตัวฝังวาด Mermaid mindmap ได้ ไทยครบ
// ─────────────────────────────────────────────────────────────────────────────
import { tr } from "./shared.js";
import { newModel, FlowError } from "./model.js";

export function parseMindmap(lines, warnings = []) {
  const m = newModel("mindmap");
  m.warnings.push(...warnings);
  const stack = [];
  for (const line of lines) {
    if (line.indent === 0 && m.nodes.length) {
      throw new FlowError(line.no, tr("แผนผังความคิดมีหัวข้อกลางได้หัวข้อเดียว (บรรทัดชิดซ้ายบรรทัดเดียว)", "A mind map has one centre topic (one line flush left)"),
        tr("ย่อหน้าบรรทัดนี้ให้เป็นกิ่งของหัวข้อกลาง หรือแยกเป็นอีกผัง", "Indent this line to make it a branch of the centre topic, or make it a separate map"));
    }
    const n = { id: "n" + (m.nodes.length + 1), text: line.text.trim(), shape: line.indent ? "step" : "start", group: null };
    m.nodes.push(n);
    stack.length = line.indent;
    const parent = stack[line.indent - 1];
    if (parent) m.edges.push({ from: parent, to: n.id, label: "", style: "plain" });
    stack[line.indent] = n.id;
  }
  if (m.nodes.length === 1) m.warnings.push({ line: lines[0].no, text: tr("ยังไม่มีกิ่ง ย่อหน้าบรรทัดถัดไปเพื่อเพิ่มกิ่ง", "No branches yet, indent the next lines to add them") });
  return m;
}
