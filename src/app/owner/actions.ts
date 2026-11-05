// src/app/owner/actions.ts
"use server";
import { redirect } from "next/navigation";
import { changeIdFromToken, decideChange } from "@/lib/changes";

export async function decideChangeByToken(fd: FormData) {
  const token = String(fd.get("token") ?? "");
  const id = changeIdFromToken(token);
  const d = fd.get("decision");
  if (id && (d === "approved" || d === "rejected")) await decideChange(id, d, "owner-email", String(fd.get("note") ?? "").trim() || null);
  redirect(`/owner/change/${token}`);
}
