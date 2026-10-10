import { createContext, useContext } from 'react';
import { getCachedMe, fetchMe } from './meClient.js';

// Explicit dependency injection for an isolated synthetic workspace. Normal
// application callers keep the browser's authenticated transport and clock.
const nativeRequest = (...args) => fetch(...args);
export const WorkspaceTransport = createContext({
  request: nativeRequest,
  today: null,
  preserveLibraryPlanMetadata: false,
  refreshAccount: () => fetchMe({ force: true }),
  getAccountScope: () => getCachedMe()?.athlete?.id || 'current-session',
});
export function useWorkspaceTransport() { return useContext(WorkspaceTransport); }
