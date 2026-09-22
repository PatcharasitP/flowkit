// ธีม ภาษา และแถบเว็บในเครือ ใช้ทั้งหน้าแรกและหน้าวาดผัง (ถอดจาก flow/src/app.js เดิม พฤติกรรมเดียวกับหน้าแรก FileKit)
// ‼️ ค่าที่จำอยู่ใน localStorage คีย์ fk-theme , fk-lang เป็นของทั้งโดเมน สลับที่ FlowKit แล้ว FileKit ก็เปลี่ยนด้วย ตั้งใจ
import { tr, IS_EN, setLang } from "./shared.js";

export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* โหมดส่วนตัว */ } },
};

/** ต่อปุ่มธีม ปุ่มภาษา และลิงก์หมวดในแถบเว็บในเครือ
 *  beforeLangSwitch เรียกก่อนโหลดหน้าใหม่ตอนสลับภาษา (หน้าวาดใช้บันทึกร่าง) */
export function initChrome({ beforeLangSwitch } = {}) {
  const btn = document.querySelector("#theme");
  const name = { light: tr("โหมดสว่าง", "light"), dark: tr("โหมดมืด", "dark") };
  const apply = (v) => {
    if (v === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v;
    btn.ariaLabel = tr(`ธีม: ${name[v] || "ตามเครื่อง"} (กดเพื่อสลับ)`, `Theme: ${name[v] || "system"} (click to switch)`);
  };
  apply(store.get("fk-theme", "auto"));
  btn.addEventListener("click", () => {
    const cur = store.get("fk-theme", "auto");
    const now = cur !== "auto" ? cur : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = now === "dark" ? "light" : "dark";
    store.set("fk-theme", next);
    apply(next);
  });
  for (const b of document.querySelectorAll("#lang .langopt")) {
    const cur = b.dataset.lang === (IS_EN ? "en" : "th");
    b.setAttribute("aria-current", String(cur));
    b.setAttribute("aria-label", b.dataset.lang === "th" ? "ภาษาไทย" : "English");
    if (!cur) b.addEventListener("click", () => { if (beforeLangSwitch) beforeLangSwitch(); setLang(b.dataset.lang); });
  }
  /* ลิงก์หมวดในแถบท้ายเว็บ ฝากหมวดไว้ให้หน้าแรก FileKit กรองให้ (กลไกเดียวกับ FileKit src/app.js) */
  for (const a of document.querySelectorAll(".sites a[data-gocat]")) {
    a.addEventListener("click", () => { try { if (a.dataset.gocat) sessionStorage.setItem("fk:gocat", a.dataset.gocat); } catch { /* โหมดส่วนตัว */ } });
  }
}
