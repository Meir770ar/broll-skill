// Usage: node transcribe.mjs <audio-file>
// Output: JSON to stdout with { text, words: [{ word, start, end }] }
// Powered by ElevenLabs Scribe v2 — high-accuracy Hebrew transcription
import { readFileSync } from 'fs';
import { basename } from 'path';

const audioPath = process.argv[2];
if (!audioPath) { console.error('Usage: node transcribe.mjs <audio-file>'); process.exit(1); }

const KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API;
if (!KEY) { console.error('ERROR: ELEVENLABS_API_KEY not set'); process.exit(1); }

const audioBuffer = readFileSync(audioPath);
const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });

const form = new FormData();
form.append('file', blob, basename(audioPath));
form.append('model_id', 'scribe_v2');
form.append('language_code', 'heb');
form.append('timestamps_granularity', 'word');
form.append('tag_audio_events', 'false');

const resp = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
  method: 'POST',
  headers: { 'xi-api-key': KEY },
  body: form,
});

if (!resp.ok) {
  console.error(`ElevenLabs Scribe error ${resp.status}: ${await resp.text()}`);
  process.exit(1);
}

const data = await resp.json();

// Scribe returns {text, words:[{text, start, end, type}]}
// Map to {text, words:[{word, start, end}]} to match existing pipeline contract
const words = (data.words || [])
  .filter(w => w.type === 'word' && w.text && w.start != null && w.end != null)
  .map(w => ({ word: w.text, start: w.start, end: w.end }));

const result = { text: data.text || '', words };
console.log(JSON.stringify(result, null, 2));
