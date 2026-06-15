const Jimp = require('jimp');
const path = require('path');

async function cropLogo() {
    try {
        const logoPath = path.join(__dirname, 'public', 'assets', 'images', 'logo.jpeg');
        const outputPath = path.join(__dirname, 'public', 'assets', 'images', 'logo-cropped.jpeg');

        const image = await Jimp.read(logoPath);
        
        console.log(`Original dimensions: ${image.bitmap.width}x${image.bitmap.height}`);

        // Scan for bounding box ignoring near-white pixels
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        let minX = width, minY = height, maxX = 0, maxY = 0;
        
        image.scan(0, 0, width, height, function(x, y, idx) {
            const r = this.bitmap.data[idx];
            const g = this.bitmap.data[idx+1];
            const b = this.bitmap.data[idx+2];
            
            // If pixel is significantly darker than white (tolerance for JPEG artifacts)
            if (r < 245 || g < 245 || b < 245) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        });

        const cropWidth = maxX - minX + 1;
        const cropHeight = maxY - minY + 1;
        
        if (cropWidth > 0 && cropHeight > 0) {
            console.log(`Bounding box found: x=${minX}, y=${minY}, w=${cropWidth}, h=${cropHeight}`);
            
            // Add a small 10px padding so it's not cropped perfectly tight
            const pad = 10;
            const finalX = Math.max(0, minX - pad);
            const finalY = Math.max(0, minY - pad);
            const finalW = Math.min(width - finalX, cropWidth + pad*2);
            const finalH = Math.min(height - finalY, cropHeight + pad*2);
            
            image.crop(finalX, finalY, finalW, finalH);
            console.log(`Final cropped dimensions: ${image.bitmap.width}x${image.bitmap.height}`);
        } else {
            console.log("Could not find any non-white pixels!");
        }

        await image.writeAsync(outputPath);
        console.log('Successfully saved to ' + outputPath);
    } catch (error) {
        console.error('Error editing logo:', error);
    }
}

cropLogo();
