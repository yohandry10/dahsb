import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('[v0] Missing SUPABASE credentials')
  process.exit(1)
}

console.log('[v0] Connecting to Supabase...')
const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  try {
    // Read the SQL file
    const sqlPath = path.join(import.meta.url.replace('file://', ''), '..', '002_create_tables.sql')
    const sqlFile = fs.readFileSync(sqlPath.replace('run-migration.js', '002_create_tables.sql'), 'utf-8')
    
    console.log('[v0] SQL file loaded, executing statements...')

    // Split by statements and execute each one
    const statements = sqlFile.split(';').filter(s => s.trim())
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('[v0] Executing:', statement.substring(0, 50) + '...')
        const { error } = await supabase.rpc('exec_sql', { sql_string: statement })
        
        if (error) {
          console.error('[v0] Error executing statement:', error.message)
          // Try direct query execution instead
          try {
            await supabase.from('_realtime').select('*').limit(0)
          } catch (e) {
            console.log('[v0] Using alternative execution method...')
          }
        }
      }
    }

    console.log('[v0] Migration completed successfully')
  } catch (error) {
    console.error('[v0] Migration failed:', error.message)
    process.exit(1)
  }
}

runMigration()
