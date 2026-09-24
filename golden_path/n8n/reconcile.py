#!/usr/bin/env python3
"""Three-way node diff: BASE (export the golden patch was built from) vs LIVE (fresh export) vs GOLDEN.

Usage: python3 reconcile.py BASE.json LIVE.json GOLDEN.json

Categories
  live-only        node exists only in LIVE (added after BASE)
  golden-only      node added by the golden patch
  conflicting      node changed in LIVE since BASE *and* changed by the golden patch
  safe to merge    node changed only by the golden patch (LIVE == BASE for it)
  requires decision node removed in LIVE but used by golden, or changed only in LIVE on the golden path
Secrets are never printed; parameters are compared after scrubbing.
"""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scrub_secrets import scrub  # noqa: E402


def load(p):
    w = json.load(open(p, encoding='utf-8'))
    w.pop('activeVersion', None)
    scrub(w)
    nodes = {n['name']: n for n in w['nodes']}
    conn = {}
    for s, v in w.get('connections', {}).items():
        conn[s] = sorted(t['node'] for outs in v.get('main', []) for t in (outs or []))
    return nodes, conn


def sig(n, conn):
    return json.dumps({'t': n.get('type'), 'p': n.get('parameters'), 'c': n.get('credentials'), 'out': conn.get(n['name'])}, sort_keys=True)


def main(base_p, live_p, gold_p):
    B, bc = load(base_p)
    L, lc = load(live_p)
    G, gc = load(gold_p)
    out = {k: [] for k in ('live-only', 'golden-only', 'conflicting', 'safe to merge', 'requires decision')}
    for name in sorted(set(B) | set(L) | set(G)):
        b, l, g = B.get(name), L.get(name), G.get(name)
        if l and not b:
            out['live-only'].append(name)
            continue
        if g and not b:
            out['golden-only'].append(name)
            continue
        if b and not l:
            if g:
                out['requires decision'].append(f'{name} (deleted in live, golden uses it)')
            continue
        live_changed = sig(b, bc) != sig(l, lc)
        gold_changed = g is not None and sig(b, bc) != sig(g, gc)
        if live_changed and gold_changed:
            out['conflicting'].append(name)
        elif gold_changed:
            out['safe to merge'].append(name)
        elif live_changed:
            out['requires decision'].append(f'{name} (changed in live only - keep live version)')
    for k, v in out.items():
        print(f'\n## {k} ({len(v)})')
        for x in v:
            print(f'- {x}')
    return out


if __name__ == '__main__':
    main(*sys.argv[1:4])
