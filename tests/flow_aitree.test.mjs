/* FlowKit ฝัง AI: ผังขั้นตอนกับผังลู่ให้ AI ตอบเป็นโครงข้อมูล แล้วโค้ดเขียนย่อหน้าเอง (src/ai-tree.js)
 * ที่มา: วัดจริง 24/10/2026 ให้ AI เขียนข้อความย่อหน้าเอง Haiku อ่านผ่าน 7/12 Sonnet 9/12 Opus 11/12 (พลาดเรื่องย่อหน้าทั้งหมด)
 * ตรวจ: โครงทุกแบบที่ schema ยอม แปลงแล้วตัวอ่านผังต้องอ่านผ่าน และได้กล่อง เส้น ป้าย ตรงกับโครงจริง
 * ‼️ ถ้าผิดจะรู้ได้ยังไง: --selftest แปลงด้วยตัวแปลงที่ย่อหน้าแบบขั้นบันได (แบบที่ AI พลาด) ต้องแดง
 * รัน: node tests/flow_aitree.test.mjs   (--selftest) */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
await import("./_loader/register.mjs");
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const { toFlowText, treeSchema, TREE_DEPTH } = await imp("src/ai-tree.js");
const { parseText } = await imp("src/parse.js");
const SELFTEST = process.argv.includes("--selftest");

let pass = 0; const fail = [];
const ck = (ok, msg, detail = "") => {
  if (ok) { pass++; console.log("  ✅ " + msg); }
  else { fail.push(msg); console.log("  ❌ " + msg + (detail ? "\n      " + detail : "")); }
};
/* selftest: ตัวแปลงที่ย่อหน้าลึกขึ้นทีละขั้นแบบที่ Haiku เขียน (ขั้นต่อจากขั้นแรกของกิ่งลึกขึ้นทีละชั้น) */
const conv = SELFTEST
  ? (tree, kind, lang) => toFlowText(tree, kind, lang).split("\n").map((l, i, a) => (i > 0 && /^ {4,}/.test(l) && /^ {4,}/.test(a[i - 1]) && !/[?:]\s*$/.test(a[i - 1]) ? "  " + l : l)).join("\n")
  : toFlowText;
const read = (tree, kind = "steps", lang = "th") => {
  const text = conv(tree, kind, lang);
  const r = parseText(text, kind);
  return { text, r, m: r.model };
};
const edgeSet = (m) => m.edges.map((e) => `${m.nodes.find((n) => n.id === e.from).text}>${m.nodes.find((n) => n.id === e.to).text}${e.label ? "|" + e.label : ""}`).sort();

/* ── ร้านซ่อม (โครงที่ Haiku ตอบจริง 24/10/2026) ── */
{
  const tree = { title: "ซ่อมมือถือ", steps: [
    { step: "ลูกค้านำเครื่องมาส่ง" }, { step: "ช่างตรวจอาการ" },
    { question: "ซ่อมได้ไหม", answers: [
      { label: "ได้", steps: [{ step: "แจ้งราคา" }, { question: "ลูกค้าตกลงไหม?", answers: [
        { label: "ตกลง", steps: [{ step: "ซ่อมเครื่อง" }, { step: "โทรให้มารับ" }, { end: true }] },
        { label: "ไม่ตกลง", steps: [{ step: "คืนเครื่อง" }, { end: true }] }] }] },
      { label: "ไม่ได้", steps: [{ step: "แจ้งว่าซ่อมไม่ได้" }, { end: true }] }] }] };
  const { text, r, m } = read(tree);
  ck(m && !r.error, "โครงซ้อนสองชั้นแปลงแล้วอ่านผ่าน", r.error ? `บรรทัด ${r.error.line}: ${r.error.message}\n${text}` : "");
  ck(m && m.title === "ซ่อมมือถือ", "ชื่อผังมาด้วย");
  ck(m && m.nodes.find((n) => n.text === "ซ่อมได้ไหม?" && n.shape === "ask"), "คำถามที่ลืม ? ได้ ? และเป็นกล่องคำถาม");
  ck(m && JSON.stringify(edgeSet(m)) === JSON.stringify([
    "ช่างตรวจอาการ>ซ่อมได้ไหม?", "ซ่อมได้ไหม?>แจ้งราคา|ได้", "ซ่อมได้ไหม?>แจ้งว่าซ่อมไม่ได้|ไม่ได้", "ซ่อมเครื่อง>โทรให้มารับ",
    "ลูกค้าตกลงไหม?>คืนเครื่อง|ไม่ตกลง", "ลูกค้าตกลงไหม?>ซ่อมเครื่อง|ตกลง", "ลูกค้านำเครื่องมาส่ง>ช่างตรวจอาการ", "แจ้งราคา>ลูกค้าตกลงไหม?"].sort()),
    "เส้นและป้ายตรงกับโครงทุกเส้น", m ? edgeSet(m).join(" , ") : "");
}
/* ── กิ่งบรรจบ: ขั้นหลังคำถามต่อจากทุกกิ่งที่ยังไม่จบ ── */
{
  const { r, m, text } = read({ title: "", steps: [
    { question: "ของพอไหม", answers: [{ label: "พอ", steps: [{ step: "ชงกาแฟ" }] }, { label: "ไม่พอ", steps: [{ step: "โทรแจ้งลูกค้า" }, { goto: "ของพอไหม" }] }, { label: "รอ", steps: [] }] },
    { step: "ส่งไรเดอร์" }] });
  ck(m && !r.error, "กิ่งว่าง กับ กลับไป อ่านผ่าน", r.error ? `${r.error.message}\n${text}` : "");
  ck(m && edgeSet(m).includes("ชงกาแฟ>ส่งไรเดอร์") && edgeSet(m).includes("ของพอไหม?>ส่งไรเดอร์|รอ") && edgeSet(m).includes("โทรแจ้งลูกค้า>ของพอไหม?") && !edgeSet(m).some((e) => e.startsWith("โทรแจ้งลูกค้า>ส่ง")),
    "กิ่งที่ไม่จบมาบรรจบขั้นถัดไป กิ่งว่างพาป้ายไปด้วย กิ่งที่วนกลับไม่บรรจบ", m ? edgeSet(m).join(" , ") : "");
}
/* ── คำตอบพาไปคำถามเลย แล้วมีขั้นต่อหลังคำถามนั้นในกิ่งเดียวกัน ── */
{
  const { r, m, text } = read({ title: "", steps: [{ question: "สมาชิกไหม", answers: [
    { label: "ใช่", steps: [{ question: "แต้มพอไหม", answers: [{ label: "พอ", steps: [{ step: "ใช้แต้ม" }] }, { label: "ไม่พอ", steps: [] }] }, { step: "สะสมแต้มเพิ่ม" }] },
    { label: "ไม่ใช่", steps: [{ step: "สมัครสมาชิก" }] }] }, { step: "ชำระเงิน" }] });
  ck(m && !r.error && edgeSet(m).includes("ใช้แต้ม>สะสมแต้มเพิ่ม") && edgeSet(m).includes("สะสมแต้มเพิ่ม>ชำระเงิน") && edgeSet(m).includes("สมัครสมาชิก>ชำระเงิน"),
    "คำถามซ้อนเป็นขั้นแรกของกิ่ง แล้วมีขั้นต่อในกิ่งนั้น", r.error ? `${r.error.message}\n${text}` : m && edgeSet(m).join(" , "));
}
/* ── ข้อความซ้ำกล่องเดิม = บรรจบกล่องนั้น กิ่งจบตรงนั้น ── */
{
  const { r, m, text } = read({ title: "", steps: [{ step: "ตรวจเอกสาร" }, { question: "ครบไหม", answers: [
    { label: "ครบ", steps: [{ step: "คืนเอกสาร" }, { end: true }] }, { label: "ไม่ครบ", steps: [{ step: "แจ้งแก้" }, { step: "คืนเอกสาร" }, { end: true }] }] }] });
  ck(m && !r.error && m.nodes.filter((n) => n.text === "คืนเอกสาร").length === 1 && edgeSet(m).includes("แจ้งแก้>คืนเอกสาร"), "ขั้นซ้ำเป็นกล่องเดียวกัน ไม่พัง", r.error ? `${r.error.message}\n${text}` : "");
}
/* ── ข้อความแปลก ── */
{
  const { r, m, text } = read({ title: "x", steps: [{ question: "ผล: ผ่านไหม", answers: [{ label: "ผ่าน: ใช่", steps: [{ step: "บันทึกผล?" }] }, { label: "ไม่ผ่าน", steps: [{ step: "จบ" }] }] }, { step: "  " }, { step: "แจ้งผล" }] });
  ck(m && !r.error && m.nodes.some((n) => n.text === "บันทึกผล" && n.shape === "step") && edgeSet(m).some((e) => /\|ผ่าน ใช่$/.test(e)),
    "ป้ายที่มี : ไม่แตกบรรทัด ขั้นที่ลงท้าย ? ไม่กลายเป็นคำถาม ขั้นว่างถูกข้าม", r.error ? `${r.error.message}\n${text}` : m && edgeSet(m).join(" , "));
}
/* ── ผังลู่: [ฝ่าย] ทุกขั้นที่มี team ── */
{
  const { r, m, text } = read({ title: "", steps: [{ step: "กรอกใบเบิก", team: "พนักงาน" }, { question: "อนุมัติไหม", team: "หัวหน้า", answers: [
    { label: "อนุมัติ", steps: [{ step: "จ่ายของ", team: "คลัง" }] }, { label: "ไม่อนุมัติ", steps: [{ end: true }] }] }, { step: "เซ็นรับ", team: "พนักงาน" }] }, "lane");
  const grp = (t) => { const n = m && m.nodes.find((x) => x.text === t); const g = n && m.groups.find((x) => x.id === n.group); return g && g.title; };
  ck(m && !r.error && grp("กรอกใบเบิก") === "พนักงาน" && grp("อนุมัติไหม?") === "หัวหน้า" && grp("จ่ายของ") === "คลัง" && grp("เซ็นรับ") === "พนักงาน",
    "ผังลู่ทุกกล่องอยู่ลู่ของฝ่ายที่ AI บอก", r.error ? `${r.error.message}\n${text}` : "");
}
/* ── หน้าอังกฤษ ── */
{
  const { r, m, text } = read({ title: "Repair", steps: [{ question: "Can fix", answers: [{ label: "Yes", steps: [{ step: "Fix it" }, { end: true }] }, { label: "No", steps: [{ step: "Return it" }, { goto: "Can fix" }] }] }] }, "steps", "en");
  ck(m && !r.error && /^title: Repair/.test(text) && /stop/.test(text) && /back to: Can fix\?/.test(text), "หน้าอังกฤษใช้ title stop back to", r.error ? `${r.error.message}\n${text}` : text);
}
/* ── schema ── */
{
  const s = treeSchema("lane"), t = JSON.stringify(s);
  const objs = []; (function walk(o) { if (o && typeof o === "object") { if (o.type === "object") objs.push(o); Object.values(o).forEach(walk); } })(s);
  ck(objs.length > 5 && objs.every((o) => o.additionalProperties === false), "ทุก object ใน schema ปิด additionalProperties (API บังคับ วัดจริง E15)");
  ck(Object.keys(s.$defs).length === TREE_DEPTH + 1 && !/"\$ref":"#\/\$defs\/s0"[^}]*\$defs/.test(t) && !t.includes(`s${TREE_DEPTH + 1}`), `ซ้อนได้ ${TREE_DEPTH} ชั้น ไม่มีอ้างวนกลับ (API ไม่รับ circular 400)`);
  ck(/"team"/.test(JSON.stringify(treeSchema("lane"))) && !/"team"/.test(JSON.stringify(treeSchema("steps"))), "ผังลู่มีช่อง team ผังขั้นตอนไม่มี");
}

console.log(`\n${pass} ผ่าน , ${fail.length} ไม่ผ่าน`);
if (SELFTEST) {
  const need = ["โครงซ้อนสองชั้นแปลงแล้วอ่านผ่าน", "เส้นและป้ายตรงกับโครงทุกเส้น", "คำถามซ้อนเป็นขั้นแรกของกิ่ง แล้วมีขั้นต่อในกิ่งนั้น"];   // เคสที่มีขั้นต่อกันใต้กิ่งสองบรรทัดขึ้นไป
  const miss = need.filter((n) => !fail.includes(n));
  console.log(miss.length ? `❌ selftest: ย่อหน้าขั้นบันไดแล้วไม่แดง ${miss.join(" , ")}` : `✅ selftest: ย่อหน้าขั้นบันไดแดง ${fail.length} ข้อ`);
  process.exit(miss.length ? 1 : 0);
}
process.exit(fail.length ? 1 : 0);
