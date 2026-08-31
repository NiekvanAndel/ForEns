/**
 * Radar provider registry.
 *
 * Screens resolve their provider through `activeProvider()` and never construct one,
 * so adding ExactCast's own radar and nowcast means registering an adapter here and
 * changing the default — nothing in the UI moves.
 */
import type { RadarProvider } from './types';
import { RainViewerProvider } from './rainviewer';

export * from './types';
export * from './labels';
export { RainViewerProvider, buildProfile } from './rainviewer';

const providers = new Map<string, RadarProvider>();
let activeId = 'rainviewer';

export function registerProvider(provider: RadarProvider): void {
  providers.set(provider.id, provider);
}

/** Select the active provider. Throws on an unregistered id, so a typo in
 *  configuration fails at startup rather than as a blank map. */
export function setActiveProvider(id: string): void {
  if (!providers.has(id)) {
    throw new Error(`radar: no provider registered with id "${id}"`);
  }
  activeId = id;
}

export function activeProvider(): RadarProvider {
  const p = providers.get(activeId);
  if (!p) throw new Error(`radar: active provider "${activeId}" is not registered`);
  return p;
}

export function listProviders(): RadarProvider[] {
  return [...providers.values()];
}

registerProvider(new RainViewerProvider());
