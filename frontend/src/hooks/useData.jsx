/**
 * DataProvider: opens the signed-in user's IndexedDB, starts the sync engine
 * and exposes `save` / `remove` helpers that write locally first.
 */
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createUserDb, getMeta } from '../db/db.js';
import { deleteRecord, saveRecord } from '../db/repo.js';
import { SyncEngine } from '../sync/engine.js';
import { api } from '../services/api.js';
import { session } from '../services/session.js';
import { useSession } from './useSession.js';
import Splash from '../components/Splash.jsx';

const DataContext = createContext(null);

export function DataProvider({ userId, children }) {
  const [ready, setReady] = useState(null);
  const current = useSession();

  useEffect(() => {
    let cancelled = false;
    const db = createUserDb(userId);
    const engine = new SyncEngine({
      db,
      client: api,
      canSync: () => {
        const s = session.get();
        return Boolean(s && !s.expired && s.refreshToken);
      },
      onProfile: (user) => session.update({ user }),
    });

    (async () => {
      const firstRun = !(await getMeta(db, 'lastPulledAt'));
      const started = engine.start();
      // On a brand-new device wait for the first download so the user sees their data.
      if (firstRun && navigator.onLine) await Promise.race([started, new Promise((r) => setTimeout(r, 15_000))]);
      if (!cancelled) setReady({ db, engine });
    })();

    return () => {
      cancelled = true;
      engine.stop();
      db.close();
    };
  }, [userId]);

  // After logging in again with an expired session, resume syncing.
  const canSync = Boolean(current && !current.expired);
  useEffect(() => {
    if (ready && canSync) ready.engine.request(0);
  }, [ready, canSync]);

  const value = useMemo(() => {
    if (!ready) return null;
    const { db, engine } = ready;
    return {
      db,
      engine,
      async save(entity, record) {
        const saved = await saveRecord(db, entity, record);
        engine.request();
        return saved;
      },
      async remove(entity, id) {
        await deleteRecord(db, entity, id);
        engine.request();
      },
    };
  }, [ready]);

  if (!value) return <Splash message="Setting up SpendWise on this device…" />;
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}

export function useSyncState() {
  const { engine } = useData();
  return useSyncExternalStore(
    (fn) => engine.subscribe(fn),
    () => engine.getState(),
  );
}
