import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

async function run() {
    const { data, error } = await supabase
        .from('user_follows')
        .select(`
            *,
            follower:profiles!fk_follower_user(id, full_name, avatar_url, craft),
            following:profiles!fk_following_user(id, full_name, avatar_url, craft)
        `)
        .limit(1)

    console.log("Data:", data)
    console.log("Error:", error)
}
run()
