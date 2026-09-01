/**
 * Preferences context.
 *
 * Preferences persist through AsyncStorage. The AgroExact API token is deliberately
 * not part of this object: it is a credential, so it lives in expo-secure-store and
 * is read only by the code that calls the API.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  DEFAULT_PREFS, mergePrefs, activeLocation, withCurrentLocation,
  type Prefs, type SavedLocation,
} from '../core/prefs';

const PREFS_KEY = 'exactcast.prefs.v1';
const TOKEN_KEY = 'exactcast.agro.token';

interface PrefsContextValue {
  prefs: Prefs;
  /** True until stored preferences have been read, so the UI can hold the splash. */
  ready: boolean;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  setPrefs: (patch: Partial<Prefs>) => void;
  location: SavedLocation;
  addLocation: (loc: SavedLocation) => void;
  removeLocation: (index: number) => void;
  /** Move a location to an arbitrary slot, for drag-and-drop reordering. */
  reorderLocation: (from: number, to: number) => void;
  selectLocation: (index: number) => void;
  /** Record where the device is as the first page, replacing any earlier fix. */
  setCurrentLocation: (loc: SavedLocation) => void;
  /** Credential access, kept off the Prefs object on purpose. */
  getAgroToken: () => Promise<string>;
  setAgroToken: (token: string) => Promise<void>;
}

const PrefsContext = createContext<PrefsContextValue | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setState] = useState<Prefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  /** Guards against a write racing the initial read and clobbering stored state. */
  const loaded = useRef(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(PREFS_KEY)
      .then((raw) => {
        if (!alive) return;
        if (raw) {
          try {
            setState(mergePrefs(JSON.parse(raw)));
          } catch {
            // Corrupt stored JSON must not block startup.
            setState({ ...DEFAULT_PREFS });
          }
        }
      })
      .finally(() => {
        if (!alive) return;
        loaded.current = true;
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)).catch(() => {
      // A failed write costs the setting on next launch, not the session.
    });
  }, [prefs]);

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setState((p) => ({ ...p, ...patch }));
  }, []);

  const setPref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setState((p) => ({ ...p, [key]: value }));
  }, []);

  const addLocation = useCallback((loc: SavedLocation) => {
    setState((p) => {
      const existing = p.locations.findIndex(
        (l) => Math.abs(l.lat - loc.lat) < 1e-4 && Math.abs(l.lon - loc.lon) < 1e-4
      );
      // Adding a place already saved selects it instead of duplicating the pill.
      if (existing >= 0) return { ...p, activeLocation: existing };
      return { ...p, locations: [...p.locations, loc], activeLocation: p.locations.length };
    });
  }, []);

  const removeLocation = useCallback((index: number) => {
    setState((p) => {
      // The app must always have somewhere to show.
      if (p.locations.length <= 1) return p;
      const locations = p.locations.filter((_, i) => i !== index);
      const active = p.activeLocation >= locations.length
        ? locations.length - 1
        : p.activeLocation > index ? p.activeLocation - 1 : p.activeLocation;
      return { ...p, locations, activeLocation: Math.max(0, active) };
    });
  }, []);

  const reorderLocation = useCallback((from: number, to: number) => {
    setState((p) => {
      if (from === to || from < 0 || to < 0) return p;
      if (from >= p.locations.length || to >= p.locations.length) return p;
      const locations = [...p.locations];
      const [item] = locations.splice(from, 1);
      locations.splice(to, 0, item as SavedLocation);
      // Follow the place, not the slot: whatever was being viewed stays selected.
      let active = p.activeLocation;
      if (active === from) active = to;
      else if (active > from && active <= to) active -= 1;
      else if (active < from && active >= to) active += 1;
      return { ...p, locations, activeLocation: active };
    });
  }, []);

  const setCurrentLocation = useCallback((loc: SavedLocation) => {
    setState((p) => withCurrentLocation(p, loc));
  }, []);

  const selectLocation = useCallback((index: number) => {
    setState((p) =>
      index >= 0 && index < p.locations.length ? { ...p, activeLocation: index } : p
    );
  }, []);

  const getAgroToken = useCallback(async () => {
    try {
      return (await SecureStore.getItemAsync(TOKEN_KEY)) ?? '';
    } catch {
      return '';
    }
  }, []);

  const setAgroToken = useCallback(async (token: string) => {
    const t = token.trim();
    if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  }, []);

  const value = useMemo<PrefsContextValue>(
    () => ({
      prefs, ready, setPref, setPrefs,
      location: activeLocation(prefs),
      addLocation, removeLocation, reorderLocation, selectLocation,
      setCurrentLocation, getAgroToken, setAgroToken,
    }),
    [
      prefs, ready, setPref, setPrefs, addLocation, removeLocation,
      reorderLocation, selectLocation, setCurrentLocation, getAgroToken, setAgroToken,
    ]
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs must be used inside a PrefsProvider');
  return ctx;
}
