import { useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { DevicePageLightingDevice } from '../../../../api/lighting';
import { DeviceContextMenu, type DeviceMenuItem } from '../../../../components/common/DeviceCanvas/DeviceContextMenu';
import { MenuArrowButton } from '../../../../components/common/DeviceCanvas/MenuArrowButton';
import { DeviceSourceBadge } from './ZoneCard';
import { useTranslation } from '../../../../lib/i18n';
import styles from '../LightingPage.module.scss';

/** A device whose lighting is set on its device page; a click or its menu opens that page. */
export function DevicePageCard({ device, onOpen }: { device: DevicePageLightingDevice; onOpen: () => void }) {
  const { t } = useTranslation();
  // seq remounts the menu on every open, as on ZoneCard.
  const [menuAt, setMenuAt] = useState<{ x: number; y: number; seq: number } | null>(null);
  const menuSeq = useRef(0);
  const openMenu = (x: number, y: number) => setMenuAt({ x, y, seq: ++menuSeq.current });
  const argb = device.reason === 'argbInput';
  const menuItems: DeviceMenuItem[] = [{
    key: 'openDevicePage',
    icon: <SlidersHorizontal size={14} />,
    label: t('lighting.devices.menuOpenDevicePage'),
    onSelect: onOpen,
  }];
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={device.name}
        className={`${styles.deviceCard} ${styles.deviceCardPoweredOff} ${styles.deviceCardZone}`}
        data-menu-arrow-host
        onClick={onOpen}
        onKeyDown={e => {
          if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
          e.preventDefault();
          onOpen();
        }}
        onContextMenu={e => {
          e.preventDefault();
          e.stopPropagation();
          openMenu(e.clientX, e.clientY);
        }}
      >
        <div className={styles.deviceCardBody}>
          <div className={styles.deviceNameRow}>
            <span className={styles.deviceName}>{device.name}</span>
          </div>
          <div className={styles.deviceMetaRow}>
            <DeviceSourceBadge
              argb={argb}
              tooltip={t(argb ? 'lighting.devices.devicePageArgbTooltip' : 'lighting.devices.devicePageFirmwareTooltip')}
            />
          </div>
        </div>
        <MenuArrowButton
          variant="card"
          label={t('lighting.devices.moreActions')}
          tooltip={t('lighting.devices.moreActions')}
          open={menuAt != null}
          onOpen={openMenu}
          onClose={() => setMenuAt(null)}
        />
      </div>
      {menuAt && (
        <DeviceContextMenu
          key={menuAt.seq}
          x={menuAt.x}
          y={menuAt.y}
          items={menuItems}
          onClose={() => setMenuAt(null)}
        />
      )}
    </>
  );
}
