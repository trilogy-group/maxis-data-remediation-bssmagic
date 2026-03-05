import Anthropic from '@anthropic-ai/sdk';
import { executeSOQL, describeObject } from './salesforce';
import { getAllTribal, getAllDetections, getTribalAsText, getDetectionsAsText, saveTribal, saveDetection, type TribalKnowledgeEntry, type DetectionEntry } from './knowledge-store';

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'run_soql',
    description: 'Execute a SOQL query against the live Salesforce org. Returns up to 2000 records.',
    input_schema: {
      type: 'object' as const,
      properties: {
        intent: { type: 'string', description: 'Why you are running this query (1 sentence)' },
        query: { type: 'string', description: 'The SOQL query to execute' },
      },
      required: ['intent', 'query'],
    },
  },
  {
    name: 'describe_object',
    description: 'Get the schema of a Salesforce object — field names, types, relationships.',
    input_schema: {
      type: 'object' as const,
      properties: {
        object_name: { type: 'string', description: 'API name (e.g. csord__Order__c)' },
      },
      required: ['object_name'],
    },
  },
  {
    name: 'read_knowledge',
    description: 'Read tribal knowledge or detection functions from the knowledge store.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', enum: ['tribal', 'detections'], description: 'What to read' },
      },
      required: ['type'],
    },
  },
  {
    name: 'record_finding',
    description: 'Record a classified finding for a specific entity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        entity_id: { type: 'string' },
        root_cause: { type: 'string', enum: ['false_positive', 'in_progress', 'blocked_external', 'data_quality', 'process_deviation', 'system_bug', 'unknown'] },
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
        summary: { type: 'string' },
        evidence_query: { type: 'string' },
        evidence_result: { type: 'string' },
        business_impact: { type: 'string' },
        resolution: { type: 'string' },
      },
      required: ['entity_id', 'root_cause', 'severity', 'summary', 'evidence_query'],
    },
  },
  {
    name: 'record_tribal_knowledge',
    description: 'Record reusable knowledge for future investigations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'TK-{DOMAIN}-{NNN}' },
        domain: { type: 'string' },
        fact: { type: 'string' },
        evidence_query: { type: 'string' },
        evidence_result: { type: 'string' },
        implication: { type: 'string' },
        resolution: { type: 'string' },
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
      },
      required: ['id', 'domain', 'fact', 'evidence_query', 'evidence_result', 'implication', 'resolution', 'severity'],
    },
  },
  {
    name: 'propose_detection',
    description: 'Propose a SOQL-based detection function for periodic monitoring.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        object_type: { type: 'string' },
        soql_condition: { type: 'string' },
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        resolution_action: { type: 'string' },
      },
      required: ['name', 'description', 'object_type', 'soql_condition', 'severity'],
    },
  },
  {
    name: 'done',
    description: 'Signal investigation complete with executive summary.',
    input_schema: {
      type: 'object' as const,
      properties: {
        executive_summary: { type: 'string', description: '3-5 bullet summary' },
      },
      required: ['executive_summary'],
    },
  },
];

const SYSTEM_PROMPT = `You are an expert CloudSense / Salesforce data investigator for a telecom BSS system (Maxis, Malaysia).

You drive the ENTIRE investigation. You decide what to query, what to look up, and how to interpret results.

## YOUR TOOLS
- **run_soql**: Execute SOQL against live Salesforce
- **describe_object**: Get schema of a Salesforce object
- **read_knowledge**: Read tribal knowledge or detection functions
- **record_finding**: Record a classified finding
- **record_tribal_knowledge**: Record reusable knowledge
- **propose_detection**: Propose a monitoring rule
- **done**: Signal investigation complete

## APPROACH
1. Check existing knowledge first (read_knowledge)
2. Fetch entities (run_soql, describe_object)
3. Explore relationships and history
4. Compare against population baselines
5. Record findings and knowledge as you go
6. Be efficient — max {max_iterations} iterations

## EXISTING KNOWLEDGE
### Tribal Knowledge
{tribal_knowledge}

### Detection Functions
{detection_functions}

## BASKET DIAGNOSTICS PATTERNS (from Maxis Basket Analyzer)
When investigating baskets (a0u IDs):
1. Check basket pricing: cscfga__pricing_status__c must be 'Done' or 'Complete', Total_Price must not be null
2. Check solution integrity: count solutions vs product configs, look for orphans and deleted records
3. Check duplicate GUIDs: SELECT GUID__c FROM cscfga__Product_Configuration__c GROUP BY GUID__c HAVING COUNT > 1
4. Check cancelled items: csordtelcoa__cancelled_by_change_process__c = true
5. For submitted baskets, run order generation 5-step check:
   a. Basket_Stage_UI__c must be 'Submitted'
   b. Service records should exist for basket (csord__Service__c WHERE csordtelcoa__Product_Basket__c)
   c. Solutions should have orders (csord__Order__c != null)
   d. Check AsyncApexJob for Order_Generation_Batch_Job_Id errors
   e. Check Log__c WHERE Class__c = 'AfterOrderGenerationObserverHelper' for post-generation errors
6. If ID doesn't start with a0u, it's likely a Solution ID — reverse lookup via csord__Solution__c.cssdm__product_basket__c

## INVESTIGATION REQUEST
{context}`;

interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

export async function* runInvestigation(params: {
  entityIds: string[];
  description: string;
  depth?: string;
}): AsyncGenerator<SSEEvent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    yield { type: 'error', message: 'ANTHROPIC_API_KEY not set in .env.local' };
    return;
  }

  const client = new Anthropic({ apiKey });
  const maxIterations = params.depth === 'full' ? 50 : params.depth === 'quick' ? 10 : 25;

  const context = [
    params.description ? `**Issue:** ${params.description}` : '',
    params.entityIds.length ? `**Entity IDs:** ${params.entityIds.join(', ')}` : '',
    `**Depth:** ${params.depth || 'standard'}`,
  ].filter(Boolean).join('\n');

  const system = SYSTEM_PROMPT
    .replace('{tribal_knowledge}', getTribalAsText())
    .replace('{detection_functions}', getDetectionsAsText())
    .replace('{context}', context)
    .replace('{max_iterations}', String(maxIterations));

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: 'Begin the investigation. Check existing knowledge, then fetch and analyze the data. Record findings as you go.' },
  ];

  const findings: Record<string, unknown>[] = [];
  const queryLog: Record<string, unknown>[] = [];

  yield { type: 'investigation_start', maxIterations, entityIds: params.entityIds };

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    yield { type: 'iteration_start', iteration, max: maxIterations };

    const response = await client.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system,
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === 'end_turn') {
      for (const block of response.content) {
        if ('text' in block && block.text) {
          yield { type: 'thinking', text: block.text };
        }
      }
      break;
    }

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    let done = false;

    for (const block of response.content) {
      if ('text' in block && block.text) {
        yield { type: 'thinking', text: block.text };
      }

      if (block.type !== 'tool_use') continue;

      const { name, input, id } = block;
      yield { type: 'tool_call', tool: name, input };

      let result: unknown;

      switch (name) {
        case 'run_soql': {
          const inp = input as { intent: string; query: string };
          result = await executeSOQL(inp.query);
          queryLog.push({ tool: 'run_soql', intent: inp.intent, soql: inp.query, ...(result as Record<string, unknown>) });
          break;
        }
        case 'describe_object': {
          result = await describeObject((input as { object_name: string }).object_name);
          break;
        }
        case 'read_knowledge': {
          const t = (input as { type: string }).type;
          result = t === 'tribal' ? getAllTribal() : getAllDetections();
          break;
        }
        case 'record_finding': {
          findings.push(input as Record<string, unknown>);
          result = { status: 'recorded', finding_count: findings.length };
          break;
        }
        case 'record_tribal_knowledge': {
          const tk = input as TribalKnowledgeEntry;
          saveTribal({ ...tk, confirmed_by: ['Investigation Agent'], discovered_date: new Date().toISOString().split('T')[0], scope: 'customer_specific' });
          result = { status: 'saved', id: tk.id };
          yield { type: 'new_knowledge', knowledge_type: 'tribal', entry: tk };
          break;
        }
        case 'propose_detection': {
          const det = input as DetectionEntry;
          saveDetection(det);
          result = { status: 'saved', name: det.name };
          yield { type: 'new_knowledge', knowledge_type: 'detection', entry: det };
          break;
        }
        case 'done': {
          yield { type: 'done', summary: (input as { executive_summary: string }).executive_summary };
          result = { status: 'investigation_complete' };
          done = true;
          break;
        }
        default:
          result = { error: `Unknown tool: ${name}` };
      }

      yield { type: 'tool_result', tool: name, output: result };
      toolResults.push({ type: 'tool_result', tool_use_id: id, content: JSON.stringify(result, null, 0) });
    }

    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });

    if (done) break;
  }

  yield { type: 'stream_end', findings, queryLog };
}
