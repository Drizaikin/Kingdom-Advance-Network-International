const Jimp = require('jimp');
const path = require('path');

async function cropTransparentLogo() {
    try {
        const imagePath = path.join(__dirname, 'public', 'assets', 'images', 'logo-transparent.png');
        const image = await Jimp.read(imagePath);
        
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        
        // The text is likely at the very bottom. Let's crop the bottom 20%.
        const newHeight = Math.floor(height * 0.80);
        
        console.log(`Cropping logo-transparent.png from ${width}x${height} to ${width}x${newHeight}`);
        image.crop(0, 0, width, newHeight);
        
        await image.writeAsync(imagePath);
        console.log('Successfully cropped the transparent logo.');
    } catch (error) {
        console.error('Error:', error);
    }
}

cropTransparentLogo();
