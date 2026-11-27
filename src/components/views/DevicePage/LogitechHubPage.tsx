import { useState, type ReactNode } from 'react';
import { Keyboard, Mouse, Speaker } from 'lucide-react';
import { ViewHeader } from '../../common/ViewHeader/ViewHeader';
import { sidebarDeviceName, type UnifiedDevice } from '../../../hooks/useUnifiedDevices';
import { InLogitechHub } from './logitechHubContext';
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
 * The Logitech page, like the Lian Li one: a tab per device (named as the sidebar names it,
 * "G502 X PLUS"); each device shows all its sections one under the other (the mouse's assignments
 * then its sensitivity, the speakers' acoustics then surround), with no second row of tabs. The
 * devices keep their own pages too, for search and deep links.
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
      <InLogitechHub.Provider value>
        {current && <div key={current.id} className={styles.device}>{current.page()}</div>}
      </InLogitechHub.Provider>
    </div>
  );
}
