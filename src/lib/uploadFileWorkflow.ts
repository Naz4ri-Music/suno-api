import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { sleep } from '@/lib/utils';
import { sunoApi } from '@/lib/SunoApi';

type UploadFileWorkStatus = 'queued' | 'running' | 'completed' | 'failed';
type UploadFileStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

type UploadFileStepKey =
  | 'create_upload'
  | 'upload_storage'
  | 'upload_finish'
  | 'poll_upload'
  | 'initialize_clip'
  | 'set_metadata'
  | 'set_audio_description'
  | 'move_to_workspace';

type UploadFileWorkflowInput = {
  filename: string;
  content_type?: string;
  file_size: number;
  workspace_id?: string;
  workspace_name?: string;
  title?: string;
  image_url?: string;
};

type UploadFileWorkStep = {
  key: UploadFileStepKey;
  label: string;
  status: UploadFileStepStatus;
  started_at?: string;
  finished_at?: string;
  output?: any;
  error?: any;
};

export type UploadFileWork = {
  work_id: string;
  status: UploadFileWorkStatus;
  created_at: string;
  updated_at: string;
  input: UploadFileWorkflowInput;
  steps: UploadFileWorkStep[];
  result?: {
    upload?: any;
    initialized_clip?: any;
    clip?: any;
    workspace_move?: any;
  };
  error?: {
    step: UploadFileStepKey;
    detail: any;
  };
};

const resolveWorkDir = () => {
  const configuredDir = process.env.UPLOAD_FILE_WORK_DIR?.trim();
  if (configuredDir)
    return path.resolve(configuredDir);

  return path.resolve(process.cwd(), '.data', 'upload-file-works');
};

const WORK_DIR = resolveWorkDir();

const WORKFLOW_STEPS: Array<Pick<UploadFileWorkStep, 'key' | 'label'>> = [
  { key: 'create_upload', label: 'Create upload task' },
  { key: 'upload_storage', label: 'Upload file to storage' },
  { key: 'upload_finish', label: 'Finalize upload' },
  { key: 'poll_upload', label: 'Wait for Suno upload processing' },
  { key: 'initialize_clip', label: 'Initialize clip in account' },
  { key: 'set_metadata', label: 'Set clip metadata' },
  { key: 'set_audio_description', label: 'Accept inferred description' },
  { key: 'move_to_workspace', label: 'Move clip to workspace' }
];

const nowIso = () => new Date().toISOString();

const getWorkPath = (workId: string) =>
  path.join(WORK_DIR, `${workId}.json`);

async function ensureWorkDir() {
  await fs.mkdir(WORK_DIR, { recursive: true });
}

async function saveWork(work: UploadFileWork) {
  await ensureWorkDir();

  const workPath = getWorkPath(work.work_id);
  const tempPath = `${workPath}.${randomUUID()}.tmp`;

  await fs.writeFile(tempPath, JSON.stringify(work, null, 2), 'utf8');
  await fs.rename(tempPath, workPath);
}

export async function getUploadFileWork(
  workId: string
): Promise<UploadFileWork | null> {
  try {
    const raw = await fs.readFile(getWorkPath(workId), 'utf8');
    return JSON.parse(raw) as UploadFileWork;
  } catch (error: any) {
    if (error?.code === 'ENOENT')
      return null;

    throw error;
  }
}

async function updateWork(
  workId: string,
  updater: (work: UploadFileWork) => void
): Promise<UploadFileWork> {
  const work = await getUploadFileWork(workId);
  if (!work)
    throw new Error(`Upload work not found: ${workId}`);

  updater(work);
  work.updated_at = nowIso();
  await saveWork(work);
  return work;
}

function buildErrorDetail(error: any) {
  return {
    message: error?.message || 'Unknown error',
    status: error?.status || error?.response?.status,
    data: error?.response?.data,
    detail: error?.detail
  };
}

async function markStepStatus(
  workId: string,
  stepKey: UploadFileStepKey,
  status: UploadFileStepStatus,
  options: {
    output?: any;
    error?: any;
  } = {}
) {
  await updateWork(workId, work => {
    const step = work.steps.find(item => item.key === stepKey);
    if (!step)
      throw new Error(`Upload work step not found: ${stepKey}`);

    if (status === 'running' && !step.started_at)
      step.started_at = nowIso();

    if (status === 'completed' || status === 'failed' || status === 'skipped')
      step.finished_at = nowIso();

    step.status = status;

    if (options.output !== undefined)
      step.output = options.output;

    if (options.error !== undefined)
      step.error = options.error;
  });
}

async function setWorkState(
  workId: string,
  status: UploadFileWorkStatus,
  fields: Partial<UploadFileWork> = {}
) {
  await updateWork(workId, work => {
    work.status = status;
    Object.assign(work, fields);
  });
}

export async function createUploadFileWork(
  input: UploadFileWorkflowInput
): Promise<UploadFileWork> {
  const work: UploadFileWork = {
    work_id: randomUUID(),
    status: 'queued',
    created_at: nowIso(),
    updated_at: nowIso(),
    input,
    steps: WORKFLOW_STEPS.map(step => ({
      ...step,
      status: 'pending'
    }))
  };

  await saveWork(work);
  return work;
}

async function runTrackedStep<T>(
  workId: string,
  stepKey: UploadFileStepKey,
  action: () => Promise<T>
): Promise<T> {
  await markStepStatus(workId, stepKey, 'running');

  try {
    const output = await action();
    await markStepStatus(workId, stepKey, 'completed', { output });
    return output;
  } catch (error: any) {
    await markStepStatus(workId, stepKey, 'failed', {
      error: buildErrorDetail(error)
    });
    throw error;
  }
}

export async function runUploadFileWorkflow({
  workId,
  sunoCookie,
  fileBuffer,
  filename,
  contentType,
  workspaceId,
  workspaceName,
  title,
  imageUrl
}: {
  workId: string;
  sunoCookie: string;
  fileBuffer: Buffer;
  filename: string;
  contentType?: string;
  workspaceId?: string;
  workspaceName?: string;
  title?: string;
  imageUrl?: string;
}) {
  await setWorkState(workId, 'running');

  let failedStep: UploadFileStepKey = 'create_upload';

  try {
    const api = await sunoApi(sunoCookie);
    const extension = api.resolveAudioUploadExtension(filename, contentType);

    failedStep = 'create_upload';
    const uploadTask = await runTrackedStep(workId, 'create_upload', () =>
      api.createAudioUpload(extension)
    );

    failedStep = 'upload_storage';
    await runTrackedStep(workId, 'upload_storage', () =>
      api.uploadAudioToStorage(uploadTask, fileBuffer, filename, contentType)
    );

    failedStep = 'upload_finish';
    await runTrackedStep(workId, 'upload_finish', () =>
      api.finishAudioUpload(uploadTask.id, filename)
    );

    failedStep = 'poll_upload';
    await markStepStatus(workId, 'poll_upload', 'running', {
      output: { attempts: [] }
    });

    const attempts: any[] = [];
    const startedAt = Date.now();
    let uploadResult = await api.getUploadedAudio(uploadTask.id);

    try {
      while (true) {
        attempts.push(uploadResult);
        await markStepStatus(workId, 'poll_upload', 'running', {
          output: {
            attempts,
            latest: uploadResult
          }
        });

        if (uploadResult.status === 'complete') {
          await markStepStatus(workId, 'poll_upload', 'completed', {
            output: {
              attempts,
              latest: uploadResult
            }
          });
          break;
        }

        if (uploadResult.status === 'error') {
          const uploadError = new Error(
            uploadResult.error_message || 'Suno upload processing failed'
          );
          (uploadError as Error & { detail?: any }).detail = uploadResult;
          throw uploadError;
        }

        if (Date.now() - startedAt > 120000) {
          throw new Error('Timed out waiting for Suno to finish processing the upload');
        }

        await sleep(3, 5);
        uploadResult = await api.getUploadedAudio(uploadTask.id);
      }
    } catch (error: any) {
      await markStepStatus(workId, 'poll_upload', 'failed', {
        output: {
          attempts,
          latest: uploadResult
        },
        error: buildErrorDetail(error)
      });
      throw error;
    }

    failedStep = 'initialize_clip';
    const initializedClip = await runTrackedStep(workId, 'initialize_clip', () =>
      api.initializeUploadClip(uploadTask.id)
    );

    const metadataPayload = {
      title: title || uploadResult.title,
      image_url: imageUrl || uploadResult.image_url,
      is_audio_upload_tos_accepted: true
    };

    failedStep = 'set_metadata';
    await runTrackedStep(workId, 'set_metadata', () =>
      api.setClipMetadata(initializedClip.clip_id, metadataPayload)
    );

    failedStep = 'set_audio_description';
    const clipResult = await runTrackedStep(workId, 'set_audio_description', () =>
      api.acceptAudioDescription(initializedClip.clip_id)
    );

    let workspaceMove: any = null;
    if (workspaceId || workspaceName) {
      failedStep = 'move_to_workspace';
      workspaceMove = await runTrackedStep(workId, 'move_to_workspace', () =>
        api.moveClipsToWorkspace(
          [initializedClip.clip_id],
          workspaceId,
          workspaceName
        )
      );
    } else {
      await markStepStatus(workId, 'move_to_workspace', 'skipped', {
        output: {
          skipped: true,
          reason: 'No workspace_id or workspace_name provided'
        }
      });
    }

    await setWorkState(workId, 'completed', {
      result: {
        upload: uploadResult,
        initialized_clip: initializedClip,
        clip: clipResult,
        workspace_move: workspaceMove
      }
    });
  } catch (error: any) {
    await setWorkState(workId, 'failed', {
      error: {
        step: failedStep,
        detail: buildErrorDetail(error)
      }
    });
  }
}
