import type { UserRoleName } from "@/types/database";

const roleHierarchy: Record<UserRoleName, number> = {
  SUPER_ADMIN: 100,
  SCHOOL_OWNER: 90,
  SCHOOL_ADMIN: 80,
  PRINCIPAL: 70,
  TEACHER: 60,
  STUDENT: 40,
  PARENT: 30,
};

export function canUser(
  role: UserRoleName | null | undefined,
  required: UserRoleName,
): boolean {
  if (!role) return false;
  return roleHierarchy[role] >= roleHierarchy[required];
}

export function isPlatformRole(role: UserRoleName | null | undefined): boolean {
  return role === "SUPER_ADMIN";
}

export function isSchoolRole(role: UserRoleName | null | undefined): boolean {
  return !!role && isPlatformRole(role) === false;
}