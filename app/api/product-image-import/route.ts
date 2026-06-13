import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabaseAdmin';
import { BUSINESS } from '@/lib/business';
import { safeFileName } from '@/lib/format';

async function getAdminUserEmail(request: Request) {
  const supabaseAdmin = createSupabaseAdmin();
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user?.email || null;
}

function extensionFromContentType(contentType: string) {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return 'jpg';
}

export async function POST(request: Request) {
  const supabaseAdmin = createSupabaseAdmin();
  const email = await getAdminUserEmail(request);
  if (email !== BUSINESS.adminEmail) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const imageUrl = String(body?.imageUrl || '').trim();
  const productName = String(body?.productName || 'perfume').trim();

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid image URL.' }, { status: 400 });
  }

  if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: 'Image URL must start with http or https.' }, { status: 400 });
  }

  const imageResponse = await fetch(parsedUrl.toString(), {
    headers: {
      'User-Agent': 'DeesScentryProductImporter/1.0'
    }
  });

  if (!imageResponse.ok) {
    return NextResponse.json({ error: 'Could not download that image. Try another image or upload manually.' }, { status: 400 });
  }

  const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    return NextResponse.json({ error: 'The selected URL is not an image.' }, { status: 400 });
  }

  const arrayBuffer = await imageResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.byteLength > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image is too large. Please use an image under 5MB.' }, { status: 400 });
  }

  const extension = extensionFromContentType(contentType);
  const path = `${Date.now()}-${safeFileName(productName || 'perfume')}.${extension}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('product-images')
    .upload(path, buffer, {
      cacheControl: '3600',
      contentType,
      upsert: false
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data } = supabaseAdmin.storage.from('product-images').getPublicUrl(path);
  return NextResponse.json({ imageUrl: data.publicUrl });
}
