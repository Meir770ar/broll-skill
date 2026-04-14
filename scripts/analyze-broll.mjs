// Usage: node analyze-broll.mjs <transcript.json> <broll-output-dir>
// Output: JSON to stdout with { segments: [{ start, end, query, localPath, isImage }] }
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import crypto from 'crypto';

const transcriptPath = process.argv[2];
const brollDir = process.argv[3];
if (!transcriptPath || !brollDir) {
  console.error('Usage: node analyze-broll.mjs <transcript.json> <broll-dir>');
  process.exit(1);
}

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const PEXELS_KEY = process.env.PEXELS_API_KEY;
const RUNWARE_KEY = process.env.RUNWARE_API_KEY;
if (!GEMINI_KEY) { console.error('ERROR: GEMINI_API_KEY not set'); process.exit(1); }

mkdirSync(brollDir, { recursive: true });

const transcript = JSON.parse(readFileSync(transcriptPath, 'utf-8'));

// Step 1: Ask Gemini to create an intelligent B-roll plan
const geminiResp = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `You are a professional video editor. Analyze this transcript and create a B-roll plan.

For each B-roll moment, decide:
- "type": "ai" if the topic is abstract/specific (AI generates exactly what's needed), "stock" if the topic is concrete/visual (real footage looks better)
- "style": choose based on mood: "cinematic" for dramatic, "realistic" for professional, "illustration" for educational
- "prompt": detailed English image description for AI generation (be VERY specific and visual, 20-40 words)
- "query": 3-4 word English search for Pexels stock video (concrete, visual)
- "transition": "fade" for calm moments, "slide" for energetic, "wipe" for topic changes
- "highlight_words": array of word indices from the transcript that should be highlighted in captions during this B-roll

Rules:
- B-roll every 10-15 seconds
- Each clip 4-6 seconds
- Be LITERAL — match EXACTLY what the speaker is saying
- Also determine the overall "mood" of the transcript: one of "calm", "energetic", "corporate", "emotional", or "tech"
- Return JSON OBJECT (not array), no markdown, no explanation

Transcript: "${transcript.text}"

Word timestamps: ${JSON.stringify(transcript.words?.slice(0, 200))}

Return format:
{"mood": "tech", "segments": [{"start": 8.5, "end": 13.0, "type": "ai", "style": "cinematic", "prompt": "detailed visual description", "query": "pexels search terms", "transition": "fade", "highlight_words": [5,6,7]}, ...]}`
        }]
      }],
      generationConfig: { temperature: 0.2 }
    }),
  }
);

const geminiData = await geminiResp.json();
let brollText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
brollText = brollText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
let brollPlan;
try {
  const parsed = JSON.parse(brollText);
  if (Array.isArray(parsed)) {
    brollPlan = parsed;
  } else if (parsed.segments) {
    brollPlan = parsed.segments;
    brollPlan._mood = parsed.mood;
  } else {
    brollPlan = [parsed];
  }
} catch (e) {
  console.error('Gemini returned invalid JSON, falling back to auto-split');
  const duration = transcript.words?.length > 0
    ? transcript.words[transcript.words.length - 1].end
    : 60;
  brollPlan = [];
  for (let t = 8; t < duration - 6; t += 12) {
    brollPlan.push({ start: t, end: t + 5, type: 'stock', style: 'cinematic', prompt: 'beautiful landscape scenery', query: 'technology innovation', transition: 'fade', highlight_words: [] });
  }
}

console.error(`[analyze-broll] Gemini plan: ${brollPlan.length} segments`);

// Helper: Generate image via Runware API
async function generateRunwareImage(prompt, outputPath) {
  if (!RUNWARE_KEY) return false;
  try {
    const resp = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNWARE_KEY}`
      },
      body: JSON.stringify([{
        taskType: "imageInference",
        taskUUID: crypto.randomUUID(),
        model: "bfl:5@1",
        positivePrompt: prompt,
        negativePrompt: "blurry, low quality, text, watermark, ugly, deformed",
        width: 1280,
        height: 720,
        numberResults: 1,
        outputType: "URL",
        outputFormat: "jpg"
      }])
    });
    const data = await resp.json();
    const imageUrl = data.data?.[0]?.imageURL || data[0]?.imageURL;
    if (!imageUrl) {
      console.error(`[analyze-broll] Runware: no imageURL in response: ${JSON.stringify(data).slice(0, 200)}`);
      return false;
    }
    execSync(`curl -sL "${imageUrl}" -o "${outputPath}"`, { timeout: 30000 });
    return existsSync(outputPath);
  } catch (e) {
    console.error(`[analyze-broll] Runware failed: ${e.message}`);
    return false;
  }
}

// Helper: Search Pexels for stock video
async function searchPexelsVideo(query, outputPath) {
  if (!PEXELS_KEY) return false;
  try {
    const searchResp = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape&size=medium`,
      { headers: { 'Authorization': PEXELS_KEY } }
    );
    const searchData = await searchResp.json();
    const videos = searchData.videos || [];
    if (videos.length === 0) return false;

    const video = videos[Math.floor(Math.random() * Math.min(3, videos.length))];
    const file = video.video_files
      .filter(f => f.width >= 720 && f.width <= 1920)
      .sort((a, b) => b.width - a.width)[0]
      || video.video_files[0];

    if (!file) return false;
    execSync(`curl -sL "${file.link}" -o "${outputPath}"`, { timeout: 30000 });
    return existsSync(outputPath);
  } catch (e) {
    console.error(`[analyze-broll] Pexels failed for "${query}": ${e.message}`);
    return false;
  }
}

// Step 2: For each segment, get media based on type
const segments = [];
for (let i = 0; i < brollPlan.length; i++) {
  const plan = brollPlan[i];
  const segType = plan.type || 'stock';
  let localPath = null;
  let isImage = false;

  if (segType === 'ai') {
    // Try Runware AI image first
    const imgPath = `${brollDir}/broll_${i}.jpg`;
    const success = await generateRunwareImage(plan.prompt || plan.query, imgPath);
    if (success) {
      localPath = imgPath;
      isImage = true;
      console.error(`[analyze-broll] Segment ${i}: AI image generated`);
    } else {
      // Fallback to Pexels stock video
      const vidPath = `${brollDir}/broll_${i}.mp4`;
      const pexelsOk = await searchPexelsVideo(plan.query, vidPath);
      if (pexelsOk) {
        localPath = vidPath;
        isImage = false;
        console.error(`[analyze-broll] Segment ${i}: AI failed, Pexels fallback`);
      }
    }
  } else {
    // Stock: try Pexels first
    const vidPath = `${brollDir}/broll_${i}.mp4`;
    const pexelsOk = await searchPexelsVideo(plan.query, vidPath);
    if (pexelsOk) {
      localPath = vidPath;
      isImage = false;
      console.error(`[analyze-broll] Segment ${i}: Pexels stock video`);
    } else if (RUNWARE_KEY) {
      // Fallback to Runware AI image
      const imgPath = `${brollDir}/broll_${i}.jpg`;
      const success = await generateRunwareImage(plan.prompt || plan.query, imgPath);
      if (success) {
        localPath = imgPath;
        isImage = true;
        console.error(`[analyze-broll] Segment ${i}: Pexels failed, AI fallback`);
      }
    }
  }

  if (localPath) {
    segments.push({
      start: plan.start,
      end: plan.end,
      query: plan.query,
      localPath,
      isImage,
      transition: plan.transition || 'fade',
      highlight_words: plan.highlight_words || [],
    });
  } else {
    console.error(`[analyze-broll] Segment ${i}: SKIPPED (no media)`);
  }
}

const mood = brollPlan._mood || 'calm';
console.log(JSON.stringify({ segments, mood }, null, 2));
