const Jimp = require('jimp');
const path = require('path');

async function removeBottomText() {
    try {
        const imagePath = path.join(__dirname, 'public', 'assets', 'images', 'logo-symbol.png');
        const image = await Jimp.read(imagePath);
        
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        
        // Crop the bottom 25% where the text "based in Kenya" might be
        const newHeight = Math.floor(height * 0.75);
        
        console.log(`Cropping from ${width}x${height} to ${width}x${newHeight}`);
        image.crop(0, 0, width, newHeight);
        
        await image.writeAsync(imagePath);
        console.log('Successfully cropped the bottom text.');
    } catch (error) {
        console.error('Error:', error);
    }
}

removeBottomText();
