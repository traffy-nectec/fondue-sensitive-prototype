# Prototype ฟีเจอร์ Sensitive

หน้าเว็บ static หน้าเดียว มีแท็บสลับดูได้ทั้ง 3 platform
ให้ทีมกดลอง flow ปกปิดข้อมูลอ่อนไหวได้ก่อนระบบจริงขึ้น

**เป็น HTML เขียนมือล้วน** — ไม่มี framework ไม่มี build step ไม่มี node_modules
ไม่ต้อง login ไม่เรียก API อะไรทั้งสิ้น เปิดแล้วกดใช้ได้เลย

```
index.html          หน้าเดียวที่ทีมเปิด — แท็บ + iframe ของแต่ละ platform
liff/               หน้า LIFF ผู้แจ้ง
web/                หน้าเจ้าหน้าที่ฝั่งเว็บ (citydata)
app/                หน้าเจ้าหน้าที่ฝั่งแอป (FondueManager)
shared/             ข้อมูลจำลอง + flow ที่ web กับ app ใช้ร่วมกัน + ภาพ render จริง
```

`index.html` โหลดแต่ละ platform เข้ามาเป็น iframe ทำให้ทีมเห็นหน้าเดียว
แต่แต่ละคนยังแก้ไฟล์ของตัวเองแยกกันได้ ไม่ชนกัน · แท็บผูกกับ hash
(`#liff` `#web` `#app`) ส่งลิงก์ตรงไปแท็บที่ต้องการได้

## รันดูในเครื่อง

```bash
python3 -m http.server 8899
```

แล้วเปิด `http://127.0.0.1:8899/` — เปิดด้วย `file://` ไม่ได้เพราะใช้ ES module

## PIN สำหรับทดลอง

ครั้งแรกระบบจะให้ตั้ง PIN 6 หลัก ตั้งอะไรก็ได้ ถ้าไม่อยากตั้งเองใช้ `123456`
PIN เก็บใน `sessionStorage` — ปิดแท็บแล้วเปิดใหม่คือเริ่มต้นใหม่

---

## แต่ละหน้าลอกมาจากไหน

ทุกหน้าเขียนมือ โดยลอก markup และ style จากโค้ดจริงของแต่ละ platform

**`liff/`** — ลอกจาก `fondue-liff-my-case` ชื่อ class ตรงกับของจริงทั้งหมด
(`sensitive-locked-toolbar`, `sensitive-pin-modal`, `sensitive-rendered-page` ฯลฯ)
อ้างอิง `Detail.jsx`, `SensitiveCaseView.jsx`, `SensitivePinModal.jsx`,
`SensitiveFullImageViewer.jsx` · `assets/liff-real.css` คือ CSS ที่ compile
จาก `sensitive.scss` + `Detail.scss` ของจริง ฟอนต์ IBM Plex Sans Thai ก็ของจริง

**`web/`** กับ **`app/`** — โค้ดฝั่งเจ้าหน้าที่ยังไม่มีส่วน sensitive
สองหน้านี้จึงลอกเฉพาะโครงหน้า detail ที่มีอยู่ ส่วนที่ยังไม่มีทำเป็นกรอบเส้นประไว้
`app/` วาดในกรอบมือถือเพื่อให้เห็นบริบท

> ถ้าหน้าไหนยังไม่เหมือนของจริง บอกได้ แก้ให้ก่อน push

**คนที่มาทำหน้า `web/` หรือ `app/` ต่อ อ่าน [docs/BRIEF.md](docs/BRIEF.md) ก่อน**

## จะแก้ UI ยังไง

`shared/sensitive-mock.js` คือข้อมูลจำลองกลางที่ทุกหน้าใช้ร่วมกัน
ลำดับการเรียกเหมือนของจริงทุกอย่าง ต่างแค่ไม่ได้ยิง HTTP

```
getCredentialStatus()         → เคยตั้ง PIN หรือยัง
createSensitivePin(pin)       → ตั้ง PIN ครั้งแรก
unlockSensitiveCase(id, pin)  → ปลดล็อก ได้ view token
getRenderedContent(id)        → ได้ URL ภาพหลายหน้า + ภาพแนบ
revokeViewSession(token)      → ปิดหน้าจอ คืน session
```

state ที่ทุกหน้าต้องมี

| state | ต้องแสดงอะไร |
| --- | --- |
| ล็อกอยู่ | ข้อมูลฉบับปกปิด + ปุ่มปลดล็อก |
| ตั้ง PIN | ฟอร์มตั้ง PIN ครั้งแรก + ยืนยัน PIN |
| กรอก PIN | ฟอร์มกรอก PIN + จำนวนครั้งที่เหลือเมื่อผิด |
| กำลังโหลด | ระหว่างสร้างภาพ |
| ปลดล็อกแล้ว | ภาพหลายหน้า + ปุ่มดูภาพทั้งหมด |

`liff/liff.js` เขียน UI ของ LIFF แยกไว้เพราะหน้าตาต่างจากอีกสองตัว
ส่วน `web/` กับ `app/` ใช้ `shared/sensitive-flow.js` ร่วมกัน

## ภาพตัวอย่างจาก renderer

`shared/real-render/` เป็นภาพที่สร้างด้วย renderer รุ่น `2026-09-02-v0.8.0`
จากข้อมูล mock เก็บเป็นไฟล์ static — 3 หน้า (1200×1800 WebP) + ภาพแนบ 1 รูป
ตัวเรื่องเป็นข้อมูลจำลอง แต่ลายน้ำใช้ implementation จริงที่สุ่มฟอนต์ ขนาด
และตำแหน่งของแต่ละชิ้น เพื่อให้รีวิวลายน้ำพร้อม UI ได้โดยไม่มีข้อมูลจริงติด repo

ทุกหน้าอ่าน `shared/real-render/manifest.json` แล้วใช้ภาพเหล่านี้อัตโนมัติ
ถ้าลบโฟลเดอร์ทิ้ง จะตกกลับไปใช้ SVG จำลองใน `shared/` เงียบๆ

ถ้าต้องการดึงภาพจากเรื่อง KMS จริง ใช้สคริปต์ที่เก็บไว้นอก repo:

```bash
../fetch-real-render.sh 2026-62CT43
```

สคริปต์ไม่ได้อยู่ใน repo เพราะไม่จำเป็นต่อการเปิดหน้าเว็บ และมี URL ของ service จริงอยู่
มันจะถาม PIN ตอนรัน (ไม่แสดงบนจอ ไม่เก็บลงไฟล์) ปลดล็อกผ่าน access API
โหลดทุกหน้าและภาพแนบลง `shared/real-render/` แล้วคืน view session ให้เอง

เคสที่เข้ารหัสด้วย KMS ถอดได้เฉพาะ service account ของ Cloud Run และทุก request
ต้องมี view token ที่ได้จากการใส่ PIN — prototype จึงเก็บผลลัพธ์ไว้เป็นไฟล์
แทนที่จะเรียก API ตอนเปิดหน้า

## ก่อนเอาขึ้น GitHub Pages

- Pages บน repo **public** = ใครก็เปิดได้และ Google index ได้ ถ้า org เป็น
  GitHub Team/Enterprise ตั้ง Pages เป็น private ให้เห็นเฉพาะคนใน org จะปลอดภัยกว่า
- ทุกหน้าใส่ `noindex, nofollow` ไว้แล้ว แต่นั่นกัน search engine เท่านั้น ไม่ใช่การเข้าถึง
- ไม่มี token, API key หรือ URL ของ service จริงอยู่ใน repo เลย (ตรวจแล้ว)
- ภาพชุดปัจจุบันใช้ผู้ใช้ mock ไม่มีชื่อหรือเลขของผู้ใช้งานจริงติดอยู่
- ข้อมูลเรื่องแจ้งอื่นๆ เป็นของแต่งขึ้นทั้งหมด (`2026-6U23NF`)
