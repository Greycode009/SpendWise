import { useSyncExternalStore } from 'react';
import { session } from '../services/session.js';

export function useSession() {
  return useSyncExternalStore(session.subscribe, session.get, session.get);
}

export function useCurrency() {
  return useSession()?.user?.currency || 'NPR';
}
