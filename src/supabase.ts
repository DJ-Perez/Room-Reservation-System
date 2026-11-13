import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://qhysdzsgkzxpfpyqknqn.supabase.co'
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_wt5elWDQzBbc7aaervXZ0A_SGPoUGGk'

export const supabase = createClient(supabaseUrl, supabaseKey)