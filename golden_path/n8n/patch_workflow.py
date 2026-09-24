#!/usr/bin/env python3
"""Apply the CarIndex golden-path changes to an n8n workflow export.

Input : CarIndex_Workflow.json (repo root; Drive export of workflow smn2kQ7BP9H926pV, 2026-08-29)
Output: golden_path/n8n/CarIndex_Workflow.golden.json + golden_path/n8n/CHANGES.md

Code-node bodies are built from golden_path/src/*.js so the n8n nodes and the local
harness (run_golden_path.js) run the same code. Nodes taken off the path are left in the
workflow, disconnected, not deleted.
"""
import copy
import json
import os
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
GP = os.path.dirname(HERE)
ROOT = os.path.dirname(GP)
SRC_WF = os.path.join(ROOT, 'CarIndex_Workflow.json')
OUT_WF = os.path.join(HERE, 'CarIndex_Workflow.golden.json')
OUT_MD = os.path.join(HERE, 'CHANGES.md')

MEDIA_STATIC = 'http://207.127.99.206:8080/static'  # same logo URLs the existing templates use


def src(name):
    code = open(os.path.join(GP, 'src', name), encoding='utf-8').read()
    # drop the Node-only export footer; n8n Code nodes have no module system
    return code.split("if (typeof module !== 'undefined'")[0].rstrip() + '\n'


PROMPT = open(os.path.join(GP, 'prompts', 'buyer_check_content.md'), encoding='utf-8').read().strip()
assert '{{' not in PROMPT and '}}' not in PROMPT and '`' not in PROMPT

wf = json.load(open(SRC_WF, encoding='utf-8'))
nodes = {n['name']: n for n in wf['nodes']}
conn = wf['connections']
changes = []


def log(kind, name, what):
    changes.append(f'| {kind} | {name} | {what} |')


def set_main(src_name, outputs):
    """outputs: list (one per output index) of lists of target node names."""
    conn[src_name] = {'main': [[{'node': t, 'type': 'main', 'index': 0} for t in out] for out in outputs]}


def drop_target(src_name, target):
    for outs in conn.get(src_name, {}).get('main', []):
        outs[:] = [t for t in (outs or []) if t['node'] != target]


def add_node(template_name, name, params, pos, extra=None):
    n = copy.deepcopy(nodes[template_name]) if template_name else {}
    n['parameters'] = params
    n['name'] = name
    n['id'] = str(uuid.uuid5(uuid.NAMESPACE_URL, 'carindex-golden/' + name))
    n['position'] = pos
    if extra:
        n.update(extra)
    n.pop('onError', None) if not (extra and 'onError' in extra) else None
    wf['nodes'].append(n)
    nodes[name] = n
    return n


def code_node(name, js, pos, mode=None):
    params = {'jsCode': js}
    if mode:
        params['mode'] = mode
    return add_node(None, name, params, pos, {'type': 'n8n-nodes-base.code', 'typeVersion': 2})


# ---------------------------------------------------------------- 1. CONTENT (structured, no design)
user_msg = ("`Write a Buyer Check post from this article. Use only facts in it.\\n\\n"
            "TITLE: ${$('Code in JavaScript').item.json.title}\\n"
            "SOURCE OUTLET: ${$('Code in JavaScript').item.json.source}\\n"
            "URL: ${$('Code in JavaScript').item.json.link}\\n"
            "PUBLISHED: ${$('Code in JavaScript').item.json.isoDate || ''}\\n"
            "SUMMARY: ${$('Code in JavaScript').item.json.contentSnippet}\\n"
            "LANGUAGE: ${$('Code in JavaScript').item.json.language}\\n\\n"
            "VERIFIED FACTS: none beyond the article above. Anything not in it is missing.`")
nodes['Content Creation']['parameters']['jsonBody'] = (
    "={{ JSON.stringify({\n  model: 'openai/gpt-oss-20b',\n  messages: [\n"
    f"    {{ role: 'system', content: {json.dumps(PROMPT, ensure_ascii=False)} }},\n"
    f"    {{ role: 'user', content: {user_msg} }}\n"
    "  ],\n  temperature: 0.2,\n  max_tokens: 6000,\n}) }}")
log('prompt', 'Content Creation', 'System prompt replaced with golden_path/prompts/buyer_check_content.md: structured Buyer Check JSON, 6 fixed slides, every number must be a sourced key_data entry, missing = null. Removed: carousel design fields, spec_facts "use general market knowledge" and competitor "best estimate" instructions, platform captions. temperature 0.7 -> 0.2.')

gem = nodes['Content Creation Fallback (Gemini)']['parameters']['messages']['values']
gem[0]['content'] = PROMPT
gem[1]['content'] = ("=Write a Buyer Check post from this article. Use only facts in it.\n\n"
                     "TITLE: {{ $('Code in JavaScript').item.json.title }}\n"
                     "SOURCE OUTLET: {{ $('Code in JavaScript').item.json.source }}\n"
                     "URL: {{ $('Code in JavaScript').item.json.link }}\n"
                     "PUBLISHED: {{ $('Code in JavaScript').item.json.isoDate || '' }}\n"
                     "SUMMARY: {{ $('Code in JavaScript').item.json.contentSnippet }}\n"
                     "LANGUAGE: {{ $('Code in JavaScript').item.json.language }}\n\n"
                     "VERIFIED FACTS: none beyond the article above. Anything not in it is missing.")
log('prompt', 'Content Creation Fallback (Gemini)', 'Same prompt as primary (was a known-stale older prompt).')

# ---------------------------------------------------------------- 2. REAL IMAGE only
nodes['Build Image Candidates']['parameters']['jsCode'] = r"""// Golden path: only images whose page/image URL contains the model name (modelMatchConfidence
// 'high'). Low-confidence DDG hits (other models on the same OEM site) are dropped.
const raw = (($json.oemCandidates || []).filter(c => c.url && c.modelMatchConfidence === 'high'));
const imageCandidates = raw.slice(0, 6).map((c, i) => ({
  index: i, url: c.url, title: c.title || '', market: c.market, pageUrl: c.pageUrl,
  width: c.width || 0, height: c.height || 0, modelMatchConfidence: c.modelMatchConfidence,
}));
return [{ json: { ...$('Parse Vehicle ID').first().json, imageCandidates, imageSourceType: imageCandidates.length ? 'oem' : 'none' } }];
"""
log('code', 'Build Image Candidates', 'Keeps only high-confidence OEM matches (model name in URL).')

code_node('Set No Image', r"""// No real image found. The post continues so the draft is still logged, but QA will stop it.
// Replaces the Nano Banana AI-image fallback on the golden path.
return [{ json: { ...$('Parse Vehicle ID').first().json, imageCandidates: [], imageSourceType: 'none' } }];
""", [-900, 520])
for n in ('IF Vehicle Identified', 'IF Has OEM Candidates'):
    outs = conn[n]['main']
    outs[1] = [{'node': 'Set No Image', 'type': 'main', 'index': 0}]
set_main('Set No Image', [['Content Creation']])
log('node+wire', 'Set No Image (new)', 'IF Vehicle Identified[false] and IF Has OEM Candidates[false] now go here instead of Nano Banana Fallback Image. No AI images on the golden path.')

# ---------------------------------------------------------------- 3. PARSE CONTENT
nodes['Parse AI Draft']['parameters']['jsCode'] = r"""// Golden path: parse the structured Buyer Check JSON + attach the real image record.
function parseJsonLoose(text) {
  const cleaned = (text || '').replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch (e) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (e2) {} }
    return null;
  }
}
// Brand-name safety net kept from the previous version (Chery was mistransliterated live).
const WRONG = ['Sherry', 'Shari', 'Cherry', 'SHERRY', 'SHARI', 'CHERRY', 'sherry', 'shari', 'cherry'];
function fixDeep(v) {
  if (typeof v === 'string') return v.replace(new RegExp(`\\b(?:${WRONG.join('|')})\\b`, 'g'), 'Chery');
  if (Array.isArray(v)) return v.map(fixDeep);
  if (v && typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) o[k] = fixDeep(x); return o; }
  return v;
}
const buyerCheck = fixDeep(parseJsonLoose($json.aiDraft) || {});

let cands = [];
try { cands = $('Build Image Candidates').first().json.imageCandidates || []; } catch (e) { /* branch did not run */ }
const vid = $('Parse Vehicle ID').first().json;
const best = cands[0] || null;
let host = '';
try { host = best ? new URL(best.pageUrl || best.url).hostname : ''; } catch (e) {}
const imageRecord = best ? {
  url: best.url, source_url: best.url, source_page: best.pageUrl || '',
  credit: host, ai_generated: false,
  registry_status: best.modelMatchConfidence === 'high' ? 'approved' : 'unreviewed',
  vehicle: `${vid.vehicleMake} ${vid.vehicleModel}`.trim(),
  width: best.width || 0, height: best.height || 0,
} : { url: '', source_url: null, library_ref: null, credit: '', ai_generated: false, registry_status: 'none', vehicle: null };

const car = buyerCheck.car || {};
return [{ json: {
  ...$json,
  buyerCheck,
  buyerCheckParsed: !!buyerCheck.format,
  imageRecord,
  imageUrl: imageRecord.url,
  format: 'Buyer Check',
  draftHeadline: (buyerCheck.hook && buyerCheck.hook.ar) || $json.title,
  draftHeadlineEn: (buyerCheck.hook && buyerCheck.hook.en) || $json.title,
  carName: [car.make, car.model, car.variant].filter(Boolean).join(' '),
  draftPlatformCaptions: {},
} }];
"""
log('code', 'Parse AI Draft', 'Parses the Buyer Check JSON; builds imageRecord (url, provenance, vehicle, approval) from the OEM candidate; no image selection by the LLM.')

# ---------------------------------------------------------------- 4. TEMPLATE (renderer owns layout)
nodes['Carousel Designer']['parameters']['jsCode'] = src('buyer_check_render.js') + f"""
// ---- n8n entry point
const d = $json;
return buildBuyerCheckSlides(d.buyerCheck || {{}}, {{
  postId: d.postId,
  imageUrl: (d.imageRecord && d.imageRecord.url) || '',
  imageCredit: (d.imageRecord && d.imageRecord.credit) || '',
  logoUrl: '{MEDIA_STATIC}/carindex-logo.png',
  logoWhiteUrl: '{MEDIA_STATIC}/carindex-logo-white.png',
}}).map(s => ({{ json: s }}));
"""
log('code', 'Carousel Designer', 'Replaced the 9 hardcoded templates (fixed "only trim", "naturally aspirated", "5 seats", fixed 4-line citation list, JAC JS2 default titles) with the 6-slide Buyer Check renderer from golden_path/src/buyer_check_render.js. Missing facts render as "not in source".')

# Parse AI Draft feeds only the carousel now
set_main('Parse AI Draft', [['Carousel Designer']])
log('wire', 'Parse AI Draft', 'Output now goes only to Carousel Designer. Disconnected (left in place): Build Video Scenes, Reel Script Designer, Build Competitor Image Queries, Merge Carousel Inputs.')

# ---------------------------------------------------------------- 5. RENDER + file check
add_node('Download Slide for Telegram', 'Download Rendered Slide', {
    'url': '={{ $json.url }}',
    'options': {'response': {'response': {'responseFormat': 'file'}}},
}, [2860, 160], {'onError': 'continueRegularOutput'})
set_main('Render Slide to PNG', [['Download Rendered Slide']])
set_main('Download Rendered Slide', [['Merge Slides Into Item']])
log('node+wire', 'Download Rendered Slide (new)', 'Fetches each rendered PNG so QA can verify it exists, its size and dimensions. Replaces Aggregate Rendered Slides on the path.')

nodes['Merge Slides Into Item']['parameters']['jsCode'] = r"""// Zip planned slides, render responses and downloaded files (same order, 6 items).
const planned = $('Carousel Designer').all();
const renders = $('Render Slide to PNG').all();
const items = $input.all();
const rendered = [];
for (let i = 0; i < planned.length; i++) {
  const p = planned[i].json;
  const r = renders[i] ? renders[i].json : {};
  let bytes = 0, width = 0, height = 0, exists = false;
  if (r.url && items[i] && items[i].binary && items[i].binary.data) {
    try {
      const buf = await this.helpers.getBinaryDataBuffer(i, 'data');
      bytes = buf.length;
      if (buf.length > 24 && buf.readUInt32BE(12) === 0x49484452) { width = buf.readUInt32BE(16); height = buf.readUInt32BE(20); }
      exists = bytes > 0;
    } catch (e) { /* treated as missing */ }
  }
  rendered.push({ slideNumber: p.slideNumber, role: p.role, filename: p.filename, url: r.url || '', exists, bytes, width, height });
}
return [{ json: {
  ...$('Parse AI Draft').first().json,
  rendered,
  renderedImageUrls: rendered.map(x => x.url).filter(Boolean),
  slideFiles: rendered.map(x => x.filename),
  failedSlideNumbers: rendered.filter(x => !x.exists).map(x => x.slideNumber),
  totalSlides: planned.length,
} }];
"""
log('code', 'Merge Slides Into Item', 'Builds the rendered-file list (filename, url, exists, bytes, width, height) from Parse AI Draft (was Merge Carousel Inputs).')

# ---------------------------------------------------------------- 6. QA GATE
code_node('QA Gate', src('qa_gate.js') + r"""
// ---- n8n entry point
const d = $json;
const qa = runQaGate(d.buyerCheck || {}, d.imageRecord || {}, d.rendered || [], { postId: d.postId, today: new Date().toISOString().slice(0, 10) });
return [{ json: { ...d, qa, qaPassed: qa.passed, qaSummary: qa.passed ? `PASSED (${qa.warnings.length} warnings)` : qa.failures.join(' | ') } }];
""", [3240, 160])
add_node('IF Carousel Incomplete', 'IF QA Passed', {
    'conditions': {
        'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 2},
        'conditions': [{'id': 'if-qa-passed-cond1', 'leftValue': '={{ $json.qaPassed }}', 'rightValue': True,
                        'operator': {'type': 'boolean', 'operation': 'equals'}}],
        'combinator': 'and'},
    'options': {}}, [3440, 160])
set_main('Merge Slides Into Item', [['QA Gate']])
set_main('QA Gate', [['IF QA Passed']])
set_main('IF QA Passed', [['Append row in sheet', 'Create Notion Page'], ['Log QA Failed']])
log('node+wire', 'QA Gate (new) + IF QA Passed (new)', 'Runs golden_path/src/qa_gate.js. Pass -> Sheet + Notion + Telegram. Fail -> Log QA Failed -> Telegram QA Fail Alert. Replaces Merge Video + Carousel / IF Carousel Incomplete on the path.')

qa_fail_log = copy.deepcopy(nodes['Log Editor Rejected']['parameters'])
qa_fail_log['columns']['value'] = {
    'Date': "={{ new Date().toISOString().split('T')[0] }}",
    'Title': '={{ $json.title }}', 'Source': '={{ $json.source }}', 'URL': '={{ $json.link }}',
    'Status': 'QA-Failed', 'PostId': '={{ $json.postId }}', 'Format': 'Buyer Check',
    'AI Draft': '={{ $json.aiDraft }}', 'Summary': '={{ $json.qaSummary }}',
}
add_node('Log Editor Rejected', 'Log QA Failed', qa_fail_log, [3640, 360])
add_node('Telegram Reject Alert', 'Telegram QA Fail Alert', {
    'chatId': nodes['Telegram Reject Alert']['parameters']['chatId'],
    'text': "=CarIndex: QA FAILED - blocked, not sent for approval\n\nStory: {{ $('QA Gate').item.json.title }}\nCar: {{ $('QA Gate').item.json.carName }}\nSource: {{ $('QA Gate').item.json.link }}\nPostId: {{ $('QA Gate').item.json.postId }}\n\n{{ ($('QA Gate').item.json.qa.failures || []).map(f => '- ' + f).join('\\n') }}",
    'additionalFields': {'appendAttribution': False}}, [3840, 360])
set_main('Log QA Failed', [['Telegram QA Fail Alert']])
log('node', 'Log QA Failed (new), Telegram QA Fail Alert (new)', 'Sheet row Status=QA-Failed with the failure list in Summary; Telegram alert lists each failure.')

# ---------------------------------------------------------------- 7. SHEET + TELEGRAM APPROVAL
cols = nodes['Append row in sheet']['parameters']['columns']['value']
cols.update({
    'Title': '={{ $json.title }}',
    'Format': 'Buyer Check',
    'Image': '={{ $json.imageRecord.url }}',
    'ImageURLs': '={{ JSON.stringify($json.renderedImageUrls) }}',
    'SlideFiles': '={{ JSON.stringify($json.slideFiles) }}',
    'QA': '={{ $json.qaSummary }}',
    'AI Draft': '={{ JSON.stringify($json.buyerCheck) }}',
    'Status': 'Pending',
})
cols.pop('VideoURL', None)
cols.pop('PlatformCaptions', None)
log('params', 'Append row in sheet', 'Adds SlideFiles and QA columns (must exist as Sheet headers), stores the structured JSON in AI Draft, drops VideoURL/PlatformCaptions.')

code_node('Split Slides For Telegram', r"""// One item per slide, binary renamed to the QA-checked filename.
const d = $('QA Gate').first().json;
const bins = $('Download Rendered Slide').all();
return d.rendered.map((r, i) => ({
  json: { caption: `${i + 1}/6 ${r.filename}`, filename: r.filename },
  binary: bins[i] && bins[i].binary && bins[i].binary.data ? { data: { ...bins[i].binary.data, fileName: r.filename } } : {},
}));
""", [3640, 80])
add_node('Send Telegram Approval', 'Send Slide Preview', {
    'operation': 'sendPhoto', 'chatId': nodes['Send Telegram Approval']['parameters']['chatId'],
    'binaryData': True, 'additionalFields': {'caption': '={{ $json.caption }}'}}, [3840, 80])
code_node('Build Approval Message', src('telegram_approval.js') + r"""
// ---- n8n entry point (runs once, after the 6 previews)
const d = $('QA Gate').first().json;
const text = tgApprovalText({ postId: d.postId, storyTitle: d.title, content: d.buyerCheck, files: d.rendered, image: d.imageRecord }, d.qa);
return [{ json: { approvalText: text, postId: d.postId } }];
""", [4040, 80])
nodes['Send Telegram Approval']['parameters'] = {
    'chatId': nodes['Send Telegram Approval']['parameters']['chatId'],
    'text': '={{ $json.approvalText }}',
    'additionalFields': {'appendAttribution': False}}
nodes['Send Telegram Approval']['position'] = [4240, 80]
nodes['Update Sheet: Telegram Message Id']['parameters']['columns']['value']['PostId'] = "={{ $('QA Gate').first().json.postId }}"
nodes['Update Sheet: Telegram Message Id']['position'] = [4440, 80]
set_main('Append row in sheet', [['Split Slides For Telegram']])
set_main('Split Slides For Telegram', [['Send Slide Preview']])
set_main('Send Slide Preview', [['Build Approval Message']])
set_main('Build Approval Message', [['Send Telegram Approval']])
set_main('Send Telegram Approval', [['Update Sheet: Telegram Message Id']])
log('node+wire', 'Split Slides For Telegram, Send Slide Preview, Build Approval Message (new); Send Telegram Approval (changed)', 'Telegram gets all 6 slides as previews (was slide 1 only), then one text message with story title, car, format, files, image credit, missing facts, sources, QA result, PostId and YES / NO <reason> instructions. Its message_id is stored on the Sheet row. Download Slide for Telegram is no longer on the path.')

# ---------------------------------------------------------------- 8. REPLY HANDLING
nodes['Extract Reply']['parameters']['jsCode'] = src('telegram_approval.js') + r"""
// ---- n8n entry point
const staticData = $getWorkflowStaticData('global');
const updates = $json.result || [];
let maxUpdateId = staticData.telegramUpdateOffset ? staticData.telegramUpdateOffset - 1 : -1;
const replies = [];
for (const update of updates) {
  if (update.update_id > maxUpdateId) maxUpdateId = update.update_id;
  const msg = update.message;
  if (!msg || !msg.reply_to_message) continue;
  const parsed = tgParseReply(msg.text || '');
  if (!parsed.decision) continue; // ambiguous replies change nothing
  replies.push({ json: { replyToMessageId: msg.reply_to_message.message_id, replyText: (msg.text || '').trim(), decision: parsed.decision, reason: parsed.reason } });
}
staticData.telegramUpdateOffset = maxUpdateId + 1;
return replies;
"""
nodes['Switch YES/NO']['parameters']['conditions']['conditions'][0]['leftValue'] = "={{ $('Extract Reply').item.json.decision }}"
nodes['Switch YES/NO']['parameters']['conditions']['conditions'][0]['rightValue'] = 'APPROVED'
nodes['Update Status: Rejected']['parameters']['columns']['value']['RejectReason'] = "={{ $('Extract Reply').item.json.reason }}"
nodes['Reply: Rejected Ack']['parameters']['text'] = "=Rejected: {{ $json.Title }}\nReason recorded: {{ $('Extract Reply').item.json.reason }}"
nodes['Reply: Approved Ack']['parameters']['text'] = "=Approved: {{ $json.Title }}\nStatus = Approved. Final files are in the Sheet (SlideFiles / ImageURLs). Nothing was published."
log('code', 'Extract Reply / Switch YES/NO', 'YES (or نعم/موافق) -> Approved; NO <reason> (or لا/رفض) -> Rejected with reason; anything else is ignored (previously any non-YES reply rejected the post).')
log('params', 'Update Status: Rejected / Reply acks', 'Writes RejectReason column (must exist in the Sheet); acks echo the reason. No publishing.')

# ---------------------------------------------------------------- 9. small wiring fix in CURATE
conn['IF Relevant Enough']['main'] = [conn['IF Relevant Enough']['main'][0], [{'node': 'Log Low Relevance Skip', 'type': 'main', 'index': 0}]]
log('wire', 'IF Relevant Enough -> Log Low Relevance Skip', 'False branch was unconnected, so low-relevance skips were never logged.')

# the Claude EIC fallback still had role "assistant" in the Drive export
for m in nodes['Editor-in-Chief Fallback (Claude)']['parameters']['messages']['values']:
    if m.get('role') == 'assistant':
        m['role'] = 'system'
        log('params', 'Editor-in-Chief Fallback (Claude)', 'Instruction role assistant -> system (fix from branch claude/carousel-designer-rules-nhvkom, missing from the Aug 29 export).')

# ---------------------------------------------------------------- orphan cleanup of connections
for dead in ('Aggregate Rendered Slides', 'Download Slide for Telegram', 'Merge Video + Carousel', 'IF Carousel Incomplete'):
    for s, v in list(conn.items()):
        for outs in v.get('main', []):
            if outs:
                outs[:] = [t for t in outs if t['node'] != dead]
    conn.pop(dead, None)

wf['name'] = wf['name'] + ' - golden path'
json.dump(wf, open(OUT_WF, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

with open(OUT_MD, 'w', encoding='utf-8') as f:
    f.write('# n8n changes applied by patch_workflow.py\n\n')
    f.write('Source: `CarIndex_Workflow.json` (Drive export, updatedAt 2026-08-29). Output: `CarIndex_Workflow.golden.json`.\n\n')
    f.write('| Type | Node | Change |\n|---|---|---|\n')
    f.write('\n'.join(changes) + '\n')
print(f'wrote {OUT_WF} ({len(wf["nodes"])} nodes), {len(changes)} changes')
