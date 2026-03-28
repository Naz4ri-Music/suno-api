import { NextRequest, NextResponse } from 'next/server';
import { missingSunoCookieResponse, resolveSunoCookie } from '@/lib/apiAuth';
import { corsHeaders } from '@/lib/utils';
import { AudioToAudioMode, sunoApi } from '@/lib/SunoApi';

export const dynamic = 'force-dynamic';

const validModes: AudioToAudioMode[] = ['cover', 'add_vocals', 'add_instrumental'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode = body.mode as AudioToAudioMode;

    if (!body.clip_id) {
      return new NextResponse(JSON.stringify({ error: 'Missing clip_id' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    if (!validModes.includes(mode)) {
      return new NextResponse(
        JSON.stringify({ error: 'mode must be one of: cover, add_vocals, add_instrumental' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    const sunoCookie = resolveSunoCookie(req, body);
    if (!sunoCookie)
      return missingSunoCookieResponse();

    const response = await (await sunoApi(sunoCookie)).generateFromAudio(body.clip_id, mode, {
      prompt: body.prompt,
      title: body.title,
      tags: body.tags,
      negative_tags: body.negative_tags,
      model: body.model,
      wait_audio: Boolean(body.wait_audio),
      workspace_id: body.workspace_id,
      workspace_name: body.workspace_name,
      vocal_gender: body.vocal_gender
    });

    return new NextResponse(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error: any) {
    console.error('Error generating from audio:', error);

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
