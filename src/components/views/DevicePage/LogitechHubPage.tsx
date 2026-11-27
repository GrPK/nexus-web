import { useState, type ReactNode } from 'react';
import { Keyboard, Mouse, Speaker } from 'lucide-react';
import { ViewHeader } from '../../common/ViewHeader/ViewHeader';
import { sidebarDeviceName, type UnifiedDevice } from '../../../hooks/useUnifiedDevices';
import { LogitechKeyboardDevicePage } from './LogitechKeyboardDevicePage';
import { LogitechMouseDevicePage } from './LogitechMouseDevicePage';
import { LogitechSpeakerDevicePage } from './LogitechSpeakerDevicePage';
import styles from './LogitechHubPage.module.scss';

// Brand name, not translated.
const BRAND = 'Logitech';

// The Logitech devices this page holds, in the order of their tabs, with the page each opens.
const PAGES: readonly { id: string; icon: ReactNode; page: () => ReactNode }[] = [
  { id: 'logitech-mouse', icon: <Mouse size={14} />, page: () => <LogitechMouseDevicePage /> },
  { id: 'logitech-keyboard', icon: <Keyboard size={14} />, page: () => <LogitechKeyboardDevicePage /> },
  { id: 'logitech-speaker', icon: <Speaker size={14} />, page: () => <LogitechSpeakerDevicePage /> },
];

interface LogitechHubPageProps {
  /** The connected Logitech devices the page stands for (see groupLogitechDevices). */
  members: readonly UnifiedDevice[];
}

/**
 * The Logitech page: the mouse, the keyboard and the speakers in one place, like G HUB's one
 * window. A tab per device (named as the sidebar names it, "G502 X PLUS"), each showing that
 * device's whole page with its own tabs. The devices keep their own pages too, for search and
 * deep links.
 */
export function LogitechHubPage({ members }: LogitechHubPageProps) {
  const present = PAGES.flatMap(p => {
    const device = members.find(m => m.curatedId === p.id);
    return device ? [{ ...p, device }] : [];
  });
  const [active, setActive] = useState(present[0]?.id ?? PAGES[0].id);
  const current = present.find(p => p.id === active) ?? present[0];

  return (
    <div className={styles.hub}>
      <ViewHeader
        title={BRAND}
        tabs={present.map(p => ({ key: p.id, icon: p.icon, label: sidebarDeviceName(p.device) }))}
        activeTab={current?.id}
        onTabChange={setActive}
      />
      <div className={styles.body}>
        {current && <div key={current.id} className={styles.device}>{current.page()}</div>}
      </div>
    </div>
  );
}
