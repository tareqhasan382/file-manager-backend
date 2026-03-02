export const PLAN_LIMITS = {
  FREE: {
    maxFiles: 2,
    maxFolders: 2,
    maxStorageMB: 10,
    maxFolderDepth: 2,
  },
  SILVER: {
    maxFiles: 4,
    maxFolders: 4,
    maxStorageMB: 100,
    maxFolderDepth: 4,
  },
  GOLD: {
    maxFiles: 20,
    maxFolders: 20,
    maxStorageMB: 500,
    maxFolderDepth: 6,
  },
  DIAMOND: {
    maxFiles: Infinity,
    maxFolders: Infinity,
    maxStorageMB: Infinity,
    maxFolderDepth: Infinity,
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;