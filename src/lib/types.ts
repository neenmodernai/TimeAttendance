// src/lib/types.ts
export type Kind = "check_in" | "check_out" | "lunch_begin" | "lunch_end";
export type LeaveType = "sick" | "personal" | "vacation";
export type LeaveStatus = "pending" | "approved" | "denied";
export const DEPTS = ["SA", "SR", "ACC", "Trainee", "Others"] as const;
export const KIND_TH: Record<Kind, string> = {
  check_in: "เข้างาน", check_out: "ออกงาน", lunch_begin: "พักเที่ยง", lunch_end: "กลับจากพัก",
};
export const LEAVE_TH: Record<LeaveType, string> = { sick: "ลาป่วย", personal: "ลากิจ", vacation: "ลาพักร้อน" };
export const STATUS_TH: Record<LeaveStatus, string> = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", denied: "ไม่อนุมัติ" };
