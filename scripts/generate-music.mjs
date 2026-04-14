// Usage: node generate-music.mjs <broll-segments.json> <output-path>
// Reads mood from broll-segments.json, generates matching instrumental via Lyria 3 Pro
import { readFileSync, writeFileSync } from 'fs';

const segPath = process.argv[2];
const outPath = process.argv[3];
if (!segPath || !outPath) {
  console.error('Usage: node generate-music.mjs <broll-segments.json> <output-path>');
  process.exit(1);
}

const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) { console.error('ERROR: GEMINI_API_KEY not set'); process.exit(1); }

const MOOD_PROMPTS = {
  calm:      'soft ambient instrumental, gentle piano, slow tempo 70 BPM, contemplative, no vocals, warm pads, peaceful',
  energetic: 'upbeat instrumental, driving drums, 120 BPM, motivational energy, electronic bass, no vocals, cinematic',
  corporate: 'professional orchestral instrumental, uplifting, 95 BPM, modern strings, subtle piano, no vocals, clean',
  emotional: 'emotional cinematic instrumental, delicate piano, warm strings, 75 BPM, rising build, no vocals, intimate',
  tech:      'modern electronic instrumental, subtle synth pulses, minimal arpeggios, 100 BPM, no vocals, futuristic',
};

const seg = JSON.parse(readFileSync(segPath, 'utf-8'));
const mood = (seg.mood || 'calm').toLowerCase();
const prompt = MOOD_PROMPTS[mood] || MOOD_PROMPTS.calm;

console.error(`[lyria] mood=${mood} prompt="${prompt}"`);

const resp = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/lyria-3-pro-preview:generateContent?key=${GEMINI_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['AUDIO'] },
    }),
  }
);

if (!resp.ok) {
  console.error(`Lyria error ${resp.status}: ${await resp.text()}`);
  process.exit(1);
}

const data = await resp.json();
const audio = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
if (!audio) {
  console.error('[lyria] no audio returned:', JSON.stringify(data).slice(0, 400));
  process.exit(1);
}

writeFileSync(outPath, Buffer.from(audio.inlineData.data, 'base64'));
console.error(`[lyria] saved ${outPath}`);
console.log(outPath);
