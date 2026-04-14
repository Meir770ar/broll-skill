// Universal WhatsApp sender
// Usage: node send-whatsapp.mjs --sender <green-api|openclaw> --file <path> --phone <digits> [--caption "text"]
import { existsSync } from 'fs';
import { execSync } from 'child_process';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
}

const { sender, file, phone, caption = '' } = args;
if (!sender || !file || !phone) {
  console.error('Usage: --sender <green-api|openclaw> --file <path> --phone <digits> [--caption "..."]');
  process.exit(1);
}
if (!existsSync(file)) { console.error('File not found:', file); process.exit(1); }

async function sendGreenApi() {
  const { GREEN_API_URL, GREEN_API_INSTANCE, GREEN_API_TOKEN } = process.env;
  if (!GREEN_API_URL || !GREEN_API_INSTANCE || !GREEN_API_TOKEN) {
    console.error('Missing Green API env vars'); process.exit(1);
  }
  // Dynamic import — user needs to `npm install axios form-data`
  const axios = (await import('axios')).default;
  const FormData = (await import('form-data')).default;
  const fs = await import('fs');
  const path = await import('path');

  const chatId = phone.replace(/^\+/, '').replace(/\D/g, '') + '@c.us';
  const url = `${GREEN_API_URL}/waInstance${GREEN_API_INSTANCE}/sendFileByUpload/${GREEN_API_TOKEN}`;
  const form = new FormData();
  form.append('chatId', chatId);
  form.append('file', fs.createReadStream(file), path.basename(file));
  if (caption) form.append('caption', caption);

  const res = await axios.post(url, form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  console.log('✅ Sent (Green API). ID:', res.data.idMessage);
}

function sendOpenClaw() {
  // Requires `openclaw` binary in PATH
  const target = phone.startsWith('+') ? phone : '+' + phone.replace(/\D/g, '');
  const cmd = `openclaw message send --target "${target}" --channel whatsapp --media "${file}" --message "${caption.replace(/"/g, '\\"')}"`;
  console.error('[openclaw]', cmd);
  execSync(cmd, { stdio: 'inherit' });
  console.log('✅ Sent (OpenClaw)');
}

switch (sender) {
  case 'green-api':
    await sendGreenApi(); break;
  case 'openclaw':
    sendOpenClaw(); break;
  default:
    console.error('Unknown sender:', sender); process.exit(1);
}
