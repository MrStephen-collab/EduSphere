export const siteConfig = {
  name: process.env.NEXT_PUBLIC_PLATFORM_NAME || "EduSphere",
  description:
    "Give your school a modern digital learning environment where teachers teach, students learn, assessments happen and parents stay connected.",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  links: {
    github: "https://github.com",
    twitter: "https://twitter.com",
  },
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@edusphere.app",
};

export type SiteConfig = typeof siteConfig;