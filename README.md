# แบบทดสอบ IPC (ระบบทดสอบ)

ระบบทดสอบมาตรวัด IPC ของ Levenson (1981) 24 ข้อ แยกจากงานวิจัย ไม่ใช้ข้อมูลร่วมกัน

- หน้าแบบทดสอบ: https://buriram-locus-lab.github.io/ipc-test/ (`index.html`, `avatar.js`)
- รับคำตอบและหน้าหลังบ้าน: Google Apps Script ที่ผูกกับชีตของระบบทดสอบ (`backend/Code.gs`, `backend/Admin.html`)
  - การ deploy "หน้าแบบทดสอบ": Execute as Me · Anyone (รับคำตอบผ่าน POST)
  - การ deploy "หลังบ้าน": Execute as Me · Anyone with Google account, เปิดด้วย `?page=admin` เข้าได้เฉพาะบัญชีเจ้าของชีต

คะแนน: แต่ละข้อ −3…+3 (ไม่มี 0) แต่ละด้าน = ผลรวม 8 ข้อ + 24 → 0–48, 24 = จุดกลาง ต้องตอบครบ 24 ข้อ
ข้อความภาษาไทย 15 ข้อ (1, 4, 5, 8, 9, 10, 12, 14, 15, 16, 17, 20, 21, 22, 24) เป็นฉบับร่าง รอตรวจ
