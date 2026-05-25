#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const wranglerPath = path.resolve('wrangler.toml');

async function main() {
  // 1️⃣ read wrangler.toml
  let content = await readFile(wranglerPath, 'utf8');

  // 2️⃣ ensure main field exists
  if (!content.includes('main = "./dist/_worker.js"')) {
    content = `${content.trimEnd()}\nmain = "./dist/_worker.js"\n`;
    await writeFile(wranglerPath, content, 'utf8');
    console.log('✅ main field added to wrangler.toml');
  }

  // 3️⃣ run preview deploy
  console.log('🚀 Starting Cloudflare preview deploy...');
  execSync('wrangler versions upload', { stdio: 'inherit' });
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
