import dotenv from "dotenv";
import { installHttp1Fetch } from "./lib/http1-fetch.mjs";
dotenv.config({ path: ".env.local" });
installHttp1Fetch();
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const NEW_PASSWORD = "Testing2026";

const emails = [
  "admin@greenfield.test",
  "teacher@greenfield.test",
  "student@greenfield.test",
  "parent@greenfield.test",
];

const {
  data: { users },
} = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

let changed = 0;
for (const email of emails) {
  const user = users.find((u) => u.email === email);
  if (!user) {
    console.log(`NOT FOUND: ${email}`);
    continue;
  }
  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    password: NEW_PASSWORD,
  });
  if (error) {
    console.log(`FAILED: ${email} :: ${error.message}`);
  } else {
    changed += 1;
    console.log(`UPDATED: ${email}`);
  }
}

console.log(`${changed}/${emails.length} passwords updated to "${NEW_PASSWORD}"`);