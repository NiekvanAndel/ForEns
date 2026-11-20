/**
 * The rainfall total summed on the phone (`core/radar/nowcastSum`), with its PNGs
 * written to the cache directory so MapLibre's `ImageSource` can load them as
 * `file://` URIs — the same kind of URI the bundled dummy layers resolve to in a
 * release build.
 *
 * Only the newest run's images are kept: a run's files are replaced by the next
 * run's within twenty minutes, and the cache directory is the system's to clear in
 * any case.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { nowcastSumSource } from '../../core/radar/nowcastSum';

const FOLDER = 'cumulative';

function writePng(name: string, bytes: Uint8Array): string {
  const dir = new Directory(Paths.cache, FOLDER);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  // `cumulative-{prefix}-{h}h.png`: anything from another run is stale.
  const prefix = name.replace(/-\d+h\.png$/, '');
  for (const entry of dir.list()) {
    if (entry instanceof File && !entry.name.startsWith(prefix)) {
      try {
        entry.delete();
      } catch {
        // Something else holding it is no reason to fail the layer.
      }
    }
  }
  const file = new File(dir, name);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  return file.uri;
}

export const nowcastCumulativeSource = nowcastSumSource({ writePng });
