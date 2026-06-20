const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
  });

  await page.goto('http://localhost:3000/missions.html?refresh=true', { waitUntil: 'networkidle0' });
  
  // zoom out
  await page.mouse.wheel({ deltaY: 2000 });
  await page.waitForTimeout(2000);
  
  await page.screenshot({ path: 'test_missions.png' });
  
  await browser.close();
  console.log('Done');
})();
