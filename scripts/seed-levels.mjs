// Demo data for a school at every education level.
//
// The seeded school (Greenfield College) is a secondary school, so every other
// level of the product -- nursery, primary, college, polytechnic, university --
// used to arrive with an empty portal: no classes, no students, no results, no
// invoices. A person testing the product could not tell a missing feature from
// a missing school.
//
// This script adds one school per level and fills every part of the portal for
// each of them, so each level can be opened and clicked through end to end.
//
// It is additive and idempotent: it never deletes anything, it checks before it
// inserts, and re-running it tops up whatever is missing without duplicating
// what is already there.
//
//   node scripts/seed-levels.mjs
//
// Environment: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
// DEMO_USER_PASSWORD, read from .env and .env.local.

import dotenv from "dotenv";
import { installHttp1Fetch } from "./lib/http1-fetch.mjs";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
installHttp1Fetch();
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = process.env.DEMO_USER_PASSWORD || "Testing2026";
const SESSION_NAME = "2026/2027";
const TERM_NAMES = ["First Term", "Second Term", "Third Term"];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// ---------------------------------------------------------------------------
// The schools
// ---------------------------------------------------------------------------

/**
 * One entry per education level. Everything below is derived from these
 * entries, so adding a level is a matter of adding one object here.
 *
 * `classes` follow the level's own convention (src/lib/education/levels.ts):
 * a nursery has Nursery 1-3, a primary has Year 1-6, a polytechnic has OND
 * and HND years inside a department, a university has Level 100-400.
 */
const SCHOOLS = [
  {
    level: "nursery",
    slug: "little-steps-nursery",
    name: "Little Steps Nursery",
    emailDomain: "nursery",
    staffPrefix: "LS",
    motto: "Every child a wonder in the making.",
    description:
      "A warm early-years nursery where children learn through play, songs and stories.",
    city: "Ibadan",
    state: "Oyo",
    address: "12 Amina Way, Ibadan",
    phone: "+234 802 555 0111",
    email: "hello@little-steps.test",
    branding: { primary: "#f97316", secondary: "#7c2d12", accent: "#fbbf24" },
    people: {
      admin: "Mrs. Grace Ojo (Admin)",
      teacher: "Mrs. Fatima Bello (Teacher)",
      student: "Amina Bello",
      studentGender: "female",
      studentBirthDate: "2021-04-18",
      parent: "Mr. Bello (Parent)",
    },
    classes: ["Nursery 1", "Nursery 2", "Nursery 3"],
    studentClass: "Nursery 2",
    subjects: [
      ["Phonics", "PHN"],
      ["Numeracy", "NUM"],
      ["Creative Arts", "CRT"],
      ["Story Time", "STY"],
    ],
    coreSubject: "Phonics",
    courseSubject: "Phonics",
    courseClass: "Nursery 2",
    lessons: [
      ["Sound of the day: sh", "Practise the sh sound with picture cards and rhymes."],
      ["Counting to ten with song", "Count along with the ten-egg song."],
    ],
    assignment: {
      title: "Phonics: the sh sound",
      instructions:
        "Circle every word that starts with the sh sound, then say each word aloud to a grown-up.\n\n1. ship\n2. sun\n3. shop\n4. sun\n5. shell",
    },
    exam: {
      type: "school",
      title: "Nursery Phonics and Numeracy Practice",
      subject: "Phonics",
      questions: [
        {
          text: "Which word starts with the sh sound?",
          options: ["ship", "sun", "cat"],
          correct: 0,
          explanation: "The sh sound is heard at the start of ship.",
        },
        {
          text: "How many fingers do you have on one hand?",
          options: ["five", "two", "ten"],
          correct: 0,
          explanation: "One hand has five fingers.",
        },
        {
          text: "Which number comes after four?",
          options: ["five", "three", "nine"],
          correct: 0,
          explanation: "Four is followed by five.",
        },
        {
          text: "Which one is a colour?",
          options: ["yellow", "spoon", "chair"],
          correct: 0,
          explanation: "Yellow is a colour.",
        },
      ],
      essay: {
        text: "Draw a picture of your family and tell your teacher one thing you did at nursery today.",
        marks: 5,
        guide: "1 mark for the drawing, 2 marks for a clear sentence, 2 marks for spelling.",
      },
    },
    fees: [
      ["First Term Tuition", 45000, "paid", 45000],
      ["Second Term Tuition", 45000, "partially_paid", 20000],
      ["Third Term Tuition", 45000, "unpaid", 0],
      ["Play Materials Levy", 8000, "unpaid", 0],
    ],
  },
  {
    level: "primary",
    slug: "cedar-grove-primary",
    name: "Cedar Grove Primary School",
    emailDomain: "primary",
    staffPrefix: "CG",
    motto: "Learning with curiosity and care.",
    description:
      "A community primary school that teaches the national curriculum through projects, games and strong reading habits.",
    city: "Enugu",
    state: "Enugu",
    address: "4 Cedar Close, Enugu",
    phone: "+234 803 555 0222",
    email: "office@cedar-grove.test",
    branding: { primary: "#16a34a", secondary: "#14532d", accent: "#84cc16" },
    people: {
      admin: "Mr. Chidi Nwosu (Admin)",
      teacher: "Mr. Emeka Uche (Teacher)",
      student: "Chiamaka Uche",
      studentGender: "female",
      studentBirthDate: "2015-08-02",
      parent: "Mrs. Uche (Parent)",
    },
    classes: ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"],
    studentClass: "Year 5",
    subjects: [
      ["English Language", "ENG"],
      ["Mathematics", "MTH"],
      ["Basic Science", "BSC"],
      ["Social Studies", "SST"],
      ["Creative Arts", "CRT"],
      ["Computer Studies", "CSC"],
    ],
    coreSubject: "Mathematics",
    courseSubject: "Mathematics",
    courseClass: "Year 5",
    lessons: [
      ["Fractions on a number line", "Place thirds and quarters on a number line."],
      ["Reading comprehension: the honey badger", "Answer the questions about the passage."],
    ],
    assignment: {
      title: "Fractions practice set",
      instructions:
        "Show all your working.\n\n1. Write 3/4 as a fraction of 20.\n2. Which is bigger: 2/3 or 3/5? Show how you know.\n3. Shade 5/8 of a bar of 8 squares.",
    },
    exam: {
      type: "school",
      title: "Primary Mathematics and English Practice",
      subject: "Mathematics",
      questions: [
        {
          text: "What is 3/4 of 20?",
          options: ["15", "12", "16"],
          correct: 0,
          explanation: "20 divided by 4 is 5, and 3 lots of 5 is 15.",
        },
        {
          text: "Which of these is the odd one out?",
          options: ["triangle", "square", "circle"],
          correct: 2,
          explanation: "A circle has no straight sides.",
        },
        {
          text: "What is the next number: 3, 6, 9, 12, ...?",
          options: ["14", "15", "18"],
          correct: 1,
          explanation: "The numbers go up by three each time.",
        },
        {
          text: "If 5 pencils cost ₦50, how much do 10 pencils cost?",
          options: ["₦100", "₦150", "₦500"],
          correct: 0,
          explanation: "Ten pencils is double five, so the price doubles to ₦100.",
        },
      ],
      essay: {
        text: "A farmer has 24 oranges. He sells 9 and gives 5 to his children. How many oranges are left? Show your working.",
        marks: 6,
        guide: "1 mark for 24 - 9, 1 mark for 15, 1 mark for 15 - 5, 2 marks for the answer 10, 1 mark for clear working.",
      },
    },
    fees: [
      ["First Term Tuition", 60000, "paid", 60000],
      ["Second Term Tuition", 60000, "partially_paid", 35000],
      ["Third Term Tuition", 60000, "unpaid", 0],
      ["Excursion and Field Trip", 15000, "unpaid", 0],
    ],
  },
  {
    level: "secondary",
    slug: "greenfield-college",
    name: "Greenfield College",
    emailDomain: "greenfield",
    staffPrefix: "GF",
    motto: "Knowledge. Character. Excellence.",
    description:
      "A private secondary school providing a modern digital learning environment.",
    city: "Akure",
    state: "Ondo",
    address: "1 Greenfield Way, Akure",
    phone: "+234 805 555 0333",
    email: "admin@greenfield.test",
    branding: { primary: "#2563eb", secondary: "#334155", accent: "#0ea5e9" },
    people: {
      admin: "Mrs. Adebayo (Admin)",
      teacher: "Mr. Ogunleye (Teacher)",
      student: "David Adebayo",
      studentGender: "male",
      studentBirthDate: "2012-04-18",
      parent: "Mr. Adebayo (Parent)",
    },
    classes: ["JSS 1", "JSS 2", "JSS 3", "SS 1", "SS 2", "SS 3"],
    studentClass: "SS 2",
    subjects: [
      ["Mathematics", "MTH"],
      ["English Language", "ENG"],
      ["Physics", "PHY"],
      ["Chemistry", "CHM"],
      ["Biology", "BIO"],
      ["Computer Studies", "CSC"],
      ["Economics", "ECO"],
      ["Government", "GOV"],
    ],
    coreSubject: "Mathematics",
    courseSubject: "Mathematics",
    courseClass: "SS 2",
    // Greenfield already has this course from scripts/seed.mjs, so the demo
    // seeder reuses it instead of creating a second Mathematics course.
    courseTitle: "SS 2 Mathematics",
    lessons: [
      ["Introduction to Quadratic Equations", "What a quadratic equation is and why it matters."],
      ["Solving by Factorization", "Solve quadratics by finding factors."],
    ],
    assignment: {
      title: "Quadratic Equations Practice Set",
      instructions:
        "Solve the following and show all your working.\n\n1. Solve x² + 5x + 6 = 0 by factorization.\n2. Solve 2x² - 4x - 6 = 0 using the quadratic formula.",
    },
    exam: {
      type: "waec",
      title: "WAEC Mathematics Practice 2019–2024",
      subject: "Mathematics",
      questions: [
        {
          text: "If x² = 64, what are the two values of x?",
          options: ["8 and -8", "8 only", "-8 only", "32 and -32"],
          correct: 0,
          explanation: "Both positive and negative 8 satisfy 8² = 64.",
        },
        {
          text: "Simplify 3/4 + 1/6 and give the answer as a fraction in its lowest terms.",
          options: ["11/12", "4/10", "13/12", "2/5"],
          correct: 0,
          explanation: "The LCM of 4 and 6 is 12, so 3/4 + 1/6 = 9/12 + 2/12 = 11/12.",
        },
        {
          text: "The mean of 6, 8, 10, 12 and 14 is:",
          options: ["10", "11", "12", "9"],
          correct: 0,
          explanation: "50 divided by 5 is 10.",
        },
        {
          text: "The simple interest on ₦2,000 for 2 years at 5% per annum is:",
          options: ["₦200", "₦100", "₦400", "₦150"],
          correct: 0,
          explanation: "I = PRT/100 = (2000 x 5 x 2) / 100 = 200.",
        },
      ],
      essay: {
        text: "Solve the pair of simultaneous equations: 2x + y = 11 and x - y = 4. Show all of your working.",
        marks: 8,
        guide: "M1 rearranging an equation, M1 substitution set up, A1 for x = 5, A2 for y = 1.",
      },
    },
    // Greenfield already carries tuition invoices and payments from
    // scripts/seed.mjs, so the fee section is left alone.
    fees: [],
  },
  {
    level: "college",
    slug: "harbour-city-college",
    name: "Harbour city College",
    emailDomain: "college",
    staffPrefix: "HC",
    motto: "Competence, character, service.",
    description:
      "A post-secondary college of science and business with semester-based teaching and continuous assessment.",
    city: "Lagos",
    state: "Lagos",
    address: "18 Marina Road, Lagos",
    phone: "+234 806 555 0444",
    email: "registrar@harbour-city.test",
    branding: { primary: "#7c3aed", secondary: "#4c1d95", accent: "#c4b5fd" },
    people: {
      admin: "Dr. Ada Mbeki (Admin)",
      teacher: "Dr. Tunde Falola (Lecturer)",
      student: "Tobi Falola",
      studentGender: "male",
      studentBirthDate: "2006-01-23",
      parent: "Mr. Falola (Parent)",
    },
    departments: ["Science", "Business"],
    classes: [
      "Science Year 1",
      "Science Year 2",
      "Science Year 3",
      "Business Year 1",
      "Business Year 2",
      "Business Year 3",
    ],
    studentClass: "Science Year 2",
    subjects: [
      ["Mathematics", "MTH"],
      ["English Language", "ENG"],
      ["Accounting", "ACC"],
      ["Computer Science", "CSC"],
      ["Business Studies", "BUS"],
      ["Statistics", "STA"],
    ],
    coreSubject: "Mathematics",
    courseSubject: "Mathematics",
    courseClass: "Science Year 2",
    lessons: [
      ["Limits and continuity", "The idea of a limit, and why continuity follows it."],
      ["Matrix algebra in practice", "Multiplying matrices and solving simple systems."],
    ],
    assignment: {
      title: "Matrix algebra problem set",
      instructions:
        "Show all your working.\n\n1. Multiply the matrices A and B.\n2. Use Cramer's rule to solve the system x + y = 5 and 2x - y = 1.",
    },
    exam: {
      type: "neco",
      title: "NECO Mathematics Practice",
      subject: "Mathematics",
      questions: [
        {
          text: "What is the derivative of x³ at x = 2?",
          options: ["12", "8", "6"],
          correct: 0,
          explanation: "3x² at x = 2 is 3 x 4 = 12.",
        },
        {
          text: "The mean of 4, 6, 8 and 10 is:",
          options: ["7", "8", "6"],
          correct: 0,
          explanation: "28 divided by 4 is 7.",
        },
        {
          text: "log₂(32) equals:",
          options: ["5", "6", "4"],
          correct: 0,
          explanation: "2⁵ = 32.",
        },
        {
          text: "If p(x) = x² - 4, what are its roots?",
          options: ["-2 and 2", "-4 and 4", "0 and 4"],
          correct: 0,
          explanation: "x² = 4, so x = ±2.",
        },
      ],
      essay: {
        text: "A company's revenue grows from ₦500,000 to ₦650,000 in one year. Calculate the percentage growth and explain two factors that could have caused it.",
        marks: 10,
        guide: "1 mark for the calculation set up, 2 marks for the answer 30%, then 4 marks for two well-explained factors.",
      },
    },
    fees: [
      ["First Semester Tuition", 185000, "paid", 185000],
      ["Second Semester Tuition", 185000, "partially_paid", 90000],
      ["Third Semester Tuition", 185000, "unpaid", 0],
      ["Laboratory Levy", 25000, "unpaid", 0],
    ],
  },
  {
    level: "polytechnic",
    slug: "sunrise-polytechnic",
    name: "Sunrise Polytechnic",
    emailDomain: "polytechnic",
    staffPrefix: "SP",
    motto: "Skill, service, industry.",
    description:
      "A polytechnic teaching OND and HND programmes with workshop-based, hands-on technical training.",
    city: "Kaduna",
    state: "Kaduna",
    address: "9 Workshop Road, Kaduna",
    phone: "+234 807 555 0555",
    email: "admissions@sunrise-poly.test",
    branding: { primary: "#ea580c", secondary: "#7c2d12", accent: "#fdba74" },
    people: {
      admin: "Mr. Musa Danladi (Admin)",
      teacher: "Engr. Bisi Adeyemi (Lecturer)",
      student: "Kunmi Adeyemi",
      studentGender: "female",
      studentBirthDate: "2005-11-07",
      parent: "Mrs. Adeyemi (Parent)",
    },
    departments: ["Computer Science", "Electrical Engineering"],
    classes: [
      "Computer Science OND Year 1",
      "Computer Science OND Year 2",
      "Computer Science HND Year 1",
      "Computer Science HND Year 2",
      "Electrical Engineering OND Year 1",
      "Electrical Engineering OND Year 2",
      "Electrical Engineering HND Year 1",
      "Electrical Engineering HND Year 2",
    ],
    studentClass: "Computer Science OND Year 2",
    subjects: [
      ["Mathematics", "MTH"],
      ["English Language", "ENG"],
      ["Computer Science", "CSC"],
      ["Electrical Engineering", "EEL"],
      ["Applied Mechanics", "MEC"],
    ],
    coreSubject: "Computer Science",
    courseSubject: "Computer Science",
    courseClass: "Computer Science OND Year 2",
    lessons: [
      ["Introduction to structured programming", "Sequence, selection and iteration in C."],
      ["Arrays and strings", "Storing collections of values and reading them back."],
    ],
    assignment: {
      title: "C programming worksheet",
      instructions:
        "Write a C program for each task and show the output.\n\n1. Read five numbers and print their sum and average.\n2. Store them in an array and print the largest.",
    },
    exam: {
      type: "neco",
      title: "ND1 Computer Science Practice",
      subject: "Computer Science",
      questions: [
        {
          text: "How many bits are in one byte?",
          options: ["8", "16", "32"],
          correct: 0,
          explanation: "A byte is eight bits.",
        },
        {
          text: "Which of these is a valid C variable name?",
          options: ["total_mark", "2ndValue", "class"],
          correct: 0,
          explanation: "A name cannot start with a digit and class is a reserved word.",
        },
        {
          text: "In binary, 1011 equals:",
          options: ["11", "13", "9"],
          correct: 0,
          explanation: "8 + 0 + 2 + 1 = 11.",
        },
        {
          text: "Which structure repeats a block of statements a fixed number of times?",
          options: ["for loop", "if statement", "assignment"],
          correct: 0,
          explanation: "A for loop runs a block a set number of times.",
        },
      ],
      essay: {
        text: "Write an algorithm in pseudocode for a program that reads a list of five marks, removes any mark below 40, then prints the average of the remaining marks.",
        marks: 10,
        guide: "2 marks for the input step, 3 marks for the removal condition, 3 marks for the average, 2 marks for the output.",
      },
    },
    fees: [
      ["First Term Tuition", 145000, "paid", 145000],
      ["Second Term Tuition", 145000, "partially_paid", 70000],
      ["Third Term Tuition", 145000, "unpaid", 0],
      ["Workshop and Tools Levy", 35000, "unpaid", 0],
    ],
  },
  {
    level: "university",
    slug: "northgate-university",
    name: "Northgate University",
    emailDomain: "university",
    staffPrefix: "NG",
    motto: "Knowledge in the service of society.",
    description:
      "A research university with faculties of science and arts, undergraduate programmes and a wide choice of courses.",
    city: "Ibadan",
    state: "Oyo",
    address: "2 University Gate, Ibadan",
    phone: "+234 808 555 0666",
    email: "admissions@northgate.test",
    branding: { primary: "#0f766e", secondary: "#134e4a", accent: "#5eead4" },
    people: {
      admin: "Prof. Akin Ajayi (Admin)",
      teacher: "Dr. Ifeoma Nwachukwu (Lecturer)",
      student: "Zainab Nwachukwu",
      studentGender: "female",
      studentBirthDate: "2004-06-15",
      parent: "Mr. Nwachukwu (Parent)",
    },
    departments: ["Science", "Arts"],
    classes: [
      "Science Level 100",
      "Science Level 200",
      "Science Level 300",
      "Science Level 400",
      "Arts Level 100",
      "Arts Level 200",
      "Arts Level 300",
      "Arts Level 400",
    ],
    studentClass: "Science Level 200",
    subjects: [
      ["Mathematics", "MTH"],
      ["English Language", "ENG"],
      ["Computer Science", "CSC"],
      ["Economics", "ECO"],
      ["Research Methods", "RES"],
    ],
    coreSubject: "Computer Science",
    courseSubject: "Computer Science",
    courseClass: "Science Level 200",
    lessons: [
      ["Data structures: trees", "How a tree organises data and why lookups are fast."],
      ["Algorithm analysis", "Big O notation and reading it off an algorithm."],
    ],
    assignment: {
      title: "Algorithm analysis take-home",
      instructions:
        "Analyse the following three sorting algorithms for time and space complexity, justify your answer with a short worked case, and state which you would use on one million records and why.",
    },
    exam: {
      type: "common_entrance",
      title: "Common Entrance Mathematics Practice",
      subject: "Mathematics",
      questions: [
        {
          text: "The sum of the first 20 positive integers is:",
          options: ["210", "190", "400"],
          correct: 0,
          explanation: "n(n+1)/2 = 20 x 21 / 2 = 210.",
        },
        {
          text: "If f(x) = 3x² - 2x, what is f'(2)?",
          options: ["10", "8", "6"],
          correct: 0,
          explanation: "f'(x) = 6x - 2, so f'(2) = 10.",
        },
        {
          text: "The 7th term of the AP 2, 5, 8, ... is:",
          options: ["20", "23", "21"],
          correct: 0,
          explanation: "a + (n-1)d = 2 + 6 x 3 = 20.",
        },
        {
          text: "The probability of getting a head in one fair coin toss is:",
          options: ["1/2", "1/4", "1/3"],
          correct: 0,
          explanation: "One of two equally likely outcomes.",
        },
      ],
      essay: {
        text: "The profits of a company for five consecutive years are ₦2.1m, ₦2.4m, ₦2.9m, ₦3.6m and ₦4.5m. (a) Find a linear model for the profit in terms of the year number. (b) Use your model to estimate the profit in year 7.",
        marks: 15,
        guide: "3 marks for a sensible model, 2 marks for showing the substitution, 2 marks for each year estimate with units.",
      },
    },
    fees: [
      ["First Session Tuition", 320000, "paid", 320000],
      ["Second Session Tuition", 320000, "partially_paid", 150000],
      ["Third Session Tuition", 320000, "unpaid", 0],
      ["Research and Development Levy", 40000, "unpaid", 0],
    ],
  },
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const log = (message) => console.log(message);
const step = (message) => console.log(`  · ${message}`);

function fail(context, error) {
  throw new Error(`${context}: ${error?.message ?? JSON.stringify(error)}`);
}

async function insert(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) fail(`insert into ${table}`, error);
  return data;
}

/**
 * Many rows in one round trip. The tables that grow with the size of a school
 * (attendance, timetable, options) are written this way, because one request
 * per row turns a two minute seed into a ten minute one.
 */
async function insertMany(table, rows) {
  if (!rows.length) return [];
  const { data, error } = await supabase.from(table).insert(rows).select();
  if (error) fail(`insert into ${table}`, error);
  return data ?? [];
}

async function upsert(table, row, onConflict) {
  const { data, error } = await supabase
    .from(table)
    .upsert(row, { onConflict })
    .select()
    .single();
  if (error) fail(`upsert into ${table}`, error);
  return data;
}

async function firstRow(table, filter, columns = "*") {
  let query = supabase.from(table).select(columns);
  for (const [column, value] of Object.entries(filter)) {
    if (value === null) query = query.is(column, null);
    else query = query.eq(column, value);
  }
  const { data, error } = await query.limit(1);
  if (error) fail(`read ${table}`, error);
  return data?.[0] ?? null;
}

async function countRows(table, filter) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [column, value] of Object.entries(filter)) {
    if (value === null) query = query.is(column, null);
    else query = query.eq(column, value);
  }
  const { count, error } = await query;
  if (error) fail(`count ${table}`, error);
  return count ?? 0;
}

let userCache = null;

async function loadUsers() {
  if (userCache) return userCache;
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) fail("list auth users", error);
  userCache = new Map((data?.users ?? []).map((user) => [user.email, user.id]));
  return userCache;
}

async function ensureUser(email, fullName) {
  const users = await loadUsers();
  const existing = users.get(email);
  if (existing) {
    step(`user ${email} already exists`);
    return existing;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) fail(`create user ${email}`, error);
  users.set(email, data.user.id);
  step(`created user ${email}`);
  return data.user.id;
}

async function ensureRole(userId, schoolId, role) {
  const existing = await firstRow("user_roles", { user_id: userId, school_id: schoolId, role });
  if (existing) return existing;
  const { error } = await supabase
    .from("user_roles")
    .insert({ school_id: schoolId, user_id: userId, role });
  if (error) {
    if (error.code === "23505") return null;
    fail(`assign ${role}`, error);
  }
  return null;
}

// ---------------------------------------------------------------------------
// The school itself
// ---------------------------------------------------------------------------

async function seedSchool(config) {
  const { level, slug } = config;
  log(`\n=== ${config.name} (${level}) ===`);

  const school = await upsert(
    "schools",
    {
      name: config.name,
      slug,
      motto: config.motto,
      description: config.description,
      address: config.address,
      city: config.city,
      state: config.state,
      country: "Nigeria",
      phone: config.phone,
      email: config.email,
      status: "active",
      education_level: level,
    },
    "slug",
  );
  const schoolId = school.id;
  step(`school ${slug} ready (${schoolId})`);

  await upsert(
    "school_settings",
    {
      school_id: schoolId,
      midterm_marking: true,
      continuous_assessment_weight: 40,
      examination_weight: 60,
      allow_student_registration: true,
      allow_parent_registration: true,
      require_email_verification: false,
      low_data_mode: false,
    },
    "school_id",
  );
  await upsert(
    "school_branding",
    {
      school_id: schoolId,
      primary_color: config.branding.primary,
      secondary_color: config.branding.secondary,
      accent_color: config.branding.accent,
    },
    "school_id",
  );

  // Session and terms
  let session = await firstRow("academic_sessions", { school_id: schoolId, name: SESSION_NAME });
  if (!session) {
    session = await insert("academic_sessions", {
      school_id: schoolId,
      name: SESSION_NAME,
      is_current: true,
      start_date: "2026-09-01",
      end_date: "2027-07-31",
    });
    step(`academic session ${SESSION_NAME} created`);
  }

  const termIds = new Map();
  for (const [index, name] of TERM_NAMES.entries()) {
    let term = await firstRow("terms", { school_id: schoolId, session_id: session.id, name });
    if (!term) {
      term = await insert("terms", {
        school_id: schoolId,
        session_id: session.id,
        name,
        is_current: index === 0,
        starts_at: index === 0 ? "2026-09-01" : index === 1 ? "2027-01-10" : "2027-04-12",
        ends_at: index === 0 ? "2026-12-18" : index === 1 ? "2027-04-09" : "2027-07-23",
      });
    }
    termIds.set(name, term.id);
  }
  const currentTermId = termIds.get("First Term");

  // Departments (higher education only)
  const departmentIds = new Map();
  for (const name of config.departments ?? []) {
    let department = await firstRow("departments", { school_id: schoolId, name });
    if (!department) {
      department = await insert("departments", { school_id: schoolId, name });
    }
    departmentIds.set(name, department.id);
  }
  if (departmentIds.size) step(`${departmentIds.size} departments ready`);

  // Classes
  const classIds = new Map();
  for (const [index, name] of config.classes.entries()) {
    let row = await firstRow("classes", { school_id: schoolId, name });
    if (!row) {
      const departmentName = (config.departments ?? []).find((department) =>
        name.startsWith(department),
      );
      const programme = level === "polytechnic" ? (name.match(/\b(OND|HND)\b/)?.[1] ?? null) : null;
      row = await insert("classes", {
        school_id: schoolId,
        name,
        order: index + 1,
        department_id: departmentName ? departmentIds.get(departmentName) : null,
        programme,
      });
    }
    classIds.set(name, row.id);
  }
  step(`${classIds.size} classes ready`);

  // Subjects
  const subjectIds = new Map();
  for (const [name, code] of config.subjects) {
    let subject = await firstRow("subjects", { school_id: schoolId, name });
    if (!subject) {
      subject = await insert("subjects", { school_id: schoolId, name, code });
    }
    subjectIds.set(name, subject.id);
  }
  step(`${subjectIds.size} subjects ready`);

  // Grades, so report cards and results can be graded
  const GRADES = [
    ["A", 70, 100, "Excellent"],
    ["B", 60, 69, "Very Good"],
    ["C", 50, 59, "Good"],
    ["D", 40, 49, "Pass"],
    ["E", 30, 39, "Fair"],
    ["F", 0, 29, "Fail"],
  ];
  const gradeIds = new Map();
  for (const [name, min, max, remark] of GRADES) {
    let grade = await firstRow("grades", { school_id: schoolId, name });
    if (!grade) {
      grade = await insert("grades", {
        school_id: schoolId,
        name,
        min_percentage: min,
        max_percentage: max,
        remark,
      });
    }
    gradeIds.set(name, grade.id);
  }

  // People
  const emailFor = (role) => {
    if (role === "teacher" && config.level === "polytechnic") return "lecturers@polytechnic.test";
    if (role === "teacher" && (config.level === "college" || config.level === "university")) return "lecturer@" + config.emailDomain + ".test";
    return `${role}@${config.emailDomain}.test`;
  };

  const adminEmail = emailFor("admin");
  const teacherEmail = emailFor("teacher");
  const studentEmail = emailFor("student");
  const parentEmail = emailFor("parent");

  const adminUserId = await ensureUser(adminEmail, config.people.admin);
  const teacherUserId = await ensureUser(teacherEmail, config.people.teacher);
  const studentUserId = await ensureUser(studentEmail, config.people.student);
  const parentUserId = await ensureUser(parentEmail, config.people.parent);

  await ensureRole(adminUserId, schoolId, "SCHOOL_ADMIN");
  await ensureRole(teacherUserId, schoolId, "TEACHER");
  await ensureRole(studentUserId, schoolId, "STUDENT");
  await ensureRole(parentUserId, schoolId, "PARENT");

  // Teacher record
  let teacher = await firstRow("teachers", { school_id: schoolId, user_id: teacherUserId });
  if (!teacher) {
    const staffId = `${config.staffPrefix}/STF/2026/001`;
    try {
      teacher = await insert("teachers", {
        school_id: schoolId,
        user_id: teacherUserId,
        staff_id: staffId,
        title: config.people.teacher.startsWith("Mrs") ? "Mrs." : "Mr.",
        display_name: config.people.teacher,
      });
    } catch (e) {
      teacher = await firstRow("teachers", { school_id: schoolId, user_id: teacherUserId }) || await firstRow("teachers", { school_id: schoolId, staff_id: staffId });
      if (!teacher) throw e;
    }
  }
  await supabase
    .from("teachers")
    .update({ display_name: config.people.teacher })
    .eq("id", teacher.id);

  // A second teacher with no login, so the timetable clash rule has something
  // to collide with.
  const secondStaffId = `${config.staffPrefix}/STF/2026/002`;
  let secondTeacher = await firstRow("teachers", { school_id: schoolId, staff_id: secondStaffId });
  if (!secondTeacher) {
    try {
      secondTeacher = await insert("teachers", {
        school_id: schoolId,
        staff_id: secondStaffId,
        title: "Mrs.",
        display_name: "Adesuwa Nwosu",
      });
    } catch (e) {
      secondTeacher = await firstRow("teachers", { school_id: schoolId, staff_id: secondStaffId });
      if (!secondTeacher) throw e;
    }
  }

  // Student and parent
  const studentClassId = classIds.get(config.studentClass);
  let student = await firstRow("students", { school_id: schoolId, user_id: studentUserId });
  if (!student) {
    const admissionNumber = `${config.staffPrefix}/STU/2026/001`;
    student = await insert("students", {
      school_id: schoolId,
      user_id: studentUserId,
      admission_number: admissionNumber,
      class_id: studentClassId,
      gender: config.people.studentGender,
      date_of_birth: config.people.studentBirthDate,
      guardian_phone: "+234 800 555 0000",
    });
  }
  await supabase
    .from("students")
    .update({ display_name: config.people.student })
    .eq("id", student.id);

  let parent = await firstRow("parents", { school_id: schoolId, user_id: parentUserId });
  if (!parent) {
    parent = await insert("parents", {
      school_id: schoolId,
      user_id: parentUserId,
      relationship: "Father",
    });
  }
  await supabase
    .from("parents")
    .update({ display_name: config.people.parent })
    .eq("id", parent.id);

  await upsert(
    "parent_student_relationships",
    { school_id: schoolId, parent_id: parent.id, student_id: student.id, relation: "Father" },
    "parent_id,student_id",
  );

  // Teacher links
  const linkedClassIds = new Set();
  const { data: classLinks } = await supabase
    .from("teacher_classes")
    .select("class_id")
    .eq("teacher_id", teacher.id)
    .eq("session_id", session.id);
  for (const link of classLinks ?? []) linkedClassIds.add(link.class_id);
  await insertMany(
    "teacher_classes",
    [...classIds.values()]
      .filter((classId) => !linkedClassIds.has(classId))
      .map((classId) => ({
        school_id: schoolId,
        teacher_id: teacher.id,
        class_id: classId,
        session_id: session.id,
      })),
  );

  const linkedSubjectIds = new Set();
  const { data: subjectLinks } = await supabase
    .from("teacher_subjects")
    .select("subject_id")
    .eq("teacher_id", teacher.id)
    .eq("session_id", session.id);
  for (const link of subjectLinks ?? []) linkedSubjectIds.add(link.subject_id);
  await insertMany(
    "teacher_subjects",
    [...subjectIds.values()]
      .filter((subjectId) => !linkedSubjectIds.has(subjectId))
      .map((subjectId) => ({
        school_id: schoolId,
        teacher_id: teacher.id,
        subject_id: subjectId,
        session_id: session.id,
      })),
  );
  step("teacher linked to classes and subjects");

  const ctx = {
    config,
    schoolId,
    level,
    sessionId: session.id,
    termId: currentTermId,
    classIds,
    subjectIds,
    gradeIds,
    teacherId: teacher.id,
    secondTeacherId: secondTeacher.id,
    teacherUserId,
    studentId: student.id,
    studentUserId,
    parentId: parent.id,
    parentUserId,
    adminUserId,
  };

  await seedCoursesAndLessons(ctx);
  await seedAssignments(ctx);
  await seedExamSeries(ctx);
  await seedExaminationsAndResults(ctx);
  await seedAttendance(ctx);
  await seedTimetable(ctx);
  await seedLiveSessions(ctx);
  await seedFees(ctx);
  await seedAdmissions(ctx);
  await seedAnnouncementsAndNotifications(ctx);
  await seedEventsAndGallery(ctx);
  await seedComplaints(ctx);
  await seedSubscription(ctx);
  await seedProgress(ctx);

  log(`  ${config.name} ready. Sign in as ${adminEmail} / ${teacherEmail} / ${studentEmail} / ${parentEmail}`);
}

// ---------------------------------------------------------------------------
// Courses, modules and lessons
// ---------------------------------------------------------------------------

async function seedCoursesAndLessons(ctx) {
  const { config, schoolId, classIds, subjectIds, teacherId, teacherUserId } = ctx;
  const classId = classIds.get(config.courseClass);
  const subjectId = subjectIds.get(config.courseSubject);
  const subjectName = config.courseSubject;
  const className = config.courseClass;

  // Below college the portal creates the course behind the lesson, so the
  // title follows that convention exactly. Above it, a course is a course.
  const title =
    config.courseTitle ??
    (ctx.level === "college" || ctx.level === "polytechnic" || ctx.level === "university"
      ? `${subjectName} — ${className}`
      : `${subjectName} · ${className}`);

  const classRow = await firstRow("classes", { id: classId });

  let course = await firstRow("courses", { school_id: schoolId, title });
  if (!course) {
    course = await insert("courses", {
      school_id: schoolId,
      subject_id: subjectId,
      class_id: classId,
      teacher_id: teacherId,
      department_id: classRow?.department_id ?? null,
      title,
      description: `${subjectName} teaching and materials for ${className}.`,
      status: "published",
    });
  }

  let module = await firstRow("course_modules", { course_id: course.id, title: "Term 1" });
  if (!module) {
    module = await insert("course_modules", {
      school_id: schoolId,
      course_id: course.id,
      title: "Term 1",
      description: `The first term of ${subjectName}.`,
      order: 0,
    });
  }

  for (const [lessonTitle, description] of config.lessons) {
    const existing = await firstRow("lessons", { course_id: course.id, title: lessonTitle });
    if (existing) continue;
    await insert("lessons", {
      school_id: schoolId,
      course_id: course.id,
      module_id: module.id,
      title: lessonTitle,
      description,
      content: `## ${lessonTitle}\n\n${description}\n\nWork through the examples in class, then try the practice questions on your own.`,
      status: "published",
      created_by: teacherUserId,
    });
  }
  step(`course "${title}" with ${config.lessons.length} lessons ready`);
}

// ---------------------------------------------------------------------------
// Assignments and submissions
// ---------------------------------------------------------------------------

async function seedAssignments(ctx) {
  const { config, schoolId, classIds, subjectIds, teacherUserId, studentId } = ctx;
  const classId = classIds.get(config.studentClass);
  const subjectId = subjectIds.get(config.coreSubject);
  const course = await firstRow("courses", { school_id: schoolId, class_id: classId });

  let assignment = await firstRow("assignments", { school_id: schoolId, title: config.assignment.title });
  if (!assignment) {
    const dueDate = new Date(Date.now() + 5 * DAY);
    assignment = await insert("assignments", {
      school_id: schoolId,
      course_id: course?.id ?? null,
      class_id: classId,
      subject_id: subjectId,
      title: config.assignment.title,
      description: `Set for ${config.studentClass} in ${config.coreSubject}.`,
      instructions: config.assignment.instructions,
      due_date: dueDate.toISOString(),
      max_score: 100,
      status: "published",
      created_by: teacherUserId,
    });
  }

  // A submission already graded, and a second set still waiting on the
  // teacher, so both sides of the marking queue have something real in them.
  // The two live on different assignments because a student may only submit
  // one piece of work per assignment.
  const graded = await firstRow("assignment_submissions", {
    assignment_id: assignment.id,
    student_id: studentId,
  });
  if (!graded) {
    await insert("assignment_submissions", {
      school_id: schoolId,
      assignment_id: assignment.id,
      student_id: studentId,
      submission_text:
        "Here is my full working for every part of the set, with the final answers written at the end of each line.",
      status: "graded",
      score: 78,
      feedback:
        "Good working, and your method is right throughout. Watch the last part: you dropped a negative sign when substituting. Full method marks, three marks lost on the final answer.",
      graded_at: new Date(Date.now() - 12 * DAY).toISOString(),
      graded_by: teacherUserId,
      submitted_at: new Date(Date.now() - 13 * DAY).toISOString(),
    });
  }

  const followUpTitle = `${config.assignment.title} — follow-up set`;
  let followUp = await firstRow("assignments", { school_id: schoolId, title: followUpTitle });
  if (!followUp) {
    followUp = await insert("assignments", {
      school_id: schoolId,
      course_id: course?.id ?? null,
      class_id: classId,
      subject_id: subjectId,
      title: followUpTitle,
      description: "The next set, submitted and waiting to be marked.",
      instructions: config.assignment.instructions,
      due_date: new Date(Date.now() - 2 * DAY).toISOString(),
      max_score: 100,
      status: "published",
      created_by: teacherUserId,
    });
  }

  const pending = await firstRow("assignment_submissions", {
    assignment_id: followUp.id,
    student_id: studentId,
  });
  if (!pending) {
    await insert("assignment_submissions", {
      school_id: schoolId,
      assignment_id: followUp.id,
      student_id: studentId,
      submission_text:
        "I worked through every question and checked my answers against the worked example in the lesson notes. The answers I got right are 1, 2 and 3; question 4 I left out because I ran out of time and I want to try it again in class.",
      status: "submitted",
      submitted_at: new Date(Date.now() - 2 * DAY).toISOString(),
    });
  }
  step("assignments with a graded and a pending submission ready");
}

// ---------------------------------------------------------------------------
// Exam series, questions and a practice attempt
// ---------------------------------------------------------------------------

async function seedExamSeries(ctx) {
  const { config, schoolId, classIds, subjectIds, teacherUserId, studentId } = ctx;
  const exam = config.exam;
  const classId = classIds.get(config.studentClass);
  const subjectId = subjectIds.get(exam.subject);

  let series = await firstRow("exam_series", { school_id: schoolId, title: exam.title });
  if (!series) {
    series = await insert("exam_series", {
      school_id: schoolId,
      exam_type: exam.type,
      title: exam.title,
      year: "2026",
      description: `Practice paper for ${exam.subject}, with objective questions marked automatically and a theory section marked by the teacher.`,
      subject_id: subjectId,
      class_id: classId,
      status: "published",
      duration_minutes: 15,
      shuffle_questions: true,
      created_by: teacherUserId,
    });
  }

  // Sections are keyed by their position, not their title: a series that
  // already has two sections keeps them, whatever they are called.
  const sectionPlan = [
    {
      position: 0,
      title: "Paper 1 — Objective",
      instructions: "Answer all questions. Select the single best option for each.",
    },
    {
      position: 1,
      title: "Paper 2 — Theory",
      instructions: "Answer ALL questions, showing your working. This section is marked by your teacher.",
    },
  ];
  const sections = [];
  for (const planned of sectionPlan) {
    let section = await firstRow("exam_sections", {
      series_id: series.id,
      position: planned.position,
    });
    if (!section) {
      section = await insert("exam_sections", {
        school_id: schoolId,
        series_id: series.id,
        title: planned.title,
        instructions: planned.instructions,
        position: planned.position,
      });
    }
    sections.push(section);
  }
  const objectiveSection = sections[0];
  const theorySection = sections[1];

  let bank = await firstRow("question_banks", {
    school_id: schoolId,
    exam_series_id: series.id,
  });
  if (!bank) {
    bank = await insert("question_banks", {
      school_id: schoolId,
      exam_series_id: series.id,
      name: exam.title,
      subject_id: subjectId,
      class_id: classId,
      status: "published",
      created_by: teacherUserId,
    });
  }

  const questionIds = [];
  const optionRows = [];
  for (const question of exam.questions) {
    const existing = await firstRow("questions", {
      question_bank_id: bank.id,
      question_text: question.text,
    });
    if (existing) {
      questionIds.push({ id: existing.id, marks: 1, options: null });
      continue;
    }
    const row = await insert("questions", {
      school_id: schoolId,
      question_bank_id: bank.id,
      subject_id: subjectId,
      class_id: classId,
      section_id: objectiveSection?.id ?? null,
      question_text: question.text,
      question_type: "multiple_choice",
      difficulty: "medium",
      marks: 1,
      explanation: question.explanation,
      created_by: teacherUserId,
    });
    for (const [index, option] of question.options.entries()) {
      optionRows.push({
        school_id: schoolId,
        question_id: row.id,
        option_text: option,
        is_correct: index === question.correct,
        position: index,
      });
    }
    questionIds.push({ id: row.id, marks: 1, options: null });
  }
  await insertMany("question_options", optionRows);

  const essayExisting = await firstRow("questions", {
    question_bank_id: bank.id,
    question_type: "essay",
  });
  if (!essayExisting) {
    await insert("questions", {
      school_id: schoolId,
      question_bank_id: bank.id,
      subject_id: subjectId,
      class_id: classId,
      section_id: theorySection?.id ?? null,
      question_text: exam.essay.text,
      question_type: "essay",
      answer_guide: exam.essay.guide,
      difficulty: "medium",
      marks: exam.essay.marks,
      explanation: "Marked by the teacher against the mark guide.",
      created_by: teacherUserId,
    });
  }

  // One submitted attempt, so the results page, the teacher's marking queue and
  // the analytics all have numbers in them.
  const attempt = await firstRow("practice_attempts", {
    school_id: schoolId,
    exam_series_id: series.id,
    student_id: studentId,
    status: "submitted",
  });
  if (!attempt) {
    const optionRows = await supabase
      .from("question_options")
      .select("id, question_id, is_correct, position")
      .eq("school_id", schoolId)
      .in("question_id", questionIds.map((q) => q.id))
      .order("position", { ascending: true });

    const answers = [];
    let autoScore = 0;
    for (const [index, question] of questionIds.entries()) {
      const options = (optionRows.data ?? []).filter((o) => o.question_id === question.id);
      const correct = options.find((o) => o.is_correct);
      const wrong = options.find((o) => !o.is_correct);
      // Every question right except the second, so the score is honest and the
      // marking screen has a wrong answer to look at.
      const isCorrect = index !== 1 && Boolean(correct);
      const selected = isCorrect ? correct : (wrong ?? correct);
      if (isCorrect) autoScore += question.marks;
      answers.push({
        school_id: schoolId,
        question_id: question.id,
        selected_option_id: selected?.id ?? null,
        is_correct: isCorrect,
        marks_awarded: isCorrect ? question.marks : 0,
      });
    }

    const totalMarks = exam.questions.length + exam.essay.marks;
    const startedAt = new Date(Date.now() - 6 * HOUR);
    const submittedAt = new Date(Date.now() - 5 * HOUR);
    const created = await insert("practice_attempts", {
      school_id: schoolId,
      exam_series_id: series.id,
      student_id: studentId,
      status: "submitted",
      started_at: startedAt.toISOString(),
      submitted_at: submittedAt.toISOString(),
      score: autoScore,
      total_marks: totalMarks,
      correct_count: answers.filter((a) => a.is_correct).length,
      wrong_count: answers.filter((a) => !a.is_correct).length,
      time_used_seconds: 900,
    });

    const answerRows = [];
    for (const answer of answers) {
      answerRows.push({
        ...answer,
        attempt_id: created.id,
        answered_at: submittedAt.toISOString(),
      });
    }

    const essayQuestion = await firstRow("questions", {
      question_bank_id: bank.id,
      question_type: "essay",
    });
    if (essayQuestion) {
      answerRows.push({
        school_id: schoolId,
        attempt_id: created.id,
        question_id: essayQuestion.id,
        answer_text:
          "I worked through the question step by step and wrote down my method before I calculated the answer. I checked my final answer by putting it back into the question.",
        is_correct: null,
        marks_awarded: null,
        answered_at: submittedAt.toISOString(),
      });
    }
    await insertMany("practice_answers", answerRows);
  }
  step(`exam series "${exam.title}" with a submitted attempt ready`);
}

// ---------------------------------------------------------------------------
// Examinations and published results (report cards, school results, analytics)
// ---------------------------------------------------------------------------

async function seedExaminationsAndResults(ctx) {
  const { config, schoolId, classIds, subjectIds, gradeIds, sessionId, termId, studentId } = ctx;
  const classId = classIds.get(config.studentClass);
  const subjects = config.subjects.slice(0, 3).map(([name]) => name);

  for (const [index, subjectName] of subjects.entries()) {
    const subjectId = subjectIds.get(subjectName);
    const title = `First Term Examination — ${subjectName}`;
    let examination = await firstRow("examinations", { school_id: schoolId, title });
    if (!examination) {
      examination = await insert("examinations", {
        school_id: schoolId,
        subject_id: subjectId,
        class_id: classId,
        session_id: sessionId,
        term_id: termId,
        title,
        instructions: "Answer every question. The paper is marked out of 100.",
        duration_minutes: 60,
        total_marks: 100,
        pass_mark: 50,
        attempt_limit: 1,
        status: "published",
        created_by: ctx.teacherUserId,
      });
    }

    const existing = await firstRow("results", {
      student_id: studentId,
      examination_id: examination.id,
      subject_id: subjectId,
    });
    if (existing) continue;

    const score = 62 + index * 9;
    const percentage = Number(((score / 100) * 100).toFixed(2));
    const gradeName = percentage >= 70 ? "A" : percentage >= 60 ? "B" : percentage >= 50 ? "C" : "D";
    await insert("results", {
      school_id: schoolId,
      student_id: studentId,
      examination_id: examination.id,
      subject_id: subjectId,
      session_id: sessionId,
      term_id: termId,
      score,
      percentage,
      grade_id: gradeIds.get(gradeName),
      pass: percentage >= 50,
      correct_count: 18 + index * 2,
      wrong_count: 2,
      published_at: new Date(Date.now() - 20 * DAY).toISOString(),
    });
  }
  step(`${subjects.length} published examinations with results ready`);
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

async function seedAttendance(ctx) {
  const { schoolId, classIds, config, studentId, teacherUserId } = ctx;
  const classId = classIds.get(config.studentClass);

  const dates = [];
  const cursor = new Date();
  while (dates.length < 18) {
    const weekday = cursor.getDay();
    if (weekday >= 1 && weekday <= 5) {
      const month = String(cursor.getMonth() + 1).padStart(2, "0");
      const day = String(cursor.getDate()).padStart(2, "0");
      dates.push(`${cursor.getFullYear()}-${month}-${day}`);
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  dates.reverse();

  const { data: existingDays } = await supabase
    .from("attendance_records")
    .select("date")
    .eq("student_id", studentId);
  const alreadyMarked = new Set((existingDays ?? []).map((row) => row.date));

  const rows = [];
  for (const [index, date] of dates.entries()) {
    if (alreadyMarked.has(date)) continue;
    let status = "present";
    if ([2, 9].includes(index)) status = "absent";
    else if ([5, 13].includes(index)) status = "late";
    else if (index === 16) status = "excused";
    rows.push({
      school_id: schoolId,
      class_id: classId,
      student_id: studentId,
      date,
      status,
      marked_by: teacherUserId,
    });
  }
  await insertMany("attendance_records", rows);
  step(`${dates.length} days of attendance ready`);
}

// ---------------------------------------------------------------------------
// Timetable
// ---------------------------------------------------------------------------

async function seedTimetable(ctx) {
  const { schoolId, classIds, subjectIds, config, sessionId, teacherId, secondTeacherId } = ctx;
  const classId = classIds.get(config.studentClass);
  const otherClassId = classIds.get(config.classes[0]);

  const periods = [
    { name: "Period 1", start: "08:00:00", end: "08:45:00", seq: 0 },
    { name: "Period 2", start: "08:45:00", end: "09:30:00", seq: 1 },
    { name: "Lunch", start: "09:30:00", end: "09:50:00", seq: 2, is_break: true },
    { name: "Period 3", start: "09:50:00", end: "10:35:00", seq: 3 },
    { name: "Period 4", start: "10:35:00", end: "11:20:00", seq: 4 },
    { name: "Period 5", start: "11:20:00", end: "12:05:00", seq: 5 },
  ];

  const periodRows = [];
  for (const period of periods) {
    const existing = await firstRow("timetable_periods", {
      school_id: schoolId,
      seq: period.seq,
    });
    if (existing) {
      periodRows.push(existing);
      continue;
    }
    periodRows.push(
      await insert("timetable_periods", {
        school_id: schoolId,
        name: period.name,
        start_time: period.start,
        end_time: period.end,
        seq: period.seq,
        is_break: period.is_break ?? false,
      }),
    );
  }

  const lessonPeriods = periodRows.filter((p) => !p.is_break);
  const subjectIdsList = [...subjectIds.values()];
  const DAYS = [1, 2, 3, 4, 5];

  // One read for every slot either class already has, then one write for the
  // slots that are still empty.
  const { data: existingEntries } = await supabase
    .from("timetable_entries")
    .select("class_id, day_of_week, period_id")
    .eq("session_id", sessionId)
    .in("class_id", [classId, otherClassId]);
  const taken = new Set(
    (existingEntries ?? []).map((row) => `${row.class_id}:${row.day_of_week}:${row.period_id}`),
  );

  const rows = [];
  for (const period of lessonPeriods) {
    for (const day of DAYS) {
      if (!taken.has(`${classId}:${day}:${period.id}`)) {
        rows.push({
          school_id: schoolId,
          session_id: sessionId,
          class_id: classId,
          period_id: period.id,
          day_of_week: day,
          subject_id: subjectIdsList[(period.seq + day) % subjectIdsList.length],
          teacher_id: teacherId,
        });
      }
    }
  }
  await insertMany("timetable_entries", rows);

  // A second class on a different teacher, so the clash check means something.
  const clashRows = [];
  for (const period of lessonPeriods.slice(0, 3)) {
    for (const day of DAYS) {
      if (taken.has(`${otherClassId}:${day}:${period.id}`)) continue;
      clashRows.push({
        school_id: schoolId,
        session_id: sessionId,
        class_id: otherClassId,
        period_id: period.id,
        day_of_week: day,
        subject_id: subjectIdsList[(period.seq + day + 2) % subjectIdsList.length],
        teacher_id: secondTeacherId,
      });
    }
  }
  await insertMany("timetable_entries", clashRows);
  step(`timetable with ${lessonPeriods.length} periods ready`);
}

// ---------------------------------------------------------------------------
// Live sessions
// ---------------------------------------------------------------------------

async function seedLiveSessions(ctx) {
  const { schoolId, classIds, config, studentId, teacherUserId } = ctx;
  const classId = classIds.get(config.studentClass);

  // A school that already has sessions (Greenfield, from scripts/seed.mjs)
  // keeps them: the demo set would only be noise on top.
  const existingCount = await countRows("live_sessions", { school_id: schoolId });
  if (existingCount > 0) {
    step(`live sessions already present (${existingCount})`);
    return;
  }

  const now = Date.now();
  const at = (offsetMs, durationMs) => ({
    starts_at: new Date(now + offsetMs).toISOString(),
    ends_at: new Date(now + offsetMs + durationMs).toISOString(),
  });

  const plan = [
    {
      title: "Worked examples from this week's lesson",
      description: "We go through the practice questions together. Bring your exercise book.",
      ...at(-2 * DAY, 50 * 60_000),
      status: "ended",
      is_visible_to_students: true,
      register: true,
    },
    {
      title: "Live: guided practice and questions",
      description: "Follow along in your exercise book. The session is not recorded.",
      ...at(-10 * 60_000, 50 * 60_000),
      status: "live",
      is_visible_to_students: true,
      register: false,
    },
    {
      title: "Preparing for the end of term assessment",
      description: "Bring a calculator if your teacher asked for one.",
      ...at(2 * DAY, 50 * 60_000),
      status: "scheduled",
      is_visible_to_students: true,
      register: false,
    },
    {
      title: "Rehearsal (not yet announced)",
      description: "The link has not been tested yet, so students cannot see it.",
      ...at(5 * DAY, 90 * 60_000),
      status: "scheduled",
      is_visible_to_students: false,
      register: false,
    },
  ];

  let pastSession = null;
  for (const item of plan) {
    const existing = await firstRow("live_sessions", { school_id: schoolId, title: item.title });
    const row =
      existing ??
      (await insert("live_sessions", {
        school_id: schoolId,
        class_id: classId,
        title: item.title,
        description: item.description,
        join_url: `https://zoom.us/j/9${Math.floor(1e9 + now % 1e8)}demo`,
        starts_at: item.starts_at,
        ends_at: item.ends_at,
        status: item.status,
        is_visible_to_students: item.is_visible_to_students,
        created_by: teacherUserId,
      }));
    if (item.register) pastSession = row;
  }

  if (pastSession) {
    const existing = await firstRow("live_attendance_records", {
      live_session_id: pastSession.id,
      student_id: studentId,
    });
    if (!existing) {
      await insert("live_attendance_records", {
        school_id: schoolId,
        live_session_id: pastSession.id,
        student_id: studentId,
        status: "late",
        marked_by: teacherUserId,
      });
    }
  }
  step(`${plan.length} live sessions ready`);
}

// ---------------------------------------------------------------------------
// Fees
// ---------------------------------------------------------------------------

async function seedFees(ctx) {
  const { config, schoolId, studentId, parentId, parentUserId } = ctx;

  if (!config.fees?.length) {
    step("fees already seeded for this school — skipping");
    return;
  }

  for (const [index, [description, amount, status, paid]] of config.fees.entries()) {
    const billingKey = `${config.slug}-invoice-${index + 1}`;
    const existing = await firstRow("fee_invoices", { school_id: schoolId, billing_key: billingKey });
    let invoice = existing;
    if (!invoice) {
      invoice = await insert("fee_invoices", {
        school_id: schoolId,
        student_id: studentId,
        description,
        amount,
        amount_paid: paid,
        currency: "NGN",
        due_date: new Date(Date.now() + (index + 1) * 30 * DAY).toISOString().slice(0, 10),
        status,
        billing_key: billingKey,
      });
    }

    if (paid > 0) {
      const reference = `${billingKey}-payment`;
      const payment = await firstRow("fee_payments", {
        provider: "paystack",
        provider_reference: reference,
      });
      if (!payment) {
        await insert("fee_payments", {
          school_id: schoolId,
          invoice_id: invoice.id,
          parent_id: parentId,
          payer_user_id: parentUserId,
          provider: "paystack",
          provider_reference: reference,
          amount: paid,
          credited_amount: paid,
          status: "approved",
          submitted_at: new Date(Date.now() - (index + 1) * 20 * DAY).toISOString(),
          reviewed_at: new Date(Date.now() - (index + 1) * 20 * DAY + 2 * HOUR).toISOString(),
          reviewed_by: ctx.adminUserId,
        });
      }
    }
  }

  // One payment still waiting on a bursar, so the approval queue is not empty.
  const pendingReference = `${config.slug}-pending-payment`;
  const pending = await firstRow("fee_payments", {
    provider: "paystack",
    provider_reference: pendingReference,
  });
  if (!pending) {
    const invoice = await firstRow("fee_invoices", {
      school_id: schoolId,
      billing_key: `${config.slug}-invoice-${config.fees.length}`,
    });
    if (invoice) {
      await insert("fee_payments", {
        school_id: schoolId,
        invoice_id: invoice.id,
        parent_id: parentId,
        payer_user_id: parentUserId,
        provider: "paystack",
        provider_reference: pendingReference,
        amount: 10000,
        status: "submitted",
        submitted_at: new Date(Date.now() - 2 * DAY).toISOString(),
      });
    }
  }
  step(`${config.fees.length} fee invoices ready`);
}

// ---------------------------------------------------------------------------
// Admissions
// ---------------------------------------------------------------------------

async function seedAdmissions(ctx) {
  const { config, schoolId, classIds, adminUserId } = ctx;

  await upsert(
    "admission_settings",
    {
      school_id: schoolId,
      enabled: true,
      opens_at: new Date(Date.now() - 14 * DAY).toISOString(),
      closes_at: new Date(Date.now() + 60 * DAY).toISOString(),
      intake_label: `${SESSION_NAME} Academic Session`,
      intro_message:
        "Applications are open for the coming academic session. Complete the form and the school will be in touch.",
      application_fee_amount: 2500,
      application_fee_currency: "NGN",
      fee_note: "Non-refundable, payable at the school bursary.",
      updated_by: adminUserId,
    },
    "school_id",
  );

  const applicants = [
    {
      first: "Segun",
      last: "Ademola",
      className: config.classes[config.classes.length - 1],
      guardian: "Mr. Ademola",
      email: "guardian.ademola@example.test",
      phone: "+234 811 222 3344",
      status: "submitted",
      score: null,
    },
    {
      first: "Ngozi",
      last: "Eze",
      className: config.classes[0],
      guardian: "Mrs. Eze",
      email: "guardian.eze@example.test",
      phone: "+234 812 333 4455",
      status: "under_review",
      score: 68,
    },
    {
      first: "Ibrahim",
      last: "Musa",
      className: config.classes[0],
      guardian: "Mr. Musa",
      email: "guardian.musa@example.test",
      phone: "+234 813 444 5566",
      status: "offered",
      score: 74,
    },
  ];

  for (const [index, applicant] of applicants.entries()) {
    const applicationNumber = `ADM-${config.slug.slice(0, 4).toUpperCase()}-${String(index + 1).padStart(4, "0")}`;
    const existing = await firstRow("admission_applications", {
      school_id: schoolId,
      application_number: applicationNumber,
    });
    let application = existing;
    if (!application) {
      application = await insert("admission_applications", {
        school_id: schoolId,
        application_number: applicationNumber,
        applicant_first_name: applicant.first,
        applicant_last_name: applicant.last,
        date_of_birth: `201${index + 2}-0${index + 4}-1${index}`,
        gender: index === 1 ? "female" : "male",
        class_id: classIds.get(applicant.className) ?? null,
        class_name: applicant.className,
        guardian_name: applicant.guardian,
        guardian_email: applicant.email,
        guardian_phone: applicant.phone,
        address: `${index + 1} Example Close, ${config.city}`,
        previous_school: "Little Steps Primary",
        notes: "Enquiry made at the school's open day.",
        status: applicant.status,
        entrance_score: applicant.score,
        entrance_date: applicant.score ? new Date(Date.now() - 5 * DAY).toISOString().slice(0, 10) : null,
        decision_note:
          applicant.status === "offered" ? "Strong result at the entrance assessment." : null,
        reviewed_by: applicant.status === "submitted" ? null : adminUserId,
        reviewed_at: applicant.status === "submitted" ? null : new Date(Date.now() - 4 * DAY).toISOString(),
      });
    }

    const event = await firstRow("admission_events", {
      application_id: application.id,
      kind: "system",
    });
    if (!event) {
      await insert("admission_events", {
        application_id: application.id,
        school_id: schoolId,
        author_id: adminUserId,
        author_name: config.people.admin,
        kind: "system",
        body: "Application received and acknowledged.",
      });
    }
  }
  step("admission settings and applications ready");
}

// ---------------------------------------------------------------------------
// Announcements and notifications
// ---------------------------------------------------------------------------

async function seedAnnouncementsAndNotifications(ctx) {
  const { config, schoolId, classIds, teacherUserId, studentUserId, parentUserId, adminUserId } = ctx;

  const announcements = [
    {
      title: "Parent–teacher meeting on Friday",
      message:
        "The meeting for this class runs from 2pm to 4pm in the main hall. Please come with your child's progress report.",
      target_type: "school",
      class_id: null,
    },
    {
      title: "Reminder: fees are due before the end of the term",
      message:
        "Any outstanding balance should be settled at the bursary before the end of the term. Statements are available in the parent portal.",
      target_type: "parents",
      class_id: null,
    },
    {
      title: "Class notice: bring a calculator",
      message:
        "The next lesson uses a calculator for the first time. Please bring one, or borrow one from the laboratory.",
      target_type: "class",
      class_id: classIds.get(config.studentClass) ?? null,
    },
  ];

  for (const announcement of announcements) {
    const existing = await firstRow("announcements", { school_id: schoolId, title: announcement.title });
    if (existing) continue;
    await insert("announcements", {
      school_id: schoolId,
      title: announcement.title,
      message: announcement.message,
      target_type: announcement.target_type,
      class_id: announcement.class_id,
      published_at: new Date(Date.now() - 2 * DAY).toISOString(),
      expires_at: new Date(Date.now() + 28 * DAY).toISOString(),
      created_by: teacherUserId,
    });
  }

  const notifications = [
    {
      user_id: adminUserId,
      type: "system",
      title: "Weekly school summary is ready",
      message: "Attendance, fees and assessment summaries for this week are ready to review.",
    },
    {
      user_id: ctx.teacherUserId,
      type: "assignment_due",
      title: "Submissions waiting to be marked",
      message: "There are submissions waiting for you in the marking queue.",
    },
    {
      user_id: studentUserId,
      type: "assignment_graded",
      title: "Your work has been marked",
      message: "Your teacher returned a marked assignment with feedback.",
    },
    {
      user_id: parentUserId,
      type: "system",
      title: "A new statement is available",
      message: "Your child's fee statement has been updated. Sign in to view it.",
    },
  ];

  for (const notification of notifications) {
    const existing = await firstRow("notifications", {
      user_id: notification.user_id,
      title: notification.title,
    });
    if (existing) continue;
    await insert("notifications", {
      school_id: schoolId,
      user_id: notification.user_id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
    });
  }
  step("announcements and notifications ready");
}

// ---------------------------------------------------------------------------
// Events and gallery
// ---------------------------------------------------------------------------

async function seedEventsAndGallery(ctx) {
  const { config, schoolId, teacherUserId } = ctx;

  const events = [
    {
      title: "Inter-house sports",
      description: "Track and field events for every house, with parents welcome.",
      venue: "School field",
      offset: 7 * DAY,
      published: true,
    },
    {
      title: "Science and Mathematics exhibition",
      description: "Student projects on display. Judges award prizes at 2pm.",
      venue: "Main hall",
      offset: 21 * DAY,
      published: true,
    },
    {
      title: "Staff briefing (not published)",
      description: "Termly planning meeting for teaching staff.",
      venue: "Staff room",
      offset: 3 * DAY,
      published: false,
    },
  ];

  for (const event of events) {
    const existing = await firstRow("school_events", { school_id: schoolId, title: event.title });
    if (existing) continue;
    const starts = new Date(Date.now() + event.offset);
    await insert("school_events", {
      school_id: schoolId,
      title: event.title,
      description: event.description,
      venue: event.venue,
      starts_at: starts.toISOString(),
      ends_at: new Date(starts.getTime() + 3 * HOUR).toISOString(),
      cover_url: `https://picsum.photos/seed/${config.slug}-event/1200/600`,
      published: event.published,
      created_by: teacherUserId,
    });
  }

  const gallery = [
    ["Sports day", "sports"],
    ["Science fair", "academic"],
    ["Graduation", "ceremony"],
  ];
  for (const [index, [title, category]] of gallery.entries()) {
    const existing = await firstRow("school_gallery", { school_id: schoolId, title });
    if (existing) continue;
    await insert("school_gallery", {
      school_id: schoolId,
      title,
      image_url: `https://picsum.photos/seed/${config.slug}-${index + 1}/800/600`,
      category,
    });
  }
  step("events and gallery ready");
}

// ---------------------------------------------------------------------------
// Complaints
// ---------------------------------------------------------------------------

async function seedComplaints(ctx) {
  const { config, schoolId, parentUserId, parentId, adminUserId } = ctx;

  const subject = "Concern about the second term fee increase";
  let complaint = await firstRow("complaints", { school_id: schoolId, subject });
  if (!complaint) {
    complaint = await insert("complaints", {
      school_id: schoolId,
      raised_by: parentUserId,
      raised_by_name: config.people.parent,
      raised_by_role: "PARENT",
      category: "fees",
      subject,
      status: "in_progress",
      assigned_to: adminUserId,
    });

    await insert("complaint_messages", {
      complaint_id: complaint.id,
      author_id: parentUserId,
      author_name: config.people.parent,
      is_from_school: false,
      body: "The second term invoice is higher than last year and I was not told before it was issued. Could someone explain the change?",
    });
    await insert("complaint_messages", {
      complaint_id: complaint.id,
      author_id: adminUserId,
      author_name: config.people.admin,
      is_from_school: true,
      body: "Thank you for raising this. The increase covers the new laboratory levy and a term of extra tutorial classes. I have attached the breakdown and we can meet this week if that helps.",
    });
  }
  step("complaint thread ready");
}

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

async function seedSubscription(ctx) {
  const { schoolId, config } = ctx;

  const plan = await firstRow("subscription_plans", { name: "Professional" });
  if (!plan) {
    step("no Professional plan found — skipping the subscription");
    return;
  }

  // The plan runs for a year so the demo school never trips the "your
  // subscription has ended" wall while it is being looked at.
  const start = new Date();
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);

  const existing = await firstRow("subscriptions", { school_id: schoolId });
  let subscription = existing;
  if (!subscription) {
    subscription = await insert("subscriptions", {
      school_id: schoolId,
      plan_id: plan.id,
      status: "active",
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
      cancel_at_period_end: false,
    });
  } else if (existing.status !== "active" || !existing.current_period_end) {
    const { error } = await supabase
      .from("subscriptions")
      .update({
        plan_id: plan.id,
        status: "active",
        current_period_start: start.toISOString(),
        current_period_end: end.toISOString(),
        cancel_at_period_end: false,
      })
      .eq("id", existing.id);
    if (error) fail("renew the subscription", error);
  }

  // The reference matches the one scripts/seed.mjs wrote for Greenfield, so
  // re-running either script does not create a second payment.
  const reference = `manual_${config.slug.replace(/-college$/, "")}_2026_professional`;
  const payment = await firstRow("payments", { provider_reference: reference });
  if (!payment) {
    await insert("payments", {
      school_id: schoolId,
      subscription_id: subscription.id,
      provider: "manual",
      provider_reference: reference,
      amount: 24000,
      currency: "NGN",
      status: "paid",
      paid_at: new Date().toISOString(),
      metadata: { plan_id: plan.id, plan_name: plan.name, billing_interval: "monthly" },
    });
  }
  step("subscription and payment ready");
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

async function seedProgress(ctx) {
  const { schoolId, studentId, teacherUserId } = ctx;

  const course = await firstRow("courses", { school_id: schoolId, teacher_id: ctx.teacherId });
  if (!course) return;

  let progress = await firstRow("student_progress", {
    student_id: studentId,
    course_id: course.id,
  });
  if (!progress) {
    await insert("student_progress", {
      school_id: schoolId,
      student_id: studentId,
      course_id: course.id,
      overall_percentage: 68,
      lessons_completed: 2,
      assignments_completed: 1,
      tests_completed: 1,
      learning_streak: 5,
      last_activity_at: new Date(Date.now() - 5 * HOUR).toISOString(),
    });
  }

  const lessons = await supabase
    .from("lessons")
    .select("id")
    .eq("course_id", course.id)
    .order("created_at", { ascending: true });
  for (const lesson of lessons.data ?? []) {
    const existing = await firstRow("lesson_progress", {
      student_id: studentId,
      lesson_id: lesson.id,
    });
    if (existing) continue;
    await insert("lesson_progress", {
      school_id: schoolId,
      student_id: studentId,
      lesson_id: lesson.id,
      started_at: new Date(Date.now() - 3 * DAY).toISOString(),
      completed_at: new Date(Date.now() - 2 * DAY).toISOString(),
      progress_percentage: 100,
    });
  }
  step("student and lesson progress ready");
}

// ---------------------------------------------------------------------------

async function main() {
  log("Seeding a school at every education level…");
  for (const config of SCHOOLS) {
    await seedSchool(config);
  }
  log("\nLevel demo data complete. Demo password:", PASSWORD);
  for (const config of SCHOOLS) {
    log(
      `  ${config.level.padEnd(12)} ${config.name} — admin@${config.emailDomain}.test, teacher@${config.emailDomain}.test, student@${config.emailDomain}.test, parent@${config.emailDomain}.test`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
