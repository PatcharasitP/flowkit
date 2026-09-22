"""ที่อยู่สองเว็บที่เทสยิง (แผนเว็บ FlowKit แยก ข้อ 8.3)
ORIGIN = http://127.0.0.1:PORT (tests/serve.py mount สองโฟลเดอร์) หรือ https://patcharasitp.github.io (เว็บจริง)
‼️ ห้ามเขียน /flowkit/ หรือ /filekit/ เองในเทส ใช้ค่าจากไฟล์นี้ ย้ายที่อยู่วันหน้าแก้ที่เดียว"""
import os

ORIGIN = os.environ.get("ORIGIN", "http://127.0.0.1:8899").rstrip("/")
FLOWKIT = ORIGIN + "/flowkit"          # หน้าแรก FlowKit = FLOWKIT + "/"
DRAW = FLOWKIT + "/draw/"              # หน้าวาดผัง
FILEKIT = ORIGIN + "/filekit"          # ปลายทางส่งต่อ และเจ้าของไฟล์กลาง
