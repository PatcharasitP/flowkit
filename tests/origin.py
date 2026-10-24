"""ที่อยู่สองเว็บที่เทสยิง (แผนเว็บ FlowKit แยก ข้อ 8.3)
ORIGIN = http://127.0.0.1:PORT (tests/serve.py mount สองโฟลเดอร์) หรือ https://patcharasitp.github.io (เว็บจริง)
‼️ ห้ามเขียน /flowkit/ หรือ /filekit/ เองในเทส ใช้ค่าจากไฟล์นี้ ย้ายที่อยู่วันหน้าแก้ที่เดียว"""
import os

ORIGIN = os.environ.get("ORIGIN", "http://127.0.0.1:8899").rstrip("/")
FLOWKIT = ORIGIN + "/flowkit"          # หน้าแรก FlowKit = FLOWKIT + "/"
DRAW = FLOWKIT + "/draw/"              # หน้าวาดผัง
FILEKIT = ORIGIN + "/filekit"          # ปลายทางส่งต่อ และเจ้าของไฟล์กลาง

# ‼️ 24/10/2026 embed.diagrams.net ตอบ 403 กับ user agent ที่มีคำว่า HeadlessChrome (curl กับ Chrome ปกติได้ 200 , วัดแล้ว)
#    ตัววาดซ่อนโหลดไม่ขึ้น หน้าวาดค้างที่ booting ทุกเทส ผู้ใช้จริงไม่โดน
#    ทุกเทส import ไฟล์นี้ จึงเติม UA ค่าเริ่มต้นที่นี่ที่เดียว: ข้อความเดิมของ Playwright ทุกตัวอักษร ตัดแค่ Headless ออก
#    เทสที่ส่ง user_agent เองยังได้ของตัวเอง
from playwright.sync_api import Browser


def _real_ua(fn):
    def wrap(self, *a, **kw):
        kw.setdefault("user_agent", f"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{self.version} Safari/537.36")
        return fn(self, *a, **kw)
    return wrap


Browser.new_context = _real_ua(Browser.new_context)
Browser.new_page = _real_ua(Browser.new_page)
