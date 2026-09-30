import {
  Bell,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Wallet,
  FileText,
  GraduationCap,
  Home,
  LayoutDashboard,
  Library,
  Megaphone,
  MessageSquareText,
  ScrollText,
  Settings,
  UserRound,
  Users,
  BarChart3,
  HelpCircle,
  Menu,
  Images,
} from "lucide-react";

export const navIcons = {
  home: Home,
  dashboard: LayoutDashboard,
  students: Users,
  teachers: GraduationCap,
  classes: Menu,
  courses: BookOpen,
  lessons: Library,
  assignments: ClipboardList,
  examinations: FileText,
  questionBank: HelpCircle,
  results: BarChart3,
  reportCard: ScrollText,
  attendance: CalendarCheck2,
  analytics: BarChart3,
  announcements: Megaphone,
  calendar: CalendarDays,
  images: Images,
  notifications: Bell,
  messages: MessageSquareText,
  settings: Settings,
  profile: UserRound,
  creditCard: CreditCard,
  wallet: Wallet,
};

export type NavItem = {
  title: string;
  href: string;
  icon: keyof typeof navIcons;
};

export type NavSection = {
  label?: string;
  items: NavItem[];
};

export const platformNav: NavSection[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/platform", icon: "dashboard" },
      { title: "Schools", href: "/platform/schools", icon: "students" },
      { title: "Users", href: "/platform/users", icon: "students" },
      { title: "Analytics", href: "/platform/analytics", icon: "analytics" },
    ],
  },
  {
    label: "Management",
    items: [
      { title: "Subscriptions", href: "/platform/subscriptions", icon: "creditCard" },
      { title: "Support", href: "/platform/support", icon: "messages" },
      { title: "Settings", href: "/platform/settings", icon: "settings" },
      { title: "Profile", href: "/platform/profile", icon: "profile" },
    ],
  },
];

export const schoolNav: NavSection[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/school", icon: "dashboard" },
      { title: "Announcements", href: "/school/announcements", icon: "announcements" },
    ],
  },
  {
    label: "People",
    items: [
      { title: "Students", href: "/school/students", icon: "students" },
      { title: "Teachers", href: "/school/teachers", icon: "teachers" },
      { title: "Parents", href: "/school/parents", icon: "profile" },
    ],
  },
  {
    label: "Academics",
    items: [
      { title: "Classes", href: "/school/classes", icon: "classes" },
      { title: "Subjects", href: "/school/subjects", icon: "courses" },
      { title: "Sessions", href: "/school/sessions", icon: "calendar" },
      { title: "Timetable", href: "/school/timetable", icon: "calendar" },
      { title: "Results", href: "/school/results", icon: "results" },
      { title: "Analytics", href: "/school/analytics", icon: "analytics" },
    ],
  },
  {
    label: "School life",
    items: [
      { title: "Events", href: "/school/events", icon: "calendar" },
      { title: "Media", href: "/school/media", icon: "images" },
      { title: "Complaints", href: "/school/complaints", icon: "messages" },
    ],
  },
  {
    label: "Money",
    items: [
      { title: "Fees", href: "/school/fees", icon: "wallet" },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Branding", href: "/school/settings", icon: "settings" },
      { title: "Billing", href: "/school/billing", icon: "creditCard" },
      { title: "Profile", href: "/school/profile", icon: "profile" },
    ],
  },
];

export const teacherNav: NavSection[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/teacher", icon: "dashboard" }],
  },
  {
    label: "Teaching",
    items: [
      { title: "Classes", href: "/teacher/classes", icon: "classes" },
      { title: "Courses", href: "/teacher/courses", icon: "courses" },
      { title: "Lessons", href: "/teacher/courses", icon: "lessons" },
      { title: "Timetable", href: "/teacher/timetable", icon: "calendar" },
      { title: "Assignments", href: "/teacher/assignments", icon: "assignments" },
    ],
  },
  {
    label: "Assessment",
    items: [
      { title: "Exam Series", href: "/teacher/exam-series", icon: "examinations" },
      { title: "Question Bank", href: "/teacher/question-bank", icon: "questionBank" },
      { title: "Attendance", href: "/teacher/attendance", icon: "attendance" },
      { title: "Report Cards", href: "/teacher/report-cards", icon: "reportCard" },
      { title: "Analytics", href: "/teacher/analytics", icon: "analytics" },
    ],
  },
  {
    label: "Settings",
    items: [{ title: "Profile", href: "/teacher/profile", icon: "profile" }],
  },
];

export const studentNav: NavSection[] = [
  {
    label: "Overview",
    items: [
      { title: "Home", href: "/student", icon: "home" },
      { title: "Timetable", href: "/student/timetable", icon: "calendar" },
    ],
  },
  {
    label: "Learning",
    items: [
      { title: "My Courses", href: "/student/courses", icon: "courses" },
      { title: "Assignments", href: "/student/assignments", icon: "assignments" },
      { title: "Exam Series", href: "/student/exam-series", icon: "examinations" },
      { title: "Results", href: "/student/results", icon: "results" },
      { title: "Report Cards", href: "/student/report-cards", icon: "reportCard" },
      { title: "Progress", href: "/student/progress", icon: "analytics" },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "My Fees", href: "/student/fees", icon: "wallet" },
      { title: "Profile", href: "/student/profile", icon: "profile" },
    ],
  },
];

export const parentNav: NavSection[] = [
  {
    label: "Overview",
    items: [{ title: "Home", href: "/parent", icon: "home" }],
  },
  {
    label: "Family",
    items: [
      { title: "My Children", href: "/parent/children", icon: "students" },
      { title: "Results", href: "/parent/results", icon: "results" },
      { title: "Report Cards", href: "/parent/report-cards", icon: "reportCard" },
      { title: "Assignments", href: "/parent/assignments", icon: "assignments" },
      { title: "Progress", href: "/parent/progress", icon: "analytics" },
    ],
  },
  {
    label: "School",
    items: [
      { title: "Fees & Payments", href: "/parent/fees", icon: "wallet" },
      { title: "Complaints & Advice", href: "/parent/complaints", icon: "messages" },
    ],
  },
  {
    label: "Settings",
    items: [{ title: "Profile", href: "/parent/profile", icon: "profile" }],
  },
];