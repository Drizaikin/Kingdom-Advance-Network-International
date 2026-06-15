const fs = require('fs');
const path = require('path');
const publicDir = path.join(__dirname, 'public');

const oldLogoHTML = `<a href="index.html" class="nav-logo">
                <img src="assets/images/logo-transparent.png" alt="KANI Logo" class="nav-brand-img">
            </a>`;

const newLogoHTML = `<a href="index.html" class="nav-logo">
                <img src="assets/images/logo-symbol.png" alt="KANI Symbol" class="nav-brand-img">
                <div class="nav-logo-text">
                    <span class="logo-text-main">Kingdom Advance</span>
                    <span class="logo-text-sub">Network International</span>
                </div>
            </a>`;

const oldMobileLogoHTML = `<a href="index.html" class="nav-logo">
                <img src="assets/images/logo-transparent.png" alt="KANI Logo" class="nav-brand-img">
            </a>`;

fs.readdirSync(publicDir).forEach(file => {
    if (file.endsWith('.html')) {
        const filePath = path.join(publicDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Use a regex that ignores exact whitespace for robustness
        const regex = /<a href="index\.html" class="nav-logo">\s*<img src="assets\/images\/logo-transparent\.png" alt="KANI Logo" class="nav-brand-img">\s*<\/a>/g;
        
        content = content.replace(regex, newLogoHTML);
        fs.writeFileSync(filePath, content);
        console.log(`Updated HTML logo in ${file}`);
    }
});
