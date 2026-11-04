import assert from 'node:assert/strict';
import {test} from 'node:test';
import {HeadlessContentProvider} from './headless-provider.mjs';
const article = {slug:'price-guide', type:'guide', status:'published', publishedAt:'2026-01-01T00:00:00Z', title:{ar:'الأسعار',en:'Prices'}, summary:{ar:'المقارنة',en:'Compare'}, body:{ar:['اقرأ التاريخ'],en:['Read the date']}, relatedModelIds:['geely/ex5'], tags:[]};
const provider = items => new HeadlessContentProvider('https://cms.example.invalid/v1/content',async()=>new Response(JSON.stringify({schema:'carindex.editorial.content/v1',items})));
test('provider matches current list/get/related contract and never leaks drafts',async()=>{
  const p=provider([article,{...article,slug:'draft',status:'draft'}]);
  assert.equal((await p.list({includeDrafts:true})).length,1);
  assert.equal((await p.get('price-guide')).title.ar,'الأسعار');
  assert.equal(await p.get('draft'),null);
  assert.equal((await p.relatedTo('geely/ex5')).length,1);
  assert.equal((await p.list({type:'news'})).length,0);
});
test('provider refuses malformed, future, missing translation and unavailable CMS',async()=>{
  for(const broken of [{...article,publishedAt:'2099-01-01T00:00:00Z'},{...article,title:{en:'Only English'}},{...article,relatedModelIds:'geely/ex5'}]) await assert.rejects(()=>provider([broken]).list());
  await assert.rejects(()=>new HeadlessContentProvider('https://cms.example.invalid/v1/content',async()=>new Response('',{status:503})).list());
  assert.throws(()=>new HeadlessContentProvider('http://public.example.invalid/content'));
});
