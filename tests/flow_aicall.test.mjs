/* FlowKit ฝัง AI เฟส 1: src/ai-call.js ยิง API ตรงจากเบราว์เซอร์ด้วย key ของคนใช้ (แผน .claude/plans/2026-10-24-flowkit-ai-direct.md)
 * ตรวจด้วย fetch ปลอม ไม่ยิงจริง ไม่เสียเงิน:
 *   คำขอ: ที่อยู่ header รุ่น ไม่มี key = ไม่ยิงเลย , คำตอบ: ตัดกรอบโค้ด อ่านผังผ่าน , อ่านไม่ผ่าน = ส่งข้อผิดพลาดกลับให้แก้ 1 รอบพอดี
 *   error ทุกชนิดกลายเป็นรหัสที่หน้าเว็บแปลเป็นคำไทยได้
 * ‼️ ถ้าผิดจะรู้ได้ยังไง: --selftest ให้ fetch ปลอมตอบผิดแบบเดียวกับของพังจริง (ซ่อมแล้วยังพัง , status ผิดชนิด , header หาย) ทุกเคสต้องแดง
 * รัน: node tests/flow_aicall.test.mjs   (--selftest) */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
await import("./_loader/register.mjs");
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const { draftDiagram, AiError, AI_MODELS, estimateUsd } = await imp("src/ai-call.js");
const { toFlowText } = await imp("src/ai-tree.js");
const SELFTEST = process.argv.includes("--selftest");

let pass = 0; const fail = [];
const ck = (ok, msg, detail = "") => {
  if (ok) { pass++; console.log("  ✅ " + msg); }
  else { fail.push(msg); console.log("  ❌ " + msg + (detail ? "\n      " + detail : "")); }
};

const KEY = "sk-ant-api03-test-not-real";
const GOOD = "ชื่อ: เบิกเงินสด\nยื่นใบเบิก\nหัวหน้าอนุมัติ?\n  อนุมัติ: บัญชีจ่ายเงิน\n  ไม่อนุมัติ: จบ\nแจ้งผล";
const BAD = "ยื่นใบเบิก\n    ย่อหน้าลึกผิดที่";          // ย่อหน้าลอยใต้ขั้นที่ไม่ใช่คำถาม ตัวอ่านแจ้ง error พร้อมเลขบรรทัด
const reply = (text, extra = {}) => ({ status: 200, body: { content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 1200, output_tokens: 80 }, ...extra } });

/** fetch ปลอม: ตอบตามคิว แล้วจดทุกคำขอไว้ตรวจ */
function fakeFetch(queue) {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const r = queue[Math.min(calls.length - 1, queue.length - 1)];
    if (r instanceof Error) throw r;
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body, text: async () => JSON.stringify(r.body) };
  };
  f.calls = calls;
  return f;
}
const errOf = async (p) => { try { await p; return null; } catch (e) { return e; } };

/* ── คำขอถูกต้อง ── */
{
  const f = fakeFetch(SELFTEST ? [reply("```\n" + BAD + "\n```")] : [reply("```\n" + GOOD + "\n```")]);
  const r = await draftDiagram({ key: KEY, model: "haiku", kind: "steps", description: "เบิกเงินสด", lang: "th", fetchImpl: f });
  const c = f.calls[0];
  ck(c && c.url === "https://api.anthropic.com/v1/messages", "ยิงที่อยู่ messages ของ Anthropic", c && c.url);
  const h = c ? c.init.headers : {};
  ck(h["x-api-key"] === KEY && h["anthropic-version"] && h["anthropic-dangerous-direct-browser-access"] === "true", "ส่ง key กับ header ที่เบราว์เซอร์ต้องใช้", JSON.stringify(h));
  ck(c && c.body.model === AI_MODELS.haiku && AI_MODELS.haiku === "claude-haiku-5-5", "รุ่นค่าเริ่มต้นคือ Haiku 5.5", c && c.body.model);
  ck(c && /ผังขั้นตอน/.test(c.body.messages[0].content) && /เบิกเงินสด/.test(c.body.messages[0].content), "คำสั่งบอกชนิดผังพร้อมคำเล่า");
  ck(r.text === GOOD && !r.error && f.calls.length === 1, "AI ตอบเป็นข้อความแทนโครง ก็ยังตัดกรอบโค้ดแล้วใช้ได้ ไม่ยิงซ้ำ", JSON.stringify({ text: r.text, n: f.calls.length }));
  ck(r.usage && r.usage.input_tokens === 1200 && r.usd > 0, "คืนจำนวน token กับราคาประมาณ", JSON.stringify(r.usage));
}
/* ── Opus และ Fable ── */
{
  const f = fakeFetch([reply(GOOD)]);
  await draftDiagram({ key: KEY, model: "opus", kind: "steps", description: "x", lang: "th", fetchImpl: f });
  ck(f.calls[0].body.model === "claude-opus-5-5", "เลือก Opus ได้");
  /* ‼️ วัดจริง 24/10/2026: Haiku 5.5 คิดเองจนใช้ 2000 token หมดโดยไม่มีคำตอบ (stop max_tokens) ต้องปิดการคิด
     Opus 5.5 ปิดการคิดไม่ได้ (400 thinking.type.disabled is not supported) ปล่อยคิดแต่เพดานต้องกว้าง (คิด 565 ตอบ 285) */
  const h = fakeFetch([reply(GOOD)]);
  await draftDiagram({ key: KEY, model: "haiku", kind: "steps", description: "x", lang: "th", fetchImpl: h });
  ck(h.calls[0].body.thinking && h.calls[0].body.thinking.type === "disabled", "Haiku ส่งคำสั่งปิดการคิด", JSON.stringify(h.calls[0].body.thinking));
  ck(!f.calls[0].body.thinking && f.calls[0].body.max_tokens >= 8000, "Opus ไม่ส่งคำสั่งปิดการคิด และเพดาน token กว้างพอให้คิด", JSON.stringify({ t: f.calls[0].body.thinking, m: f.calls[0].body.max_tokens }));
  const e = await errOf(draftDiagram({ key: KEY, model: SELFTEST ? "opus" : "fable", kind: "steps", description: "x", lang: "th", fetchImpl: fakeFetch([reply(GOOD)]) }));
  ck(e instanceof AiError && e.code === "model", "รุ่นนอกรายการ (Fable) ไม่ยิง", e && e.code);
}
/* ── ผังขั้นตอนกับผังลู่ขอเป็นโครงข้อมูล แล้วโค้ดเขียนย่อหน้า (วัดจริง 24/10/2026 AI เขียนย่อหน้าเองพลาด ดู src/ai-tree.js) ── */
const TREE = { title: "ซ่อม", steps: [{ step: "รับเครื่อง" }, { question: "ซ่อมได้ไหม", answers: [{ label: "ได้", steps: [{ step: "ซ่อม" }, { step: "คืนลูกค้า" }] }, { label: "ไม่ได้", steps: [{ end: true }] }] }] };
const TREE_BAD = { title: "", steps: [{ step: "รับเครื่อง" }, { goto: "กล่องที่ไม่มี" }] };   // กลับไปกล่องที่ไม่มี ตัวอ่านแจ้งพร้อมเลขบรรทัด
{
  const f = fakeFetch([reply(JSON.stringify(SELFTEST ? TREE_BAD : TREE))]);
  const r = await draftDiagram({ key: KEY, model: "haiku", kind: "steps", description: "ซ่อมมือถือ", lang: "th", fetchImpl: f });
  const b = f.calls[0].body;
  ck(b.output_config && b.output_config.format && b.output_config.format.type === "json_schema" && b.output_config.format.schema.$defs, "ผังขั้นตอนขอคำตอบเป็นโครงตาม schema", JSON.stringify(b.output_config || null).slice(0, 80));
  ck(r.text === toFlowText(TREE, "steps", "th") && !r.error && f.calls.length === 1, "โครงที่ได้แปลงเป็นข้อความที่อ่านผ่านในครั้งเดียว", JSON.stringify({ text: r.text, n: f.calls.length }));
  const o = fakeFetch([reply("ผู้จัดการ\n  พนักงาน")]);
  await draftDiagram({ key: KEY, model: "haiku", kind: "org", description: "x", lang: "th", fetchImpl: o });
  ck(!o.calls[0].body.output_config, "ผังองค์กรยังขอเป็นข้อความเหมือนเดิม (Haiku อ่านผ่านครบอยู่แล้ว)");
  const l = fakeFetch([reply(JSON.stringify(TREE))]);
  await draftDiagram({ key: KEY, model: "haiku", kind: "lane", description: "x", lang: "th", fetchImpl: l });
  ck(/"team"/.test(JSON.stringify(l.calls[0].body.output_config)), "ผังลู่ schema มีช่องฝ่าย");
}
{
  const f = fakeFetch(SELFTEST ? [reply(JSON.stringify(TREE_BAD)), reply(BAD)] : [reply(JSON.stringify(TREE_BAD)), reply(GOOD)]);
  const r = await draftDiagram({ key: KEY, model: "haiku", kind: "steps", description: "x", lang: "th", fetchImpl: f });
  const c2 = f.calls[1];
  ck(c2 && !c2.body.output_config && c2.body.messages[1].role === "assistant" && c2.body.messages[1].content === toFlowText(TREE_BAD, "steps", "th") && /บรรทัด\s*\d+/.test(c2.body.messages[2].content),
    "โครงแปลงแล้วอ่านไม่ผ่าน: ส่งข้อความที่แปลงแล้วพร้อมเลขบรรทัดให้แก้แบบข้อความ", JSON.stringify(c2 && c2.body.messages.map((m) => m.role)));
  ck(r.text === GOOD && !r.error && r.repaired, "ซ่อมแบบข้อความแล้วได้ผังที่อ่านผ่าน", JSON.stringify(r).slice(0, 120));
}
/* ── อัตโนมัติ: ผังมีกิ่ง (ขั้นตอน ลู่) ใช้ Opus ชนิดอื่นใช้ Haiku
     วัดจริง 24/10/2026 ผังร้านซ่อม Haiku ตัวอ่านผ่าน 12/12 แต่กิ่ง ซ่อมไม่ได้ หลุด 3/3 ใบ Opus ถูกความหมาย 3/3 , ผัง 5 ชนิดที่เหลือ Haiku ถูกความหมาย ── */
{
  const s = fakeFetch([reply(JSON.stringify(TREE))]);
  const rs = await draftDiagram({ key: KEY, model: "auto", kind: SELFTEST ? "org" : "steps", description: "x", lang: "th", fetchImpl: s });
  const o = fakeFetch([reply("ผู้จัดการ\n  พนักงาน")]);
  const ro = await draftDiagram({ key: KEY, model: "auto", kind: "org", description: "x", lang: "th", fetchImpl: o });
  ck(s.calls[0].body.model === "claude-opus-5-5" && rs.model === "opus", "อัตโนมัติ + ผังขั้นตอน ใช้ Opus และบอกว่าใช้รุ่นไหน", `${s.calls[0].body.model} ${rs.model}`);
  ck(o.calls[0].body.model === "claude-haiku-5-5" && ro.model === "haiku", "อัตโนมัติ + ผังองค์กร ใช้ Haiku");
  const l = fakeFetch([reply(JSON.stringify(TREE))]);
  await draftDiagram({ key: KEY, model: "auto", kind: "lane", description: "x", lang: "th", fetchImpl: l });
  ck(/ไม่ต้องขึ้นต้นด้วยชื่อฝ่าย/.test(l.calls[0].body.messages[0].content), "ผังลู่บอก AI ว่าไม่ต้องเขียนชื่อฝ่ายซ้ำในข้อความ (วัดจริง [พนักงาน] พนักงานกรอกใบเบิก)");
}
/* ── ตัวอักษรภาษาอื่นหลุดมา (วัดจริง Haiku เขียน เกตเวย์ชำระเงิน เป็น เงิन ได้กล่องแยก) = ซ่อม ── */
{
  const SYS_BAD = "แอป -> API: เรียก\nเกตเวย์ชำระเงิน --> API: ผล\nAPI -> เกตเวย์ชำระเงิन: จ่าย";
  const SYS_OK = "แอป -> API: เรียก\nเกตเวย์ชำระเงิน --> API: ผล\nAPI -> เกตเวย์ชำระเงิน: จ่าย";
  const f = fakeFetch([reply(SELFTEST ? SYS_OK : SYS_BAD), reply(SYS_OK)]);
  const r = await draftDiagram({ key: KEY, model: "haiku", kind: "system", description: "ระบบจ่ายเงิน", lang: "th", fetchImpl: f });
  ck(f.calls.length === 2 && /บรรทัด 3/.test(f.calls[1].body.messages[2].content) && r.text === SYS_OK && r.repaired, "ตัวอักษรภาษาอื่นที่คำเล่าไม่มี ส่งกลับให้แก้พร้อมเลขบรรทัด", JSON.stringify({ n: f.calls.length, m: f.calls[1] && f.calls[1].body.messages[2].content }));
  const g = fakeFetch([reply("नमस्ते -> API: x")]);
  const rg = await draftDiagram({ key: KEY, model: "haiku", kind: "system", description: "ระบบ नमस्ते", lang: "th", fetchImpl: g });
  ck(g.calls.length === 1 && !rg.error, "คำเล่ามีภาษานั้นเอง ไม่นับว่าพัง");
}
/* ── เฟส 3 แก้ผังที่มีอยู่: ส่งผังในช่องพิมพ์ไปพร้อมคำสั่งแก้ ได้ผังใหม่ทั้งผัง ── */
{
  const CUR = "ผู้จัดการทั่วไป\n  ฝ่ายขาย";
  const o = fakeFetch([reply("ผู้จัดการทั่วไป\n  ฝ่ายขาย\n  ฝ่ายบัญชี")]);
  const r = await draftDiagram({ key: KEY, model: "haiku", kind: "org", description: "เพิ่มฝ่ายบัญชี", current: SELFTEST ? "" : CUR, lang: "th", fetchImpl: o });
  const p = o.calls[0].body.messages[0].content;
  ck(p.includes(CUR) && /เพิ่มฝ่ายบัญชี/.test(p) && /แก้/.test(p), "แก้ผัง (ข้อความ): คำสั่งมีผังเดิมทั้งผังกับสิ่งที่อยากแก้", p.slice(-160));
  ck(r.text === "ผู้จัดการทั่วไป\n  ฝ่ายขาย\n  ฝ่ายบัญชี" && !r.error, "ได้ผังใหม่ทั้งผัง");
  const s = fakeFetch([reply(JSON.stringify(TREE))]);
  await draftDiagram({ key: KEY, model: "opus", kind: "steps", description: "เพิ่มขั้นทดสอบเครื่อง", current: SELFTEST ? "  " : GOOD, lang: "th", fetchImpl: s });
  const q = s.calls[0].body.messages[0].content;
  ck(q.includes(GOOD) && /เพิ่มขั้นทดสอบเครื่อง/.test(q) && s.calls[0].body.output_config, "แก้ผัง (โครงข้อมูล): ผังขั้นตอนส่งผังเดิมไปด้วยและยังขอเป็นโครง", q.slice(-160));
  const n = fakeFetch([reply("ก\n  ข")]);
  await draftDiagram({ key: KEY, model: "haiku", kind: "org", description: "x", current: "   \n ", lang: "th", fetchImpl: n });
  ck(!/ผังเดิม/.test(n.calls[0].body.messages[0].content), "ช่องพิมพ์ว่าง = ร่างใหม่ ไม่มีส่วนผังเดิม");
}
/* ── อ่านไม่ผ่าน = ซ่อม 1 รอบ ── */
{
  const f = fakeFetch(SELFTEST ? [reply(BAD), reply(BAD)] : [reply(BAD), reply(GOOD)]);
  const r = await draftDiagram({ key: KEY, model: "haiku", kind: "steps", description: "x", lang: "th", fetchImpl: f });
  const c2 = f.calls[1];
  ck(f.calls.length === 2 && c2 && c2.body.messages.length === 3 && c2.body.messages[1].role === "assistant", "ส่งคำตอบเดิมกลับพร้อมข้อผิดพลาดให้แก้", JSON.stringify(c2 && c2.body.messages.map((m) => m.role)));
  ck(c2 && /บรรทัด\s*\d+/.test(c2.body.messages[2].content), "ข้อผิดพลาดที่ส่งกลับมีเลขบรรทัด", c2 && c2.body.messages[2].content);
  ck(r.text === GOOD && !r.error && r.repaired === true, "หลังซ่อมได้ผังที่อ่านผ่าน", JSON.stringify(r));
  ck(r.usage.input_tokens === 2400, "นับ token รวมสองรอบ", r.usage.input_tokens);
}
{
  const f = fakeFetch([reply(BAD), reply(BAD), reply(GOOD)]);
  const r = await draftDiagram({ key: KEY, model: "haiku", kind: "steps", description: "x", lang: "th", fetchImpl: f });
  ck(f.calls.length === (SELFTEST ? 3 : 2) && r.text === BAD && r.error, "ซ่อมแล้วยังพัง: หยุดที่ 2 คำขอ คืนข้อความพร้อม error ให้คนแก้ต่อ", JSON.stringify({ n: f.calls.length, r }));
}
/* ── ไม่ยิงเลยเมื่อ ── */
for (const [key, desc, code, why] of [["", "x", "nokey", "ไม่มี key"], ["abc123", "x", "badkey", "key ไม่ใช่รูปแบบ sk-ant-"], [KEY, "   ", "nodesc", "ไม่ได้เล่างาน"]]) {
  const f = fakeFetch([reply(GOOD)]);
  const e = await errOf(draftDiagram({ key: SELFTEST ? KEY : key, model: "haiku", kind: "steps", description: SELFTEST ? "x" : desc, lang: "th", fetchImpl: f }));
  ck(e instanceof AiError && e.code === code && f.calls.length === 0, `${why}: ไม่ยิง และได้รหัส ${code}`, JSON.stringify({ code: e && e.code, n: f.calls.length }));
}
/* ── error จาก API กลายเป็นรหัส ── */
const apiErr = (status, type, message) => ({ status, body: { type: "error", error: { type, message } } });
for (const [res, code] of [
  [apiErr(401, "authentication_error", "invalid x-api-key"), "auth"],
  [apiErr(403, "permission_error", "no"), "auth"],
  [apiErr(400, "invalid_request_error", "Your credit balance is too low to access the Anthropic API."), "credit"],
  [apiErr(429, "rate_limit_error", "slow down"), "rate"],
  [apiErr(529, "overloaded_error", "Overloaded"), "busy"],
  [apiErr(500, "api_error", "boom"), "server"],
  [new TypeError("Failed to fetch"), "network"],
]) {
  const f = fakeFetch([SELFTEST ? reply(GOOD) : res]);
  const e = await errOf(draftDiagram({ key: KEY, model: "haiku", kind: "steps", description: "x", lang: "th", fetchImpl: f }));
  ck(e instanceof AiError && e.code === code && e.th && e.en, `${res.status || res.message} → ${code} พร้อมคำอธิบายไทยและอังกฤษ`, JSON.stringify(e && { code: e.code, th: e.th }));
}
{
  const f = fakeFetch([reply(GOOD, { stop_reason: SELFTEST ? "end_turn" : "max_tokens" })]);
  const e = await errOf(draftDiagram({ key: KEY, model: "haiku", kind: "steps", description: "x", lang: "th", fetchImpl: f }));
  ck(e instanceof AiError && e.code === "long", "คำตอบถูกตัดเพราะยาวเกิน แจ้งให้แบ่งงาน", e && e.code);
}
{
  const ac = new AbortController();
  const f = async () => { throw Object.assign(new Error("aborted"), { name: "AbortError" }); };
  f.calls = [];
  if (!SELFTEST) ac.abort();
  const e = await errOf(draftDiagram({ key: KEY, model: "haiku", kind: "steps", description: "x", lang: "th", fetchImpl: SELFTEST ? fakeFetch([reply(GOOD)]) : f, signal: ac.signal }));
  ck(e instanceof AiError && e.code === "cancel", "กดยกเลิกแล้วได้รหัส cancel", e && e.code);
}
ck(Math.abs(estimateUsd("haiku", { input_tokens: 1e6, output_tokens: 1e6 }) - 0.6) < 1e-9 && Math.abs(estimateUsd("opus", { input_tokens: 1e6, output_tokens: 0 }) - 4) < 1e-9,
  "ราคาประมาณ Haiku 0.10/0.50 Opus 4/20 ดอลลาร์ต่อล้าน token");

console.log(`\n${pass} ผ่าน , ${fail.length} ไม่ผ่าน`);
if (SELFTEST) {
  /* เคสที่ selftest ไม่ได้แตะ (คำขอ header รุ่น opus ราคา) ยังต้องเขียว ที่เหลือต้องแดงทุกข้อ */
  const want = 23;
  const ok = fail.length === want;
  console.log(ok ? `✅ selftest: แดง ${fail.length} ข้อตามที่ป้อนของเสีย` : `❌ selftest: ป้อนของเสียแล้วแดงแค่ ${fail.length} ข้อ (ต้อง ${want}) ตัวตรวจตาบอด`);
  process.exit(ok ? 0 : 1);
}
process.exit(fail.length ? 1 : 0);
