// ─────────────────────────────────────────────────────────────────────────────
// ให้ AI ร่างผังเอง ยิง Claude API ตรงจากเบราว์เซอร์ด้วย key ของคนใช้ (แผน FlowKit ฝัง AI เฟส 1 , 24/10/2026)
//
// ‼️ เว็บเป็นของสาธารณะบน GitHub Pages จึงไม่มี key ของเราในโค้ด คนใช้พิมพ์ key ของตัวเอง
//    คำขอออกจากเครื่องเฉพาะตอนกดปุ่มร่างเท่านั้น ทางคัดลอกคำสั่งเดิม (ai.js) ยังไม่ส่งอะไรออกเหมือนเดิม
// ‼️ คำสั่งชุดเดียวกับปุ่มคัดลอก (buildPrompt) ผลจากสองทางจึงเทียบกันได้
// ‼️ คำตอบต้องผ่านตัวอ่านผังของเราก่อน อ่านไม่ผ่านส่งข้อผิดพลาดพร้อมเลขบรรทัดกลับให้แก้ 1 รอบ
//    ยังพังอีกก็คืนข้อความไปให้คนแก้ต่อในช่องพิมพ์ ซึ่งชี้บรรทัดที่ผิดให้อยู่แล้ว ไม่ยิงวนจนเปลืองเงิน
// ‼️ รุ่นมีแค่ Haiku 5.5 กับ Opus 5.5 (พี่ปอนด์สั่ง 24/10/2026 ห้าม Fable)
// ─────────────────────────────────────────────────────────────────────────────
import { buildPrompt, cleanAnswer } from "./ai.js";
import { parseText } from "./parse.js";
import { TREE_KINDS, treeSchema, toFlowText } from "./ai-tree.js";

/** คำสั่งของทางโครงข้อมูล: บอกความหมายของแต่ละช่อง ไม่ต้องสอนย่อหน้า */
function treePrompt(kind, description, lang) {
  const lane = kind === "lane";
  if (lang === "en") {
    return [
      `Turn the work described at the end into a ${lane ? "swimlane (who does what)" : "process"} diagram, answering with the JSON structure.`,
      "- steps is the order of work. A decision is a question with every answer, each answer has its own steps",
      "- A step listed after a question, in the same list, is where every answer that did not end comes back together",
      "- Put {\"end\": true} last in an answer that finishes the work there. goto loops back to a step written earlier, spelled exactly the same",
      "- Keep each step under 40 characters and each answer label to 1 to 3 words, the title short",
      ...(lane ? ["- team is who does that step, spell each team the same way every time, and do not start the step text with the team name"] : []),
      "", "The work:", String(description).trim(),
    ].join("\n");
  }
  return [
    `ช่วยเขียน${lane ? "ผังใครทำอะไร (แยกลู่ตามฝ่าย)" : "ผังขั้นตอน"} จากงานที่เล่าไว้ท้ายข้อความนี้ ตอบเป็นโครงข้อมูล JSON`,
    "- steps คือขั้นงานเรียงตามลำดับ จุดตัดสินใจใช้ question พร้อมทุกคำตอบ แต่ละคำตอบมี steps ของกิ่งตัวเอง",
    "- ขั้นที่อยู่ต่อจาก question ในรายการเดียวกัน คือจุดที่ทุกกิ่งที่ยังไม่จบมาบรรจบกัน",
    "- ใส่ {\"end\": true} ท้ายกิ่งที่งานจบตรงนั้น goto ใช้วนกลับไปขั้นที่เขียนไว้ก่อนแล้ว พิมพ์ให้ตรงทุกตัวอักษร",
    "- ข้อความแต่ละขั้นสั้น ไม่เกิน 40 ตัวอักษร ป้ายคำตอบ 1 ถึง 3 คำ ชื่อผังสั้น ๆ",
    ...(lane ? ["- team คือฝ่ายที่ทำขั้นนั้น ใช้ชื่อฝ่ายเดิมทุกครั้ง ข้อความขั้นไม่ต้องขึ้นต้นด้วยชื่อฝ่ายซ้ำ"] : []),
    "", "งานที่อยากได้เป็นผัง:", String(description).trim(),
  ].join("\n");
}

export const AI_MODELS = { haiku: "claude-haiku-5-5", opus: "claude-opus-5-5" };
/* ดอลลาร์ต่อล้าน token (เข้า , ออก) จากหน้าราคา ณ 06/10/2026 ใช้โชว์ราคาประมาณเท่านั้น */
const PRICE = { haiku: [0.10, 0.50], opus: [4.0, 20.0] };
/** อัตโนมัติ: ผังที่มีกิ่ง (ขั้นตอน ลู่) ใช้ Opus ชนิดอื่นใช้ Haiku
 *  ‼️ วัดจริง 24/10/2026 ผังร้านซ่อมทางโครงข้อมูล ตัวอ่านผ่านทุกรุ่น 12/12 แต่ Haiku ทำกิ่ง ซ่อมไม่ได้ หลุด 3/3 ใบ Opus ถูกความหมาย 3/3
 *     Sonnet ถูกแต่ช้ากว่า Opus (10.9 กับ 8.5 วินาที) จึงไม่ใส่ , ผังองค์กร ระบบ ไทม์ไลน์ ตาราง ความคิด Haiku ถูกความหมาย ราคาไม่ถึง 0.001 ดอลลาร์ */
export const pickModel = (model, kind) => (model === "auto" ? (TREE_KINDS.includes(kind) ? "opus" : "haiku") : model);
const URL_MSG = "https://api.anthropic.com/v1/messages";
/* ‼️ วัดจริง 24/10/2026 ผังร้านกาแฟ 9 กล่อง: Haiku 5.5 คิดเองจนใช้ 2000 token หมดโดยไม่มีคำตอบ ปิดการคิดแล้วตอบ 245 token ใน 1.5 วินาที
   Opus 5.5 ปิดการคิดไม่ได้ (400) ปล่อยคิด 565 ตอบ 285 ใน 8.5 วินาที เพดานจึงต้องกว้าง จ่ายเฉพาะที่ใช้จริง
   ผังเกิน 25 กล่องตอบราว 600 token ชน 2000 ของ Haiku = งานที่ควรแบ่งผัง */
const BODY = { haiku: { max_tokens: 2000, thinking: { type: "disabled" } }, opus: { max_tokens: 8000 } };
const TIMEOUT_MS = 90000;

const MSG = {
  nokey: ["ใส่ API key ของคุณก่อน", "Enter your API key first"],
  badkey: ["key ต้องขึ้นต้นด้วย sk-ant- ลองคัดลอกจาก Claude Console ใหม่", "The key should start with sk-ant-, copy it again from the Claude Console"],
  nodesc: ["เล่างานที่อยากได้เป็นผังก่อน", "Describe the work first"],
  model: ["รุ่นนี้ใช้ไม่ได้ เลือก Haiku หรือ Opus", "That model is not available, pick Haiku or Opus"],
  auth: ["key ใช้ไม่ได้ อาจพิมพ์ผิดหรือถูกลบไปแล้ว", "The key was refused, it may be mistyped or deleted"],
  credit: ["เครดิตในบัญชี Claude API หมด เติมได้ที่ Claude Console", "Your Claude API credit has run out, add more in the Claude Console"],
  rate: ["ส่งถี่เกินไป รอสักครู่แล้วลองใหม่", "Too many requests, wait a moment and try again"],
  busy: ["AI มีคนใช้เยอะตอนนี้ ลองใหม่อีกสักครู่", "The AI is busy right now, try again shortly"],
  server: ["ฝั่ง AI มีปัญหา ลองใหม่อีกสักครู่", "The AI service had a problem, try again shortly"],
  network: ["ต่อ AI ไม่ได้ เช็คอินเทอร์เน็ต หรือเครือข่ายอาจบล็อก api.anthropic.com", "Could not reach the AI, check your connection or whether api.anthropic.com is blocked"],
  timeout: ["AI ตอบช้าเกินไป ลองใหม่ หรือเล่างานให้สั้นลง", "The AI took too long, try again or shorten the description"],
  cancel: ["ยกเลิกแล้ว", "Cancelled"],
  long: ["ผังยาวเกินจะร่างในครั้งเดียว ลองแบ่งเป็นสองผัง", "The diagram is too long for one draft, try splitting it in two"],
  bad: ["AI ตอบกลับมาในรูปแบบที่อ่านไม่ได้ ลองใหม่อีกครั้ง", "The AI reply could not be read, try again"],
};
export class AiError extends Error {
  constructor(code, detail = "") {
    const [th, en] = MSG[code];
    super(en + (detail ? ` (${detail})` : ""));
    Object.assign(this, { code, th, en, detail });
  }
}

export function estimateUsd(model, usage) {
  const [pin, pout] = PRICE[model] || PRICE.haiku;
  return ((usage.input_tokens || 0) * pin + (usage.output_tokens || 0) * pout) / 1e6;
}

/** status ของ API → รหัสที่หน้าเว็บแปลได้ (ข้อความ error จริงจาก API แนบไว้ใน detail ให้ดูตอนแก้ปัญหา) */
function codeOf(status, body) {
  const type = body && body.error && body.error.type, text = (body && body.error && body.error.message) || "";
  if (status === 401 || status === 403) return "auth";
  if (/credit balance/i.test(text)) return "credit";
  if (status === 429) return "rate";
  if (status === 529 || type === "overloaded_error") return "busy";
  if (status >= 500) return "server";
  return "bad";
}

async function call({ key, model, messages, extra, fetchImpl, signal }) {
  /* หมดเวลากับปุ่มยกเลิกใช้ตัวหยุดตัวเดียวกัน แยกกันด้วยธง timedOut */
  const ac = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ac.abort(); }, TIMEOUT_MS);
  const stop = () => ac.abort();
  if (signal) { if (signal.aborted) ac.abort(); else signal.addEventListener("abort", stop, { once: true }); }
  let res, body;
  try {
    res = await fetchImpl(URL_MSG, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",   // ให้เบราว์เซอร์ยิงตรงได้ (CORS) key เป็นของคนใช้เอง
      },
      body: JSON.stringify({ model: AI_MODELS[model], ...BODY[model], ...extra, messages }),
      signal: ac.signal,
    });
    body = await res.json().catch(() => null);
  } catch (e) {
    if (e && e.name === "AbortError") throw new AiError(timedOut ? "timeout" : "cancel");
    throw new AiError("network", e && e.message);
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", stop);
  }
  if (!res.ok) throw new AiError(codeOf(res.status, body), `${res.status} ${(body && body.error && body.error.message) || ""}`.trim());
  if (!body || !Array.isArray(body.content)) throw new AiError("bad");
  if (body.stop_reason === "max_tokens") throw new AiError("long");
  const text = body.content.filter((c) => c.type === "text").map((c) => c.text).join("");
  return { text, usage: body.usage || {} };
}

function repairNote(err, lang) {
  if (lang === "en") {
    return `FlowKit could not read your answer. Line ${err.line}: ${err.message}${err.hint ? ` (${err.hint})` : ""}\n` +
      "Fix it and send the whole diagram again, FlowKit text only, no explanation, no code block.";
  }
  return `ตัวอ่านของ FlowKit อ่านคำตอบไม่ผ่าน บรรทัด ${err.line}: ${err.message}${err.hint ? ` (${err.hint})` : ""}\n` +
    "ช่วยแก้แล้วตอบใหม่ทั้งผัง เป็นข้อความรูปแบบ FlowKit อย่างเดียว ไม่ต้องอธิบาย ไม่ใส่กรอบโค้ด";
}
/* ‼️ วัดจริง 24/10/2026 Haiku เขียน เกตเวย์ชำระเงิน เป็น เกตเวย์ชำระเงิन (น เทวนาครี) ตัวอ่านผ่านแต่ได้กล่องแยกอีกกล่อง
   อักษรอินเดียทั้งตระกูล (U+0900 ถึง U+0DFF) ที่คำเล่าไม่มี นับเป็นพังแล้วซ่อม */
const STRAY = /[ऀ-෿]/;
/** ผลอ่าน → error ที่ใช้ซ่อม หรือ null ถ้าผ่าน (คำตอบว่างนับเป็นพังบรรทัด 1) */
function readErr(text, kind, description, lang) {
  const r = parseText(text, kind);
  if (r.error) return { line: r.error.line, message: r.error.message, hint: r.error.hint };
  if (r.empty) return { line: 1, message: "empty", hint: "" };
  if (!STRAY.test(description)) {
    const i = text.split("\n").findIndex((l) => STRAY.test(l));
    if (i >= 0) return lang === "en"
      ? { line: i + 1, message: "has a letter from another script", hint: "use Thai or English letters only" }
      : { line: i + 1, message: "มีตัวอักษรภาษาอื่นปน", hint: "ใช้ตัวอักษรไทยหรืออังกฤษเท่านั้น" };
  }
  return null;
}

/**
 * ร่างผังจากคำเล่า
 * @returns {Promise<{ text, error, repaired, model, usage, usd }>} model = รุ่นที่ใช้จริง (อัตโนมัติเลือกให้แล้ว)
 *          error = ข้อผิดพลาดจากตัวอ่านเมื่อซ่อมแล้วยังไม่ผ่าน (ข้อความยังคืนให้คนแก้ต่อ)
 * @throws {AiError} เมื่อยังไม่ได้ยิง (ไม่มี key , key ผิดรูป , ไม่มีคำเล่า , รุ่นนอกรายการ) หรือยิงแล้ว API ปฏิเสธ
 */
export async function draftDiagram({ key, model = "auto", kind = "steps", description, current = "", lang = "th", fetchImpl = globalThis.fetch, signal }) {
  key = String(key || "").trim();
  if (!key) throw new AiError("nokey");
  if (!/^sk-ant-/.test(key)) throw new AiError("badkey");
  if (!String(description || "").trim()) throw new AiError("nodesc");
  model = pickModel(model, kind);
  /* แก้ผังที่มีอยู่ (เฟส 3): ผังเดิมทั้งผังไปพร้อมสิ่งที่อยากแก้ ใช้ทางเดิมทุกอย่าง (โครงข้อมูล , ซ่อม , อัตโนมัติ) ได้ผังใหม่ทั้งผัง */
  if (String(current || "").trim()) {
    description = lang === "en"
      ? `The current diagram, in FlowKit text:\n${String(current).trim()}\n\nEdit it as asked here and reply with the whole new diagram, keeping every part not asked to change: ${description}`
      : `ผังเดิมที่มีอยู่ (ข้อความรูปแบบ FlowKit):\n${String(current).trim()}\n\nช่วยแก้ผังเดิมตามนี้ แล้วตอบผังใหม่ทั้งผัง ส่วนที่ไม่ได้สั่งแก้ให้เหมือนเดิม: ${description}`;
  }
  if (!AI_MODELS[model]) throw new AiError("model", String(model));
  const go = (messages, extra = {}) => call({ key, model, messages, extra, fetchImpl: fetchImpl.bind ? fetchImpl.bind(globalThis) : fetchImpl, signal });

  /* ผังขั้นตอนกับผังลู่ขอเป็นโครงข้อมูล โค้ดเขียนย่อหน้าเอง (src/ai-tree.js) ชนิดอื่นขอข้อความตรง ๆ
     AI ตอบไม่เป็น JSON (ไม่น่าเกิดเพราะ schema บังคับ) ก็ใช้คำตอบนั้นเป็นข้อความ แล้วไปด่านตัวอ่านตามปกติ */
  const tree = TREE_KINDS.includes(kind);
  const ask = { role: "user", content: buildPrompt(kind, description, lang) };
  const first = tree
    ? await go([{ role: "user", content: treePrompt(kind, description, lang) }], { output_config: { format: { type: "json_schema", schema: treeSchema(kind) } } })
    : await go([ask]);
  let text = cleanAnswer(first.text);
  if (tree) { try { text = toFlowText(JSON.parse(first.text), kind, lang); } catch { /* ไม่ใช่ JSON ใช้เป็นข้อความ */ } }
  let usage = { ...first.usage }, repaired = false;
  let err = readErr(text, kind, description, lang);
  if (err) {
    /* ซ่อมแบบข้อความเสมอ: ส่งข้อความที่แปลงแล้ว (ตัวที่เลขบรรทัดอ้างถึง) ไม่ใช่ JSON */
    const second = await go([ask, { role: "assistant", content: text || first.text || "(ว่าง)" }, { role: "user", content: repairNote(err, lang) }]);
    usage = { input_tokens: (usage.input_tokens || 0) + (second.usage.input_tokens || 0), output_tokens: (usage.output_tokens || 0) + (second.usage.output_tokens || 0) };
    text = cleanAnswer(second.text);
    repaired = true;
    err = readErr(text, kind, description, lang);
  }
  return { text, error: err, repaired, model, usage, usd: estimateUsd(model, usage) };
}
