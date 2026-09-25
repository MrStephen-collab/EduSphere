import { describe, expect, it } from "vitest";
import {
  assignmentCreatedEmail,
  assignmentGradedEmail,
  examReminderEmail,
  examResultEmail,
  passwordResetEmail,
  schoolAnnouncementEmail,
  subscriptionConfirmationEmail,
  welcomeEmail,
} from "./templates";

describe("email templates (§77)", () => {
  it("renders every template with non-empty content", () => {
    const messages = [
      welcomeEmail({ name: "Ada", schoolName: "Greenfield College", loginUrl: "https://x/login" }),
      passwordResetEmail({ name: "Ada", resetUrl: "https://x/reset" }),
      assignmentCreatedEmail({
        studentName: "Ada",
        schoolName: "Greenfield College",
        assignmentTitle: "Essay 1",
        subject: "English",
        dueDate: "12 Oct",
        maxScore: 50,
        url: "https://x/a",
      }),
      assignmentGradedEmail({
        studentName: "Ada",
        assignmentTitle: "Essay 1",
        subject: null,
        score: 40,
        maxScore: 50,
        percentage: 80,
        feedback: "Good work",
        url: "https://x/a",
      }),
      examReminderEmail({
        studentName: "Ada",
        schoolName: "Greenfield College",
        seriesTitle: "Mid-Term",
        examTypeLabel: "Mock Exam",
        startsAt: "Mon, 5 Oct",
        durationMinutes: 60,
        url: "https://x/e",
      }),
      examResultEmail({
        studentName: "Ada",
        seriesTitle: "Mid-Term",
        schoolName: "Greenfield College",
        score: 70,
        totalMarks: 100,
        percentage: 70,
        url: "https://x/e",
      }),
      schoolAnnouncementEmail({
        name: "Ada",
        schoolName: "Greenfield College",
        title: "Sports Day",
        message: "Come dressed in your house colours.",
        url: "https://x/home",
      }),
      subscriptionConfirmationEmail({
        name: "Ada",
        schoolName: "Greenfield College",
        planName: "Pro",
        periodLabel: "monthly billing",
        amountLabel: "NGN 5,000",
        periodEnd: "24 Oct",
        url: "https://x/billing",
      }),
    ];

    for (const message of messages) {
      expect(message.subject.length).toBeGreaterThan(0);
      expect(message.html).toContain("EduSphere");
      expect(message.text.length).toBeGreaterThan(0);
    }
  });

  it("escapes user content in HTML output", () => {
    const message = schoolAnnouncementEmail({
      name: "Ada",
      schoolName: "Greenfield <College>",
      title: "Parents & Teachers",
      message: "Don't <run>",
      url: "https://x/home",
    });
    expect(message.html).not.toContain("<College>");
    expect(message.html).not.toContain("Don't <run>");
  });
});