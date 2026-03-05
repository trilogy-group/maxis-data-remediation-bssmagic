'use client';

import { useState, useMemo } from 'react';
import { TMF_ENTITIES } from '@/lib/tmf-types';
import { TMF_TYPE_DICT } from '@/lib/tmf-type-dict';
import { useQuery } from '@tanstack/react-query';
import { fetchMetadata } from '@/lib/api';
import { ArrowRight, ChevronRight, ChevronDown, Search, Play, Copy, X, Loader2, Check, Link2, Trash2, Database, Layers } from 'lucide-react';

const ALB = 'http://bssmagic-alb-526861445.ap-southeast-1.elb.amazonaws.com';

function resolveTypeName(rawType: string): string {
  let t = rawType;
  if (t.startsWith('array<')) t = t.slice(6, -1);
  if (t.startsWith('jsonb<')) t = t.slice(6, -1);
  return t;
}

function isComplexType(rawType: string): boolean {
  const t = resolveTypeName(rawType);
  if (['string', 'boolean', 'number', 'integer', 'double', 'float', 'date'].includes(t)) return false;
  if (t.endsWith('StateType') || t.endsWith('Type')) {
    const def = TMF_TYPE_DICT[t];
    if (def?.__type__ === 'enum') return false;
  }
  const def = TMF_TYPE_DICT[t];
  return !!def && (def.__type__ === 'object' || def.__type__ === 'oneOf');
}

function getSubFields(rawType: string): { name: string; type: string; depth: number }[] {
  const t = resolveTypeName(rawType);
  const def = TMF_TYPE_DICT[t];
  if (!def) return [];
  if (def.__type__ === 'oneOf' && def.fields) {
    const firstKey = Object.keys(def.fields)[0];
    const firstType = def.fields[firstKey];
    return getSubFields(firstType);
  }
  if (def.__type__ === 'object' && def.fields) {
    return Object.entries(def.fields)
      .filter(([k]) => !k.startsWith('@') && k !== 'href')
      .map(([name, type]) => ({ name, type, depth: 0 }));
  }
  return [];
}

function getTmfTypeCast(typeName: string): string {
  const resolved = resolveTypeName(typeName);
  const def = TMF_TYPE_DICT[resolved];
  if (def?.__type__ === 'enum') return `::tmf."${resolved}"`;
  if (def?.__type__ === 'object') return `::tmf."${resolved}"`;
  return '::text';
}

interface CSField {
  name: string;
  type: string;
  label: string;
  referenceTo?: string[];
  nillable?: boolean;
}

interface FieldMapping {
  tmfField: string;
  tmfType: string;
  csField: string;
  csType: string;
  joinAlias?: string;
  joinObject?: string;
  joinFk?: string;
}

interface ExpandedRef {
  fkField: string;
  objectName: string;
  fields: CSField[];
  alias: string;
}

function sfTypeToPgCast(sfType: string, tmfType: string): string {
  if (tmfType.endsWith('StateType') || tmfType.endsWith('Type') && !['string', 'boolean', 'array'].includes(tmfType)) {
    return `::text`;
  }
  if (sfType === 'boolean' || tmfType === 'boolean') return '::boolean';
  if (sfType === 'datetime' || sfType === 'date' || tmfType.includes('date') || tmfType.includes('Date')) return '::timestamp with time zone';
  if (sfType === 'double' || sfType === 'currency' || sfType === 'percent' || tmfType === 'number') return '::double precision';
  if (sfType === 'int' || sfType === 'integer') return '::integer';
  return '::text';
}

function generateSQL(
  entityName: string,
  csObject: string,
  mappings: FieldMapping[],
  expandedRefs: ExpandedRef[],
  tmfEntity?: { fields: Record<string, string> },
): string {
  if (!entityName || !csObject || mappings.length === 0) return '-- Select TMF entity, CS object, and map fields to generate SQL';

  const eName = entityName.charAt(0).toLowerCase() + entityName.slice(1);
  const lines: string[] = [];
  lines.push(`DROP VIEW IF EXISTS salesforce_server."${eName}";`);
  lines.push(`CREATE VIEW salesforce_server."${eName}" AS`);
  lines.push('SELECT');

  const selectFields: string[] = [];
  selectFields.push(`    t0."Id"::text AS "id"`);
  const domain = eName.charAt(0).toLowerCase() + eName.slice(1);
  selectFields.push(`    ('${ALB}/tmf-api/${domain}/v5/${eName}/' || t0."Id")::text AS "href"`);

  const directMappings = mappings.filter(m => !m.tmfField.includes('.'));
  const nestedMappings = mappings.filter(m => m.tmfField.includes('.'));

  for (const m of directMappings) {
    if (['id', 'href', '@type', '@baseType', '@schemaLocation'].includes(m.tmfField)) continue;
    const alias = m.joinAlias || 't0';
    const cast = sfTypeToPgCast(m.csType, m.tmfType);
    selectFields.push(`    ${alias}."${m.csField}"${cast} AS "${m.tmfField}"`);
  }

  const nestedByParent: Record<string, FieldMapping[]> = {};
  for (const m of nestedMappings) {
    const parts = m.tmfField.split('.');
    const parent = parts[0];
    if (!nestedByParent[parent]) nestedByParent[parent] = [];
    nestedByParent[parent].push(m);
  }

  for (const [parent, childMappings] of Object.entries(nestedByParent)) {
    const parentType = tmfEntity?.fields[parent];
    if (!parentType) continue;
    const isArray = parentType.startsWith('array<');
    const resolvedType = resolveTypeName(parentType);
    const typeDef = TMF_TYPE_DICT[resolvedType];

    if (typeDef?.__type__ === 'oneOf' && typeDef.fields) {
      const firstVariant = Object.keys(typeDef.fields)[0];
      const variantType = typeDef.fields[firstVariant];
      const variantDef = TMF_TYPE_DICT[variantType];

      if (variantDef?.fields) {
        const twoLevel = childMappings.filter(m => m.tmfField.split('.').length === 2);

        const rowFields: string[] = [];
        if (variantDef.fields) {
          for (const [fieldName] of Object.entries(variantDef.fields)) {
            const mapping = twoLevel.find(m => m.tmfField === `${parent}.${fieldName}`);
            if (mapping) {
              const alias = mapping.joinAlias || 't0';
              rowFields.push(`                ${alias}."${mapping.csField}"::text`);
            } else {
              rowFields.push(`                NULL::text`);
            }
          }
        }

        const rowExpr = `ROW(\n${rowFields.join(',\n')}\n            )::tmf."${variantType}"`;

        if (isArray) {
          selectFields.push(`    ARRAY[${rowExpr}]::tmf."${variantType}"[] AS "${parent}"`);
        } else {
          selectFields.push(`    ${rowExpr} AS "${parent}"`);
        }
        continue;
      }
    }

    if (typeDef?.__type__ === 'object' && typeDef.fields) {
      const rowFields: string[] = [];
      for (const [fieldName] of Object.entries(typeDef.fields)) {
        const mapping = childMappings.find(m => {
          const parts = m.tmfField.split('.');
          return parts[parts.length - 1] === fieldName;
        });
        if (mapping) {
          const alias = mapping.joinAlias || 't0';
          rowFields.push(`                ${alias}."${mapping.csField}"::text`);
        } else {
          rowFields.push(`                NULL::text`);
        }
      }
      const rowExpr = `ROW(\n${rowFields.join(',\n')}\n            )::tmf."${resolvedType}"`;
      if (isArray) {
        selectFields.push(`    ARRAY[${rowExpr}]::tmf."${resolvedType}"[] AS "${parent}"`);
      } else {
        selectFields.push(`    ${rowExpr} AS "${parent}"`);
      }
    }
  }

  selectFields.push(`    '${entityName}'::text AS "@type"`);
  selectFields.push(`    'Entity'::text AS "@baseType"`);

  lines.push(selectFields.join(',\n'));
  lines.push(`FROM salesforce_server."${csObject}" t0`);

  for (const ref of expandedRefs) {
    const hasMappingsFromRef = mappings.some(m => m.joinAlias === ref.alias);
    if (hasMappingsFromRef) {
      lines.push(`LEFT JOIN salesforce_server."${ref.objectName}" ${ref.alias} ON t0."${ref.fkField}" = ${ref.alias}."Id"`);
    }
  }

  lines.push(';');
  return lines.join('\n');
}

export default function MappingBuilderPage() {
  const [tmfSearch, setTmfSearch] = useState('');
  const [csSearch, setCsSearch] = useState('');
  const [selectedTmf, setSelectedTmf] = useState<string | null>(null);
  const [selectedCs, setSelectedCs] = useState<string | null>(null);
  const [csFields, setCsFields] = useState<CSField[]>([]);
  const [csLoading, setCsLoading] = useState(false);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [activeTmfField, setActiveTmfField] = useState<string | null>(null);
  const [expandedRefs, setExpandedRefs] = useState<ExpandedRef[]>([]);
  const [expandingRef, setExpandingRef] = useState<string | null>(null);
  const [expandedTmfFields, setExpandedTmfFields] = useState<Set<string>>(new Set());
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ success: boolean; output?: string; error?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: metadata } = useQuery({ queryKey: ['metadata'], queryFn: fetchMetadata, staleTime: 60000 });
  const mappedEntities = new Set(metadata?.resources.filter(r => r.mapped).map(r => r.name) ?? []);

  const [csObjects, setCsObjects] = useState<{ name: string; label: string }[]>([]);
  const [csObjLoading, setCsObjLoading] = useState(false);

  const loadCsObjects = async (search: string) => {
    setCsObjLoading(true);
    try {
      const res = await fetch('/platform/api/soql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'list_objects', search }),
      });
      const data = await res.json();
      setCsObjects(data.objects?.slice(0, 100) ?? []);
    } catch { setCsObjects([]); }
    finally { setCsObjLoading(false); }
  };

  const loadCsDescribe = async (objectName: string) => {
    setCsLoading(true);
    setCsFields([]);
    try {
      const res = await fetch('/platform/api/soql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'describe', object_name: objectName }),
      });
      const data = await res.json();
      setCsFields(data.fields ?? []);
    } catch { setCsFields([]); }
    finally { setCsLoading(false); }
  };

  const expandReference = async (fkField: string, refObject: string) => {
    if (expandedRefs.some(r => r.fkField === fkField)) {
      setExpandedRefs(prev => prev.filter(r => r.fkField !== fkField));
      return;
    }
    setExpandingRef(fkField);
    try {
      const res = await fetch('/platform/api/soql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'describe', object_name: refObject }),
      });
      const data = await res.json();
      const alias = `t${expandedRefs.length + 1}`;
      setExpandedRefs(prev => [...prev, { fkField, objectName: refObject, fields: data.fields ?? [], alias }]);
    } catch { /* ignore */ }
    finally { setExpandingRef(null); }
  };

  const tmfEntity = TMF_ENTITIES.find(e => e.name === selectedTmf);
  const tmfFields = useMemo(() => {
    if (!tmfEntity) return [];
    return Object.entries(tmfEntity.fields)
      .filter(([k]) => !k.startsWith('__'))
      .map(([name, type]) => ({ name, type }));
  }, [tmfEntity]);

  const filteredTmf = TMF_ENTITIES.filter(e =>
    e.name.toLowerCase().includes(tmfSearch.toLowerCase())
  ).slice(0, 50);

  const addMapping = (csField: string, csType: string, joinAlias?: string, joinObject?: string, joinFk?: string) => {
    if (!activeTmfField) return;
    const topField = activeTmfField.split('.')[0];
    const tmfType = tmfEntity?.fields[topField] ?? 'string';
    const fieldType = activeTmfField.includes('.') ? 'string' : tmfType;
    if (!activeTmfField.includes('.') && isComplexType(fieldType)) return;
    setMappings(prev => [
      ...prev.filter(m => m.tmfField !== activeTmfField),
      { tmfField: activeTmfField, tmfType: fieldType, csField, csType, joinAlias, joinObject, joinFk },
    ]);
    setActiveTmfField(null);
  };

  const removeMapping = (tmfField: string) => {
    setMappings(prev => prev.filter(m => m.tmfField !== tmfField));
  };

  const sql = generateSQL(selectedTmf ?? '', selectedCs ?? '', mappings, expandedRefs, tmfEntity ? { fields: tmfEntity.fields } : undefined);

  const deploy = async () => {
    setDeploying(true);
    setDeployResult(null);
    try {
      const res = await fetch('/platform/api/runtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute-sql', sql, environment: 'production' }),
      });
      const result = await res.json();

      if (result.success && selectedTmf) {
        const eName = selectedTmf.charAt(0).toLowerCase() + selectedTmf.slice(1);
        await new Promise(r => setTimeout(r, 2000));
        try {
          const verifyRes = await fetch(`/platform/api/tmf/tmf-api/productCatalogManagement/v5/${eName}?limit=1`);
          if (verifyRes.ok) {
            const data = await verifyRes.json();
            if (Array.isArray(data) && data.length > 0) {
              setDeployResult({ ...result, output: `Deployed and verified — ${data.length} record(s) returned from /${eName}` });
            } else if (Array.isArray(data)) {
              setDeployResult({ ...result, output: `Deployed — view created but 0 records (check source table has data)` });
            } else if (data.code === '500') {
              setDeployResult({ success: false, error: `View deployed but API returns 500 — likely a type mismatch in the SQL. Check that ROW() field counts match the TMF type definition.` });
            } else {
              setDeployResult(result);
            }
          } else {
            setDeployResult(result);
          }
        } catch {
          setDeployResult(result);
        }
      } else {
        setDeployResult(result);
      }
    } catch (err) {
      setDeployResult({ success: false, error: String(err) });
    } finally { setDeploying(false); }
  };

  const copySQL = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-purple-600" /> Entity Mapping Builder
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Map TMF entities to CloudSense objects and deploy SQL views to the runtime</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">{mappings.length} field{mappings.length !== 1 ? 's' : ''} mapped</span>
        </div>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">TMF Entity</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search TMF entities..."
              value={selectedTmf ?? tmfSearch}
              onChange={e => { setTmfSearch(e.target.value); setSelectedTmf(null); setMappings([]); }}
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-purple-400"
            />
            {!selectedTmf && tmfSearch && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredTmf.map(e => (
                  <button key={e.name} onClick={() => { setSelectedTmf(e.name); setTmfSearch(''); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 flex items-center justify-between">
                    <span className="font-medium text-slate-900">{e.name}</span>
                    <span className="text-[10px] text-slate-400">{Object.keys(e.fields).length - 1} fields</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">CloudSense Object</label>
          <div className="relative">
            <Database className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search CS objects..."
              value={selectedCs ?? csSearch}
              onChange={e => {
                setCsSearch(e.target.value);
                setSelectedCs(null);
                setCsFields([]);
                setExpandedRefs([]);
                if (e.target.value.length >= 2) loadCsObjects(e.target.value);
              }}
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
            />
            {!selectedCs && csObjects.length > 0 && csSearch && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {csObjLoading && <div className="px-3 py-2 text-xs text-slate-400">Loading...</div>}
                {csObjects.map(o => (
                  <button key={o.name} onClick={() => { setSelectedCs(o.name); setCsSearch(''); loadCsDescribe(o.name); setMappings([]); setExpandedRefs([]); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between">
                    <span className="font-mono text-slate-900 text-xs">{o.name}</span>
                    <span className="text-[10px] text-slate-400">{o.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3-Panel Mapping Area */}
      <div className="flex-1 grid grid-cols-[1fr_auto_1fr] gap-0 border border-slate-200 rounded-xl overflow-hidden bg-white min-h-0">
        {/* LEFT: TMF Fields */}
        <div className="border-r border-slate-200 overflow-y-auto">
          <div className="sticky top-0 bg-purple-50 px-3 py-2 border-b border-purple-100">
            <span className="text-[10px] font-semibold text-purple-700 uppercase tracking-wide">
              {selectedTmf ? `${selectedTmf} (${tmfFields.length} fields)` : 'Select TMF Entity'}
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {tmfFields.map(f => {
              const isMapped = mappings.some(m => m.tmfField === f.name);
              const isActive = activeTmfField === f.name;
              const isSystem = f.name.startsWith('@') || f.name === 'id' || f.name === 'href';
              const isComplex = isComplexType(f.type);
              const isExpanded = expandedTmfFields.has(f.name);
              const subFields = isExpanded ? getSubFields(f.type) : [];
              return (
                <div key={f.name}>
                  <div className="flex items-center">
                    <button
                      onClick={() => {
                        if (isSystem) return;
                        if (isComplex) {
                          setExpandedTmfFields(prev => {
                            const next = new Set(prev);
                            if (next.has(f.name)) next.delete(f.name); else next.add(f.name);
                            return next;
                          });
                          return;
                        }
                        setActiveTmfField(isActive ? null : f.name);
                      }}
                      className={`flex-1 text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                        isSystem ? 'bg-slate-50 text-slate-400 cursor-default' :
                        isComplex ? 'hover:bg-purple-50/50 cursor-pointer' :
                        isActive ? 'bg-purple-100 ring-1 ring-purple-400' :
                        isMapped ? 'bg-green-50' : 'hover:bg-purple-50 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isMapped && <Check className="w-3 h-3 text-green-500 shrink-0" />}
                        <span className={`font-mono truncate ${isMapped ? 'text-green-700' : 'text-slate-800'}`}>{f.name}</span>
                        {isComplex && !isExpanded && <span className="text-[8px] text-purple-400 italic">expand to map</span>}
                      </div>
                      <span className={`text-[9px] shrink-0 ml-2 ${isComplex ? 'text-purple-500 font-medium' : 'text-slate-400'}`}>
                        {f.type.replace('array<', '[]').replace('>', '')}
                      </span>
                    </button>
                    {isComplex && (
                      <button
                        onClick={() => setExpandedTmfFields(prev => {
                          const next = new Set(prev);
                          if (next.has(f.name)) next.delete(f.name); else next.add(f.name);
                          return next;
                        })}
                        className="px-2 py-2 text-purple-500 hover:text-purple-700 hover:bg-purple-50"
                      >
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                  {isExpanded && subFields.length > 0 && (
                    <div className="bg-purple-50/30 border-t border-purple-100">
                      {subFields.map(sf => {
                        const subKey = `${f.name}.${sf.name}`;
                        const subMapped = mappings.some(m => m.tmfField === subKey);
                        const subActive = activeTmfField === subKey;
                        const subIsComplex = isComplexType(sf.type);
                        const subExpanded = expandedTmfFields.has(subKey);
                        const subSubFields = subExpanded ? getSubFields(sf.type) : [];
                        return (
                          <div key={subKey}>
                            <div className="flex items-center">
                              <button
                                onClick={() => !subIsComplex && setActiveTmfField(subActive ? null : subKey)}
                                className={`flex-1 text-left pl-7 pr-3 py-1.5 text-[10px] flex items-center justify-between transition-colors ${
                                  subActive ? 'bg-purple-100 ring-1 ring-purple-300' :
                                  subMapped ? 'bg-green-50' : 'hover:bg-purple-50 cursor-pointer'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {subMapped && <Check className="w-2.5 h-2.5 text-green-500 shrink-0" />}
                                  <span className={`font-mono truncate ${subMapped ? 'text-green-700' : 'text-purple-800'}`}>{sf.name}</span>
                                </div>
                                <span className={`text-[8px] shrink-0 ml-1 ${subIsComplex ? 'text-purple-400' : 'text-slate-400'}`}>{sf.type}</span>
                              </button>
                              {subIsComplex && (
                                <button
                                  onClick={() => setExpandedTmfFields(prev => {
                                    const next = new Set(prev);
                                    if (next.has(subKey)) next.delete(subKey); else next.add(subKey);
                                    return next;
                                  })}
                                  className="px-1.5 py-1.5 text-purple-400 hover:text-purple-600"
                                >
                                  {subExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                                </button>
                              )}
                            </div>
                            {subExpanded && subSubFields.length > 0 && (
                              <div className="bg-purple-50/50 border-t border-purple-50">
                                {subSubFields.map(ssf => {
                                  const ssKey = `${subKey}.${ssf.name}`;
                                  const ssMapped = mappings.some(m => m.tmfField === ssKey);
                                  const ssActive = activeTmfField === ssKey;
                                  return (
                                    <button
                                      key={ssKey}
                                      onClick={() => setActiveTmfField(ssActive ? null : ssKey)}
                                      className={`w-full text-left pl-12 pr-3 py-1 text-[9px] flex items-center justify-between transition-colors ${
                                        ssActive ? 'bg-purple-100 ring-1 ring-purple-200' :
                                        ssMapped ? 'bg-green-50' : 'hover:bg-purple-50 cursor-pointer'
                                      }`}
                                    >
                                      <span className={`font-mono truncate ${ssMapped ? 'text-green-700' : 'text-purple-700'}`}>{ssf.name}</span>
                                      <span className="text-[8px] text-slate-400">{ssf.type}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER: Mappings */}
        <div className="w-64 border-r border-slate-200 bg-slate-50/50 overflow-y-auto">
          <div className="sticky top-0 bg-slate-100 px-3 py-2 border-b border-slate-200">
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
              Mappings ({mappings.length})
            </span>
          </div>
          {activeTmfField && (
            <div className="px-3 py-2 bg-purple-50 border-b border-purple-100 text-[10px] text-purple-700">
              Click a CS field on the right to map <span className="font-bold">{activeTmfField}</span>
            </div>
          )}
          <div className="divide-y divide-slate-100">
            {mappings.map(m => (
              <div key={m.tmfField} className="px-3 py-2 flex items-center gap-1.5 group">
                <span className="font-mono text-[10px] text-purple-700 truncate flex-1">{m.tmfField}</span>
                <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                <span className="font-mono text-[10px] text-blue-700 truncate flex-1">
                  {m.joinAlias ? `${m.joinObject}.` : ''}{m.csField}
                </span>
                <button onClick={() => removeMapping(m.tmfField)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {mappings.length === 0 && (
              <div className="px-3 py-8 text-center text-[10px] text-slate-400">
                Click a TMF field, then a CS field to create a mapping
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: CS Fields */}
        <div className="overflow-y-auto">
          <div className="sticky top-0 bg-blue-50 px-3 py-2 border-b border-blue-100">
            <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide">
              {selectedCs ? `${selectedCs} (${csFields.length} fields)` : 'Select CS Object'}
            </span>
          </div>
          {csLoading && <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-400" /></div>}
          <div className="divide-y divide-slate-50">
            {csFields.map(f => {
              const isMapped = mappings.some(m => m.csField === f.name && !m.joinAlias);
              const isRef = f.type === 'reference' && f.referenceTo && f.referenceTo.length > 0;
              const expanded = expandedRefs.find(r => r.fkField === f.name);
              return (
                <div key={f.name}>
                  <div className="flex items-center">
                    <button
                      onClick={() => activeTmfField && addMapping(f.name, f.type)}
                      disabled={!activeTmfField}
                      className={`flex-1 text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                        isMapped ? 'bg-green-50' :
                        activeTmfField ? 'hover:bg-blue-100 cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isMapped && <Check className="w-3 h-3 text-green-500 shrink-0" />}
                        <span className={`font-mono truncate ${isMapped ? 'text-green-700' : 'text-slate-800'}`}>{f.name}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 shrink-0 ml-2">{f.type}{isRef ? ` → ${f.referenceTo![0]}` : ''}</span>
                    </button>
                    {isRef && (
                      <button
                        onClick={() => expandReference(f.name, f.referenceTo![0])}
                        className="px-2 py-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                        title={`Expand ${f.referenceTo![0]} fields`}
                      >
                        {expandingRef === f.name ? <Loader2 className="w-3 h-3 animate-spin" /> :
                          expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                  {expanded && (
                    <div className="bg-blue-50/50 border-t border-blue-100">
                      {expanded.fields.slice(0, 30).map(sf => {
                        const subMapped = mappings.some(m => m.csField === sf.name && m.joinAlias === expanded.alias);
                        return (
                          <button
                            key={sf.name}
                            onClick={() => activeTmfField && addMapping(sf.name, sf.type, expanded.alias, expanded.objectName, f.name)}
                            disabled={!activeTmfField}
                            className={`w-full text-left pl-8 pr-3 py-1.5 text-[10px] flex items-center justify-between transition-colors ${
                              subMapped ? 'bg-green-50' : activeTmfField ? 'hover:bg-blue-100 cursor-pointer' : ''
                            }`}
                          >
                            <span className={`font-mono truncate ${subMapped ? 'text-green-700' : 'text-blue-800'}`}>
                              {expanded.objectName}.{sf.name}
                            </span>
                            <span className="text-[9px] text-slate-400 shrink-0">{sf.type}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Validation warnings */}
      {mappings.length > 0 && (() => {
        const warnings: string[] = [];
        for (const m of mappings) {
          if (!m.tmfField.includes('.') && tmfEntity) {
            const tmfType = tmfEntity.fields[m.tmfField];
            if (tmfType && isComplexType(tmfType)) {
              warnings.push(`"${m.tmfField}" is a complex type (${tmfType}) — mapping a simple field will fail. Expand and map sub-fields instead.`);
            }
          }
        }
        if (warnings.length === 0) return null;
        return (
          <div className="mt-4 bg-yellow-50 border border-yellow-300 rounded-lg p-3">
            <div className="text-xs font-semibold text-yellow-800 mb-1">Validation Warnings</div>
            {warnings.map((w, i) => (
              <div key={i} className="text-[11px] text-yellow-700 flex items-start gap-1.5">
                <span className="text-yellow-500 shrink-0">*</span> {w}
              </div>
            ))}
          </div>
        );
      })()}

      {/* SQL Preview + Actions */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Generated SQL</span>
          <div className="flex items-center gap-2">
            <button onClick={copySQL} className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-500 border border-slate-200 rounded hover:bg-slate-50">
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy SQL'}
            </button>
            <button
              onClick={deploy}
              disabled={deploying || mappings.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {deploying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Deploy to Runtime
            </button>
          </div>
        </div>
        <div className="bg-[#1e1e2e] rounded-lg p-3 max-h-40 overflow-auto">
          <pre className="text-[11px] font-mono text-green-400 whitespace-pre leading-relaxed">{sql}</pre>
        </div>
        {deployResult && (
          <div className={`mt-2 rounded-lg p-3 text-xs ${deployResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {deployResult.success ? 'SQL deployed to runtime' : `Error: ${deployResult.error}`}
          </div>
        )}
      </div>
    </div>
  );
}
