/* สัญญาไฟล์กลาง: FlowKit ใช้ไฟล์ของ FileKit ตรง ๆ ข้าม repo (แผนเว็บ FlowKit แยก ข้อ 6 , 22/09/2026)
 *
 * ‼️ ทำไมต้องมี: สองเว็บปล่อยของคนละจังหวะ ถ้า FileKit เปลี่ยนชื่อหรือตัด export ที่ FlowKit ใช้
 *    หน้า FlowKit บนเว็บจริงพังทันทีโดยไม่มีใครแตะ FlowKit เลย เทสนี้จึงรันจากทั้งสอง repo
 *    (FlowKit: tests/runp.sh all , FileKit: tests/runp.sh contract ก่อนปล่อยของทุกครั้ง)
 * ตรวจ ① ทุกที่อยู่ /filekit/ ใน src/shared.js มีไฟล์จริงใน FileKit (ตัวพิมพ์ตรง)
 *      ② import จริงผ่านตัวแปลง แล้ว export ทุกตัวเป็นชนิดที่คาด และเรียกใช้จริงได้ผลถูก
 *      ③ กวาดทุกไฟล์เว็บของ FlowKit: /filekit/ อยู่ได้แค่ใน src/shared.js , ฟอนต์ใน CSS/preload , ลิงก์แถบเว็บในเครือกับประตู
 *         และห้ามมีที่อยู่ FileKit/ ตัวใหญ่ (โฟลเดอร์ในเครื่อง) ในไฟล์เว็บเลย GitHub Pages แยกตัวพิมพ์
 * ‼️ ถ้าผิดจะรู้ได้ยังไง: --selftest ① รันเทสนี้ใหม่กับ FileKit ปลอมที่ตัด export หนึ่งตัว ต้องแดง
 *                                  ② ใส่ /filekit/src/x.js ในไฟล์ปลอม ต้องแดง , ③ ใส่ FileKit/ ตัวใหญ่ ต้องแดง
 * รัน: node tests/shared_contract.test.mjs  (หรือ --selftest) ตั้ง FILEKIT_DIR ชี้ FileKit ที่อื่นได้ */
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
await import("./_loader/register.mjs");
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const FK = process.env.FILEKIT_DIR || join(ROOT, "..", "FileKit");
const SELFTEST = process.argv.includes("--selftest");

let pass = 0; const fail = [];
const ck = (ok, msg, detail = "") => {
  if (ok) { pass++; console.log("  ✅ " + msg); }
  else { fail.push(msg); console.log("  ❌ " + msg + (detail ? "\n      " + detail : "")); }
};

/** ไฟล์ที่ทุกชื่อตรงตัวพิมพ์จริง (ดิสก์ /mnt/c ไม่สนตัวพิมพ์ แต่ GitHub Pages สน) */
function exact(base, rel) {
  let cur = base;
  for (const part of rel.split("/").filter(Boolean)) {
    if (!existsSync(cur) || !statSync(cur).isDirectory() || !readdirSync(cur).includes(part)) return false;
    cur = join(cur, part);
  }
  return existsSync(cur);
}

/** ไฟล์เว็บทั้งหมดของ FlowKit (ไม่รวมเทสกับของที่ไม่ขึ้นเว็บ) */
function webFiles() {
  const out = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n), r = relative(ROOT, p).replaceAll("\\", "/");
      if (/^(tests|\.git|node_modules)(\/|$)/.test(r) || n.startsWith(".")) continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(js|mjs|css|html)$/.test(n)) out.push([r, readFileSync(p, "utf8")]);
    }
  };
  walk(ROOT);
  return out;
}

/** ตัดคอมเมนต์ออกก่อนกวาด (คอมเมนต์เล่าที่มาได้ ไม่ใช่ที่อยู่ที่เบราว์เซอร์จะขอ) ‼️ ไม่ตัด // ที่อยู่หลัง : (https://) */
const strip = (name, s) => name.endsWith(".html") ? s.replace(/<!--[\s\S]*?-->/g, "")
  : s.replace(/\/\*[\s\S]*?\*\//g, "").replace(name.endsWith(".css") ? /$^/ : /(^|[^:"'\w])\/\/.*$/gm, "$1");

/** ที่อยู่ /filekit/ ที่ผิดที่ และ FileKit/ ตัวใหญ่ ในไฟล์เว็บ */
function sweep(files) {
  const bad = [];
  for (const [name, raw] of files) {
    const s = strip(name, raw);
    s.split("\n").forEach((ln, i) => {
      if (/FileKit\//.test(ln)) bad.push(`${name}:${i + 1} มี FileKit/ ตัวใหญ่ ${ln.trim().slice(0, 60)}`);
      if (!ln.includes("/filekit/") || name === "src/shared.js") return;
      const font = /\/filekit\/vendor\/fonts\/Sarabun-(Regular|SemiBold|Bold)\.woff2/.test(ln) && /@font-face|rel="preload"/.test(ln);
      const link = name.endsWith(".html") && /^\s*(<li>)?<a [^>]*href="\/filekit\/[^"]*"/.test(ln);
      if (!font && !link) bad.push(`${name}:${i + 1} ${ln.trim().slice(0, 70)}`);
    });
  }
  return bad;
}

async function main() {
  console.log(`\n━━ ① ที่อยู่ใน src/shared.js มีไฟล์จริงใน FileKit (${FK}) ━━`);
  const shared = readFileSync(join(ROOT, "src/shared.js"), "utf8");
  const code = strip("shared.js", shared);
  const paths = [...new Set([...code.matchAll(/"\/filekit\/([^"]*)"/g)].map((m) => m[1]))];
  ck(paths.length >= 4, `เจอที่อยู่ /filekit/ ใน shared.js ${paths.length} ตัว`, paths.join(" , "));
  for (const p of paths.filter((p) => p.endsWith(".js"))) ck(exact(FK, p), `FileKit มี ${p} (ตัวพิมพ์ตรง)`);
  for (const w of ["Regular", "SemiBold", "Bold"]) ck(exact(FK, `vendor/fonts/Sarabun-${w}.woff2`), `FileKit มีฟอนต์ Sarabun-${w}.woff2`);

  console.log("\n━━ ② import จริง export ครบ ใช้ได้จริง ━━");
  const named = (code.match(/export \{([^}]*)\} from "\/filekit\/src\/i18n\.js"/) || [, ""])[1].split(",").map((s) => s.trim()).filter(Boolean);
  ck(named.length === 6, `shared.js ส่งต่อ export ของ i18n ${named.length} ตัว`, named.join(","));
  let m;
  try { m = await import(pathToFileURL(join(ROOT, "src/shared.js")).href); }
  catch (e) { ck(false, "import src/shared.js ผ่านตัวแปลงได้", String(e).slice(0, 200)); return; }
  ck(true, "import src/shared.js ผ่านตัวแปลงได้");
  const want = { tr: "function", pl: "function", setLang: "function", applyStatic: "function", IS_EN: "boolean", LANG: "string" };
  for (const n of named) ck(typeof m[n] === want[n], `${n} เป็น ${want[n] || "?"}`, `ได้ ${typeof m[n]}`);
  ck(m.tr("ก", "a") === "ก" && m.LANG === "th" && m.IS_EN === false, 'tr("ก","a") ได้ "ก" ตอนภาษาไทย');
  ck(m.pl(1, "page", "pages") === "1 page" && m.pl(2, "page", "pages") === "2 pages", "pl() ได้เอกพจน์พหูพจน์ถูก");
  ck(m.FILEKIT === "/filekit/", "FILEKIT = /filekit/");
  const h = await m.loadHandoff();
  ck(typeof h.send === "function" && typeof h.receive === "function" && h.FLAG === "fk:handoff", "handoff.js มี send , receive และธง fk:handoff");
  const ia = await m.loadInApp();
  ck(["inApp", "inAppBanner", "saveViaShare"].every((k) => typeof ia[k] === "function"), "inapp.js มี inApp , inAppBanner , saveViaShare");

  console.log("\n━━ ③ ไม่มีที่อยู่ /filekit/ ผิดที่ และไม่มี FileKit/ ตัวใหญ่ในไฟล์เว็บ ━━");
  const files = webFiles();
  ck(files.length >= 15, `กวาดไฟล์เว็บ ${files.length} ไฟล์`);
  const bad = sweep(files);
  ck(!bad.length, "ที่อยู่ของ FileKit อยู่แค่ในที่อนุญาต", bad.slice(0, 5).join("\n      "));
  const used = files.filter(([n, s]) => n !== "src/shared.js" && /\.js$/.test(n) && /from "\/filekit\/|import\("\/filekit\//.test(strip(n, s)));
  ck(!used.length, "โมดูลอื่นไม่ import จาก /filekit/ ตรง ๆ (ต้องผ่าน shared.js)", used.map(([n]) => n).join(" , "));
}

/** FileKit ปลอมที่ตัด export ตัวหนึ่งออก แล้วรันเทสนี้ใหม่ ต้องแดง */
function selftest() {
  console.log("\n━━ selftest ━━");
  const tmp = mkdtempSync(join(tmpdir(), "fk-contract-"));
  try {
    for (const f of ["src/i18n.js", "src/handoff.js", "src/inapp.js", "vendor/fonts/Sarabun-Regular.woff2", "vendor/fonts/Sarabun-SemiBold.woff2", "vendor/fonts/Sarabun-Bold.woff2"]) {
      mkdirSync(dirname(join(tmp, f)), { recursive: true }); copyFileSync(join(FK, f), join(tmp, f));
    }
    const i18n = readFileSync(join(tmp, "src/i18n.js"), "utf8");
    writeFileSync(join(tmp, "src/i18n.js"), i18n.replace(/export function applyStatic\b/, "function applyStatic"));
    const run = (env) => spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, ...env }, encoding: "utf8" });
    const good = run({ FILEKIT_DIR: FK });
    ck(good.status === 0, "FileKit จริง เทสเขียว (กลุ่มควบคุม)", (good.stdout || "").split("\n").filter((l) => l.includes("❌")).join(" | "));
    const broke = run({ FILEKIT_DIR: tmp });
    ck(broke.status !== 0 && /applyStatic/.test(broke.stdout), "FileKit ที่ตัด export applyStatic เทสแดง และบอกชื่อตัวที่หาย", `rc ${broke.status}`);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  const fake = [["src/fake.js", 'import { x } from "/filekit/src/x.js";'], ["draw/fake.css", 'a{background:url("/filekit/assets/x.png")}'],
                ["fake.html", '<script src="/FileKit/src/i18n.js"></script>'], ["ok.css", '@font-face{src:url("/filekit/vendor/fonts/Sarabun-Bold.woff2")}'],
                ["ok.html", '    <li><a href="/filekit/#/">x</a></li>'], ["ok2.js", '// เล่าที่มา /filekit/src/i18n.js ในคอมเมนต์ได้']];
  const bad = sweep(fake).map((b) => b.split(":")[0]);
  ck(bad.includes("src/fake.js") && bad.includes("draw/fake.css") && bad.includes("fake.html"), "ตัวกวาดจับ import ตรง , รูปใน CSS , FileKit/ ตัวใหญ่", bad.join(" , "));
  ck(!bad.some((n) => n.startsWith("ok")), "ตัวกวาดปล่อยฟอนต์ ลิงก์แถบเว็บ และคอมเมนต์", bad.join(" , "));
}

if (SELFTEST) selftest(); else await main();
console.log(`\n${fail.length ? "❌" : "✅"} ผ่าน ${pass} ข้อ, ตก ${fail.length} ข้อ`);
process.exit(fail.length ? 1 : 0);
