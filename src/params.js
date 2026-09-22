/* พารามิเตอร์จากการ์ดหน้าแรก (แผนเว็บ FlowKit แยก ข้อ 5.2)
 * ‼️ ใช้ครั้งเดียวแล้วลบออกจากแถบที่อยู่ทันที โหลดหน้าซ้ำต้องไม่ใส่เทมเพลตทับร่างที่ผู้ใช้แก้แล้ว (R4) */
const KEYS = ["kind", "tpl", "open"];
export function takeParams(loc = location, hist = history) {
  const q = new URLSearchParams(loc.search), out = {};
  if (!KEYS.some((k) => q.has(k))) return out;
  for (const k of KEYS) { if (q.get(k)) out[k] = q.get(k); q.delete(k); }
  const rest = q.toString();
  hist.replaceState(hist.state, "", loc.pathname + (rest ? "?" + rest : "") + loc.hash);
  return out;
}
