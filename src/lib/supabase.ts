// Re-export local database adapter as "supabase" for backward compatibility
// All components import { supabase } from './supabase' — this now points to local lowdb
export { db as supabase, genId } from './db';
