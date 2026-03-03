export type LayerType = 'data' | 'ontology' | 'capabilities';

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  separator?: string;
}

export const LAYERS: { id: LayerType; label: string; icon: string }[] = [
  { id: 'data', label: 'Data Layer', icon: 'Database' },
  { id: 'ontology', label: 'Ontology Layer', icon: 'Share2' },
  { id: 'capabilities', label: 'Capabilities', icon: 'Zap' },
];

export const NAV_ITEMS: Record<LayerType, NavItem[]> = {
  data: [
    { label: 'Connectors', href: '/data/storage', icon: 'HardDrive' },
    { label: 'Pipelines', href: '/data/pipelines', icon: 'GitBranch' },
    { label: 'Semantic Mapping', href: '/data/semantic-mapping', icon: 'Link' },
    { label: 'Data Quality', href: '/data/data-quality', icon: 'CheckCircle' },
    { label: 'Explore', href: '/data/explore', icon: 'Search' },
  ],
  ontology: [
    { label: 'Knowledge Graph', href: '/ontology/knowledge-graph', icon: 'Share2' },
    { label: 'Entities', href: '/ontology/entities', icon: 'Box' },
    { label: 'Semantic Model', href: '/ontology/semantic-model', icon: 'Tag' },
    { label: 'Rules', href: '/ontology/rules', icon: 'Shield' },
    { label: 'Knowledge', href: '/ontology/knowledge', icon: 'BookOpen' },
    { label: 'Processes', href: '/ontology/processes', icon: 'GitBranch' },
    { label: 'Governance', href: '/ontology/governance', icon: 'Lock' },
  ],
  capabilities: [
    { label: 'Capability Builder', href: '/capabilities/builder', icon: 'GitBranch', separator: 'Platform Tools' },
    { label: 'Discovery', href: '/capabilities/discovery', icon: 'Search' },
    { label: 'Issue Dashboard', href: '/capabilities/issues', icon: 'AlertTriangle', separator: 'Maxis Deliverables' },
    { label: 'Workflows', href: '/capabilities/workflows', icon: 'GitBranch' },
    { label: 'Health Trends', href: '/capabilities/health', icon: 'Activity' },
    { label: 'Bulk Remediation', href: '/capabilities/bulk', icon: 'PlayCircle' },
  ],
};
