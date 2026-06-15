const fs = require('fs');
const path = require('path');
const publicDir = path.join(__dirname, 'public');

const newLogoHTML = `<a href="index.html" class="nav-logo">
                <img src="assets/images/logo-transparent.png" alt="KANI Logo" class="nav-brand-img">
            </a>`;

// Regex to capture the entire <a class="nav-logo"> block that we injected previously
const regex = /<a href="index\.html" class="nav-logo">\s*<img src="assets\/images\/logo-symbol\.png" alt="KANI Symbol" class="nav-brand-img">\s*<div class="nav-logo-text">\s*<span class="logo-text-main">Kingdom Advance<\/span>\s*<span class="logo-text-sub">Network International<\/span>\s*<\/div>\s*<\/a>/g;

fs.readdirSync(publicDir).forEach(file => {
    if (file.endsWith('.html')) {
        const filePath = path.join(publicDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        
        if (regex.test(content)) {
            content = content.replace(regex, newLogoHTML);
            fs.writeFileSync(filePath, content);
            console.log(`Reverted HTML logo in ${file}`);
        } else {
            console.log(`No match found in ${file}.`);
        }
    }
});
