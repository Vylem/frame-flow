import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  SFNClient,
  ListExecutionsCommand,
  GetExecutionHistoryCommand,
} from '@aws-sdk/client-sfn';

const sfn = new SFNClient({ region: process.env.AWS_REGION });

const STEP_MAP: Record<string, string> = {
  Analyzing: 'Analyzing',
  Planning: 'Planning',
  Rendering: 'Rendering',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { jobId } = req.query;
  if (!jobId || typeof jobId !== 'string') return res.status(400).json({ error: 'Missing jobId' });

  try {
    const executions = await sfn.send(
      new ListExecutionsCommand({
        stateMachineArn: process.env.STATE_MACHINE_ARN,
        maxResults: 100,
      })
    );

    const execution = executions.executions?.find((e) => e.name === jobId);
    if (!execution) return res.status(404).json({ error: 'Job not found' });

    const sfnStatus = execution.status; // RUNNING | SUCCEEDED | FAILED | TIMED_OUT | ABORTED

    if (sfnStatus === 'SUCCEEDED') {
      return res.status(200).json({ status: 'succeeded', currentStep: 'done', startedAt: execution.startDate?.toISOString() });
    }
    if (sfnStatus !== 'RUNNING') {
      return res.status(200).json({ status: 'failed', currentStep: 'error', startedAt: execution.startDate?.toISOString() });
    }

    // Determine current step from execution history
    let currentStep = 'analyzing';
    try {
      const history = await sfn.send(
        new GetExecutionHistoryCommand({
          executionArn: execution.executionArn,
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
      // Fall back to 'analyzing' if history fetch fails
    }

    return res.status(200).json({
      status: currentStep,
      currentStep,
      startedAt: execution.startDate?.toISOString(),
    });
  } catch (err) {
    console.error('status error:', err);
    return res.status(500).json({ error: 'Failed to get job status' });
  }
}
