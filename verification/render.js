const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  for (const name of ['slide_comparison_dark', 'slide_hero_stat_light']) {
    await page.goto(`file://${__dirname}/${name}.html`);
    await page.screenshot({ path: `${__dirname}/${name}.png` });
    console.log('rendered', name);
  }
  await browser.close();
})();
