import { NextRequest, NextResponse } from 'next/server';
import { missingSunoCookieResponse, resolveSunoCookie } from '@/lib/apiAuth';
import { corsHeaders } from '@/lib/utils';
import { sunoApi } from '@/lib/SunoApi';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawClipIds = body.clip_ids ?? body.clip_id;
    const clipIds = Array.isArray(rawClipIds)
      ? rawClipIds
      : typeof rawClipIds === 'string'
        ? rawClipIds.split(',').map((clipId: string) => clipId.trim()).filter(Boolean)
        : [];

    if (clipIds.length === 0) {
      return new NextResponse(JSON.stringify({ error: 'Missing clip_ids or clip_id' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    if (!body.workspace_id && !body.workspace_name) {
      return new NextResponse(
        JSON.stringify({ error: 'workspace_id or workspace_name is required' }),
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

    const response = await (await sunoApi(sunoCookie)).moveClipsToWorkspace(
      clipIds,
      body.workspace_id,
      body.workspace_name
    );

    return new NextResponse(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error: any) {
    console.error('Error moving clips to workspace:', error);

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
