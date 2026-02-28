import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jypmfvwunawgxngqjgkb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5cG1mdnd1bmF3Z3huZ3FqZ2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NTY0MjQsImV4cCI6MjA4NzUzMjQyNH0.wT_8n7A3jwMSd3mqTyHE4Ubv95hAvnkupLG68r3zYhs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

export default supabase;
