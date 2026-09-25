export const siteConfig = {
  name: process.env.NEXT_PUBLIC_PLATFORM_NAME || "EduSphere",
  description:
    "EduSphere is a digital learning, assessment and engagement platform helping schools create connected digital classrooms for students, teachers and parents.",
  url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  links: {
    github: "https://github.com",
    twitter: "https://twitter.com",
  },
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@edusphere.app",
};

export type SiteConfig = typeof siteConfig;