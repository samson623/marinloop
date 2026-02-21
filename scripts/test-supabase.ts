import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

// Manually parse .env
const envPath = path.resolve(rootDir, '.env')
const env: Record<string, string> = {}
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8')
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/)
        if (match) {
            env[match[1].trim()] = match[2].trim()
        }
    })
}

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
    process.exit(1)
}

// Check if auth-js is loadable
try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    console.log('Supabase client created successfully.')

    console.log('Testing connection...')
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true })

    if (error) {
        console.error('Supabase connection failed:', error.message)
    } else {
        console.log('Supabase connection successful. Data:', data)
    }

} catch (e) {
    console.error('Failed to create client or connect:', e)
}
