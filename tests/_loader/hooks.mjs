// ‼️ แปลงที่อยู่ "/filekit/..." ในโค้ดเว็บของ FlowKit ให้ชี้โฟลเดอร์ FileKit บนดิสก์ ตอนรันเทสด้วย node
//    บนเว็บจริงเบราว์เซอร์ขอ /filekit/... จากโดเมนเดียวกันเอง (แผนเว็บ FlowKit แยก D2 , พิสูจน์ P4 22/09/2026 Node 20)
//    FILEKIT_DIR ตั้งเองได้ ไม่ตั้ง = โฟลเดอร์ FileKit ข้าง ๆ repo นี้
import { pathToFileURL } from "node:url";

const DIR = process.env.FILEKIT_DIR
  ? pathToFileURL(process.env.FILEKIT_DIR.replace(/\/?$/, "/")).href
  : new URL("../../../FileKit/", import.meta.url).href;

export async function resolve(spec, ctx, next) {
  if (spec.startsWith("/filekit/")) return next(DIR + spec.slice("/filekit/".length), ctx);
  return next(spec, ctx);
}
