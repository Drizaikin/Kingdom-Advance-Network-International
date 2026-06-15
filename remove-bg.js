const Jimp = require('jimp');
const path = require('path');

async function removeBg() {
    try {
        const logoPath = path.join(__dirname, 'public', 'assets', 'images', 'logo.jpeg');
        const outputPath = path.join(__dirname, 'public', 'assets', 'images', 'logo-transparent.png');

        const image = await Jimp.read(logoPath);
        
        console.log(`Original dimensions: ${image.bitmap.width}x${image.bitmap.height}`);

        // Scan and make white/near-white pixels transparent
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
            const r = this.bitmap.data[idx];
            const g = this.bitmap.data[idx+1];
            const b = this.bitmap.data[idx+2];
            
            // If pixel is very close to white, make it transparent
            if (r > 235 && g > 235 && b > 235) {
                this.bitmap.data[idx + 3] = 0; // Set alpha to 0
            }
        });

        await image.writeAsync(outputPath);
        console.log('Successfully saved to ' + outputPath);
    } catch (error) {
        console.error('Error editing logo:', error);
    }
}

removeBg();
