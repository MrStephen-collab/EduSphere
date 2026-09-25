import { describe, expect, it } from "vitest";
import { canUser, isPlatformRole, isSchoolRole } from "./roles";
import {
  PERMISSIONS,
  getPermissionsForRole,
  hasPermission,
} from "./permissions";

describe("roles", () => {
  it("allows higher-or-equal hierarchy roles", () => {
    expect(canUser("SUPER_ADMIN", "TEACHER")).toBe(true);
    expect(canUser("SCHOOL_OWNER", "SCHOOL_ADMIN")).toBe(true);
    expect(canUser("SCHOOL_ADMIN", "PRINCIPAL")).toBe(true);
  });

  it("denies lower hierarchy roles", () => {
    expect(canUser("PARENT", "TEACHER")).toBe(false);
    expect(canUser("STUDENT", "SCHOOL_ADMIN")).toBe(false);
  });

  it("returns false when role is missing", () => {
    expect(canUser(null, "TEACHER")).toBe(false);
    expect(canUser(undefined, "TEACHER")).toBe(false);
  });

  it("distinguishes platform from school roles", () => {
    expect(isPlatformRole("SUPER_ADMIN")).toBe(true);
    expect(isPlatformRole("TEACHER")).toBe(false);
    expect(isSchoolRole("STUDENT")).toBe(true);
    expect(isSchoolRole("SUPER_ADMIN")).toBe(false);
  });
});

describe("permissions", () => {
  it("grants platform admin every permission", () => {
    const perms = getPermissionsForRole("SUPER_ADMIN");
    expect(perms).toEqual(Object.values(PERMISSIONS));
  });

  it("grants a teacher course management but not platform management", () => {
    expect(hasPermission("TEACHER", PERMISSIONS.COURSES_MANAGE)).toBe(true);
    expect(hasPermission("TEACHER", PERMISSIONS.PLATFORM_MANAGE)).toBe(false);
    expect(hasPermission("TEACHER", PERMISSIONS.STUDENTS_MANAGE)).toBe(false);
  });

  it("grants a student taking exams and viewing results", () => {
    const perms = getPermissionsForRole("STUDENT");
    expect(perms).toContain(PERMISSIONS.EXAMINATIONS_TAKE);
    expect(perms).toContain(PERMISSIONS.RESULTS_VIEW);
    expect(perms).not.toContain(PERMISSIONS.EXAMINATIONS_MANAGE);
  });

  it("grants a parent child visibility only", () => {
    const perms = getPermissionsForRole("PARENT");
    expect(perms).toContain(PERMISSIONS.CHILDREN_VIEW);
    expect(perms).toContain(PERMISSIONS.RESULTS_VIEW);
    expect(perms).not.toContain(PERMISSIONS.STUDENTS_MANAGE);
  });

  it("returns no permissions for a missing role", () => {
    expect(getPermissionsForRole(null)).toEqual([]);
    expect(hasPermission(null, PERMISSIONS.COURSES_VIEW)).toBe(false);
  });
});