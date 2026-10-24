// ─────────────────────────────────────────────────────────────────────────────
// ผังขั้นตอนกับผังลู่: ให้ AI ตอบเป็นโครงข้อมูล แล้วโค้ดนี้เขียนข้อความ FlowKit (ย่อหน้า ป้าย จบ กลับไป) เอง
//
// ‼️ วัดจริง 24/10/2026 ให้ AI เขียนข้อความย่อหน้าเอง ผังที่มีคำถามแตกกิ่ง ตัวอ่านอ่านผ่าน Haiku 7/12 Sonnet 9/12 Opus 11/12
//    ที่พลาดทั้งหมดคือย่อหน้า (ลึกขึ้นทีละขั้น , ลืมย่อหน้าใต้คำตอบ) ส่วนเนื้อผังถูก จึงให้ AI ตอบแค่เนื้อ ย่อหน้าเป็นงานของโค้ด
// ‼️ API ไม่รับ schema ที่อ้างตัวเอง (400 Circular reference) จึงคลี่เป็น s0..s4 ซ้อนได้ 4 ชั้น ชั้นสุดท้ายไม่มีคำถาม
//    และทุก object ต้องปิด additionalProperties (400 วัดจริงใน E15)
// ‼️ ตัวแปลงไม่เดาความหมาย ทำแค่ตามกติกาตัวอ่าน (parse-steps.js): ข้อความซ้ำ = กล่องเดิม กิ่งจบตรงนั้น ,
//    หลัง จบ หรือ กลับไป ไม่เขียนต่อ (ตัวอ่านถือว่าไม่มีทางเข้า) , กลับไป: ที่ไม่มีกล่องปลายทาง ปล่อยให้ตัวอ่านแจ้งแล้วซ่อมรอบสอง
// ─────────────────────────────────────────────────────────────────────────────
export const TREE_DEPTH = 4;
export const TREE_KINDS = ["steps", "lane"];

const WORD = { th: { title: "ชื่อ", end: "จบ", back: "กลับไป", next: "ต่อ" }, en: { title: "title", end: "stop", back: "back to", next: "next" } };
const END = /^(จบ|จบงาน|stop)$/i;
const pad = (d) => "  ".repeat(d);
/* โคลอนตามด้วยวรรคคือตัวคั่นป้าย ([ ] นำหน้าคือฝ่าย) ในข้อความของกล่องจึงเปลี่ยนเป็นวรรค "10:30" ไม่มีวรรคหลังโคลอนจึงอยู่ครบ */
const clean = (s) => String(s ?? "").replace(/\s*[:：](?=\s|$)/g, " ").replace(/^[\s[\]]+/, "").replace(/\s+/g, " ").trim();
const asStep = (s) => clean(s).replace(/[?？]+$/, "").trim();
const asAsk = (s) => { const t = asStep(s); return t ? t + "?" : ""; };
const teamOf = (t) => { const x = String(t ?? "").replace(/[[\]]/g, "").replace(/\s+/g, " ").trim(); return x ? `[${x}] ` : ""; };

/** schema ของโครงผัง (ผังลู่บังคับ team ทุกขั้นกับทุกคำถาม) */
export function treeSchema(kind = "steps") {
  const lane = kind === "lane";
  const obj = (props, required) => ({ type: "object", properties: props, required, additionalProperties: false });
  const team = lane ? { team: { type: "string" } } : {};
  const need = lane ? ["team"] : [];
  const $defs = {};
  for (let d = TREE_DEPTH; d >= 0; d--) {
    const kinds = [
      obj({ step: { type: "string" }, ...team }, ["step", ...need]),
      obj({ end: { type: "boolean" } }, ["end"]),
      obj({ goto: { type: "string" } }, ["goto"]),
    ];
    if (d < TREE_DEPTH) {
      const answer = obj({ label: { type: "string" }, steps: { $ref: `#/$defs/s${d + 1}` } }, ["label", "steps"]);
      kinds.push(obj({ question: { type: "string" }, ...team, answers: { type: "array", items: answer } }, ["question", "answers", ...need]));
    }
    $defs[`s${d}`] = { type: "array", items: { anyOf: kinds } };
  }
  return { type: "object", $defs, properties: { title: { type: "string" }, steps: { $ref: "#/$defs/s0" } }, required: ["title", "steps"], additionalProperties: false };
}

/** โครงผัง → ข้อความ FlowKit ที่ตัวอ่านอ่านได้ */
export function toFlowText(tree, kind = "steps", lang = "th") {
  const W = WORD[lang] || WORD.th;
  const lane = kind === "lane";
  const out = [];
  const seen = new Set();
  const pre = (it) => (lane ? teamOf(it.team) : "");
  if (clean(tree && tree.title)) out.push(`${W.title}: ${clean(tree.title)}`);

  /** หนึ่งรายการ → { text, ask, closes } หรือ null ถ้าว่าง
   *  closes = กิ่งปิดหลังบรรทัดนี้ (จบ , วนกลับ , บรรจบกล่องเดิม) */
  function item(it) {
    if (!it || typeof it !== "object") return null;
    if (it.end === true || (typeof it.step === "string" && END.test(clean(it.step)))) return { text: W.end, closes: true };
    if (typeof it.goto === "string") {
      const hit = [asStep(it.goto), asAsk(it.goto)].find((t) => seen.has(t));
      return { text: `${W.back}: ${hit || asStep(it.goto)}`, closes: true };
    }
    const isQ = typeof it.question === "string" && Array.isArray(it.answers) && it.answers.length > 0;
    const t = isQ ? asAsk(it.question) : asStep(it.step ?? it.question);
    if (!t) return null;
    if (seen.has(t)) return { text: pre(it) + t, closes: true };
    seen.add(t);
    return { text: pre(it) + t, ask: isQ };
  }
  /** ลำดับขั้นในชั้นเดียวกัน คืน true ถ้ากิ่งปิดแล้ว */
  function seq(items, depth) {
    for (const it of items || []) {
      const one = item(it);
      if (!one) continue;
      out.push(pad(depth) + one.text);
      if (one.ask) answers(it.answers, depth + 1);
      if (one.closes) return true;
    }
    return false;
  }
  function answers(list, depth) {
    for (const a of list) {
      const label = clean(a && a.label) || W.next;
      const items = (a && Array.isArray(a.steps) ? a.steps : []).filter(Boolean);
      const firstQ = items[0] && typeof items[0].question === "string" && Array.isArray(items[0].answers) && items[0].answers.length > 0;
      if (!items.length || firstQ) {                  // ป้าย: ว่าง แล้วขั้นทั้งหมดอยู่ชั้นถัดไป (คำถามต่อด้วยขั้นอื่นในกิ่งเดียวกันได้)
        out.push(pad(depth) + label + ":");
        seq(items, depth + 1);
        continue;
      }
      let i = 0, one = null;
      while (i < items.length && !(one = item(items[i]))) i++;
      if (!one) { out.push(pad(depth) + label + ":"); continue; }
      out.push(pad(depth) + `${label}: ${one.text}`);  // ขั้นแรกของกิ่งอยู่บรรทัดเดียวกับป้าย
      if (!one.closes) seq(items.slice(i + 1), depth + 1);
    }
  }
  seq(tree && tree.steps, 0);
  return out.join("\n");
}
