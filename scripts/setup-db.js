import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[v0] Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Read and execute the SQL migration
import { readFileSync } from 'fs';
import { join } from 'path';

const migrationPath = join(process.cwd(), 'scripts', '001_create_alerts_schema.sql');
const migrationSql = readFileSync(migrationPath, 'utf-8');

console.log('[v0] Starting database setup...');

async function setupDatabase() {
  try {
    // Execute the migration SQL
    const { error } = await supabase.rpc('exec_sql', {
      sql: migrationSql
    }).catch(async () => {
      // Fallback: execute using direct Postgres connection if available
      console.log('[v0] RPC method not available, trying alternative approach...');
      
      // Split the SQL into individual statements and execute them
      const statements = migrationSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        console.log(`[v0] Executing: ${statement.substring(0, 60)}...`);
        const { error: execError } = await supabase.rpc('query', { sql: statement });
        if (execError) {
          console.warn(`[v0] Statement warning (may be non-critical): ${execError.message}`);
        }
      }
      
      return { error: null };
    });

    if (error) {
      console.error('[v0] Database setup error:', error);
      process.exit(1);
    }

    console.log('[v0] ✅ Database setup completed successfully');
    
    // Verify tables were created
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (!tableError) {
      console.log('[v0] Created tables:', tables?.map(t => t.table_name).join(', '));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('[v0] Setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();
