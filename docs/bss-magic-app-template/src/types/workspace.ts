// File management types for AIWorkspace

// Context abstraction for multi-component support
export interface WorkspaceContext {
  id: string;           // app.id or journeyTab.journeyId or entity.id
  slug: string;         // app.slug or journeyTab.name or entity.name (used for API calls)
  name: string;         // app.name or journeyTab.name or entity.name (display name)
  type: 'app' | 'journey' | 'entity';
  projectId?: string;   // Required for journey endpoints
  entityId?: string;    // Required for entity endpoints
}

export interface FileItem {
  path: string;
  name: string;
  size_bytes: number;
  modified_at: string;
  is_directory: boolean;
  extension?: string;
  content?: string;
  content_available?: boolean;
  content_type?: 'text' | 'binary' | 'too_large';
  encoding?: string;
  reason?: string;
}

export interface FileTreeNode extends FileItem {
  children?: FileTreeNode[];
  isExpanded?: boolean;
  level: number;
  parentPath?: string;
}

export interface FilesResponse {
  success: boolean;
  app_slug: string;
  app_name: string;
  working_directory: string;
  total_files: number;
  total_size_bytes: number;
  files: FileItem[];
  excluded_patterns: string[];
}

export interface FileContentsResponse {
  success: boolean;
  app_slug: string;
  app_name: string;
  working_directory: string;
  requested_files: string[];
  retrieved_files: number;
  files: FileItem[];
  errors: string[];
}

// Journey-specific response types
export interface JourneyFilesResponse {
  journey_id: string;
  journey_name: string;
  repository_status: 'cloned' | 'pulled' | 'local' | 'empty';
  total_files: number;
  files: FileItem[];
}

export interface JourneyFileContentsResponse {
  journey_id: string;
  journey_name: string;
  repository_status: 'cloned' | 'pulled' | 'local' | 'empty';
  total_size_bytes: number;
  files: FileItem[];
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  language: string;
  modified: boolean;
  original_content: string;
}

export interface TabItem {
  id: string;
  path: string;
  name: string;
  modified: boolean;
  active: boolean;
}

// File extension to language mapping for Monaco Editor
export const FILE_LANGUAGE_MAP: Record<string, string> = {
  'ts': 'typescript',
  'tsx': 'typescript',
  'js': 'javascript',
  'jsx': 'javascript',
  'py': 'python',
  'json': 'json',
  'html': 'html',
  'css': 'css',
  'scss': 'scss',
  'sass': 'sass',
  'md': 'markdown',
  'yml': 'yaml',
  'yaml': 'yaml',
  'xml': 'xml',
  'sql': 'sql',
  'sh': 'shell',
  'bash': 'shell',
  'dockerfile': 'dockerfile',
  'go': 'go',
  'rs': 'rust',
  'cpp': 'cpp',
  'c': 'c',
  'java': 'java',
  'php': 'php',
  'rb': 'ruby',
  'vue': 'vue',
  'svelte': 'svelte'
};

// File extension to icon mapping (using Lucide React icons)
export const FILE_ICON_MAP: Record<string, string> = {
  // Code files
  'ts': 'FileText',
  'tsx': 'FileText', 
  'js': 'FileText',
  'jsx': 'FileText',
  'py': 'FileText',
  'go': 'FileText',
  'rs': 'FileText',
  'java': 'FileText',
  'cpp': 'FileText',
  'c': 'FileText',
  'php': 'FileText',
  'rb': 'FileText',
  'vue': 'FileText',
  'svelte': 'FileText',
  
  // Config files
  'json': 'Settings',
  'yml': 'Settings',
  'yaml': 'Settings',
  'toml': 'Settings',
  'ini': 'Settings',
  'env': 'Settings',
  
  // Markup & Styles
  'html': 'Globe',
  'css': 'Palette',
  'scss': 'Palette',
  'sass': 'Palette',
  'md': 'FileText',
  'xml': 'Code',
  
  // Database
  'sql': 'Database',
  
  // Scripts
  'sh': 'Terminal',
  'bash': 'Terminal',
  'bat': 'Terminal',
  'ps1': 'Terminal',
  
  // Docker
  'dockerfile': 'Package',
  
  // Images
  'png': 'Image',
  'jpg': 'Image',
  'jpeg': 'Image',
  'gif': 'Image',
  'svg': 'Image',
  'ico': 'Image',
  
  // Documents
  'pdf': 'FileText',
  'txt': 'FileText',
  'log': 'FileText',
  
  // Package files
  'package.json': 'Package',
  'package-lock.json': 'Lock',
  'yarn.lock': 'Lock',
  'requirements.txt': 'Package',
  'Cargo.toml': 'Package',
  'go.mod': 'Package',
  
  // Default
  'default': 'File'
};

export const FOLDER_ICON = 'Folder';
export const FOLDER_OPEN_ICON = 'FolderOpen';