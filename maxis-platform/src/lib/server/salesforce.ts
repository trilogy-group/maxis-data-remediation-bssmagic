/* eslint-disable @typescript-eslint/no-explicit-any */
import jsforce from 'jsforce';

let conn: any = null;

async function getConnection() {
  if (conn?.accessToken) return conn;

  const loginUrl = process.env.SF_LOGIN_URL || 'https://test.salesforce.com';
  conn = new jsforce.Connection({ loginUrl });

  await conn.login(
    process.env.SF_USERNAME || '',
    (process.env.SF_PASSWORD || '') + (process.env.SF_SECURITY_TOKEN || ''),
  );

  console.log('[SF] Connected to:', conn.instanceUrl);
  return conn;
}

export interface SOQLResult {
  totalSize: number;
  done: boolean;
  records: Record<string, unknown>[];
  error?: string;
}

export async function executeSOQL(query: string): Promise<SOQLResult> {
  try {
    const sf = await getConnection();
    const result = await sf.query(query);
    const records = (result.records || []).map((r: any) => {
      const { attributes, ...rest } = r;
      return rest;
    });
    return { totalSize: result.totalSize, done: result.done ?? true, records };
  } catch (e: any) {
    console.error('[SF] SOQL error:', e.message);
    return { totalSize: 0, done: true, records: [], error: e.message };
  }
}

export async function listObjects(search?: string): Promise<{ name: string; label: string; keyPrefix: string | null }[]> {
  try {
    const sf = await getConnection();
    const result = await sf.describeGlobal();
    let objects = result.sobjects.map((o: any) => ({ name: o.name, label: o.label, keyPrefix: o.keyPrefix }));
    if (search) {
      const s = search.toLowerCase();
      objects = objects.filter((o: any) => o.name.toLowerCase().includes(s) || o.label.toLowerCase().includes(s));
    }
    return objects;
  } catch (e: any) {
    console.error('[SF] List objects error:', e.message);
    return [];
  }
}

export async function describeObject(objectName: string): Promise<Record<string, unknown>> {
  try {
    const sf = await getConnection();
    const desc = await sf.describe(objectName);
    const fields = desc.fields.map((f: any) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      length: f.length,
      referenceTo: f.referenceTo,
      picklistValues: f.type === 'picklist' ? f.picklistValues?.filter((p: any) => p.active).map((p: any) => p.value) : undefined,
    }));
    return { name: desc.name, label: desc.label, fields, fieldCount: fields.length };
  } catch (e: any) {
    return { error: e.message, object_name: objectName };
  }
}
