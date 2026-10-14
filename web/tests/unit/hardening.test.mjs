import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import {createRequire}from'node:module';
const require=createRequire(import.meta.url);
function load(file,imports={},extra=''){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8')+'\n'+extra,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:m,exports:m.exports,require:n=>imports[n]??require(n),console,TextEncoder,TextDecoder,Uint8Array,crypto:globalThis.crypto,atob});return m.exports;}
const env=await import('../../src/lib/deploy-env.ts');
test('CMS blocks production drafts even when caller requests them, including related links',async()=>{
 const old=process.env.CI_ENV;process.env.CI_ENV='production';
 try{const cms=load('src/server/cms/provider.ts',{'server-only':{},'@/lib/deploy-env':env}).content();assert.equal((await cms.list({includeDrafts:true})).length,0);assert.equal(await cms.get('official-vs-listing-prices'),null);assert.equal((await cms.relatedTo('kia-sportage')).length,0);}finally{if(old===undefined)delete process.env.CI_ENV;else process.env.CI_ENV=old;}
});
test('UTF-8 Basic authentication validates both fields, malformed headers and prefix mismatches',async()=>{
 const m=load('src/middleware.ts',{'next/server':{}},'export const qaAuth = basicAuthOk;');
 const header=(u,p)=>'Basic '+Buffer.from(u+':'+p).toString('base64');
 assert.equal(await m.qaAuth(header('مستخدم','كلمة:سر'),'مستخدم','كلمة:سر'),true);
 for(const h of ['Basic %%%','Bearer x',header('مستخدمx','كلمة:سر'),header('مستخدم','كلمة:سx')])assert.equal(await m.qaAuth(h,'مستخدم','كلمة:سر'),false);
});
test('EV3 drops PII keys and nested payloads; array strings are re-redacted',()=>{
 const redact=load('src/lib/analytics/redact.ts');const contract=load('src/lib/analytics/contract.ts');
 const m=load('src/app/api/v1/events/route.ts',{'@/server/http/guard':{},'@/lib/analytics/redact':redact,'@/lib/analytics/contract':contract},'export const qaValue=cleanValue; export const qaKey=(k:string)=>PROP_KEY.test(k)&&!FORBIDDEN_KEYS.test(k)&&redact(k).text_redacted===k;');
 for(const k of ['user 01012345678','note_01012345678','email','free_text'])assert.equal(m.qaKey(k),false,k);
 assert.equal(m.qaValue({email:'a@b.co'}),undefined);const v=m.qaValue(['a@b.co','01012345678',{email:'x@y.co'}]);assert.equal(v.length,2);assert.ok(v.every(s=>!s.includes('@')&&!s.includes('01012345678')));
});
