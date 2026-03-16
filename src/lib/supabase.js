import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://rzzzmziuamvkqqlinzha.supabase.co"
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_QESkvCPkmAPB-PM8ynyrqQ_vzvodKC5"

export const supabase = createClient(supabaseUrl, supabaseKey)