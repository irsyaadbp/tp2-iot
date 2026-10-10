import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
if (!process.env.NEON_DATABASE_URL) throw new Error('NEON_DATABASE_URL belum tersedia');
const sql = neon(process.env.NEON_DATABASE_URL);
const source = await readFile(new URL('../migrations/0001_readings.sql', import.meta.url),'utf8');
await sql.transaction(source.split(';').map(s => s.trim()).filter(Boolean).map(s => sql.query(s,[])));
console.log('Schema Neon berhasil dibuat');
