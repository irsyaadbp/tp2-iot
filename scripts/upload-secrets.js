import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const source = await readFile(new URL('../.dev.vars',import.meta.url),'utf8');
const secrets = {};
for(const line of source.split('\n')) {
  const match=line.match(/^(INGEST_TOKEN|NEON_DATABASE_URL)\s*=\s*(.+)$/);
  if(match) secrets[match[1]]=match[2].trim().replace(/^['"]|['"]$/g,'');
}
if(!secrets.INGEST_TOKEN || secrets.INGEST_TOKEN.length < 32)throw new Error('INGEST_TOKEN belum valid');
const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','bulk'],{cwd:new URL('..',import.meta.url),stdio:['pipe','inherit','inherit']});
child.stdin.end(JSON.stringify(secrets));
child.on('exit',code=>process.exit(code??1));
