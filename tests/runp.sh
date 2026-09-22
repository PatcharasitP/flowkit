#!/usr/bin/env bash
# รันเทสของ FlowKit แบบขนาน บนเซิร์ฟเวอร์ที่ยืนยันแล้วว่าเสิร์ฟโค้ดชุดนี้จริง (ดัดแปลงจาก FileKit/tests/runp.sh)
#
# ‼️ ต่างจากของ FileKit 3 ข้อ (แผนเว็บ FlowKit แยก ข้อ 8.3)
#    ① เซิร์ฟเวอร์คือ tests/serve.py ที่ mount สองเว็บ (/flowkit/ = repo นี้ , /filekit/ = FileKit ข้าง ๆ) ไม่ใช่ http.server
#    ② ทุกชุดได้ ORIGIN ไม่ใช่ FK_BASE ตั้ง ORIGIN เองเพื่อยิงเว็บจริง แล้วตัวนี้ไม่เปิดเซิร์ฟเวอร์
#    ③ ยืนยันชุดด้วย <meta name="flowkit-version"> (FlowKit ไม่มี service worker จึงไม่มี VERSION ใน sw.js)
#
# ใช้: tests/runp.sh all                                      (ทุกชุด browser + node)
#      tests/runp.sh browser_flowkit flow_parse.test.mjs
#      ORIGIN=https://patcharasitp.github.io tests/runp.sh all  (ยิงเว็บจริงแบบเย็น)
#      JOBS=6 tests/runp.sh all
set -u
cd "$(dirname "$0")/.."
PY="${PY:-../.venv/bin/python}"
JOBS="${JOBS:-4}"
OUT="${OUT:-/tmp/flowkit-runp}"
# ชุดที่ต้องรันเดี่ยว เพราะวัดเวลา (รันขนานแล้วตัวเลขเพี้ยน บทเรียน browser_trust ของ FileKit 22/09/2026)
SOLO="browser_flowperf"

want=$(grep -m1 -oE 'flowkit-v[0-9]+' draw/index.html)
pids_srv=""
free_port() { python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()'; }
if [ -z "${ORIGIN:-}" ]; then
  python3 tests/serve.py --selftest >/dev/null || { echo "❌ serve.py --selftest ไม่ผ่าน หยุด"; exit 2; }
  PORT=$(free_port); python3 tests/serve.py "$PORT" >/dev/null 2>&1 & pids_srv="$pids_srv $!"
  GZPORT=$(free_port); python3 tests/serve.py "$GZPORT" --gzip >/dev/null 2>&1 & pids_srv="$pids_srv $!"
  trap 'kill $pids_srv 2>/dev/null' EXIT
  ORIGIN="http://127.0.0.1:$PORT"; GZORIGIN="http://127.0.0.1:$GZPORT"
  for _ in $(seq 1 40); do curl -s -o /dev/null "$ORIGIN/flowkit/draw/" && curl -s -o /dev/null "$GZORIGIN/flowkit/draw/" && break; sleep 0.2; done
else
  ORIGIN="${ORIGIN%/}"; GZORIGIN="$ORIGIN"          # เว็บจริงบีบ gzip เองอยู่แล้ว
fi
got=$(curl -s "$ORIGIN/flowkit/draw/" | grep -m1 -oE 'flowkit-v[0-9]+')
if [ "$want" != "$got" ]; then echo "❌ $ORIGIN เสิร์ฟคนละชุด (ไฟล์ $want แต่ได้ ${got:-ไม่มี}) หยุด"; exit 2; fi
echo "▶ $ORIGIN เสิร์ฟ $got  ขนานครั้งละ $JOBS ชุด  บันทึกไว้ที่ $OUT/"

if [ "${1:-}" = "all" ]; then
  set -- $(ls tests/browser_*.py | sed 's#tests/##; s#\.py$##') $(ls tests/*.test.mjs | sed 's#tests/##')
fi
rm -rf "$OUT"; mkdir -p "$OUT"

run_one() {
  t="$1"; o="$ORIGIN"
  case " $SOLO " in *" $t "*) o="$GZORIGIN";; esac
  case "$t" in
    *.mjs) ORIGIN="$o" timeout "${TMO:-600}" node "tests/$t" >"$OUT/$t.log" 2>&1 ;;
    *)     ORIGIN="$o" timeout "${TMO:-600}" "$PY" "tests/$t.py" >"$OUT/$t.log" 2>&1 ;;
  esac
  echo "$?" >"$OUT/$t.rc"
  if [ "$(cat "$OUT/$t.rc")" = "0" ]; then printf '  ✅ %s\n' "$t"; else printf '  ❌ %s\n' "$t"; fi
}

par=""; solo=""
for t in "$@"; do
  case " $SOLO " in *" $t "*) solo="$solo $t";; *) par="$par $t";; esac
done
# ‼️ รอเฉพาะงานเทส ห้าม wait เปล่า (เซิร์ฟเวอร์ก็เป็นงานเบื้องหลัง wait เปล่ารอมันปิดไม่มีวันจบ บทเรียน FileKit 22/09/2026)
running=0; pids=""
for t in $par; do
  run_one "$t" & pids="$pids $!"; running=$((running+1))
  if [ "$running" -ge "$JOBS" ]; then wait -n; running=$((running-1)); fi
done
[ -n "$pids" ] && wait $pids 2>/dev/null
for t in $solo; do run_one "$t"; done

fail=0; total=0
for f in "$OUT"/*.rc; do
  [ -e "$f" ] || continue
  total=$((total+1)); [ "$(cat "$f")" = "0" ] || fail=$((fail+1))
done
# ‼️ ไม่มีชุดไหนรันเลย = แดง (กติกา "ไม่มีสรุป = แดง" ของ FileKit)
if [ "$total" -eq 0 ]; then echo "❌ ไม่มีชุดไหนถูกรัน"; exit 1; fi
echo "━━ รวม $total ชุด, ตก $fail ชุด  (log เต็มอยู่ใน $OUT/<ชื่อชุด>.log)"
[ "$fail" -eq 0 ]
