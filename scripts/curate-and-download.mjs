#!/usr/bin/env node
/**
 * Phase 3: Curate top tracks per B-roll mood and download to local staging dir.
 * Phase 4 (separate step): SCP the staging dir to VPS.
 */
import { readFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const CATALOG = process.argv[2] || 'C:/Users/pc/broll-skill/music-catalog.json';
const OUT_DIR = process.argv[3] || 'C:/Users/pc/broll-skill/music-library';
const GWS = 'C:/Users/pc/AppData/Local/Programs/gws/gws.exe';

const TARGETS = {
  calm:       { count: 7, boost: ['ambient', 'acoustic', 'intimate'] },
  energetic:  { count: 7, boost: ['uplifting'] },
  corporate:  { count: 7, boost: ['uplifting', 'tech'] },
  emotional:  { count: 7, boost: ['cinematic', 'intimate', 'acoustic'] },
  tech:       { count: 6, boost: ['corporate'] },
  cinematic:  { count: 5, boost: ['epic', 'emotional'] },
  dark:       { count: 5, boost: ['cinematic'] },
  festive:    { count: 3, boost: ['energetic', 'uplifting'] },
  uplifting:  { count: 3, boost: ['corporate', 'energetic'] },
};

// --- Load catalog ---
const catalog = JSON.parse(readFileSync(CATALOG, 'utf-8'));
console.error(`[curate] loaded ${catalog.total_files} files`);

// --- Score each file for a target mood ---
function scoreFor(file, mood, cfg) {
  if (!file.moods.includes(mood)) return -1;
  let score = 1;
  score += file.moods.length * 0.5;                    // multi-mood = higher confidence
  cfg.boost.forEach(b => { if (file.moods.includes(b)) score += 0.7; });
  const mb = file.size_bytes / 1024 / 1024;
  if (mb < 0.5) score -= 2;                             // tiny files = loops, skip
  if (mb > 15) score -= 1.5;                            // too big = full albums, skip
  if (mb >= 2 && mb <= 10) score += 1;                  // sweet spot
  if (/\.(mp3)$/i.test(file.name)) score += 0.5;        // prefer MP3 over WAV
  if (file.folder_path.match(/audiojungle/i)) score += 0.3;
  return score;
}

// --- Pick top tracks per mood ---
mkdirSync(OUT_DIR, { recursive: true });
const picks = [];
for (const [mood, cfg] of Object.entries(TARGETS)) {
  const scored = catalog.files
    .map(f => ({ f, s: scoreFor(f, mood, cfg) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s);
  const chosen = scored.slice(0, cfg.count).map(x => x.f);
  chosen.forEach(f => picks.push({ mood, file: f }));
  console.error(`  ${mood}: ${chosen.length} picked (from ${scored.length} candidates)`);
}

console.error(`\n[curate] total picks: ${picks.length}\n`);

// --- Download via gws CLI ---
let ok = 0, fail = 0;
for (let i = 0; i < picks.length; i++) {
  const { mood, file } = picks[i];
  const moodDir = join(OUT_DIR, mood);
  mkdirSync(moodDir, { recursive: true });
  // Sanitize filename (keep ASCII-ish, .mp3/.wav)
  const ext = file.name.match(/\.(mp3|wav|m4a|aac|flac|ogg)$/i)?.[0] || '.mp3';
  const safeBase = file.name.replace(ext, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
  const outPath = join(moodDir, `${safeBase}${ext}`);
  if (existsSync(outPath) && statSync(outPath).size > 10000) {
    ok++;
    continue;
  }
  process.stdout.write(`[${i + 1}/${picks.length}] ${mood} → ${file.name.slice(0, 50)} ... `);
  try {
    const params = JSON.stringify({ fileId: file.drive_id, alt: 'media' }).replace(/"/g, '\\"');
    execSync(`"${GWS}" drive files get --params "${params}" --output "${outPath}"`, { stdio: ['ignore', 'pipe', 'pipe'] });
    const size = statSync(outPath).size;
    if (size < 10000) throw new Error(`too small (${size}B)`);
    console.log(`✓ ${(size / 1024 / 1024).toFixed(1)}MB`);
    ok++;
  } catch (e) {
    console.log(`✗ ${e.message?.slice(0, 80)}`);
    fail++;
  }
}

// --- Summary ---
console.error(`\n=== DONE: ${ok} downloaded, ${fail} failed ===`);
console.error(`output: ${OUT_DIR}`);

// Total size report
let totalMB = 0;
for (const mood of Object.keys(TARGETS)) {
  const d = join(OUT_DIR, mood);
  if (!existsSync(d)) continue;
  const files = execSync(`dir /B "${d}" 2>nul || ls "${d}"`, { shell: true, encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
  let moodMB = 0;
  files.forEach(n => {
    try { moodMB += statSync(join(d, n)).size / 1024 / 1024; } catch {}
  });
  totalMB += moodMB;
  console.error(`  ${mood}: ${files.length} files, ${moodMB.toFixed(1)}MB`);
}
console.error(`  TOTAL: ${totalMB.toFixed(1)}MB`);
