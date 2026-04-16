#!/usr/bin/env node
/**
 * Recursively scans a Google Drive folder of music, infers mood/genre/use_case from
 * folder + file names (no AI), outputs catalog.json.
 *
 * Usage: node catalog-music-library.mjs <ROOT_FOLDER_ID> <OUTPUT_PATH>
 *
 * Auth: uses gcloud application-default credentials OR a service account JSON in
 * GOOGLE_APPLICATION_CREDENTIALS env var.
 */
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const ROOT = process.argv[2] || '108UnhGQZybmiJmgfJdRy-bQRQcSyXvDX';
const OUT = process.argv[3] || './music-catalog.json';
const CONCURRENCY = 8;

// --- Drive API helper via gws CLI (uses Workspace auth, no scope hassle) ---
const GWS = process.env.GWS_BIN || 'C:/Users/pc/AppData/Local/Programs/gws/gws.exe';
function driveListSync(q, pageToken) {
  const params = { q, fields: 'files(id,name,mimeType,size,parents),nextPageToken', pageSize: 1000 };
  if (pageToken) params.pageToken = pageToken;
  const json = JSON.stringify(params).replace(/"/g, '\\"');
  const out = execSync(`"${GWS}" drive files list --params "${json}"`, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  return JSON.parse(out);
}
async function driveList(q, pageToken) {
  return driveListSync(q, pageToken);
}

async function listAll(folderId) {
  const items = [];
  let pageToken;
  do {
    const d = await driveList(`'${folderId}' in parents and trashed=false`, pageToken);
    items.push(...(d.files || []));
    pageToken = d.nextPageToken;
  } while (pageToken);
  return items;
}

// --- Mood inference from text (keyword scoring) ---
const MOOD_KEYWORDS = {
  epic:        ['epic', 'trailer', 'cinematic', 'dramatic', 'hollywood', 'movie', 'epicness', 'powerful', 'rise'],
  corporate:   ['corporate', 'business', 'motivational', 'inspirational', 'inspiring', 'success', 'professional', 'commercial', 'presentation'],
  emotional:   ['emotional', 'piano', 'sentimental', 'reflection', 'tender', 'love', 'romantic', 'memorial', 'nostalgic'],
  calm:        ['calm', 'ambient', 'meditation', 'relax', 'peaceful', 'soft', 'gentle', 'background', 'atmospheric', 'easy'],
  energetic:   ['upbeat', 'energetic', 'happy', 'fun', 'bright', 'positive', 'sport', 'rock', 'pop', 'dance', 'party', 'celebration'],
  tech:        ['tech', 'technology', 'electronic', 'future', 'futuristic', 'digital', 'glitch', 'modern', 'edm', 'spectrum'],
  dark:        ['dark', 'tension', 'suspense', 'mystery', 'horror', 'thriller', 'evil', 'destruction', 'sad'],
  cinematic:   ['cinematic', 'orchestral', 'classical', 'documentary', 'film', 'score'],
  festive:     ['festive', 'christmas', 'new-years', 'birthday', 'holiday', 'wedding'],
  acoustic:    ['acoustic', 'folk', 'guitar', 'flute', 'native', 'indie'],
  uplifting:   ['uplifting', 'beauty', 'beautiful', 'amazing', 'wonderful', 'sunshine', 'summer'],
  intimate:    ['romantic', 'love', 'tender', 'moonlight', 'reflection', 'quiet'],
};

const USE_CASE_KEYWORDS = {
  intro:       ['intro', 'opening', 'logo', 'opener', 'short'],
  outro:       ['outro', 'ending', 'closing', 'credits'],
  trailer:     ['trailer', 'cinematic', 'epic'],
  background:  ['ambient', 'background', 'underscore', 'easy', 'loop'],
  climax:      ['climax', 'rise', 'tension', 'epic', 'powerful', 'dramatic'],
  commercial:  ['corporate', 'commercial', 'product', 'advertisement', 'brand'],
};

function infer(text) {
  const t = text.toLowerCase().replace(/[-_]/g, ' ');
  const moods = [];
  for (const [mood, kws] of Object.entries(MOOD_KEYWORDS)) {
    if (kws.some(k => t.includes(k))) moods.push(mood);
  }
  const useCases = [];
  for (const [uc, kws] of Object.entries(USE_CASE_KEYWORDS)) {
    if (kws.some(k => t.includes(k))) useCases.push(uc);
  }
  return { moods, useCases };
}

// --- Main: BFS recursive scan with concurrency ---
async function scan(rootId) {
  const allFiles = [];
  let queue = [{ id: rootId, path: [] }];
  let processed = 0;

  while (queue.length) {
    const batch = queue.splice(0, CONCURRENCY);
    const results = await Promise.all(batch.map(async (f) => {
      try {
        const items = await listAll(f.id);
        return { folder: f, items };
      } catch (e) {
        console.error(`  err on ${f.path.join('/')}: ${e.message}`);
        return { folder: f, items: [] };
      }
    }));
    for (const { folder, items } of results) {
      processed++;
      for (const it of items) {
        if (it.mimeType === 'application/vnd.google-apps.folder') {
          queue.push({ id: it.id, path: [...folder.path, it.name] });
        } else if (/\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(it.name)) {
          const folderText = folder.path.join(' ');
          const inferred = infer(folderText + ' ' + it.name);
          allFiles.push({
            drive_id: it.id,
            name: it.name,
            folder_path: folder.path.join('/'),
            size_bytes: parseInt(it.size || 0, 10),
            moods: inferred.moods,
            use_cases: inferred.useCases,
          });
        }
      }
    }
    if (processed % 20 === 0 || queue.length === 0) {
      console.error(`[scan] processed ${processed} folders, ${allFiles.length} files, queue ${queue.length}`);
    }
  }
  return allFiles;
}

console.error(`[catalog] root: ${ROOT}`);
const files = await scan(ROOT);

// --- Aggregate stats ---
const moodCount = {};
files.forEach(f => f.moods.forEach(m => moodCount[m] = (moodCount[m] || 0) + 1));
const sortedMoods = Object.entries(moodCount).sort((a, b) => b[1] - a[1]);
const noMoods = files.filter(f => f.moods.length === 0).length;

writeFileSync(OUT, JSON.stringify({
  generated_at: new Date().toISOString(),
  root_folder_id: ROOT,
  total_files: files.length,
  files_without_mood: noMoods,
  mood_distribution: Object.fromEntries(sortedMoods),
  files,
}, null, 2));

console.error(`\n✓ ${files.length} files cataloged → ${OUT}`);
console.error(`  ${noMoods} without mood tag`);
console.error('  Top moods:');
sortedMoods.slice(0, 10).forEach(([m, c]) => console.error(`    ${m}: ${c}`));
