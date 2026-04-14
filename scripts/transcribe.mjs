// Usage: node transcribe.mjs <audio-file>
// Output: JSON to stdout with { text, words: [{ word, start, end }] }
// Provider is chosen via TRANSCRIBE_PROVIDER env var (set by pipeline.sh from config.json).
// Options: "groq" (free, Whisper Large v3) or "elevenlabs" (paid, Scribe v2 — higher accuracy on Hebrew).
import { readFileSync } from 'fs';
import { basename } from 'path';

const audioPath = process.argv[2];
if (!audioPath) { console.error('Usage: node transcribe.mjs <audio-file>'); process.exit(1); }

const PROVIDER = (process.env.TRANSCRIBE_PROVIDER || 'groq').toLowerCase();

async function transcribeGroq(audioBuffer) {
  const KEY = process.env.GROQ_API_KEY;
  if (!KEY) { console.error('ERROR: GROQ_API_KEY not set (required for provider=groq)'); process.exit(1); }
  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  const form = new FormData();
  form.append('file', blob, basename(audioPath));
  form.append('model', 'whisper-large-v3');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('language', 'he');
  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { 'Authorization': `Bearer ${KEY}` }, body: form,
  });
  if (!r.ok) { console.error(`Groq ${r.status}: ${await r.text()}`); process.exit(1); }
  const d = await r.json();
  return {
    text: d.text || '',
    words: (d.words || []).map(w => ({ word: w.word, start: w.start, end: w.end })),
  };
}

async function transcribeElevenLabs(audioBuffer) {
  const KEY = process.env.ELEVENLABS_API_KEY;
  if (!KEY) { console.error('ERROR: ELEVENLABS_API_KEY not set (required for provider=elevenlabs)'); process.exit(1); }
  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  const form = new FormData();
  form.append('file', blob, basename(audioPath));
  form.append('model_id', 'scribe_v2');
  form.append('language_code', 'heb');
  form.append('timestamps_granularity', 'word');
  form.append('tag_audio_events', 'false');
  const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST', headers: { 'xi-api-key': KEY }, body: form,
  });
  if (!r.ok) { console.error(`Scribe ${r.status}: ${await r.text()}`); process.exit(1); }
  const d = await r.json();
  const words = (d.words || [])
    .filter(w => w.type === 'word' && w.text && w.start != null && w.end != null)
    .map(w => ({ word: w.text, start: w.start, end: w.end }));
  return { text: d.text || '', words };
}

const audioBuffer = readFileSync(audioPath);
const result = PROVIDER === 'elevenlabs'
  ? await transcribeElevenLabs(audioBuffer)
  : await transcribeGroq(audioBuffer);
console.error(`[transcribe] provider=${PROVIDER} words=${result.words.length}`);
console.log(JSON.stringify(result, null, 2));
