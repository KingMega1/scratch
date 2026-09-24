// Telegram approval: message builder + reply parser. No auto-publishing anywhere.
// Used by the n8n "Build Telegram Approval" and "Extract Reply" Code nodes and locally.

function tgApprovalText(post, qa) {
  const c = post.content;
  const car = [c.car.make, c.car.model, c.car.variant].filter(Boolean).join(' ');
  const srcs = (c.sources || []).map(s => `• ${s.outlet} (${s.published}) ${s.url}`).join('\n');
  const warn = (qa.warnings || []).length ? `\nQA warnings:\n${qa.warnings.map(w => '• ' + w).join('\n')}\n` : '';
  const missing = (c.key_data || []).filter(k => k.status !== 'verified').map(k => `${k.label_en} (${k.status})`);
  return [
    'CarIndex - approval needed',
    '',
    `Story: ${post.storyTitle}`,
    `Car: ${car}`,
    `Format: Buyer Check (6 slides) | Type: ${c.story_type}`,
    `Hook: ${c.hook.en}`,
    `Files: ${post.files.map(f => f.filename).join(', ')}`,
    `Image: ${post.image.credit}`,
    missing.length ? `Marked missing: ${missing.join(', ')}` : 'Marked missing: none',
    '',
    'Sources:',
    srcs,
    `QA: PASSED (${(qa.failures || []).length} failures)`,
    warn,
    `PostId: ${post.postId}`,
    '',
    'REPLY to this message:',
    'YES  -> approve',
    'NO <reason>  -> reject (reason is recorded)',
    'Nothing is published automatically.',
  ].join('\n');
}

// Returns {decision: 'APPROVED'|'REJECTED'|null, reason}
function tgParseReply(text) {
  const t = String(text || '').trim();
  // (?=...) instead of \b: JS \b does not work next to Arabic letters.
  const END = '(?=$|[\\s:,.!\\-–—])';
  if (new RegExp(`^(yes|y|approve|approved|نعم|موافق|أيوه|ايوه)${END}[\\s.!]*$`, 'i').test(t)) {
    return { decision: 'APPROVED', reason: '' };
  }
  const m = t.match(new RegExp(`^(no|n|reject|rejected|لا|رفض)${END}[\\s:,.\\-–—]*([\\s\\S]*)$`, 'i'));
  if (m) return { decision: 'REJECTED', reason: m[2].trim() || '(no reason given)' };
  return { decision: null, reason: '' };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { tgApprovalText, tgParseReply };
}
