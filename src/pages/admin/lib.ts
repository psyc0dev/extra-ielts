import type { ReactNode } from "react";
import en from "@/locales/en";

export type AdminSection = "overview" | "users" | "tests" | "assignments" | "groups" | "user-details" | "group-details";

export type NavItem = { id: AdminSection; label: string; description: string; icon: ReactNode };

export function buildDueAt(dueDate?: Date, dueTime?: string) {
  if (!dueDate || !dueTime) return null;
  const yyyy = dueDate.getFullYear();
  const mm = String(dueDate.getMonth() + 1).padStart(2, "0");
  const dd = String(dueDate.getDate()).padStart(2, "0");
  const local = `${yyyy}-${mm}-${dd}T${dueTime}:00`;
  return new Date(local).toISOString();
}

export function formatDateLabel(date?: Date) {
  return date ? date.toLocaleDateString() : en.admin.assignments.pickDate;
}
