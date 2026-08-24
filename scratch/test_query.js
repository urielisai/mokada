import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  const search = 'Juan';
  console.log('Testing query with search:', search);
  let query = supabase.from('customer_summaries').select('*').order('created_at', { ascending: false });
  
  query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  
  const { data, error } = await query;
  if (error) {
    console.error('Query failed:', error);
  } else {
    console.log(`Found ${data.length} records`);
  }
}

testQuery();
