// หน้าแรก FlowKit: ปุ่มหมวด ค้นหา และการ์ดจุดเริ่ม 15 ใบ (แผนเว็บ FlowKit แยก ข้อ 4)
// โครงหน้าตาลอกจากหน้าแรก FileKit (src/app.js ของ FileKit) ใช้คลาสชุดเดียวกัน .cat .pill .pill-group .empty
// ‼️ ห้ามใส่ style ในแท็ก CSP ของหน้านี้ไม่มี unsafe-inline สีประจำหมวดใช้ data-kind แล้ว home.css แปลงเป็นสี
//    (FileKit ใส่ style="--ac:..." ได้เพราะหน้าแรกของเขามี unsafe-inline)
import { tr, IS_EN, pl } from "./shared.js";
import { initChrome } from "./chrome.js";
import { CATALOG, KINDS, GROUPS, ICONS, isNew } from "./catalog.js";

initChrome();
const $ = (s) => document.querySelector(s);
const L = (x) => (IS_EN ? x.en : x.th);
const grids = $("#tools"), cats = $("#cats"), search = $("#q"), searchBox = $("#searchbox"), hits = $("#hits"), stageH = $("#stageh");
let active = "";                                  // "" = ทุกชนิด

function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  for (const k of [].concat(kids)) if (k !== false && k != null) n.append(k);
  return n;
}
function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "ico-svg"); svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = ICONS[name];                    // ของนิ่งใน catalog.js เท่านั้น ไม่มีข้อความจากผู้ใช้
  return svg;
}

/* ── ค้นหา: ชื่อภาษาที่ใช้อยู่ก่อน แล้วชื่ออีกภาษา แล้วคำค้นแฝง (คนค้นด้วยคำของตัวเอง ไม่ใช่ชื่อการ์ด) ── */
const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
function score(c, q) {
  const t = norm(L(c)), o = norm(IS_EN ? c.th : c.en), k = norm(c.keys || "");
  if (t.startsWith(q)) return 4;
  if (t.includes(q)) return 3;
  if (o.includes(q)) return 2;
  return q.split(" ").every((w) => t.includes(w) || o.includes(w) || k.includes(w)) ? 1 : 0;
}

/** ชื่อการ์ด: วลีละก้อน (.w ไม่ตัดบรรทัดข้างใน ดู home.css) + ไฮไลต์คำค้น ไฮไลต์ข้ามวลีได้ */
function label(title, q) {
  const at = q ? title.toLowerCase().indexOf(q) : -1, out = [];
  let pos = 0;
  title.split(" ").forEach((w, n) => {
    if (n) out.push(" ");
    const s = pos, e = pos + w.length, span = el("span", { class: "w" });
    if (at >= 0 && at < e && at + q.length > s) {
      const a = Math.max(at, s) - s, b = Math.min(at + q.length, e) - s;
      span.append(w.slice(0, a), el("mark", {}, w.slice(a, b)), w.slice(b));
    } else span.append(w);
    out.push(span);
    pos = e + 1;
  });
  return out;
}
function card(c, q = "") {
  return el("a", { class: "pill", href: c.href, "data-id": c.id, "data-kind": c.kind }, [
    el("i", { "aria-hidden": "true" }, [icon(c.icon)]), el("span", {}, label(L(c), q)),
    isNew(c) && el("b", { class: "new" }, tr("ใหม่", "New"))]);
}

function renderCats() {
  cats.replaceChildren();
  const mk = (id, name, n) => {
    const b = el("button", { class: "cat", type: "button", "aria-pressed": String(active === id), "data-kind": id || "all" }, [name, el("b", {}, String(n))]);
    b.addEventListener("click", () => {
      active = active === id ? "" : id;
      if (search.value) { search.value = ""; searchBox.classList.remove("has"); }   // กดหมวด = ดูหมวดนั้น ไม่ค้างผลค้นหา
      renderCats(); render();
    });
    return b;
  };
  cats.append(mk("", tr("ทั้งหมด", "All"), CATALOG.length));
  for (const k of KINDS) {
    const n = CATALOG.filter((c) => c.kind === k.id).length;
    if (n) cats.append(mk(k.id, L(k), n));
  }
}

function showEmpty(q) {
  const btn = el("button", { class: "btn-soft", type: "button" }, tr("ล้างคำค้นหา แล้วดูทั้งหมด", "Clear search and show everything"));
  btn.addEventListener("click", clearSearch);
  grids.append(el("div", { class: "empty" }, [
    el("b", {}, tr(`ไม่พบจุดเริ่มที่ตรงกับ “${q}”`, `Nothing matches “${q}”`)),
    el("div", {}, tr("ลองพิมพ์สั้นลง หรือใช้คำอื่น เช่น “อนุมัติ”, “องค์กร”, “ระบบ”", "Try a shorter word, or another one: “approval”, “org”, “system”")),
    btn]));
}

function render() {
  const raw = search.value.trim(), q = norm(raw);
  grids.replaceChildren();
  if (q) {
    const found = CATALOG.map((c) => [score(c, q), c]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).map(([, c]) => c);
    hits.textContent = found.length ? tr(`พบ ${found.length} จุดเริ่ม`, `${pl(found.length, "starting point", "starting points")} found`) : "";
    stageH.textContent = found.length ? tr(`ผลการค้นหา “${raw}”`, `Results for “${raw}”`) : "";
    if (!found.length) return showEmpty(raw);
    grids.append(el("div", { class: "pills" }, found.map((c) => card(c, q))));
    return;
  }
  hits.textContent = "";
  const shown = CATALOG.filter((c) => !active || c.kind === active);
  const kindName = active ? L(KINDS.find((k) => k.id === active)) : "";
  stageH.textContent = active
    ? tr(`${kindName}, ${shown.length} จุดเริ่ม`, `${kindName}, ${pl(shown.length, "starting point", "starting points")}`)
    : tr(`${CATALOG.length} จุดเริ่ม วาดในเครื่องคุณทั้งหมด`, `${CATALOG.length} starting points, all drawn on your device`);
  /* ‼️ หัวกลุ่มโชว์เมื่อมีมากกว่าหนึ่งกลุ่ม (กติกาเดียวกับ FileKit) กรองขั้นตอนแล้วยังแยกหน้าว่างกับเทมเพลตออก */
  const groups = GROUPS.filter((g) => shown.some((c) => c.group === g.id));
  const box = el("div", { class: "pills" });
  for (const g of groups) {
    if (groups.length > 1) box.append(el("div", { class: "pill-group" }, [L(g), el("s")]));
    for (const c of shown.filter((c) => c.group === g.id)) box.append(card(c));
  }
  grids.append(box);
}

function clearSearch() {
  search.value = "";
  searchBox.classList.remove("has");
  render();
  search.focus();
}
let timer = 0;
search.addEventListener("input", () => {
  searchBox.classList.toggle("has", !!search.value);
  clearTimeout(timer);
  timer = setTimeout(() => { if (search.value.trim()) { active = ""; renderCats(); } render(); }, 90);
});
$("#qclear").addEventListener("click", clearSearch);
search.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && search.value) { e.preventDefault(); clearSearch(); }
  if (e.key === "ArrowDown" || e.key === "Enter") {
    const first = grids.querySelector("a.pill");
    if (first) { e.preventDefault(); e.key === "Enter" ? first.click() : first.focus(); }
  }
});

/* ── หัวเว็บทึบขึ้นเมื่อเลื่อน , แถบหมวดบนมือถือหลบเมื่อเลื่อนลง (พฤติกรรมเดียวกับ FileKit) ── */
{
  const root = document.documentElement;
  let ticking = false, lastY = 0;
  const HIDE_AFTER = 220;
  const sync = () => {
    ticking = false;
    const y = window.scrollY;
    if (y > 8) root.dataset.scrolled = ""; else root.removeAttribute("data-scrolled");
    if (y > HIDE_AFTER && y > lastY + 6) root.dataset.hidecats = "";
    else if (y < lastY - 6 || y <= HIDE_AFTER) root.removeAttribute("data-hidecats");
    lastY = y;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(sync); } }, { passive: true });
  sync();
}

renderCats();
render();
