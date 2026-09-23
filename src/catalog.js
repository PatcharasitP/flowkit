// จุดเริ่ม 15 ใบของหน้าแรก (แผนเว็บ FlowKit แยก ข้อ 4) ใช้ทั้งหน้าแรกและเทส
// ‼️ การ์ดเป็นลิงก์ธรรมดาไปหน้าวาดพร้อมพารามิเตอร์ (D4) หน้าวาดอ่านครั้งเดียวแล้วลบ (src/params.js)
// ‼️ เทมเพลตมาจาก templates.js ตัวเดียวกับหน้าต่างเทมเพลตในหน้าวาด ชื่อจึงตรงกันเสมอ
import { TEMPLATES } from "./templates.js";

/** ชนิดผังกับสีประจำ (ตัวแปรสีของ FileKit ใน home.css) ลำดับนี้คือลำดับปุ่มหมวด */
export const KINDS = [
  { id: "steps", th: "ขั้นตอน", en: "Steps" },
  { id: "lane", th: "ใครทำอะไร", en: "Who does what" },
  { id: "org", th: "องค์กร", en: "Org chart" },
  { id: "system", th: "ระบบ", en: "Systems" },
  { id: "timeline", th: "ไทม์ไลน์", en: "Timeline" },
  { id: "pa", th: "Power Automate", en: "Power Automate" },
  { id: "other", th: "ทางเข้าอื่น", en: "Other ways in" },
];

/** กลุ่มบนบอร์ด เรียงตามนี้ */
export const GROUPS = [
  { id: "blank", th: "เริ่มจากหน้าว่าง", en: "Start blank" },
  { id: "template", th: "เทมเพลต", en: "Templates" },
  { id: "other", th: "ทางเข้าอื่น", en: "Other ways in" },
];

/** ป้าย "ใหม่" โผล่ 30 วันนับจาก since แล้วหายเอง (กติกาเดียวกับ FileKit) */
export const NEW_DAYS = 30;
export const isNew = (c, now = Date.now()) => !!c.since && now - Date.parse(c.since) < NEW_DAYS * 864e5;

const blank = (kind, th, en, keys, since) => ({ id: kind, group: "blank", kind, icon: kind, href: `draw/?kind=${kind}`, th, en, keys, since });

/** keys = คำค้นแฝง ไทยและอังกฤษ (คนค้นด้วยคำที่ตัวเองใช้ ไม่ใช่ชื่อการ์ด) */
const TPL_KEYS = {
  approval: "อนุมัติ วงเงิน เบิก ขอซื้อ approve approval budget",
  complaint: "ร้องเรียน ลูกค้า call center แจ้งปัญหา complaint customer ticket",
  purchasing: "จัดซื้อ ซื้อ ผู้รับผิดชอบ เลน swimlane purchase procurement role",
  "lane-approval": "อนุมัติ ข้ามฝ่าย วงเงิน จัดซื้อ การเงิน ลู่ swimlane approval handoff",
  "lane-complaint": "ร้องเรียน ลูกค้า ช่าง call center ลู่ swimlane complaint technician",
  renewal: "สัญญา เช่า ต่ออายุ lease contract renew",
  sla: "sla เวลา ซ่อม ภายใน deadline repair",
  team: "ทีม โครงสร้าง ผัง องค์กร หัวหน้า team structure",
  systems: "ระบบ ข้อมูล power bi power query excel data pipeline system",
  weekly: "แผน สัปดาห์ โครงการ plan week project",
};

export const CATALOG = [
  blank("steps", "ผังขั้นตอน", "Process diagram", "flowchart process ขั้นตอน ผังงาน โฟลว์ ตัดสินใจ decision"),
  blank("lane", "ผังใครทำอะไร", "Who does what", "swimlane ลู่ เลน ฝ่าย ผู้รับผิดชอบ ส่งต่อ ข้ามฝ่าย handoff role responsibility", "2026-09-23"),
  blank("org", "ผังองค์กร", "Org chart", "organization องค์กร ทีม หัวหน้า ลูกน้อง hierarchy"),
  blank("system", "ผังระบบ", "Systems diagram", "system ระบบ ข้อมูล ส่งต่อ data flow architecture"),
  blank("timeline", "ไทม์ไลน์", "Timeline", "timeline แผนงาน ช่วงเวลา ลำดับเวลา roadmap schedule"),
  blank("pa", "flow ของ Power Automate", "Power Automate flow", "power automate flow json definition cloud flow โฟลว์", "2026-09-22"),
  ...TEMPLATES.map((t) => ({
    id: `tpl-${t.id}`, group: "template", kind: t.kind, icon: t.kind, href: `draw/?tpl=${t.id}`,
    th: t.title.th, en: t.title.en, keys: TPL_KEYS[t.id] || "",
  })),
  { id: "ai", group: "other", kind: "other", icon: "ai", href: "draw/?open=ai", th: "ให้ AI ช่วยร่าง", en: "Let an AI draft it",
    keys: "ai chatgpt copilot gemini claude ร่าง คำสั่ง prompt", since: "2026-09-22" },
  { id: "file", group: "other", kind: "other", icon: "file", href: "draw/?open=file", th: "เปิดไฟล์ผังเดิม", en: "Open a diagram file",
    keys: "เปิด แก้ ไฟล์ drawio png svg xml open edit file" },
];

/** ไอคอนเส้นบาง 7 แบบ (24x24 เส้นอย่างเดียว สีจาก currentColor ผ่าน .ico-svg ของ FileKit) */
export const ICONS = {
  lane: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9.4h18M3 14.7h18M7.5 4v16"/><rect x="9.5" y="5.6" width="4.5" height="2.3" rx=".6"/><rect x="15" y="16.2" width="4.5" height="2.3" rx=".6"/><path d="M14 6.8h2.6v9.4"/>',
  steps: '<rect x="3" y="3" width="8" height="5" rx="1.5"/><path d="M7 8v3"/><path d="M7 11l4 3.5-4 3.5-4-3.5z"/><path d="M11 14.5h4"/><rect x="15" y="12" width="6" height="5" rx="1.5"/>',
  org: '<rect x="9" y="3" width="6" height="4.5" rx="1.2"/><path d="M12 7.5v3M6 10.5h12M6 10.5v3M18 10.5v3"/><rect x="3" y="13.5" width="6" height="4.5" rx="1.2"/><rect x="15" y="13.5" width="6" height="4.5" rx="1.2"/>',
  system: '<rect x="3" y="4" width="7" height="6" rx="1.5"/><rect x="14" y="4" width="7" height="6" rx="1.5"/><rect x="8.5" y="15" width="7" height="6" rx="1.5"/><path d="M10 7h4M6.5 10v2.5h3M17.5 10v2.5h-3"/>',
  timeline: '<path d="M3 12h18"/><circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/><path d="M6 6v3M12 15v3M18 6v3"/>',
  pa: '<path d="M13 2.5L5.5 13h6l-1 8.5L18.5 11h-6z"/>',
  ai: '<path d="M11 3.5l1.7 4.4 4.4 1.7-4.4 1.7L11 15.7l-1.7-4.4-4.4-1.7 4.4-1.7z"/><path d="M18 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  file: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
};
