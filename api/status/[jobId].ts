import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  SFNClient,
  DescribeExecutionCommand,
  GetExecutionHistoryCommand,
} from '@aws-sdk/client-sfn';

const sfn = new SFNClient({ region: process.env.AWS_REGION });

const STEP_MAP: Record<string, string> = {
  NormalizeVideo: 'Normalizing',
  AnalyzeVideo:   'Analyzing',
  PlanCropPath:   'Planning',
  RenderVideo:    'Rendering',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.API_KEY;
  if (apiKey && req.headers['x-api-key'] !== apiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { jobId } = req.query;
  if (!jobId || typeof jobId !== 'string') return res.status(400).json({ error: 'Missing jobId' });

  // Derive execution ARN directly — avoids scanning ListExecutions
  const executionArn = process.env.STATE_MACHINE_ARN!
    .replace(':stateMachine:', ':execution:') + `:${jobId}`;

  try {
    const execution = await sfn.send(new DescribeExecutionCommand({ executionArn }));
    const sfnStatus = execution.status; // RUNNING | SUCCEEDED | FAILED | TIMED_OUT | ABORTED

    if (sfnStatus === 'SUCCEEDED') {
      return res.status(200).json({ status: 'succeeded', currentStep: 'done', startedAt: execution.startDate?.toISOString() });
    }
    if (sfnStatus !== 'RUNNING') {
      return res.status(200).json({ status: 'failed', currentStep: 'error', startedAt: execution.startDate?.toISOString() });
    }

    // Determine current step from execution history
    let currentStep = 'Normalizing';
    try {
      const history = await sfn.send(
        new GetExecutionHistoryCommand({
          executionArn,
          reverseOrder: true,
          maxResults: 50,
        })
      );

      for (const event of history.events || []) {
        if (event.type === 'TaskStateEntered' && event.stateEnteredEventDetails?.name) {
          const name = event.stateEnteredEventDetails.name;
          if (STEP_MAP[name]) {
            currentStep = STEP_MAP[name];
            break;
          }
        }
      }
    } catch {
      // Fall back to 'Analyzing' if history fetch fails
    }

    return res.status(200).json({
      status: currentStep,
      currentStep,
      startedAt: execution.startDate?.toISOString(),
    });
  } catch (err: any) {
    if (err.name === 'ExecutionDoesNotExist') {
      return res.status(404).json({ error: 'Job not found' });
    }
    console.error('status error:', err);
    return res.status(500).json({ error: 'Failed to get job status' });
  }
}
