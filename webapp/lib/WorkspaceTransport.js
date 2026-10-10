import { createContext, useContext } from 'react';

// Explicit dependency injection for an isolated synthetic workspace. Normal
// application callers keep the browser's authenticated transport and clock.
const nativeRequest = (...args) => fetch(...args);
export const WorkspaceTransport = createContext({ request: nativeRequest, today: null });
export function useWorkspaceTransport() { return useContext(WorkspaceTransport); }
