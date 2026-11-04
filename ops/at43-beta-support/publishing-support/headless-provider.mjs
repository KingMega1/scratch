// Matches existing P5 ContentProvider methods; server-only integration required.
// Caller owns fetch caching/revalidation and endpoint configuration.
export class HeadlessContentProvider {
  constructor(endpoint, request = fetch) {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname))) throw Error('HTTPS CMS endpoint required');
    if (url.username || url.password || url.search || url.hash) throw Error('credentials/query forbidden in CMS URL');
    this.endpoint = url.toString();
    this.request = request;
  }
  async list(opts = {}) {
    const response = await this.request(this.endpoint, {redirect:'error', cache:'no-store', signal:AbortSignal.timeout(5000)});
    if (!response.ok) throw Error('CMS unavailable');
    const text = await response.text();
    if (new TextEncoder().encode(text).length > 2000000) throw Error('CMS response too large');
    const body = JSON.parse(text);
    if (body.schema !== 'carindex.editorial.content/v1' || !Array.isArray(body.items)) throw Error('invalid CMS envelope');
    const published = body.items.filter(item => item.status === 'published');
    for (const item of published) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) || !['news','guide','insight'].includes(item.type)
          || !Number.isFinite(Date.parse(item.publishedAt)) || Date.parse(item.publishedAt) > Date.now()
          || !Array.isArray(item.relatedModelIds) || !item.relatedModelIds.every(x => typeof x === 'string')
          || !Array.isArray(item.tags) || !item.tags.every(x => typeof x === 'string')) throw Error('invalid CMS item');
      for (const locale of ['ar','en']) {
        if (typeof item.title?.[locale] !== 'string' || !item.title[locale].trim()
            || typeof item.summary?.[locale] !== 'string' || !item.summary[locale].trim()
            || !Array.isArray(item.body?.[locale]) || !item.body[locale].length
            || !item.body[locale].every(x => typeof x === 'string' && x.trim())) throw Error('bilingual CMS content required');
      }
    }
    return published.filter(item => !opts.type || opts.type === item.type);
  }
  async get(slug) { return (await this.list()).find(item => item.slug === slug) ?? null; }
  async relatedTo(modelId) { return (await this.list()).filter(item => item.relatedModelIds.includes(modelId)); }
}
