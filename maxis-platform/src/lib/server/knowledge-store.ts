import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

const KNOWLEDGE_DIR = process.env.KNOWLEDGE_DIR || path.join(process.cwd(), '..', 'ontology-discovery-agent', 'knowledge');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export interface TribalKnowledgeEntry {
  id: string;
  domain: string;
  fact: string;
  evidence_query?: string;
  evidence_result?: string;
  implication?: string;
  resolution?: string;
  severity: string;
  confirmed_by?: string[];
  discovered_date?: string;
  scope?: string;
}

export interface DetectionEntry {
  name: string;
  description: string;
  object_type: string;
  soql_condition: string;
  severity: string;
  resolution_action?: string;
  current_scale?: string | null;
  last_run?: string | null;
}

export function getAllTribal(): TribalKnowledgeEntry[] {
  const dir = path.join(KNOWLEDGE_DIR, 'tribal');
  ensureDir(dir);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.yaml')).sort();
  return files.map(f => {
    const content = fs.readFileSync(path.join(dir, f), 'utf-8');
    return YAML.parse(content) as TribalKnowledgeEntry;
  }).filter(Boolean);
}

export function saveTribal(entry: TribalKnowledgeEntry): void {
  const dir = path.join(KNOWLEDGE_DIR, 'tribal');
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, `${entry.id}.yaml`), YAML.stringify(entry));
}

export function getAllDetections(): DetectionEntry[] {
  const dir = path.join(KNOWLEDGE_DIR, 'detections');
  ensureDir(dir);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.yaml')).sort();
  return files.map(f => {
    const content = fs.readFileSync(path.join(dir, f), 'utf-8');
    return YAML.parse(content) as DetectionEntry;
  }).filter(Boolean);
}

export function saveDetection(entry: DetectionEntry): void {
  const dir = path.join(KNOWLEDGE_DIR, 'detections');
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, `${entry.name}.yaml`), YAML.stringify(entry));
}

export function getTribalAsText(): string {
  const entries = getAllTribal();
  if (!entries.length) return 'No tribal knowledge accumulated yet.';
  return entries.map(tk =>
    `- ${tk.id} [${tk.severity}]: ${tk.fact}\n  Implication: ${tk.implication}\n  Resolution: ${tk.resolution}`
  ).join('\n');
}

export function getDetectionsAsText(): string {
  const dets = getAllDetections();
  if (!dets.length) return 'No detection functions defined yet.';
  return dets.map(d => `- ${d.name} [${d.severity}]: ${d.object_type} WHERE ${d.soql_condition}`).join('\n');
}
