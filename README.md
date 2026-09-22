# FlowKit วาดผังจากข้อความ ในเบราว์เซอร์

พิมพ์ขั้นตอนทีละบรรทัด (หรือวาง flow ของ Power Automate) ได้ผังงาน ผังองค์กร ผังระบบ หรือไทม์ไลน์ ที่จัดวางให้เอง
ดาวน์โหลดเป็นไฟล์ `.drawio.png` วางสไลด์ได้ทันที และเปิดแก้ต่อใน draw.io ได้ ข้อความไม่ถูกส่งออกจากเครื่อง

เว็บ: https://patcharasitp.github.io/flowkit/

## สองหน้า

| หน้า | ที่อยู่ | ไฟล์ |
|---|---|---|
| หน้าแรก | `/flowkit/` | `index.html` , `home.css` , `src/home.js` , `src/catalog.js` |
| หน้าวาดผัง | `/flowkit/draw/` | `draw/index.html` , `draw/draw.css` , `src/draw.js` และตัววาด |

การ์ดบนหน้าแรกเป็นลิงก์ธรรมดา `draw/?kind=org` , `draw/?tpl=renewal` , `draw/?open=ai` , `draw/?open=file`
หน้าวาดใช้พารามิเตอร์ครั้งเดียวแล้วลบออกจากแถบที่อยู่ทันที (`src/params.js`) โหลดหน้าซ้ำจึงไม่ใส่เทมเพลตทับร่าง

## ใช้ไฟล์กลางร่วมกับ FileKit

FlowKit อยู่โดเมนเดียวกับ [FileKit](https://github.com/PatcharasitP/filekit) จึงใช้ไฟล์ของ FileKit ตรง ๆ ได้
ภาษา ธีม และการส่งผังเข้าเครื่องมือ FileKit จึงเป็นชุดเดียวกันทั้งสองเว็บ

- ทุกอย่างที่แตะ FileKit อยู่ใน `src/shared.js` ไฟล์เดียว (`/filekit/src/i18n.js` , `handoff.js` , `inapp.js`)
- ข้อยกเว้นเดียวคือฟอนต์ Sarabun ใน CSS (`/filekit/vendor/fonts/`) กับลิงก์ในแถบเว็บในเครือ
- `tests/shared_contract.test.mjs` คุมสัญญานี้ รันทั้งจาก repo นี้และจาก FileKit ก่อนปล่อยของทุกครั้ง

## รันในเครื่อง

ต้อง clone `filekit` ไว้ข้าง ๆ โฟลเดอร์นี้ (`../FileKit`)

```bash
python3 tests/serve.py 8899        # เปิด http://127.0.0.1:8899/flowkit/
```

`serve.py` เสิร์ฟสองเว็บใต้ที่อยู่เดียวเหมือนเว็บจริง และตัวพิมพ์ใหญ่เล็กของที่อยู่ต้องตรงเหมือน GitHub Pages

## ทดสอบ

```bash
tests/runp.sh all                                        # ทุกชุด บนเซิร์ฟเวอร์ในเครื่อง
ORIGIN=https://patcharasitp.github.io tests/runp.sh all  # ยิงเว็บจริง
node tests/<ชุด>.test.mjs --selftest                    # ทุกชุดมีโหมดพิสูจน์ว่าตัวตรวจจับของผิดได้
```

ทุกข้อถามของที่ผู้ใช้ได้จริง เช่น แกะ PNG ที่หน้าเว็บวาดแล้วอ่านข้อความทีละกล่อง และตรวจทุกคำขอว่าข้อความไม่ออกจากเครื่อง

## ข้อจำกัดที่รู้อยู่

- ต้องต่อเน็ต ตัววาดคือ draw.io ตัวฝังจาก embed.diagrams.net (ข้อความผังส่งเข้ากรอบของ draw.io ในเบราว์เซอร์เท่านั้น ไม่ออกไปเซิร์ฟเวอร์)
- ไม่มีโหมดออฟไลน์ และไม่มี service worker (รุ่นแรก)
