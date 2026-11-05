// src/lib/types.ts
export type Kind = "check_in" | "check_out" | "lunch_begin" | "lunch_end";
/** Leave type code from the leave_types table (sick, personal, vacation, or anything HR adds). */
export type LeaveType = string;
export type LeaveStatus = "pending" | "approved" | "denied";
export const DEPTS = ["SA", "SR", "ACC", "Trainee", "Others"] as const;
export const KIND_TH: Record<Kind, string> = {
  check_in: "เข้างาน", check_out: "ออกงาน", lunch_begin: "พักเที่ยง", lunch_end: "กลับจากพัก",
};
export const STATUS_TH: Record<LeaveStatus, string> = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", denied: "ไม่อนุมัติ" };
