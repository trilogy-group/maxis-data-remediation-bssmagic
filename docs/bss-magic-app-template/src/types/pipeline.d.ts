export type PipelineModuleType = {
  id: string;
  name: string;
  userStories: UserStoryType[];
  maxQueueSize: number;
};

export type UserStoryType = {
  id: string;
  numberOfTasks: number;
  completedTasks: number;
  startedAt: string | null;
  status: "pending" | "running" | "completed" | "failed";
};
