import { describe, expect, it } from "vitest";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth";

describe("auth validation", () => {
  it("accepts valid login input", () => {
    const parsed = loginSchema.safeParse({
      email: "teacher@greenfield.test",
      password: "password123",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const parsed = loginSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a short password", () => {
    const parsed = loginSchema.safeParse({
      email: "teacher@greenfield.test",
      password: "123",
    });
    expect(parsed.success).toBe(false);
  });

  it("requires fields for registration", () => {
    const parsed = registerSchema.safeParse({
      email: "",
      password: "short",
      fullName: "A",
      schoolName: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts valid registration input", () => {
    const parsed = registerSchema.safeParse({
      email: "admin@newcollege.edu.ng",
      password: "a-secure-password",
      fullName: "Mrs. Adebayo",
      schoolName: "New College",
    });
    expect(parsed.success).toBe(true);
  });

  it("validates password reset input", () => {
    expect(forgotPasswordSchema.safeParse({ email: "x@y.com" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "12345678" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ password: "123" }).success).toBe(false);
  });
});