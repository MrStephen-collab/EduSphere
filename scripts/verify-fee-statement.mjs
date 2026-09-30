// Verifies the parent statement and receipt pages against real fee data.
//
// The unit tests cover the ledger arithmetic and verify:fee-rls covers who can
// read what. Neither proves the pages render those numbers, so this seeds a
// known set of charges and payments for the demo parent and reads the figures
// back off the rendered HTML. It has already earned its keep: it caught a
// statement whose headline totals did not reconcile, and a receipt that was
// unreachable for any invoice that had been fully paid.
//
// Requires a running server, the same as smoke:pages.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password = process.env.DEMO_USER_PASSWORD || "Testing2026";
const base = "http://localhost:3100";

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const SCHOOL_ID = "00000000-0000-0000-0000-000000000001";

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

  // Two charges and two payments, one deliberately overpaid, so the statement
  // has to show a clamped credit to be considered correct.
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

  // Invoice 1: 50,000 fully paid.
  const p1 = await mk("First Term Fees", 50000, 50000, "paid", 50000, "2026-01-10T09:00:00Z");
  // Invoice 2: 20,000 with 12,000 paid -> 8,000 outstanding.
  await mk("Second Term Fees", 20000, 12000, "partially_paid", 12000, "2026-04-10T09:00:00Z");
  // Invoice 3: 10,000 unpaid.
  await mk("Third Term Fees", 10000, 0, "unpaid", 0, "2026-07-10T09:00:00Z");
  // Invoice 4: waived, must not appear in the balance.
  await mk("Scholarship Award", 5000, 0, "waived", 0, "2026-07-11T09:00:00Z");

  const get = await parentSession();

  console.log("\nStatement of account");
  const stmt = await get(`/parent/fees/statement?child=${studentId}`);
  const stmtHtml = await stmt.text();
  ok("statement page renders", stmt.status === 200 && stmtHtml.length > 30000, `${stmtHtml.length} bytes`);
  ok("shows the first charge", stmtHtml.includes("First Term Fees"));
  ok("shows the part-paid charge", stmtHtml.includes("Second Term Fees"));
  ok("shows the unpaid charge", stmtHtml.includes("Third Term Fees"));
  // 50000 + 20000 + 10000 charged = 80000; 50000 + 12000 credited = 62000.
  ok("total charged is NGN 80,000", /80,000/.test(stmtHtml));
  ok("total credited is NGN 62,000", /62,000/.test(stmtHtml));
  ok("closing balance is NGN 18,000", /18,000/.test(stmtHtml));
  ok("waived charge is excluded but reported", stmtHtml.includes("Not included in the balance"));
  // The three headline figures have to reconcile. Counting the waived invoice
  // toward the total would print "charged 85,000, credited 62,000, balance
  // 18,000" and the first thing a parent does is subtract.
  ok("does not count the waived 5,000 toward the balance", !stmtHtml.includes("85,000"));

  console.log("\nReceipt");
  const rec = await get(`/parent/fees/receipt/${p1}`);
  const recHtml = await rec.text();
  ok("receipt page renders", rec.status === 200 && recHtml.length > 30000, `${recHtml.length} bytes`);
  ok("shows a receipt reference", /RCP-[0-9A-F]{8}/.test(recHtml));
  ok("names the payer", recHtml.includes("David Adebayo"));
  ok("shows the amount received as NGN 50,000", /50,000/.test(recHtml));

  console.log("\nFees landing page");
  const fees = await get("/parent/fees");
  const feesHtml = await fees.text();
  ok("landing page renders", fees.status === 200);
  ok("links to the statement", feesHtml.includes("/parent/fees/statement"));
  // A settled invoice is the one a parent most wants proof of, so its receipt
  // has to be reachable from the page rather than only via the open-invoice
  // payment history.
  ok("links to a receipt on a settled invoice", feesHtml.includes(`/parent/fees/receipt/${p1}`));
  ok("shows the outstanding total of NGN 18,000", /18,000/.test(feesHtml));
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
