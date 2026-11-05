// src/lib/version.ts
export const APP_VERSION = "3.2.1";
export const VERSION_HISTORY: [string, string][] = [
  ["v3.2.1", "ลบหน้า HR dashboard เก่าที่ทำให้ build ล้ม, ย้ายสคริปต์ import ที่แก้แล้วไปไว้ใน scripts/"],
  ["v3.2", "บทบาทเจ้าของ, สิทธิ์การลาต่อปีแยกประเภท + คงเหลือให้พนักงานเห็น, HR แก้ประเภทใบลาได้, การเปลี่ยนนโยบายต้องให้เจ้าของอนุมัติ, เข้า HR จากเลขเวอร์ชัน / เมนูนักพัฒนาจาก footer"],
  ["v3.1", "จัดเมนู HR ใหม่: ภาพรวม/ใบลา/รายบุคคล/พนักงาน/ตั้งค่า, ปุ่มกลับหน้าลงเวลา, เมนูลับเหลือเฉพาะเครื่องมือนักพัฒนา"],
  ["v3.0", "ย้ายไป Next.js + Supabase, PIN ตรวจฝั่งเซิร์ฟเวอร์, HR dashboard, อีเมลขออนุมัติลาถึง HR, แจ้งเตือนคนไม่ลงเวลา"],
  ["v2.6", "ระบบเดิมบน Google Form + Apps Script"],
  ["v2.5", "Fix Approval Bug & Advanced Reporting"],
  ["v2.4", "Added Leave Management & SHA-256"],
  ["v2.0", "Silent Submit Integration"],
];
