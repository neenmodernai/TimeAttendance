// src/app/hr/actions.ts
"use server";
import { redirect } from "next/navigation";
import { applyDecision, leaveIdFromToken } from "@/lib/leave";

export async function decideByToken(fd: FormData) {
  const token = String(fd.get("token") ?? "");
  const decision = fd.get("decision");
  const id = leaveIdFromToken(token);
  if (!id || (decision !== "approved" && decision !== "denied")) redirect(`/hr/leave/${token}`);
  await applyDecision(id, decision, "hr-email");
  redirect(`/hr/leave/${token}`);
}
