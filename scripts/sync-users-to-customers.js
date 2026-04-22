const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email, username, first_name, last_name");
  if (usersError) {
    throw usersError;
  }

  if (!users || users.length === 0) {
    console.info("No users to sync.");
    return;
  }

  const payloads = users.map((user) => ({
    id: user.id,
    email: user.email,
    username: user.username,
    name: [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.username,
    full_name: [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || null,
  }));

  const { error: upsertError, data: upserted } = await supabase
    .from("customers")
    .upsert(payloads, { onConflict: "id" })
    .select("id");

  if (upsertError) {
    throw upsertError;
  }

  console.info(`Synced ${upserted?.length ?? 0} customer rows from users table.`);
}

main().catch((error) => {
  console.error("Sync failed:", error.message ?? error);
  process.exit(1);
});
