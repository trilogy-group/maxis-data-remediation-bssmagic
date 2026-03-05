import { NextRequest, NextResponse } from 'next/server';
import { ECSClient, ListTasksCommand, ExecuteCommandCommand } from '@aws-sdk/client-ecs';

const CLUSTER = 'bssmagic-cluster';
const SERVICE_MAP: Record<string, { service: string; container: string }> = {
  production: { service: 'bssmagic-service', container: 'bssmagic-runtime' },
  sandbox: { service: 'bssmagic-runtime-sandbox', container: 'bssmagic-runtime-sandbox' },
};

const ecs = new ECSClient({ region: 'ap-southeast-1' });

async function getTaskArn(service: string): Promise<string | null> {
  try {
    const res = await ecs.send(new ListTasksCommand({ cluster: CLUSTER, serviceName: service }));
    return res.taskArns?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'execute-sql') {
      const { sql, environment = 'production' } = body;
      if (!sql || typeof sql !== 'string') {
        return NextResponse.json({ error: 'SQL statement is required' }, { status: 400 });
      }

      const env = SERVICE_MAP[environment];
      if (!env) {
        return NextResponse.json({ error: `Unknown environment: ${environment}` }, { status: 400 });
      }

      const taskArn = await getTaskArn(env.service);
      if (!taskArn) {
        return NextResponse.json({ error: `No running task found for ${env.service}` }, { status: 503 });
      }

      const sqlB64 = Buffer.from(sql).toString('base64');
      const command = `bash -c 'echo "${sqlB64}" | base64 -d | psql -U postgres -d bssmagic 2>&1'`;

      try {
        const result = await ecs.send(new ExecuteCommandCommand({
          cluster: CLUSTER,
          task: taskArn,
          container: env.container,
          interactive: true,
          command: command,
        }));

        return NextResponse.json({
          success: true,
          taskArn,
          environment,
          sessionId: result.session?.sessionId,
          output: 'SQL submitted to runtime. The ECS ExecuteCommand requires session-manager-plugin for interactive output. For production use, check CloudWatch logs for results.',
          sql: sql.substring(0, 500) + (sql.length > 500 ? '...' : ''),
        });
      } catch (ecsErr: unknown) {
        const msg = ecsErr instanceof Error ? ecsErr.message : String(ecsErr);
        if (msg.includes('not authorized') || msg.includes('AccessDenied')) {
          return NextResponse.json({
            success: false,
            error: 'ECS ExecuteCommand not authorized. Ensure the platform task role has ecs:ExecuteCommand permission.',
            fallback: 'manual',
            sql,
            manualCommand: `aws ecs execute-command --cluster ${CLUSTER} --task ${taskArn} --container ${env.container} --interactive --command "${command}"`,
          });
        }
        return NextResponse.json({ success: false, error: msg, sql }, { status: 500 });
      }
    }

    if (action === 'list-tasks') {
      const { environment = 'production' } = body;
      const env = SERVICE_MAP[environment];
      if (!env) return NextResponse.json({ error: `Unknown environment` }, { status: 400 });

      const taskArn = await getTaskArn(env.service);
      return NextResponse.json({ taskArn, environment, service: env.service });
    }

    if (action === 'get-deploy-order') {
      const DEPLOY_ORDER = [
        { group: 'REST FDW Foreign Tables', files: ['rest_foreign_tables.sql', 'oe_foreign_tables.sql'] },
        { group: 'Core TMF Views', files: ['shoppingCart.sql', 'productOrder.sql', 'service.sql', 'product.sql', 'individual.sql', 'organization.sql', 'billingAccount.sql'] },
        { group: 'Migration & Remediation', files: ['batchJob.sql', 'failedMigrationProduct.sql', 'failedMigrationSolutions.sql', 'serviceProblem.sql', 'serviceProblemEventRecord.sql'] },
      ];
      return NextResponse.json({ deployOrder: DEPLOY_ORDER });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
