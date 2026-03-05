// Example usage of the BSS Magic API Client
// This file demonstrates how to integrate the API into React components

import React, { useEffect, useState } from 'react';
import { bssMagicApi } from './index';
import type { Project, BRD, ProjectListParams } from './types';

/**
 * Example component showing how to use the BSS Magic API
 */
export const BSSMagicExample: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [brds, setBrds] = useState<BRD[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check API health on component mount
  useEffect(() => {
    checkApiHealth();
  }, []);

  const checkApiHealth = async () => {
    try {
      const health = await bssMagicApi.getHealthStatus();
      console.log('API Health:', health);

      if (health.status === 'healthy') {
        // API is healthy, load initial data
        await loadProjects();
      }
    } catch (err) {
      setError(`API is not accessible: ${err.message}`);
    }
  };

  const loadProjects = async (params?: ProjectListParams) => {
    setLoading(true);
    setError(null);

    try {
      const response = await bssMagicApi.listProjects({
        limit: 10,
        offset: 0,
        'filter[status]': 'active',
        ...params
      });

      setProjects(response.items);
    } catch (err) {
      setError(`Failed to load projects: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadBRDsForProject = async (projectId: string) => {
    setLoading(true);
    setError(null);

    try {
      // Using filter to load BRDs for specific project
      const response = await bssMagicApi.listBRDs({
        'filter[project_id]': projectId,
        limit: 50,
        sort: 'created_at:desc'
      });

      setBrds(response.items);
    } catch (err) {
      setError(`Failed to load BRDs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    setLoading(true);
    setError(null);

    try {
      const newProject = await bssMagicApi.createProject({
        slug: `project-${Date.now()}`,
        name: 'New Project',
        description: 'Created from BSS Magic UI',
        status: 'active',
        metadata: {
          createdBy: 'BSS Magic UI',
          createdAt: new Date().toISOString()
        }
      });

      // Reload projects to include the new one
      await loadProjects();

      // Select the new project
      setSelectedProject(newProject);
    } catch (err) {
      setError(`Failed to create project: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createBRD = async () => {
    if (!selectedProject) {
      setError('Please select a project first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Using the regular endpoint with project_id in body
      const newBRD = await bssMagicApi.createBRD({
        project_id: selectedProject.id,
        title: 'New Business Requirements',
        version: '1.0.0',
        status: 'draft',
        content: {
          summary: 'Business requirements created from UI',
          details: 'This is a sample BRD'
        },
        business_objectives: {
          primary: 'Improve customer experience',
          secondary: ['Increase revenue', 'Reduce costs']
        },
        priority: 'medium'
      });

      // Reload BRDs to include the new one
      await loadBRDsForProject(selectedProject.id);

      console.log('Created BRD:', newBRD);
    } catch (err) {
      setError(`Failed to create BRD: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await bssMagicApi.deleteProject(projectId);

      // Reload projects
      await loadProjects();

      // Clear selection if deleted project was selected
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
        setBrds([]);
      }
    } catch (err) {
      setError(`Failed to delete project: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">BSS Magic API Example</h2>

      {/* Error display */}
      {error && (
        <div className="bg-error-50 text-error-700 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="bg-navigation-50 text-navigation-700 p-4 rounded-lg">
          Loading...
        </div>
      )}

      {/* API Status */}
      <div className="bg-background-paper p-4 rounded-lg border border-border">
        <h3 className="font-semibold mb-2">API Configuration</h3>
        <p className="text-sm text-text-secondary">
          Base URL: {bssMagicApi.getBaseUrl()}
        </p>
        <p className="text-sm text-text-secondary">
          Authentication: Using Cognito tokens
        </p>
      </div>

      {/* Projects Section */}
      <div className="bg-background-paper p-4 rounded-lg border border-border">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Projects</h3>
          <button
            onClick={createProject}
            disabled={loading}
            className="px-3 py-1.5 bg-primary text-white rounded-md hover:bg-primary-600 disabled:opacity-50"
          >
            Create Project
          </button>
        </div>

        <div className="space-y-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`p-3 rounded-md border cursor-pointer transition-colors ${
                selectedProject?.id === project.id
                  ? 'bg-primary-50 border-primary'
                  : 'bg-background border-border hover:bg-neutral-50'
              }`}
              onClick={() => {
                setSelectedProject(project);
                loadBRDsForProject(project.id);
              }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-text-primary">{project.name}</p>
                  <p className="text-sm text-text-secondary">{project.description}</p>
                  <p className="text-xs text-text-tertiary mt-1">
                    Status: {project.status} | Created: {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteProject(project.id);
                  }}
                  className="px-2 py-1 text-xs bg-error-50 text-error-700 rounded hover:bg-error-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BRDs Section */}
      {selectedProject && (
        <div className="bg-background-paper p-4 rounded-lg border border-border">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">BRDs for {selectedProject.name}</h3>
            <button
              onClick={createBRD}
              disabled={loading}
              className="px-3 py-1.5 bg-success text-white rounded-md hover:bg-success-600 disabled:opacity-50"
            >
              Create BRD
            </button>
          </div>

          <div className="space-y-2">
            {brds.length === 0 ? (
              <p className="text-text-secondary">No BRDs found for this project</p>
            ) : (
              brds.map((brd) => (
                <div
                  key={brd.id}
                  className="p-3 bg-background rounded-md border border-border"
                >
                  <p className="font-medium text-text-primary">{brd.title}</p>
                  <p className="text-sm text-text-secondary">
                    Version: {brd.version} | Status: {brd.status} | Priority: {brd.priority}
                  </p>
                  <p className="text-xs text-text-tertiary mt-1">
                    Created: {new Date(brd.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BSSMagicExample;