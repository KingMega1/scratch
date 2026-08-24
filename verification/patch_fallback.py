import json

data = json.load(open('/home/user/scratch/CarIndex_Workflow.json', encoding='utf-8'))
cc_standalone = json.load(open('/home/user/scratch/content_creation.json', encoding='utf-8'))

for n in data['nodes']:
    if n['name'] == 'Content Creation':
        n['parameters']['jsonBody'] = cc_standalone['parameters']['jsonBody']
        print('Copied patched jsonBody into full-workflow Content Creation node')

    if n['name'] == 'Content Creation Fallback (Gemini)':
        c = n['parameters']['messages']['values'][0]['content']
        old_intro = ("You are CarIndex's lead content strategist and writer. You create skeptical, "
                     "data-first car content for Egyptian buyers, published bilingually (Arabic + English "
                     "on every slide) across Instagram, Facebook, X, Threads, TikTok, and YouTube.\n\n"
                     "Output format:")
        new_intro = ("You are CarIndex's lead content strategist and writer. You create skeptical, "
                     "data-first car content for Egyptian buyers, published bilingually (Arabic + English "
                     "on every slide) across Instagram, Facebook, X, Threads, TikTok, and YouTube.\n\n"
                     "BRAND VOICE — NON-NEGOTIABLE, apply this while you write, not just when checked "
                     "afterward: \"Numbers first, opinions last.\" Every number leads; every opinion is "
                     "earned by a number that came before it. No \"best/cheapest/first/only\" claim "
                     "without it either being explicitly stated in the source you were given, or tagged "
                     "[UNVERIFIED] in both languages. Never write like a dealer ad: no exclamation-stacked "
                     "price call-outs, no \"save this and send it to your friend\" soft-sell CTA as the "
                     "ONLY closing line, no distributor or dealer name used as a hashtag or credited as if "
                     "endorsing the post.\n\n"
                     "Output format:")
        assert old_intro in c, "old_intro not found in fallback node"
        c = c.replace(old_intro, new_intro)

        old_rules = ('Rules:\n'
                     '- Arabic fields: Egyptian Arabic (عامية مصرية), Arabic script, street-smart and numbers-forward — never Modern Standard Arabic, never a stiff translation of the English\n'
                     '- English fields: Bloomberg-tight, no fluff — write it as its own original copy, not a translation of the Arabic either\n'
                     '- Include price context if mentioned in source\n'
                     '- Flag any unverified claims with [UNVERIFIED] (in both languages)\n'
                     '- Never use hype language: no "amazing," "incredible," "must-buy" (or Arabic equivalents)\n'
                     '- Every skip_if must be specific and fair, in both languages\n\n'
                     'PLATFORM CAPTION RULES')
        new_rules = ('Rules:\n'
                     '- Arabic fields: Egyptian Arabic (عامية مصرية), Arabic script, street-smart and numbers-forward — never Modern Standard Arabic, never a stiff translation of the English\n'
                     '- English fields: Bloomberg-tight, no fluff — write it as its own original copy, not a translation of the Arabic either\n'
                     '- Include price context if mentioned in source\n'
                     '- Flag any unverified claims with [UNVERIFIED] (in both languages) — this includes any spec, price, or superlative from the source article not attributed to an official distributor/manufacturer figure\n'
                     '- Never use hype language: no "amazing," "incredible," "must-buy" (or Arabic equivalents)\n'
                     "- HOOK SPECIFICITY: headline_ar/en and reel_script.hook_ar/en must each contain a specific fact unique to THIS article — if the hook could be pasted onto a different article in the same content pillar and still make sense, it's too generic; rewrite it\n"
                     '- Every skip_if must be specific and fair, in both languages\n\n'
                     'PLATFORM CAPTION RULES')
        assert old_rules in c, "old_rules not found in fallback node"
        c = c.replace(old_rules, new_rules)

        n['parameters']['messages']['values'][0]['content'] = c
        with open('/home/user/scratch/content_creation_fallback_gemini.json', 'w', encoding='utf-8') as f:
            json.dump(n, f, ensure_ascii=False, indent=2)
        print('Patched Content Creation Fallback (Gemini), saved standalone copy')

with open('/home/user/scratch/CarIndex_Workflow.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print('Saved CarIndex_Workflow.json')
