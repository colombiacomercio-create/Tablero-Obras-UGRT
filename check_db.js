import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env
import fs from 'fs';
const envText = fs.readFileSync('.env', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  if (line.includes('=')) {
    const parts = line.split('=');
    env[parts[0]] = parts[1].trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: frentes } = await supabase.from('frentes_obra').select('*').limit(1);
  const { data: alertas } = await supabase.from('alertas_obra').select('*').limit(1);
  console.log('frentes:', Object.keys(frentes[0]));
  console.log('alertas:', Object.keys(alertas[0]));
  console.log('frente sample:', frentes[0]);
  console.log('alerta sample:', alertas[0]);
}
check();
