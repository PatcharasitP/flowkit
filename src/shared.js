// ‼️ จุดเดียวที่ FlowKit แตะไฟล์ของ FileKit (แผนเว็บ FlowKit แยก D2 , 22/09/2026)
//    FlowKit (repo flowkit) กับ FileKit (repo filekit) อยู่โดเมนเดียวกัน patcharasitp.github.io
//    จึงใช้ไฟล์กลางของ FileKit ตรง ๆ ได้ ภาษา ธีม และการส่งไฟล์เข้าเครื่องมือ FileKit เป็นชุดเดียวกันทั้งสองเว็บ
// ‼️ tests/shared_contract.test.mjs อ่านไฟล์นี้ ทั้ง FlowKit และ FileKit รันเทสนั้นก่อนปล่อยของ
//    ห้ามเขียนที่อยู่ /filekit/ ในไฟล์อื่น (เทสกวาดทุกไฟล์) ยกเว้นฟอนต์ใน CSS กับลิงก์ในแถบเว็บในเครือ
export { tr, IS_EN, LANG, pl, setLang, applyStatic } from "/filekit/src/i18n.js";
export const FILEKIT = "/filekit/";                                    // ลิงก์กลับบ้านและปลายทางส่งต่อ
export const loadHandoff = () => import("/filekit/src/handoff.js");    // ส่งผังเข้าเครื่องมือ FileKit (โหลดตอนกด)
export const loadInApp = () => import("/filekit/src/inapp.js");        // เปิดจาก LINE ฯลฯ ต้องส่งผ่าน share sheet
