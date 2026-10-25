import dotenv from "dotenv";
import { installHttp1Fetch } from "./lib/http1-fetch.mjs";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
installHttp1Fetch();
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const tables = process.argv.slice(2);

for (const table of tables) {
  const { data, error } = await supabase.from(table).select("*").limit(1);
  if (error) {
    console.log(`${table}: ERROR ${error.message}`);
    continue;
  }
  const row = data?.[0];
  const columns = row ? Object.keys(row) : [];
  console.log(`${table}: ${columns.length ? columns.join(", ") : "(no rows - columns unknown)"}`);
}
