const Jimp = require('jimp');
const path = require('path');

async function editLogo() {
    try {
        const logoPath = path.join(__dirname, 'public', 'assets', 'images', 'logo.jpeg');
        const outputPath = path.join(__dirname, 'public', 'assets', 'images', 'logo-symbol.png');

        const image = await Jimp.read(logoPath);
        
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        
        console.log(`Original dimensions: ${width}x${height}`);

        // If the logo is wider than it is tall, assume symbol is on the left
        let cropSize = Math.min(width, height);
        if (width > height * 1.2) {
            console.log('Cropping to extract symbol from the left...');
            image.crop(0, 0, cropSize, cropSize);
        } else {
            console.log('Image is roughly square, assuming it is already just the symbol.');
        }

        // Remove white background
        console.log('Removing white background...');
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
            // Get RGB values
            const red = this.bitmap.data[idx + 0];
            const green = this.bitmap.data[idx + 1];
            const blue = this.bitmap.data[idx + 2];

            // If it's a very light pixel (close to white), make it transparent
            if (red > 230 && green > 230 && blue > 230) {
                this.bitmap.data[idx + 3] = 0; // Alpha channel to 0 (transparent)
            }
        });

        await image.writeAsync(outputPath);
        console.log('Successfully saved to ' + outputPath);
    } catch (error) {
        console.error('Error editing logo:', error);
    }
}

editLogo();
