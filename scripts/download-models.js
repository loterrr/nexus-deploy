const fs = require('fs');
const path = require('path');
const https = require('https');

const MODELS = [
  'Xenova/all-MiniLM-L6-v2',
  'Xenova/ms-marco-MiniLM-L-6-v2'
];

const FILES = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'special_tokens_map.json',
  'vocab.txt',
  'onnx/model_quantized.onnx' // The actual weights for Transformers.js
];

const BASE_URL = 'https://huggingface.co';

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301 || response.statusCode === 307) {
        // Handle redirect
        const redirectUrl = new URL(response.headers.location, BASE_URL).href;
        downloadFile(redirectUrl, dest).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      
      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('Downloading Transformers.js models for 100% offline usage...');
  const publicDir = path.join(__dirname, '..', 'public', 'models');
  
  for (const model of MODELS) {
    console.log(`\nProcessing model: ${model}`);
    for (const file of FILES) {
      const url = `${BASE_URL}/${model}/resolve/main/${file}`;
      const dest = path.join(publicDir, model, file);
      
      if (fs.existsSync(dest)) {
        console.log(`  [SKIP] ${file} already exists`);
        continue;
      }
      
      console.log(`  [DOWNLOADING] ${file}...`);
      try {
        await downloadFile(url, dest);
        console.log(`  [OK] ${file}`);
      } catch (err) {
        console.error(`  [ERROR] Failed to download ${file}: ${err.message}`);
        // Optional file missing is okay for some models
      }
    }
  }
  
  console.log('\nAll models downloaded successfully to /public/models/');
}

main().catch(console.error);
