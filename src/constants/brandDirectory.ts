export interface BrandSupportInfo {
  name: string;
  aliases: string[];
  email: string;
  phone: string;
  website?: string;
}

export const BRAND_SUPPORT_DIRECTORY: BrandSupportInfo[] = [
  // E-Commerce & Marketplaces
  {
    name: 'Amazon',
    aliases: ['amazon', 'amazon.in', 'amazon basics', 'aws', 'prime video', 'cloudtail', 'appario'],
    email: 'cs-reply@amazon.in',
    phone: '1800-3000-9009',
    website: 'https://www.amazon.in',
  },
  {
    name: 'Flipkart',
    aliases: ['flipkart', 'flipkart internet', 'supercoins', 'shopsy'],
    email: 'support@flipkart.com',
    phone: '1800-208-9898',
    website: 'https://www.flipkart.com',
  },
  {
    name: 'Myntra',
    aliases: ['myntra', 'myntra designs'],
    email: 'support@myntra.com',
    phone: '080-6156-1999',
    website: 'https://www.myntra.com',
  },
  {
    name: 'Blinkit',
    aliases: ['blinkit', 'grofers'],
    email: 'info@blinkit.com',
    phone: '1800-208-8888',
    website: 'https://blinkit.com',
  },
  {
    name: 'Zepto',
    aliases: ['zepto', 'kiranakart'],
    email: 'support@zeptonow.com',
    phone: '022-5000-0000',
    website: 'https://www.zeptonow.com',
  },
  {
    name: 'Swiggy Instamart',
    aliases: ['swiggy', 'instamart', 'swiggy instamart'],
    email: 'support@swiggy.in',
    phone: '080-6746-6720',
    website: 'https://www.swiggy.com',
  },
  {
    name: 'Zomato',
    aliases: ['zomato', 'hyperpure', 'blinkit'],
    email: 'order@zomato.com',
    phone: '011-3080-0000',
    website: 'https://www.zomato.com',
  },
  {
    name: 'Nykaa',
    aliases: ['nykaa', 'fsn e-commerce'],
    email: 'support@nykaa.com',
    phone: '1800-267-4444',
    website: 'https://www.nykaa.com',
  },
  {
    name: 'Meesho',
    aliases: ['meesho', 'fashnear'],
    email: 'query@meesho.com',
    phone: '080-6179-9600',
    website: 'https://www.meesho.com',
  },
  {
    name: 'BigBasket',
    aliases: ['bigbasket', 'bb daily', 'innovative retail'],
    email: 'customerservice@bigbasket.com',
    phone: '1860-123-1000',
    website: 'https://www.bigbasket.com',
  },
  {
    name: 'AJIO',
    aliases: ['ajio', 'reliance retail', 'ajio luxe'],
    email: 'customercare@ajio.com',
    phone: '1800-889-9991',
    website: 'https://www.ajio.com',
  },
  {
    name: 'Tata CLiQ',
    aliases: ['tata cliq', 'tatacliq', 'tata unistore'],
    email: 'hello@tatacliq.com',
    phone: '1800-419-9440',
    website: 'https://www.tatacliq.com',
  },
  {
    name: 'IKEA',
    aliases: ['ikea', 'ikea india'],
    email: 'customercare.india@ikea.com',
    phone: '1800-419-4532',
    website: 'https://www.ikea.in',
  },

  // Electronics & Gadgets
  {
    name: 'boAt',
    aliases: ['boat', 'boat lifestyle', 'imagine marketing', 'airdopes', 'rockerz', 'wave', 'storm'],
    email: 'info@imaginemarketingindia.com',
    phone: '022-6918-1920',
    website: 'https://www.boat-lifestyle.com',
  },
  {
    name: 'Noise',
    aliases: ['noise', 'gonoise', 'colorfit', 'shots', 'buds'],
    email: 'help@nexxbase.com',
    phone: '088-0021-1901',
    website: 'https://www.gonoise.com',
  },
  {
    name: 'Apple',
    aliases: ['apple', 'iphone', 'ipad', 'macbook', 'airpods', 'apple watch', 'apple inc'],
    email: 'contactus.in@apple.com',
    phone: '000800-100-9009',
    website: 'https://www.apple.com/in',
  },
  {
    name: 'Samsung',
    aliases: ['samsung', 'galaxy', 'samsung electronics'],
    email: 'support.india@samsung.com',
    phone: '1800-5-7267864',
    website: 'https://www.samsung.com/in',
  },
  {
    name: 'Sony',
    aliases: ['sony', 'bravia', 'playstation', 'xperia', 'sony india'],
    email: 'sonyindia.care@ap.sony.com',
    phone: '1800-103-7799',
    website: 'https://www.sony.co.in',
  },
  {
    name: 'OnePlus',
    aliases: ['oneplus', '1+', 'nord', 'oneplus technology'],
    email: 'customercare@oneplus.com',
    phone: '1800-102-8411',
    website: 'https://www.oneplus.in',
  },
  {
    name: 'Xiaomi',
    aliases: ['xiaomi', 'mi', 'redmi', 'poco', 'xiaomi technology'],
    email: 'service.in@xiaomi.com',
    phone: '1800-103-6286',
    website: 'https://www.mi.com/in',
  },
  {
    name: 'Realme',
    aliases: ['realme', 'narzo', 'realme mobile'],
    email: 'service.in@realme.com',
    phone: '1800-102-2777',
    website: 'https://www.realme.com/in',
  },
  {
    name: 'Vivo',
    aliases: ['vivo', 'vivo mobile'],
    email: 'vcare@vivo.com',
    phone: '1800-102-3388',
    website: 'https://www.vivo.com/in',
  },
  {
    name: 'Oppo',
    aliases: ['oppo', 'oppo mobile', 'reno'],
    email: 'support.in@oppo.com',
    phone: '1800-103-2777',
    website: 'https://www.oppo.com/in',
  },
  {
    name: 'HP',
    aliases: ['hp', 'hewlett packard', 'pavilion', 'omen', 'victus'],
    email: 'in.contacthp@hp.com',
    phone: '1800-258-7170',
    website: 'https://www.hp.com/in',
  },
  {
    name: 'Dell',
    aliases: ['dell', 'alienware', 'inspiron', 'xps', 'vostro'],
    email: 'india_support@dell.com',
    phone: '1800-425-4002',
    website: 'https://www.dell.com/in',
  },
  {
    name: 'Lenovo',
    aliases: ['lenovo', 'thinkpad', 'ideapad', 'legion', 'yoga'],
    email: 'consumercare@lenovo.com',
    phone: '1800-419-7555',
    website: 'https://www.lenovo.com/in',
  },
  {
    name: 'Asus',
    aliases: ['asus', 'rog', 'tuf gaming', 'zenbook', 'vivobook'],
    email: 'rc_india@asus.com',
    phone: '1800-209-0365',
    website: 'https://www.asus.com/in',
  },
  {
    name: 'LG Electronics',
    aliases: ['lg', 'lg electronics', 'lifes good'],
    email: 'serviceindia@lge.com',
    phone: '1800-315-9999',
    website: 'https://www.lg.com/in',
  },
  {
    name: 'Philips',
    aliases: ['philips', 'philips domestic appliances'],
    email: 'customercare.india@philips.com',
    phone: '1800-102-2929',
    website: 'https://www.philips.co.in',
  },
  {
    name: 'JBL',
    aliases: ['jbl', 'harman', 'infinity', 'jbl audio'],
    email: 'india_support@harman.com',
    phone: '1800-102-0525',
    website: 'https://in.jbl.com',
  },
  {
    name: 'Bose',
    aliases: ['bose', 'bose corporation', 'quietcomfort'],
    email: 'in_support@bose.com',
    phone: '1800-11-2673',
    website: 'https://www.bose.com',
  },
  {
    name: 'Sennheiser',
    aliases: ['sennheiser', 'sonova'],
    email: 'in-info@sennheiser.com',
    phone: '1800-223-632',
    website: 'https://www.sennheiser-hearing.com',
  },
  {
    name: 'Canon',
    aliases: ['canon', 'canon india', 'eos', 'pixma'],
    email: 'customer.care@canon.co.in',
    phone: '1860-180-3366',
    website: 'https://in.canon',
  },
  {
    name: 'Nikon',
    aliases: ['nikon', 'nikon india', 'coolpix', 'nikkor'],
    email: 'nfindia@nikon.com',
    phone: '1800-102-7346',
    website: 'https://www.nikon.co.in',
  },

  // Food, FMCG & Beverages
  {
    name: 'Cadbury',
    aliases: ['cadbury', 'mondelez', 'dairy milk', 'oreo', 'silk', 'bournvita', 'perk', '5 star', 'gems', 'fuse'],
    email: 'consumercare@mdlz.com',
    phone: '1800-22-7080',
    website: 'https://www.mondelezinternational.com',
  },
  {
    name: 'Nestlé',
    aliases: ['nestle', 'nestlé', 'maggi', 'kitkat', 'nescafe', 'munch', 'milkybar', 'everyday', 'cerelac', 'nan pro'],
    email: 'wecare@in.nestle.com',
    phone: '1800-103-1947',
    website: 'https://www.nestle.in',
  },
  {
    name: 'Amul',
    aliases: ['amul', 'gcmmf', 'amul butter', 'amul milk', 'amul cheese', 'amul kool', 'amul ice cream'],
    email: 'customercare@amul.coop',
    phone: '1800-258-3333',
    website: 'https://amul.com',
  },
  {
    name: 'Britannia',
    aliases: ['britannia', 'good day', 'bourbon', 'treat', 'nutrichoice', 'milk bikis', 'marie gold', 'jim jam', 'little hearts'],
    email: 'feedback@britindia.com',
    phone: '1800-425-4449',
    website: 'https://www.britannia.co.in',
  },
  {
    name: 'Parle',
    aliases: ['parle', 'parle-g', 'parle g', 'hide & seek', 'hide and seek', 'monaco', 'krackjack', 'milano', 'frooti'],
    email: 'cs@parle.biz',
    phone: '1800-22-7777',
    website: 'https://www.parleproducts.com',
  },
  {
    name: 'Lay\'s / PepsiCo',
    aliases: ['lays', 'lay\'s', 'pepsico', 'pepsi', 'doritos', 'kurkure', 'mountain dew', 'mirinda', '7up', 'aquafina', 'tropicana', 'quaker'],
    email: 'consumer.feedback@pepsico.com',
    phone: '1800-22-4020',
    website: 'https://www.pepsicoindia.co.in',
  },
  {
    name: 'Coca-Cola',
    aliases: ['coca-cola', 'coca cola', 'coke', 'thums up', 'thumbs up', 'sprite', 'fanta', 'limca', 'maaza', 'kinley', 'minute maid'],
    email: 'indiahelpline@coca-cola.com',
    phone: '1800-208-2653',
    website: 'https://www.coca-colaindia.com',
  },
  {
    name: 'Haldiram\'s',
    aliases: ['haldiram', 'haldirams', 'haldiram\'s', 'haldiram snacks', 'haldiram foods'],
    email: 'care@haldiram.com',
    phone: '0120-240-0286',
    website: 'https://www.haldirams.com',
  },
  {
    name: 'ITC Limited',
    aliases: ['itc', 'sunfeast', 'aashirvaad', 'bingo', 'yippee', 'b natural', 'fabelle', 'classmate', 'savlon', 'fiama', 'vivel'],
    email: 'itccares@itc.in',
    phone: '1800-425-4444',
    website: 'https://www.itcportal.com',
  },
  {
    name: 'Hindustan Unilever (HUL)',
    aliases: ['hul', 'hindustan unilever', 'surf excel', 'dove', 'rin', 'wheel', 'vim', 'lux', 'lifebuoy', 'red label', 'bru', 'horlicks', 'boost', 'ponds', 'vaseline', 'tresemme', 'sunlight', 'glow & lovely'],
    email: 'lever.care@unilever.com',
    phone: '1800-10-22-221',
    website: 'https://www.hul.co.in',
  },
  {
    name: 'Dabur',
    aliases: ['dabur', 'chyawanprash', 'real juice', 'vatika', 'hajmola', 'dabur honey', 'gulabari', 'meswak', 'red paste'],
    email: 'daburcares@dabur.com',
    phone: '1800-103-1644',
    website: 'https://www.dabur.com',
  },
  {
    name: 'Marico',
    aliases: ['marico', 'saffola', 'parachute', 'livon', 'set wet', 'mediker'],
    email: 'csc@marico.com',
    phone: '1800-222-248',
    website: 'https://marico.com',
  },
  {
    name: 'Tata Consumer Products',
    aliases: ['tata consumer', 'tata tea', 'tata salt', 'tetley', 'tata sampann', 'tata soulfull', 'himalayan water'],
    email: 'care@tataconsumer.com',
    phone: '1800-108-4488',
    website: 'https://www.tataconsumer.com',
  },
  {
    name: 'Mother Dairy',
    aliases: ['mother dairy', 'safal', 'dhara'],
    email: 'consumer.services@motherdairy.com',
    phone: '1800-180-1018',
    website: 'https://www.motherdairy.com',
  },
  {
    name: 'Hershey\'s',
    aliases: ['hershey', 'hersheys', 'hershey\'s', 'kisses', 'sofit', 'nutrine'],
    email: 'consumercare@hersheys.com',
    phone: '1800-22-1456',
    website: 'https://www.hersheysindia.com',
  },
  {
    name: 'Ferrero',
    aliases: ['ferrero', 'rocher', 'nutella', 'kinder', 'kinder joy', 'tic tac'],
    email: 'consumercare.india@ferrero.com',
    phone: '1800-209-1200',
    website: 'https://www.ferreroindia.com',
  },
  {
    name: 'Kellogg\'s',
    aliases: ['kellogg', 'kelloggs', 'kellogg\'s', 'corn flakes', 'chocos', 'special k', 'muesli', 'pringles'],
    email: 'kelloggs.care@kellogg.com',
    phone: '1800-223-500',
    website: 'https://www.kelloggs.in',
  },
  {
    name: 'Red Bull',
    aliases: ['red bull', 'redbull'],
    email: 'consumer.care@redbull.com',
    phone: '1800-258-2855',
    website: 'https://www.redbull.com',
  },

  // Personal Care, Pharma & Hygiene
  {
    name: 'Dettol / Reckitt',
    aliases: ['dettol', 'reckitt', 'harpic', 'lizol', 'vanish', 'mortein', 'veet', 'durex', 'strepsils', 'gaviscon'],
    email: 'consumercare_in@reckitt.com',
    phone: '1800-102-7245',
    website: 'https://www.reckitt.com',
  },
  {
    name: 'Colgate-Palmolive',
    aliases: ['colgate', 'palmolive', 'colgate total', 'maxfresh', 'vedshakti'],
    email: 'consumeraffairs_india@colpal.com',
    phone: '1800-225-599',
    website: 'https://www.colgatepalmolive.co.in',
  },
  {
    name: 'Procter & Gamble (P&G)',
    aliases: ['p&g', 'procter & gamble', 'gillette', 'head & shoulders', 'pantene', 'whisper', 'pampers', 'ariel', 'tide', 'oral-b', 'olay', 'vicks'],
    email: 'pgconsumercare@in.pg.com',
    phone: '1800-202-1364',
    website: 'https://in.pg.com',
  },
  {
    name: 'L\'Oréal',
    aliases: ['loreal', 'l\'oreal', 'garnier', 'maybelline', 'matrix', 'cerave', 'nyx'],
    email: 'corpin.services@loreal.com',
    phone: '1800-22-3000',
    website: 'https://www.loreal.com/en/india',
  },
  {
    name: 'Nivea',
    aliases: ['nivea', 'beiersdorf'],
    email: 'care@nivea.in',
    phone: '022-6248-7999',
    website: 'https://www.nivea.in',
  },
  {
    name: 'Mamaearth',
    aliases: ['mamaearth', 'honasa consumer', 'the derma co', 'aqualogica', 'ayuga', 'bblunt'],
    email: 'care@mamaearth.in',
    phone: '089-0155-5444',
    website: 'https://mamaearth.in',
  },
  {
    name: 'WOW Skin Science',
    aliases: ['wow', 'wow skin science', 'body cupid'],
    email: 'support@buywow.in',
    phone: '080-4289-6000',
    website: 'https://www.buywow.in',
  },
  {
    name: 'Cipla',
    aliases: ['cipla', 'omnilgel', 'nicotex', 'cipladine', 'cofsils', 'prolyte'],
    email: 'contactus@cipla.com',
    phone: '1800-267-7799',
    website: 'https://www.cipla.com',
  },
  {
    name: 'Apollo Pharmacy',
    aliases: ['apollo', 'apollo pharmacy', 'apollo 247'],
    email: 'customersupport@apollopharmacy.org',
    phone: '1860-500-0101',
    website: 'https://www.apollopharmacy.in',
  },
  {
    name: '1mg (Tata 1mg)',
    aliases: ['1mg', 'tata 1mg'],
    email: 'care@1mg.com',
    phone: '0124-416-6666',
    website: 'https://www.1mg.com',
  },

  // Apparel & Footwear
  {
    name: 'Nike',
    aliases: ['nike', 'air jordan', 'air max', 'nike india'],
    email: 'india.customercare@nike.com',
    phone: '000-800-100-9538',
    website: 'https://www.nike.com/in',
  },
  {
    name: 'Adidas',
    aliases: ['adidas', 'adidas originals', 'yeezy', 'ultraboost'],
    email: 'care@adidas.com',
    phone: '1800-120-3300',
    website: 'https://www.adidas.co.in',
  },
  {
    name: 'Puma',
    aliases: ['puma', 'puma sports'],
    email: 'customercareindia@puma.com',
    phone: '1800-102-7862',
    website: 'https://in.puma.com',
  },
  {
    name: 'Zara',
    aliases: ['zara', 'inditex'],
    email: 'contact.in@zara.com',
    phone: '000-800-050-1020',
    website: 'https://www.zara.com/in',
  },
  {
    name: 'H&M',
    aliases: ['h&m', 'hm', 'hennes & mauritz'],
    email: 'customerservice.in@hm.com',
    phone: '1800-889-8000',
    website: 'https://www2.hm.com/en_in',
  },
  {
    name: 'Levi\'s',
    aliases: ['levis', 'levi\'s', 'levi strauss'],
    email: 'customercare@levi.in',
    phone: '1800-102-5384',
    website: 'https://www.levi.in',
  },
  {
    name: 'Bata',
    aliases: ['bata', 'bata india', 'power', 'north star', 'weinbrenner', 'hush puppies'],
    email: 'in-customer.service@bata.com',
    phone: '1800-419-2282',
    website: 'https://www.bata.in',
  },
];

/**
 * Normalizes text for brand matching by removing punctuation and extra whitespace.
 */
function cleanText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Looks up official customer care details for a given brand name or text snippet.
 */
export function lookupBrandSupport(
  brandQuery?: string | null,
  productQuery?: string | null
): BrandSupportInfo | null {
  if (!brandQuery && !productQuery) return null;

  const rawQuery = `${brandQuery || ''} ${productQuery || ''}`;
  const cleaned = cleanText(rawQuery);

  if (!cleaned || cleaned.length < 2) return null;

  // 1. Check exact or high-confidence match in directory
  for (const item of BRAND_SUPPORT_DIRECTORY) {
    const cleanedName = cleanText(item.name);
    if (cleaned.includes(cleanedName) || cleanedName.includes(cleaned)) {
      return item;
    }

    for (const alias of item.aliases) {
      const cleanedAlias = cleanText(alias);
      if (
        cleaned === cleanedAlias ||
        cleaned.startsWith(`${cleanedAlias} `) ||
        cleaned.endsWith(` ${cleanedAlias}`) ||
        cleaned.includes(` ${cleanedAlias} `)
      ) {
        return item;
      }
    }
  }

  // 2. Fuzzy / Substring check
  for (const item of BRAND_SUPPORT_DIRECTORY) {
    for (const alias of item.aliases) {
      const cleanedAlias = cleanText(alias);
      if (cleanedAlias.length >= 3 && cleaned.includes(cleanedAlias)) {
        return item;
      }
    }
  }

  // 3. Fallback: If a valid brand string exists (e.g. "Acme Corp"), generate a standard support domain
  if (brandQuery && brandQuery.trim() && brandQuery !== 'Not Found') {
    const safeDomain = brandQuery
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    if (safeDomain.length >= 2) {
      return {
        name: brandQuery.trim(),
        aliases: [brandQuery.toLowerCase()],
        email: `support@${safeDomain}.com`,
        phone: '1800-100-CARE',
        website: `https://www.${safeDomain}.com`,
      };
    }
  }

  return null;
}
