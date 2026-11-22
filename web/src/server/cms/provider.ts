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
  images?: { src: string; alt: Record<Locale, string> }[]; // first image is the card/cover image
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
    slug: 'xpeng-l03-egypt-launch', type: 'news', status: 'published', publishedAt: '2026-11-22', relatedModelIds: [], tags: ["xpeng", "launch", "prices"],
    title: { ar: "XPENG L03 وصلت مصر بسعر 1,750,000 جنيه", en: "XPENG L03 arrives in Egypt at EGP 1,750,000" },
    summary: { ar: "SUV كوبيه بمولّد مدى. سعر الفئة Premium والأرقام الأساسية.", en: "A range-extender coupe SUV. Premium price and key figures." },
    body: {
      ar: ["وصلت XPENG L03 مصر. هي SUV كوبيه بمولّد مدى: الموتور الكهربائي هو اللي بيحرّك العربية دايمًا، والمولّد بيشحن البطارية في المشاوير الطويلة.", "سعر الفئة Premium عند الإطلاق: 1,750,000 جنيه مصري. ده السعر المعلن من الموزّع.", "حسب كتيّب XPENG: المدى المجمّع 1,017 كم (WLTP)، والمدى بالكهربا فقط 215 كم (WLTP)، من 0 إلى 100 في 6.8 ثانية، والشحن السريع من 10 إلى 80% في 20 دقيقة أو أقل، وسعة الشنطة 539 لتر.", "أرقام الكتيّب عالمية، والمواصفات في مصر ممكن تختلف. هنأكد أي فرق ونحدّث الصفحة."],
      en: ["The XPENG L03 has arrived in Egypt. It is a coupe SUV with a range extender: the electric motor always drives the car, and the generator charges the battery on longer trips.", "Launch price for the Premium version: EGP 1,750,000, as announced by the distributor.", "Per the XPENG brochure: combined range 1,017 km (WLTP), electric-only range 215 km (WLTP), 0 to 100 km/h in 6.8 seconds, fast charging from 10 to 80% in 20 minutes or less, and a 539-litre trunk.", "The brochure figures are global, and Egyptian-market specifications may differ. We will confirm any difference and update this page."],
    },
    images: [{"src": "/media/news/xpeng-l03-1.jpg", "alt": {"ar": "XPENG L03 وصلت مصر", "en": "XPENG L03 arrives in Egypt"}}, {"src": "/media/news/xpeng-l03-2.jpg", "alt": {"ar": "سعر XPENG L03 Premium: 1,750,000 جنيه", "en": "XPENG L03 Premium price: EGP 1,750,000"}}, {"src": "/media/news/xpeng-l03-3.jpg", "alt": {"ar": "يعني إيه مولّد مدى", "en": "What a range extender means"}}, {"src": "/media/news/xpeng-l03-4.jpg", "alt": {"ar": "أرقام XPENG L03", "en": "XPENG L03 key figures"}}, {"src": "/media/news/xpeng-l03-5.jpg", "alt": {"ar": "رشّحلي عربية على CarIndexed", "en": "Find my car on CarIndexed"}}],
  },
  {
    slug: 'soueast-2027-egypt-prices', type: 'news', status: 'published', publishedAt: '2026-11-22', relatedModelIds: [], tags: ["soueast", "prices"],
    title: { ar: "أسعار Soueast في مصر 2027 وفئة S06 Highline Plus الجديدة", en: "Soueast Egypt 2027 prices and the new S06 Highline Plus" },
    summary: { ar: "كل الفئات من 1,090,000 لـ 1,849,000 جنيه، والضمان والصيانة.", en: "All versions from EGP 1,090,000 to 1,849,000, plus warranty and service." },
    body: {
      ar: ["أسعار Soueast في مصر لموديل 2027 بتبدأ من 1,090,000 جنيه لفئة S05 Highline، وبتوصل لـ 1,849,000 جنيه لفئة S08DM Intelligent الهجين.", "فئة جديدة في S06: Highline Plus بسعر 1,390,000 جنيه. أعلى من Highline (1,370,000) بـ 20,000 جنيه، وأقل من Premium (1,510,000) بـ 120,000 جنيه.", "بقية فئات البنزين: S07 Highline 1,415,000 وS07 Premium 1,555,000 وS09 Flagship 1,620,000 جنيه. الهجين القابل للشحن: S06DM Intelligent 1,689,000 وS08DM Intelligent 1,849,000 جنيه.", "الضمان: 6 سنين أو 150,000 كم للسيارة، و10 سنين أو 1,000,000 كم لموتور البنزين، و8 سنين أو 160,000 كم لبطارية الهجين. صيانة مجانية 4 سنين أو 60,000 كم لفترة محدودة. الشروط والأحكام تنطبق."],
      en: ["Soueast 2027 prices in Egypt start at EGP 1,090,000 for the S05 Highline and reach EGP 1,849,000 for the S08DM Intelligent plug-in hybrid.", "New S06 version: the Highline Plus at EGP 1,390,000. That is EGP 20,000 above the Highline (1,370,000) and EGP 120,000 below the Premium (1,510,000).", "Other petrol versions: S07 Highline 1,415,000, S07 Premium 1,555,000 and S09 Flagship 1,620,000. Plug-in hybrids: S06DM Intelligent 1,689,000 and S08DM Intelligent 1,849,000.", "Warranty: 6 years or 150,000 km for the car, 10 years or 1,000,000 km for the petrol engine, and 8 years or 160,000 km for the hybrid battery. Free service for 4 years or 60,000 km for a limited time. Terms and conditions apply."],
    },
    images: [{"src": "/media/news/soueast-2027-1.jpg", "alt": {"ar": "أسعار Soueast في مصر 2027", "en": "Soueast Egypt prices 2027"}}, {"src": "/media/news/soueast-2027-2.jpg", "alt": {"ar": "Soueast S06 Highline Plus فئة جديدة", "en": "Soueast S06 Highline Plus, new version"}}, {"src": "/media/news/soueast-2027-3.jpg", "alt": {"ar": "أسعار فئات البنزين", "en": "Petrol version prices"}}, {"src": "/media/news/soueast-2027-4.jpg", "alt": {"ar": "الهجين القابل للشحن", "en": "Plug-in hybrids"}}, {"src": "/media/news/soueast-2027-5.jpg", "alt": {"ar": "اختار حسب ميزانيتك", "en": "Choose by budget"}}, {"src": "/media/news/soueast-2027-6.jpg", "alt": {"ar": "الضمان والصيانة", "en": "Warranty and service"}}],
  },
  {
    slug: 'official-vs-listing-prices', type: 'insight', status: 'draft', publishedAt: null, relatedModelIds: [], tags: ['prices', 'methodology'],
    title: { ar: 'ليه سعر الوكيل غير سعر الإعلانات', en: 'Why official and listing prices differ' },
    summary: { ar: 'الفرق بين الرقمين معناه إيه بالنسبالك.', en: 'What the gap between the two numbers means for you.' },
    body: {
      ar: ['السعر الرسمي هو اللي الوكيل بينشره للفئة. سعر الإعلانات هو اللي معروض في مواقع البيع، وممكن يكون أعلى أو أقل.', 'عشان كده بنكتب حالة السعر جنب كل رقم، ومش بنخلط بين الاتنين.'],
      en: ['The official price is what the distributor publishes for a version. A listing price is what sellers advertise, and it can be higher or lower.', 'That is why every figure on CarIndexed carries its state, and we never mix the two.'],
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
