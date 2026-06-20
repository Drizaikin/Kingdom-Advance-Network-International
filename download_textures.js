const fs = require('fs');
const path = require('path');

const urls = [
  'https://www.solarsystemscope.com/textures/download/2k_sun.jpg',
  'https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg',
  'https://www.solarsystemscope.com/textures/download/2k_saturn.jpg',
  'https://www.solarsystemscope.com/textures/download/2k_saturn_ring_alpha.png',
  'https://www.solarsystemscope.com/textures/download/2k_mars.jpg',
  'https://www.solarsystemscope.com/textures/download/2k_mercury.jpg',
  'https://www.solarsystemscope.com/textures/download/2k_venus_atmosphere.jpg',
  'https://www.solarsystemscope.com/textures/download/2k_uranus.jpg',
  'https://www.solarsystemscope.com/textures/download/2k_neptune.jpg'
];

async function downloadTextures() {
  const dir = path.join(__dirname, 'public', 'assets', 'textures');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  for (const url of urls) {
    const filename = url.split('/').pop();
    const filepath = path.join(dir, filename);
    console.log(`Downloading ${filename}...`);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filepath, buffer);
      console.log(`Saved ${filename}`);
    } catch (err) {
      console.error(`Failed to download ${filename}:`, err.message);
    }
  }
}

downloadTextures();
