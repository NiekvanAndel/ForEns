/**
 * The layer switcher on 'Verwachting'.
 *
 * The row itself is `ui/PillSwitcher`, shared with the measurement switcher on
 * 'Grafiek' — see the note there. What is left here is this page's own part: which
 * layers there are, and what they are called in the reader's language.
 */
import { PillSwitcher, type PillItem } from '../PillSwitcher';
import { usePrefs } from '../../state/prefs';
import { t } from '../../core/i18n';
import { LAYERS, type LayerKey } from '../../core/model/layers';
import type { IconName } from '../Icon';

export function LayerSwitcher({
  active, onChange,
}: { active: LayerKey; onChange: (k: LayerKey) => void }) {
  const { prefs } = usePrefs();

  const items: PillItem<LayerKey>[] = LAYERS.map((layer) => ({
    key: layer.key,
    icon: layer.icon as IconName,
    label: t(layer.labelKey, prefs.lang),
  }));

  return <PillSwitcher items={items} active={active} onChange={onChange} paddingBottom={10} />;
}
