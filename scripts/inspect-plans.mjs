import dotenv from "dotenv";
import { installHttp1Fetch } from "./lib/http1-fetch.mjs";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
installHttp1Fetch();
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: plans } = await supabase.from("subscription_plans").select("*");
console.log(JSON.stringify(plans, null, 1));

const { data: feePayments } = await supabase
  .from("fee_payments")
  .select("id,school_id,invoice_id,amount,status,provider_reference");
console.log("FEE_PAYMENTS", JSON.stringify(feePayments, null, 1));

const { data: liveAttendance } = await supabase
  .from("live_attendance_records")
  .select("id,school_id,live_session_id,student_id,status");
console.log("LIVE_ATTENDANCE", JSON.stringify(liveAttendance, null, 1));
