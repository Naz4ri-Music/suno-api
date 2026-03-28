import { NextRequest, NextResponse } from 'next/server';
import { missingSunoCookieResponse, resolveSunoCookie } from '@/lib/apiAuth';
import { corsHeaders } from '@/lib/utils';
import { sunoApi } from '@/lib/SunoApi';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return new NextResponse(JSON.stringify({ error: 'Missing form-data file field' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const waitAudioValue = String(formData.get('wait_audio') ?? 'true').toLowerCase();
    const waitAudio = waitAudioValue !== 'false' && waitAudioValue !== '0';
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const sunoCookie = resolveSunoCookie(req, formData);
    if (!sunoCookie)
      return missingSunoCookieResponse();

    const uploadedAudio = await (await sunoApi(sunoCookie)).uploadAudio(
      fileBuffer,
      file.name,
      file.type || undefined,
      waitAudio
    );

    return new NextResponse(JSON.stringify(uploadedAudio), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error: any) {
    console.error('Error uploading audio:', error);

    return new NextResponse(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders
  });
}
