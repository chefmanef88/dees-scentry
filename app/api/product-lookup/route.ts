import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabaseAdmin';
import { BUSINESS } from '@/lib/business';
import type { ProductCategory } from '@/lib/types';

type LookupSuggestion = {
  name: string;
  brand: string;
  category: ProductCategory;
  size_ml: number | null;
  fragrance_notes: string;
  description: string;
  source: string;
};

type ImageSuggestion = {
  title: string;
  thumbnail: string;
  original: string;
  source: string;
};

const KNOWN_PERFUMES: LookupSuggestion[] = [
  {
    name: 'Versace Bright Crystal',
    brand: 'Versace',
    category: 'Women',
    size_ml: 90,
    fragrance_notes: 'Top: yuzu, pomegranate, iced accord. Heart: peony, magnolia, lotus. Base: musk, amber, mahogany.',
    description: 'A fresh, luminous floral fragrance with fruity brightness, soft flowers, and a clean musky finish.',
    source: 'Built-in perfume guide'
  },
  {
    name: 'Dior Sauvage',
    brand: 'Dior',
    category: 'Men',
    size_ml: 100,
    fragrance_notes: 'Top: bergamot, pepper. Heart: lavender, Sichuan pepper, star anise, nutmeg. Base: ambroxan, vanilla, cedar.',
    description: 'A bold fresh-spicy masculine scent with crisp citrus, peppery warmth, and a strong ambroxan trail.',
    source: 'Built-in perfume guide'
  },
  {
    name: 'Bleu de Chanel',
    brand: 'Chanel',
    category: 'Men',
    size_ml: 100,
    fragrance_notes: 'Citrus, mint, pink pepper, grapefruit, ginger, incense, cedar, sandalwood, vetiver.',
    description: 'A clean woody-aromatic fragrance with fresh citrus, elegant woods, and versatile everyday appeal.',
    source: 'Built-in perfume guide'
  },
  {
    name: 'Baccarat Rouge 540',
    brand: 'Maison Francis Kurkdjian',
    category: 'Unisex',
    size_ml: 70,
    fragrance_notes: 'Saffron, jasmine, amberwood, ambergris, fir resin, cedar.',
    description: 'A luxurious amber-floral scent known for its airy sweetness, saffron warmth, and long-lasting trail.',
    source: 'Built-in perfume guide'
  },
  {
    name: 'Chanel No. 5',
    brand: 'Chanel',
    category: 'Women',
    size_ml: 100,
    fragrance_notes: 'Aldehydes, neroli, ylang-ylang, jasmine, rose, sandalwood, vetiver, vanilla.',
    description: 'An iconic floral-aldehydic perfume with elegant powdery florals and a classic sophisticated finish.',
    source: 'Built-in perfume guide'
  },
  {
    name: 'YSL Libre',
    brand: 'Yves Saint Laurent',
    category: 'Women',
    size_ml: 90,
    fragrance_notes: 'Lavender, mandarin, orange blossom, jasmine, vanilla, musk, cedar, ambergris.',
    description: 'A modern floral fragrance blending lavender freshness with orange blossom, vanilla, and warm musks.',
    source: 'Built-in perfume guide'
  },
  {
    name: 'Black Opium',
    brand: 'Yves Saint Laurent',
    category: 'Women',
    size_ml: 90,
    fragrance_notes: 'Coffee, pear, pink pepper, orange blossom, jasmine, vanilla, patchouli, cedar.',
    description: 'A warm sweet-gourmand scent with coffee, vanilla, white florals, and a seductive evening character.',
    source: 'Built-in perfume guide'
  },
  {
    name: 'Tom Ford Oud Wood',
    brand: 'Tom Ford',
    category: 'Unisex',
    size_ml: 100,
    fragrance_notes: 'Oud, rosewood, cardamom, sandalwood, vetiver, tonka bean, amber.',
    description: 'A refined woody unisex fragrance built around smooth oud, warm spices, and polished woods.',
    source: 'Built-in perfume guide'
  },
  {
    name: 'Carolina Herrera Good Girl',
    brand: 'Carolina Herrera',
    category: 'Women',
    size_ml: 80,
    fragrance_notes: 'Almond, coffee, tuberose, jasmine sambac, tonka bean, cacao, vanilla, sandalwood.',
    description: 'A bold sweet floral scent with almond, coffee, white flowers, and warm tonka-cocoa depth.',
    source: 'Built-in perfume guide'
  },
  {
    name: 'Lancôme La Vie Est Belle',
    brand: 'Lancôme',
    category: 'Women',
    size_ml: 100,
    fragrance_notes: 'Blackcurrant, pear, iris, jasmine, orange blossom, praline, vanilla, patchouli, tonka bean.',
    description: 'A popular sweet floral-gourmand perfume with pear, iris, praline, vanilla, and patchouli warmth.',
    source: 'Built-in perfume guide'
  },
  {
    name: 'Creed Aventus',
    brand: 'Creed',
    category: 'Men',
    size_ml: 100,
    fragrance_notes: 'Pineapple, bergamot, blackcurrant, apple, birch, jasmine, patchouli, musk, oakmoss, ambergris.',
    description: 'A powerful fruity-woody fragrance known for pineapple brightness, smoky birch, and masculine depth.',
    source: 'Built-in perfume guide'
  },
  {
    name: 'Versace Eros',
    brand: 'Versace',
    category: 'Men',
    size_ml: 100,
    fragrance_notes: 'Mint, green apple, lemon, tonka bean, ambroxan, geranium, vanilla, cedar, vetiver.',
    description: 'A vibrant sweet-fresh masculine scent with mint, apple, vanilla, and strong club-ready projection.',
    source: 'Built-in perfume guide'
  },
  {
    name: 'Paco Rabanne One Million',
    brand: 'Rabanne',
    category: 'Men',
    size_ml: 100,
    fragrance_notes: 'Blood mandarin, grapefruit, mint, cinnamon, rose, leather, amber, patchouli.',
    description: 'A sweet spicy-leather fragrance with bright citrus, cinnamon warmth, and a confident amber finish.',
    source: 'Built-in perfume guide'
  },
  {
    name: 'Paco Rabanne Invictus',
    brand: 'Rabanne',
    category: 'Men',
    size_ml: 100,
    fragrance_notes: 'Grapefruit, marine accord, bay leaf, jasmine, guaiac wood, oakmoss, patchouli, ambergris.',
    description: 'A sporty fresh-aquatic fragrance with grapefruit, marine notes, woods, and clean ambergris style.',
    source: 'Built-in perfume guide'
  },
  {
    name: 'Ariana Grande Cloud',
    brand: 'Ariana Grande',
    category: 'Women',
    size_ml: 100,
    fragrance_notes: 'Lavender, pear, bergamot, coconut, praline, vanilla orchid, musk, woods.',
    description: 'A soft sweet fragrance with airy coconut, praline, vanilla, lavender, and a creamy musky drydown.',
    source: 'Built-in perfume guide'
  }
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function guessSuggestion(name: string): LookupSuggestion {
  const normalized = normalize(name);
  const match = KNOWN_PERFUMES.find((item) => {
    const itemName = normalize(item.name);
    return itemName.includes(normalized) || normalized.includes(itemName) || normalized.split(' ').every((word) => itemName.includes(word));
  });

  if (match) return { ...match, name: match.name };

  const words = name.trim().split(/\s+/);
  const brand = words.length > 1 ? words[0] : '';
  return {
    name: name.trim(),
    brand,
    category: 'Unisex',
    size_ml: 100,
    fragrance_notes: '',
    description: `${name.trim()} from Dee's Scentry. Add the fragrance notes/composition after confirming the exact product.`,
    source: 'Basic generated draft'
  };
}

async function getAdminUserEmail(request: Request) {
  const supabaseAdmin = createSupabaseAdmin();
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user?.email || null;
}

async function getSerpImages(productName: string): Promise<ImageSuggestion[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];

  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_images');
  url.searchParams.set('q', `${productName} perfume bottle official`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('ijn', '0');
  url.searchParams.set('safe', 'active');

  const response = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!response.ok) return [];

  const data = await response.json();
  const results = Array.isArray(data.images_results) ? data.images_results : [];
  return results
    .slice(0, 8)
    .map((item: any) => ({
      title: String(item.title || productName),
      thumbnail: String(item.thumbnail || item.original || ''),
      original: String(item.original || item.thumbnail || ''),
      source: String(item.source || item.link || 'Google Images')
    }))
    .filter((item: ImageSuggestion) => item.thumbnail && item.original);
}

export async function POST(request: Request) {
  const email = await getAdminUserEmail(request);
  if (email !== BUSINESS.adminEmail) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = String(body?.name || '').trim();
  if (name.length < 2) {
    return NextResponse.json({ error: 'Enter a perfume name first.' }, { status: 400 });
  }

  const suggestion = guessSuggestion(name);
  const images = await getSerpImages(suggestion.name || name);

  return NextResponse.json({
    suggestion,
    images,
    imageSearchEnabled: Boolean(process.env.SERPAPI_KEY)
  });
}
