// P1.2 contract adapters. Run from buyer-decision/: node tests/contracts.test.js
const C = require('../app/contracts.js');
let fails = 0;
const ok = (c, msg) => { console.log(`${c ? 'PASS' : 'FAIL'} ${msg}`); if (!c) fails++; };

// market status: consumed, never inferred; no audited dataset -> unverified + gate inactive
ok(C.marketStatus('byd/ti-7', null).status === 'unverified' && C.marketStatus('byd/ti-7', null).source === 'none', 'no dataset -> unverified, source none');
ok(!C.gateActive(null, true) && !C.gateActive({ audited: false, models: {} }, true) && !C.gateActive({ audited: true, models: {} }, false), 'gate inactive without audited dataset AND explicit switch');
ok(C.gateActive({ audited: true, models: {} }, true), 'gate active only with audited dataset + switch');
const D = { audited: true, models: { a: { status: 'official' }, g1: { status: 'grey', grey_sufficient: true }, g2: { status: 'grey' }, n: { status: 'announced' }, d: { status: 'discontinued' }, x: { status: 'bogus' } } };
const pl = id => C.marketPlacement(C.marketStatus(id, D));
ok(pl('a') === 'main', 'official -> main');
ok(pl('g1') === 'main_flagged' && pl('g2') === 'not_main', 'grey -> flagged only with sufficient evidence');
ok(pl('u') === 'not_main' && pl('x') === 'not_main', 'unverified / unknown status -> not main');
ok(pl('n') === 'worth_waiting' && pl('d') === 'excluded', 'announced -> worth waiting; discontinued -> excluded');

// technology: resolve only what the data supports
ok(C.trimTech({ pt: 'petrol' }).tech === 'ICE' && C.trimTech({ pt: 'ev' }).tech === 'BEV', 'petrol -> ICE, ev -> BEV');
const h = C.trimTech({ pt: 'hybrid' }), ph = C.trimTech({ pt: 'hybrid', plugin: true });
ok(!h.resolved && h.candidates.join() === 'HEV,PHEV,REEV', 'hybrid unresolved: HEV/PHEV/REEV');
ok(!ph.resolved && ph.candidates.join() === 'PHEV,REEV', 'plugin hybrid unresolved: PHEV/REEV');
ok(C.trimTech({ tech: 'REEV', pt: 'hybrid' }).tech === 'REEV', 'explicit P2 tech wins');

// intent: technology separate from intent; driving pattern reused
const i1 = C.powertrainIntent({ pt: 'no_ev', usage: 'long' });
ok(i1.stance === 'avoid_bev' && i1.excluded.join() === 'BEV' && i1.concerns.includes('long_distance') && i1.source.concerns === 'usage', 'no_ev -> avoid BEV only; long usage reused as concern');
ok(C.techAllowed(C.trimTech({ tech: 'REEV' }), i1) === true && C.techAllowed(C.trimTech({ pt: 'ev' }), i1) === false, 'avoid_bev keeps REEV, excludes BEV');
ok(C.techAllowed(h, i1) === true, 'unresolved hybrid is allowed under avoid_bev (no BEV candidate)');
const i2 = C.powertrainIntent({ pt: 'petrol' });
ok(i2.stance === 'ice_only' && C.techAllowed(h, i2) === false && C.techAllowed(C.trimTech({ pt: 'petrol' }), i2) === true, 'petrol only excludes all electrified');
const i3 = C.powertrainIntent({ pt: 'open', ptNo: ['hybrid'] });
ok(C.techAllowed(ph, i3) === false && C.techAllowed(C.trimTech({ pt: 'ev' }), i3) === true, 'explicit "no hybrid" excludes HEV/PHEV/REEV only');
ok(C.powertrainIntent({}).stance === 'open' && C.powertrainIntent({ priorities: ['economy'] }).concerns.includes('running_cost'), 'open by default; economy priority -> running-cost concern');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
