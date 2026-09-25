const ROLE_PRIORITY: string[] = [
  "SUPER_ADMIN",
  "SCHOOL_OWNER",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "TEACHER",
  "STUDENT",
  "PARENT",
];

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  SCHOOL_OWNER: "School owner",
  SCHOOL_ADMIN: "School admin",
  PRINCIPAL: "Principal",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
};

export function primaryRoleLabel(roles: string[]): string {
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) {
      return ROLE_LABELS[role] ?? role;
    }
  }
  return "Member";
}