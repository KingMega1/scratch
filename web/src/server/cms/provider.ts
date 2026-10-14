import 'server-only';
import { showDrafts } from '@/lib/deploy-env';
import type { Locale } from '@/lib/i18n/config';

/* CMS boundary for editorial content ONLY: News, Guides, Insights.
   Never in CMS: vehicle facts (GitHub registry), recommendation rules (P1), customer identity (identity service).
   S1: in-repo stub provider (STUB_CONTENT). S2: headless CMS adapter implementing the same interface,
   with editorial workflow, scheduled publish and preview tokens (server-only CMS_API_TOKEN). */

export type ContentType = 'news' | 'guide' | 'insight';
export interface ContentItem {
  slug: string;
  type: ContentType;
  status: 'published' | 'draft';
  publishedAt: string | null;
  title: Record<Locale, string>;
  summary: Record<Locale, string>;
  body: Record<Locale, string[]>;
  relatedModelIds: string[]; // references into the vehicle registry by stable ID; no vehicle facts copied in
  tags: string[];
}

export interface ContentProvider {
  list(opts?: { type?: ContentType; includeDrafts?: boolean }): Promise<ContentItem[]>;
  get(slug: string): Promise<ContentItem | null>;
  relatedTo(modelId: string): Promise<ContentItem[]>;
}

/* Placeholder editorial items for layout review. status 'draft': rendered with a visible "Draft" tag,
   excluded from sitemap, noindex. They state no vehicle prices or specs. */
const STUB_CONTENT: ContentItem[] = [
  {
    slug: 'official-vs-listing-prices', type: 'insight', status: 'draft', publishedAt: null, relatedModelIds: [], tags: ['prices', 'methodology'],
    title: { ar: 'ليه سعر الوكيل غير سعر الإعلانات', en: 'Why official and listing prices differ' },
    summary: { ar: 'الفرق بين الرقمين معناه إيه بالنسبالك.', en: 'What the gap between the two numbers means for you.' },
    body: {
      ar: ['السعر الرسمي هو اللي الوكيل بينشره للفئة. سعر الإعلانات هو اللي معروض في مواقع البيع، وممكن يكون أعلى أو أقل.', 'عشان كده بنكتب حالة السعر جنب كل رقم، ومش بنخلط بين الاتنين.'],
      en: ['The official price is what the distributor publishes for a version. A listing price is what sellers advertise, and it can be higher or lower.', 'That is why every figure on CarIndex carries its state, and we never mix the two.'],
    },
  },
  {
    slug: 'before-you-set-a-budget', type: 'guide', status: 'draft', publishedAt: null, relatedModelIds: [], tags: ['budget'],
    title: { ar: 'قبل ما تحدد ميزانيتك', en: 'Before you set a budget' },
    summary: { ar: 'أسئلة بسيطة توفّر عليك وقت في المعارض.', en: 'Simple questions that save you time at the showroom.' },
    body: {
      ar: ['حدد إذا كان الرقم ده أقصى حاجة ولا في حدوده. واسأل نفسك هتسوق فين أكتر: في المدينة ولا مشاوير طويلة.', 'وبعد كده قارن الفئات، مش بس الموديلات.'],
      en: ['Decide whether the number is a hard maximum or a target. Then ask where you will drive most: city traffic or long trips.', 'After that, compare versions, not just models.'],
    },
  },
  {
    slug: 'reading-registrations', type: 'insight', status: 'draft', publishedAt: null, relatedModelIds: [], tags: ['market'],
    title: { ar: 'التسجيلات بتقولك إيه', en: 'What registration numbers tell you' },
    summary: { ar: 'إزاي تقرا أرقام التسجيل من غير ما تتلخبط.', en: 'How to read registration numbers without being misled.' },
    body: {
      ar: ['التسجيلات بتوريك العربيات اللي الناس اشترتها فعلًا، مش اللي معروضة بس.', 'رقم عالي معناه انتشار، مش بالضرورة إن العربية تناسبك.'],
      en: ['Registrations show what people actually bought, not just what is on sale.', 'A high number means a car is common, not that it suits you.'],
    },
  },
];

class StubContentProvider implements ContentProvider {
  async list(opts: { type?: ContentType; includeDrafts?: boolean } = {}) {
    return STUB_CONTENT.filter(c => (!opts.type || c.type === opts.type) && (showDrafts() && opts.includeDrafts === true || c.status === 'published'));
  }
  async get(slug: string) { return STUB_CONTENT.find(c => c.slug === slug && (showDrafts() || c.status === 'published')) ?? null; }
  async relatedTo(modelId: string) { return STUB_CONTENT.filter(c => (showDrafts() || c.status === 'published') && (c.relatedModelIds.includes(modelId) || c.tags.includes('prices'))); }
}

let provider: ContentProvider | null = null;
export const content = (): ContentProvider => (provider ??= new StubContentProvider());
