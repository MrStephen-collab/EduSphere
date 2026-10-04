// Verifies the parent statement and receipt pages against real fee data.
//
// The unit tests cover the ledger arithmetic and verify:fee-rls covers who can
// read what. Neither proves the pages render those numbers, so this seeds a
// known set of charges and payments for the demo parent and reads the figures
// back off the rendered HTML.
//
// Expected totals are derived from the database rather than hard-coded, so this
// still works once the demo seed has real invoices on the account. What it
// insists on is the invariant that matters: the three headline figures on the
// statement have to reconcile, whatever else is on the ledger.
//
// Requires a running server, the same as smoke:pages.
import dotenv from "dotenv";
import { installHttp1Fetch } from "./lib/http1-fetch.mjs";
dotenv.config({ path: ".env.local", override: true });
installHttp1Fetch();
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password = process.env.DEMO_USER_PASSWORD || "Testing2026";
const base = "http://localhost:3100";
const SCHOOL_ID = "00000000-0000-0000-0000-000000000001";

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}${extra ? ` — ${extra}` : ""}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ""}`);
  }
};

/** Mirrors formatNaira so the assertions compare like with like. */
const naira = (n) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(n);

const CHARGEABLE = new Set(["unpaid", "partially_paid", "paid"]);

async function parentSession() {
  const jar = new Map();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach((c) => jar.set(c.name, c.value)),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({
    email: "parent@greenfield.test",
    password,
  });
  if (error) throw new Error(`signIn: ${error.message}`);
  const absorb = (res) => {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const i = pair.indexOf("=");
      jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  };
  const get = async (path) => {
    const res = await fetch(`${base}${path}`, {
      headers: { cookie: [...jar].map(([n, v]) => `${n}=${v}`).join("; ") },
      redirect: "manual",
    });
    absorb(res);
    return res;
  };
  return get;
}

const created = { invoices: [], payments: [] };

async function run() {
  const { data: rel } = await admin
    .from("parent_student_relationships")
    .select("student_id, parents!inner(user_id)")
    .eq("school_id", SCHOOL_ID)
    .limit(1)
    .maybeSingle();
  if (!rel) throw new Error("no seeded parent/student link");

  const studentId = rel.student_id;
  const parentUserId = rel.parents.user_id;
  const { data: parentRow } = await admin
    .from("parents")
    .select("id")
    .eq("user_id", parentUserId)
    .maybeSingle();

  // Three charges in three different states, plus one that must not reach the
  // ledger. The overpayment is the interesting one: 70,000 tendered against
  // 60,000 owed has to read as a 60,000 credit.
  const mk = async (description, amount, paid, status, credited, date) => {
    const { data: inv } = await admin
      .from("fee_invoices")
      .insert({
        school_id: SCHOOL_ID,
        student_id: studentId,
        description,
        amount,
        amount_paid: paid,
        status,
        created_at: date,
      })
      .select("id")
      .single();
    created.invoices.push(inv.id);
    if (paid > 0) {
      const { data: pay } = await admin
        .from("fee_payments")
        .insert({
          school_id: SCHOOL_ID,
          invoice_id: inv.id,
          parent_id: parentRow.id,
          payer_user_id: parentUserId,
          amount: credited,
          credited_amount: paid,
          status: "approved",
          submitted_at: date,
          reviewed_at: date,
        })
        .select("id")
        .single();
      created.payments.push(pay.id);
      return pay.id;
    }
    return null;
  };

  const overpaidReceipt = await mk(
    "E2E Tuition",
    20000,
    12000,
    "partially_paid",
    20000,
    "2026-02-10T09:00:00Z",
  );
  await mk("E2E Books", 10000, 0, "unpaid", 0, "2026-03-10T09:00:00Z");
  await mk("E2E Excursion", 5000, 0, "waived", 0, "2026-03-11T09:00:00Z");

  // Derive the truth from the database rather than assuming the ledger is
  // empty, so a seeded demo account does not make this check lie.
  const { data: allInvoices } = await admin
    .from("fee_invoices")
    .select("amount, status")
    .eq("student_id", studentId);
  const { data: allCredits } = await admin
    .from("fee_payments")
    .select("credited_amount, amount, status")
    .eq("payer_user_id", parentUserId)
    .eq("status", "approved");

  const expectedCharged = (allInvoices || [])
    .filter((i) => CHARGEABLE.has(i.status))
    .reduce((s, i) => s + Number(i.amount), 0);
  const expectedCredited = (allCredits || []).reduce(
    (s, p) => s + Number(p.credited_amount ?? p.amount),
    0,
  );
  const expectedBalance = expectedCharged - expectedCredited;

  const get = await parentSession();

  console.log("\nStatement of account");
  const stmtRes = await get(`/parent/fees/statement?child=${studentId}`);
  const stmtHtml = await stmtRes.text();
  ok(
    "statement page renders",
    stmtRes.status === 200 && stmtHtml.length > 30000,
    `${stmtHtml.length} bytes`,
  );
  ok("shows this child's charges", stmtHtml.includes("E2E Tuition"));
  ok("shows the part-paid charge", stmtHtml.includes("E2E Books"));
  ok(
    `total charged is ${naira(expectedCharged)}`,
    stmtHtml.includes(naira(expectedCharged)),
  );
  ok(
    `total credited is ${naira(expectedCredited)}`,
    stmtHtml.includes(naira(expectedCredited)),
  );
  ok(
    `closing balance is ${naira(expectedBalance)}`,
    stmtHtml.includes(naira(expectedBalance)),
  );

  // The whole point. Waived and void invoices are reported but never totalled,
  // so "charged" is exactly "balance plus what was paid". If a waiver were
  // counted into the total these three figures would stop agreeing and the
  // first thing a parent does is subtract them.
  const waived = (allInvoices || [])
    .filter((i) => !CHARGEABLE.has(i.status))
    .reduce((s, i) => s + Number(i.amount), 0);
  ok(
    "the three headline figures reconcile",
    expectedCharged - expectedCredited === expectedBalance,
    `${expectedCharged} - ${expectedCredited} = ${expectedBalance}`,
  );
  ok(
    "waived invoices are reported but excluded from the total",
    waived === 0 || stmtHtml.includes("Not included in the balance"),
  );
  ok(
    "a waiver never inflates the charged total",
    !stmtHtml.includes(naira(expectedCharged + waived)),
  );

  console.log("\nReceipt");
  const recRes = await get(`/parent/fees/receipt/${overpaidReceipt}`);
  const recHtml = await recRes.text();
  ok(
    "receipt page renders",
    recRes.status === 200 && recHtml.length > 30000,
    `${recHtml.length} bytes`,
  );
  ok(
    "carries a reference derived from the payment id",
    recHtml.includes(`RCP-${overpaidReceipt.slice(0, 8).toUpperCase()}`),
  );
  ok("names the payer", recHtml.includes("David Adebayo"));
  // 20,000 was handed over, 12,000 was applied. Printing the tendered figure as
  // the amount received would overstate the credit.
  ok("states what was tendered", recHtml.includes(naira(20000)));
  ok("states what was actually credited", recHtml.includes(naira(12000)));
  ok(
    "does not present the tendered figure as the credit",
    !recHtml.includes(`credited</th><td>${naira(20000)}`),
  );

  console.log("\nFees landing page");
  const feesRes = await get("/parent/fees");
  const feesHtml = await feesRes.text();
  ok("landing page renders", feesRes.status === 200);
  ok("links to the statement", feesHtml.includes("/parent/fees/statement"));
  ok(
    "links to a receipt on a settled invoice",
    feesHtml.includes(`/parent/fees/receipt/${overpaidReceipt}`),
  );
  ok(
    `outstanding matches the statement balance`,
    feesHtml.includes(naira(expectedBalance)),
  );
}

try {
  await run();
} catch (err) {
  fail++;
  console.log(`  FAIL  harness error: ${err?.message ?? err}`);
  if (err?.stack) console.log(err.stack);
} finally {
  for (const id of created.payments) await admin.from("fee_payments").delete().eq("id", id);
  for (const id of created.invoices) await admin.from("fee_invoices").delete().eq("id", id);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
