import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nuvxndlhfnrtpufsnviz.supabase.co'
const supabaseAnonKey = 'sb_publishable_Gh_zFuXXr0Xru4SsATc4sA_VBMVUXJJ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
