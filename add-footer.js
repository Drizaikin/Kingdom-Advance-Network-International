const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const indexHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');

const footerMatch = indexHtml.match(/(<!-- Footer -->[\s\S]*?<\/footer>)/);
if (!footerMatch) {
    console.error('Footer not found in index.html');
    process.exit(1);
}

const footerHTML = footerMatch[1];

const filesToUpdate = [
    'about.html',
    'founder.html',
    'programs.html',
    'missions.html',
    'partnership.html',
    'contact.html'
];

filesToUpdate.forEach(file => {
    const filePath = path.join(publicDir, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (!content.includes('<!-- Footer -->')) {
            content = content.replace(/<\/main>/, `</main>\n\n    ${footerHTML}`);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Added footer to ${file}`);
        } else {
            console.log(`Footer already exists in ${file}`);
        }
    }
});
