import { NextRequest, NextResponse } from 'next/server';
import { missingSunoCookieResponse, resolveSunoCookie } from '@/lib/apiAuth';
import { corsHeaders } from '@/lib/utils';
import {
  createUploadFileWork,
  getUploadFileWork,
  runUploadFileWorkflow
} from '@/lib/uploadFileWorkflow';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const workId = url.searchParams.get('work_id');

    if (!workId) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing query parameter work_id' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    const work = await getUploadFileWork(workId);
    if (!work) {
      return new NextResponse(
        JSON.stringify({ error: `Upload work not found: ${workId}` }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    return new NextResponse(JSON.stringify(work), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error: any) {
    console.error('Error reading upload work:', error);

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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing form-data file field' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }

    const sunoCookie = resolveSunoCookie(req, formData);
    if (!sunoCookie)
      return missingSunoCookieResponse();

    const workspaceId =
      String(formData.get('workspace_id') || '').trim() || undefined;
    const workspaceName =
      String(formData.get('workspace_name') || '').trim() || undefined;
    const title = String(formData.get('title') || '').trim() || undefined;
    const imageUrl = String(formData.get('image_url') || '').trim() || undefined;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const work = await createUploadFileWork({
      filename: file.name,
      content_type: file.type || undefined,
      file_size: file.size,
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      title,
      image_url: imageUrl
    });

    setImmediate(() => {
      void runUploadFileWorkflow({
        workId: work.work_id,
        sunoCookie,
        fileBuffer,
        filename: file.name,
        contentType: file.type || undefined,
        workspaceId,
        workspaceName,
        title,
        imageUrl
      });
    });

    const statusUrl = new URL(req.url);
    statusUrl.search = '';
    statusUrl.searchParams.set('work_id', work.work_id);

    return new NextResponse(
      JSON.stringify({
        work_id: work.work_id,
        status: work.status,
        status_url: statusUrl.toString()
      }),
      {
        status: 202,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  } catch (error: any) {
    console.error('Error creating upload work:', error);

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
