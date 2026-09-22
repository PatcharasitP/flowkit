// ใช้: node --import ./tests/_loader/register.mjs tests/<ชุด>.test.mjs
// ‼️ ไม่เจอ FileKit = หยุดพร้อมบอกวิธีแก้ ไม่ข้ามเงียบ (กติกา "ไม่มีสรุป = แดง")
import { register } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = process.env.FILEKIT_DIR || fileURLToPath(new URL("../../../FileKit/", import.meta.url));
if (!existsSync(dir + "/src/i18n.js")) {
  console.error(`❌ ไม่เจอไฟล์กลางของ FileKit ที่ ${dir}\n   clone repo filekit ไว้ข้าง ๆ FlowKit หรือตั้ง FILEKIT_DIR`);
  process.exit(2);
}
register("./hooks.mjs", import.meta.url);
