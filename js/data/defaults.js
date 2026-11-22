export const DEFAULT_CONTENT = {
  site: {
    name: 'Para Engineer',
    owner: 'Raja Naufal Zhahir',
    license: 'MIT License',
    licenseUrl: 'https://opensource.org/licenses/MIT',
  },
  home: {
    headline: 'Hi, this is Para Engineer.',
    subtitle:
      'An independent digital brand by Raja Naufal Zhahir. Exploring technology, engineering, projects, and ideas — with two senior cat engineers supervising.',
    primaryCta: 'See projects',
    secondaryCta: 'About',
    projectsTitle: 'Featured Projects',
    projectsSubtitle: 'Things I built, shipped, and sometimes broke.',
  },
  about: {
    title: 'About',
    body:
      'I am Raja Naufal Zhahir — an engineering student who likes building things end to end: from the first sketch to something real people can open in a browser.\n\nPara Engineer is the place where those projects live. Some are polished, some are experiments, all of them taught me something.',
    quote: 'Build things from scratch, break them to understand why they work, and ship them anyway.',
    quoteAuthor: 'Personal engineering note',
    skills: ['Web development', 'Backend & APIs', 'Embedded & IoT', 'Open source'],
    photoUrl: '',
    photoPath: '',
  },
  socials: [
    { id: 'github', type: 'github', name: 'GitHub', url: 'https://github.com/taxcoding', showInContact: true },
    { id: 'linkedin', type: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com/in/raja-naufal-zhahir', showInContact: true },
    { id: 'instagram', type: 'instagram', name: 'Instagram', url: 'https://instagram.com/zhaa.raja', showInContact: false },
  ],
  contact: {
    email: 'raja.naufal1605@student.unri.ac.id',
    ctaTitle: 'Let’s connect',
    ctaText: 'Say hi, follow along, or send an idea.',
  },
};

export const CONTENT_KEYS = Object.keys(DEFAULT_CONTENT);

export function mergeContent(rows = {}) {
  const out = {};
  for (const k of CONTENT_KEYS) {
    const base = DEFAULT_CONTENT[k];
    const val = rows[k];
    out[k] = Array.isArray(base) ? (Array.isArray(val) ? val : base) : { ...base, ...(val && typeof val === 'object' ? val : {}) };
  }
  return out;
}

export const RATIOS = ['16:9', '4:3', '1:1'];
export const STATUSES = ['published', 'draft', 'archived'];
export const ratioValue = (r) => {
  const [a, b] = String(r || '16:9').split(':').map(Number);
  return a > 0 && b > 0 ? a / b : 16 / 9;
};
export const ratioCss = (r) => String(r || '16:9').replace(':', ' / ');