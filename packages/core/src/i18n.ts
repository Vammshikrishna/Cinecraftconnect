/**
 * Shared words for the screens people see most: navigation and sign-in.
 * English is the source. A missing word in another language falls back to English, so a screen is never blank.
 * The Hindi, Telugu and Tamil text needs a native-speaker review before release.
 */
export type Lang = 'en' | 'hi' | 'te' | 'ta';

export const LANGUAGES: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'te', label: 'తెలుగు' },
  { value: 'ta', label: 'தமிழ்' },
];

const en = {
  'nav.home': 'Home',
  'nav.search': 'Search',
  'nav.messages': 'Messages',
  'nav.notifications': 'Notifications',
  'nav.create': 'Create',
  'nav.projects': 'Projects',
  'nav.jobs': 'Jobs',
  'nav.pitch': 'Pitch',
  'nav.marketplace': 'Marketplace',
  'nav.network': 'Network',
  'nav.discussions': 'Discussions',
  'nav.pages': 'Pages',
  'nav.plans': 'Plans',
  'nav.payments': 'My payments',
  'nav.ratings': 'Ratings',
  'nav.announcements': 'Announcements',
  'nav.profile': 'Profile',
  'nav.more': 'More',
  'nav.showLabels': 'Show labels',
  'nav.hideLabels': 'Hide labels',
  'auth.signIn': 'Sign in',
  'auth.signUp': 'Create account',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.tooMany': 'Too many failed sign-in attempts. Try again in 15 minutes.',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.retry': 'Try again',
  'common.loading': 'Loading',
} as const;

export type I18nKey = keyof typeof en;

const hi: Partial<Record<I18nKey, string>> = {
  'nav.home': 'होम',
  'nav.search': 'खोजें',
  'nav.messages': 'संदेश',
  'nav.notifications': 'सूचनाएँ',
  'nav.create': 'बनाएँ',
  'nav.projects': 'प्रोजेक्ट',
  'nav.jobs': 'नौकरियाँ',
  'nav.pitch': 'पिच',
  'nav.marketplace': 'बाज़ार',
  'nav.network': 'नेटवर्क',
  'nav.discussions': 'चर्चाएँ',
  'nav.pages': 'पेज',
  'nav.plans': 'प्लान',
  'nav.payments': 'मेरे भुगतान',
  'nav.ratings': 'रेटिंग',
  'nav.announcements': 'घोषणाएँ',
  'nav.profile': 'प्रोफ़ाइल',
  'nav.more': 'और',
  'nav.showLabels': 'नाम दिखाएँ',
  'nav.hideLabels': 'नाम छिपाएँ',
  'auth.signIn': 'साइन इन करें',
  'auth.signUp': 'खाता बनाएँ',
  'auth.email': 'ईमेल',
  'auth.password': 'पासवर्ड',
  'auth.tooMany': 'साइन इन के बहुत ज़्यादा असफल प्रयास हुए। 15 मिनट बाद फिर कोशिश करें।',
  'common.save': 'सहेजें',
  'common.cancel': 'रद्द करें',
  'common.retry': 'फिर कोशिश करें',
  'common.loading': 'लोड हो रहा है',
};

const te: Partial<Record<I18nKey, string>> = {
  'nav.home': 'హోమ్',
  'nav.search': 'వెతకండి',
  'nav.messages': 'సందేశాలు',
  'nav.notifications': 'నోటిఫికేషన్లు',
  'nav.create': 'సృష్టించండి',
  'nav.projects': 'ప్రాజెక్టులు',
  'nav.jobs': 'ఉద్యోగాలు',
  'nav.pitch': 'పిచ్',
  'nav.marketplace': 'మార్కెట్',
  'nav.network': 'నెట్‌వర్క్',
  'nav.discussions': 'చర్చలు',
  'nav.pages': 'పేజీలు',
  'nav.plans': 'ప్లాన్‌లు',
  'nav.payments': 'నా చెల్లింపులు',
  'nav.ratings': 'రేటింగ్‌లు',
  'nav.announcements': 'ప్రకటనలు',
  'nav.profile': 'ప్రొఫైల్',
  'nav.more': 'మరిన్ని',
  'nav.showLabels': 'పేర్లు చూపించు',
  'nav.hideLabels': 'పేర్లు దాచు',
  'auth.signIn': 'సైన్ ఇన్',
  'auth.signUp': 'ఖాతా సృష్టించండి',
  'auth.email': 'ఇమెయిల్',
  'auth.password': 'పాస్‌వర్డ్',
  'auth.tooMany': 'సైన్ ఇన్ ప్రయత్నాలు చాలాసార్లు విఫలమయ్యాయి. 15 నిమిషాల తర్వాత మళ్లీ ప్రయత్నించండి.',
  'common.save': 'సేవ్ చేయండి',
  'common.cancel': 'రద్దు',
  'common.retry': 'మళ్లీ ప్రయత్నించండి',
  'common.loading': 'లోడ్ అవుతోంది',
};

const ta: Partial<Record<I18nKey, string>> = {
  'nav.home': 'முகப்பு',
  'nav.search': 'தேடு',
  'nav.messages': 'செய்திகள்',
  'nav.notifications': 'அறிவிப்புகள்',
  'nav.create': 'உருவாக்கு',
  'nav.projects': 'திட்டங்கள்',
  'nav.jobs': 'வேலைகள்',
  'nav.pitch': 'பிட்ச்',
  'nav.marketplace': 'சந்தை',
  'nav.network': 'நெட்வொர்க்',
  'nav.discussions': 'விவாதங்கள்',
  'nav.pages': 'பக்கங்கள்',
  'nav.ratings': 'மதிப்பீடுகள்',
  'nav.announcements': 'அறிவிப்புகள்',
  'nav.profile': 'சுயவிவரம்',
  'nav.more': 'மேலும்',
  'nav.showLabels': 'பெயர்களைக் காட்டு',
  'nav.hideLabels': 'பெயர்களை மறை',
  'auth.signIn': 'உள்நுழை',
  'auth.signUp': 'கணக்கை உருவாக்கு',
  'auth.email': 'மின்னஞ்சல்',
  'auth.password': 'கடவுச்சொல்',
  'auth.tooMany': 'பல முறை உள்நுழைவு தோல்வியடைந்தது. 15 நிமிடங்கள் கழித்து மீண்டும் முயற்சிக்கவும்.',
  'common.save': 'சேமி',
  'common.cancel': 'ரத்து செய்',
  'common.retry': 'மீண்டும் முயற்சி',
  'common.loading': 'ஏற்றுகிறது',
};

const DICTS: Record<Lang, Partial<Record<I18nKey, string>>> = { en, hi, te, ta };

/** Any saved value that is not a supported language (older choices such as Spanish) reads as English. */
const NAMES: Record<string, Lang> = { hindi: 'hi', telugu: 'te', tamil: 'ta', english: 'en' };

export const toLang = (value: unknown): Lang => {
  const v = String(value ?? '').toLowerCase();
  return v === 'hi' || v === 'te' || v === 'ta' ? v : NAMES[v] ?? 'en';
};

export const translate = (lang: Lang, key: I18nKey): string => DICTS[lang]?.[key] ?? en[key];
