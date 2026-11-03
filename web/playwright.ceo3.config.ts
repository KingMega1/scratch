import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir:'tests/ceo3-browser', timeout:45000, retries:0,
 reporter:[['list'],['json',{outputFile:'test-results/ceo3-browser.json'}]],
 use:{baseURL:'http://127.0.0.1:3210'},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}},{name:'mobile',use:{...devices['Pixel 7']}}],
});
