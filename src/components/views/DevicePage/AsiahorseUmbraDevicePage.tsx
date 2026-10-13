import { useCallback, useEffect, useRef, useState } from 'react';
import { Lightbulb, Unplug } from 'lucide-react';
import { ViewHeader } from '../../common/ViewHeader/ViewHeader';
import { EmptyState } from '../../common/EmptyState/EmptyState';
import { SettingRow, SettingSelect, SettingToggle } from '../../common/SettingRow/SettingRow';
import { SettingsSection } from '../../common/SettingsSection/SettingsSection';
import { ChipGroup } from '../../common/ChipGroup/ChipGroup';
import { ColorSlots } from '../../common/ColorSlots/ColorSlots';
import { Slider } from '../../common/Slider/Slider';
import { HsvPicker } from '../../common/HsvPicker/HsvPicker';
import { Button } from '../../common/Button/Button';
import { Notice } from '../../common/Notice/Notice';
import { InlineError } from '../../common/InlineError/InlineError';
import { CoolingPageLink } from './CoolingPageLink';
import {
  autoDetectUmbra,
  getUmbraState,
  setUmbraBoot,
  setUmbraFan,
  setUmbraLighting,
  setUmbraPort,
  type UmbraBootMode,
  type UmbraBootPatch,
  type UmbraDirection,
  type UmbraEffectPatch,
  type UmbraGroup,
  type UmbraLightingPatch,
  type UmbraPortPatch,
  type UmbraSource,
  type UmbraState,
} from '../../../api/asiahorse-umbra';
import {
  COLOR_SLOTS,
  DEFAULT_COLOR,
  MAX_LED_COUNT,
  MIN_BRIGHTNESS_LEVEL,
  PERCENT_PER_LEVEL,
  activeSettings,
  effectsForGroup,
  levelToPercent,
  percentToLevel,
  populatedPorts,
  previewEffect,
  totalLeds,
  withColor,
} from './asiahorseUmbraUtils';
import { useUnitPrefs } from '../../../hooks/useUiSettings';
import { useTranslation } from '../../../lib/i18n';
import { localizeNumbers } from '../../../lib/units';
import { useReportDeviceWaiting } from './deviceDetecting';
import styles from './LianLiDevicePage.module.scss';

const POLL_MS = 3000;
type WriteCard = 'lighting' | 'ports' | 'fan' | 'boot';
const SOURCES: readonly UmbraSource[] = ['nexus', 'firmware', 'argbInput'];
const SOURCE_KEYS: Record<UmbraSource, string> = {
  nexus: 'sourceNexus',
  firmware: 'sourceFirmware',
  argbInput: 'sourceArgb',
};
const GROUPS: readonly UmbraGroup[] = ['sync', 'async', 'merge'];
const GROUP_KEYS: Record<UmbraGroup, string> = { sync: 'modeSync', async: 'modeAsync', merge: 'modeMerge' };
const DIRECTIONS: readonly UmbraDirection[] = ['forward', 'reverse'];
const CONNECTED_TONE = 'good' as const;
const BOOT_MODES: readonly UmbraBootMode[] = ['memory', 'fixed'];
const BOOT_KEYS = {
  memory: 'devices.asiahorse-umbra.bootMemory',
  fixed: 'devices.asiahorse-umbra.bootFixed',
} as const;
const PORT_ORDERS = Array.from({ length: 10 }, (_, i) => i + 1);

interface AsiahorseUmbraDevicePageProps {
  onSectionNavigate?: (section: string) => void;
}

export function AsiahorseUmbraDevicePage({ onSectionNavigate }: AsiahorseUmbraDevicePageProps) {
  const { t } = useTranslation();
  const { numberFormat } = useUnitPrefs();
  const [state, setState] = useState<UmbraState | null>(null);
  const [connection, setConnection] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  useReportDeviceWaiting(connection !== 'connected');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<Partial<Record<WriteCard, boolean>>>({});
  const [detecting, setDetecting] = useState(false);
  const [detectFailed, setDetectFailed] = useState(false);
  const [portIndex, setPortIndex] = useState<number | null>(null);
  const [asyncIndex, setAsyncIndex] = useState(0);
  const [colorSlot, setColorSlot] = useState(0);
  const aliveRef = useRef(true);
  // A write in flight, or an edit made moments ago: a poll landing then would
  // snap the control back to the old value.
  const busyRef = useRef(0);
  const lastEditRef = useRef(0);
  const detectingRef = useRef(false);
  // Bumped by every edit and write; a response older than the latest one is stale.
  const seqRef = useRef(0);

  const apply = useCallback((next: UmbraState) => {
    if (!aliveRef.current) return;
    setFailed({});
    setState(next);
    setConnection(next.isConnected ? 'connected' : 'disconnected');
  }, []);

  const refresh = useCallback(async () => {
    const held = () => busyRef.current > 0 || detectingRef.current || Date.now() - lastEditRef.current < POLL_MS;
    if (held()) return;
    const next = await getUmbraState();
    if (!aliveRef.current || next === null || held()) return;
    apply(next);
  }, [apply]);

  useEffect(() => {
    aliveRef.current = true;
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    const id = window.setInterval(() => { void refresh(); }, POLL_MS);
    return () => {
      aliveRef.current = false;
      window.removeEventListener('focus', onFocus);
      window.clearInterval(id);
    };
  }, [refresh]);

  // Runs a write; the service answers with the canonical state, which replaces the optimistic one
  // unless a newer edit has been made since.
  const write = useCallback(async (card: WriteCard, call: () => Promise<UmbraState | null>) => {
    const id = ++seqRef.current;
    busyRef.current += 1;
    setSaving(true);
    try {
      const next = await call();
      if (!aliveRef.current) return;
      if (!next) {
        setFailed(prev => ({ ...prev, [card]: true }));
      } else if (id === seqRef.current) {
        apply(next);
      } else {
        setFailed(prev => ({ ...prev, [card]: false }));
      }
    } finally {
      busyRef.current -= 1;
      if (aliveRef.current && busyRef.current === 0) setSaving(false);
    }
  }, [apply]);

  const commitLighting = useCallback((patch: UmbraLightingPatch) => {
    void write('lighting', () => setUmbraLighting(patch));
  }, [write]);

  const detect = useCallback(async () => {
    detectingRef.current = true;
    setDetecting(true);
    setDetectFailed(false);
    try {
      const next = await autoDetectUmbra();
      if (!aliveRef.current) return;
      if (next) apply(next);
      else setDetectFailed(true);
    } finally {
      detectingRef.current = false;
      if (aliveRef.current) setDetecting(false);
    }
  }, [apply]);

  if (connection === 'disconnected') {
    return (
      <div className={styles.page}>
        {/* eslint-disable-next-line i18next/no-literal-string -- brand + model name */}
        <ViewHeader title="Asiahorse Umbra V2" />
        <div className={`${styles.pageBody} pageBody`}>
          <EmptyState icon={<Unplug size={40} />} title={t('devices.asiahorse-umbra.notConnected')} />
        </div>
      </div>
    );
  }

  const loaded = state !== null;
  const lighting = state?.lighting;
  const source = lighting?.source ?? 'nexus';
  const firmwareSource = source === 'firmware';
  const ports = state?.ports ?? [];
  const populated = populatedPorts(ports);
  const group = lighting?.group ?? 'sync';
  const asyncPort = populated.some(p => p.index === asyncIndex) ? asyncIndex : populated[0]?.index ?? null;
  const asyncBlocked = group === 'async' && asyncPort === null;
  const settings = state && !asyncBlocked ? activeSettings(state, asyncPort ?? 0) : null;
  const effectList = state ? effectsForGroup(state.effects, group) : [];
  const spec = effectList.find(e => e.key === settings?.effect) ?? null;
  const slots = Math.min(spec?.colors ?? 0, COLOR_SLOTS);
  const slot = Math.min(colorSlot, Math.max(slots - 1, 0));
  const port = ports.find(p => p.index === portIndex) ?? populated[0] ?? ports[0];
  const pct = (v: number) => localizeNumbers(`${v}%`, numberFormat);

  const touch = () => {
    lastEditRef.current = Date.now();
    seqRef.current += 1;
  };

  // One edit of the shown effect: patch the cached value now, send it on commit.
  const edit = (patch: UmbraEffectPatch, commit: boolean) => {
    if (!state) return;
    touch();
    const target = asyncPort ?? 0;
    setState(prev => prev && previewEffect(prev, target, patch));
    if (commit) {
      if (group === 'async') commitLighting({ async: { ...patch, port: target } });
      else if (group === 'merge') commitLighting({ merge: patch });
      else commitLighting({ sync: patch });
    }
  };
  const editPort = (patch: UmbraPortPatch) => {
    if (!port) return;
    void write('ports', () => setUmbraPort(port.index, patch));
  };

  const commitBoot = (patch: UmbraBootPatch) => { void write('boot', () => setUmbraBoot(patch)); };

  const connectedState = loaded ? { label: t('devices.asiahorse-umbra.connected'), tone: CONNECTED_TONE } : undefined;
  const bootOptions = BOOT_MODES.map(m => ({ value: m, label: t(BOOT_KEYS[m]) }));

  return (
    <div className={styles.page}>
      <ViewHeader
        // eslint-disable-next-line i18next/no-literal-string -- brand + model name
        title="Asiahorse Umbra V2"
        actions={saving ? <span className={styles.savingBadge}>{t('devices.saving')}</span> : null}
      />
      <div className={`${styles.pageBody} pageBody`}>
        <SettingsSection title={t('devices.asiahorse-umbra.statusSection')} boxClassName={styles.sectionBox}>
          <SettingRow
            label={t('devices.asiahorse-umbra.connection')}
            state={connectedState}
          />
          <SettingRow label={t('devices.asiahorse-umbra.firmware')}>
            <span className={styles.rowValue}>{state?.firmware ?? ''}</span>
          </SettingRow>
          <SettingRow label={t('devices.asiahorse-umbra.deviceId')}>
            <span className={styles.rowValue}>{state?.deviceId ?? ''}</span>
          </SettingRow>
        </SettingsSection>

        <SettingsSection title={t('devices.asiahorse-umbra.lightingSection')} boxClassName={styles.sectionBox}>
          <div className={styles.colorBlock} data-settings-aside="true">
            <ChipGroup
              fullWidth
              ariaLabel={t('devices.asiahorse-umbra.source')}
              activeKey={source}
              options={SOURCES.map(s => ({ key: s, label: t(`devices.asiahorse-umbra.${SOURCE_KEYS[s]}`), disabled: !loaded }))}
              onChange={key => {
                if (!state) return;
                const next = key as UmbraSource;
                setState(prev => prev && { ...prev, lighting: { ...prev.lighting, source: next } });
                commitLighting({ source: next });
              }}
            />
          </div>

          {source === 'nexus' && (
            <>
              <p className={styles.customNote} data-settings-aside="true">{t('devices.asiahorse-umbra.sourceNexusHint')}</p>
              {onSectionNavigate && (
                <div data-settings-aside="true">
                  <Button
                    className={styles.lightingLink}
                    size="sm"
                    tone="neutral"
                    icon={<Lightbulb size={14} />}
                    onClick={() => onSectionNavigate('lighting')}
                  >
                    {t('smartLights.colorOnLightingPage')}
                  </Button>
                </div>
              )}
            </>
          )}

          {source === 'argbInput' && (
            <p className={styles.customNote} data-settings-aside="true">{t('devices.asiahorse-umbra.sourceArgbHint')}</p>
          )}

          {firmwareSource && lighting && (
            <>
              <SettingToggle
                label={t('devices.asiahorse-umbra.lightOn')}
                description={t('devices.asiahorse-umbra.lightOnHint')}
                checked={lighting.lightOn}
                onChange={on => {
                  if (!state) return;
                  setState(prev => prev && { ...prev, lighting: { ...prev.lighting, lightOn: on } });
                  commitLighting({ lightOn: on });
                }}
              />

              <div className={styles.colorBlock} data-settings-aside="true">
                <ChipGroup
                  fullWidth
                  ariaLabel={t('devices.asiahorse-umbra.mode')}
                  activeKey={group}
                  options={GROUPS.map(g => ({ key: g, label: t(`devices.asiahorse-umbra.${GROUP_KEYS[g]}`) }))}
                  onChange={key => {
                    if (!state) return;
                    const next = key as UmbraGroup;
                    setState(prev => prev && { ...prev, lighting: { ...prev.lighting, group: next } });
                    commitLighting({ group: next });
                  }}
                />
                <p className={styles.customNote}>{t(`devices.asiahorse-umbra.${GROUP_KEYS[group]}Hint`)}</p>
              </div>

              {asyncBlocked && (
                <div data-settings-aside="true">
                  <Notice tone="info">{t('devices.asiahorse-umbra.asyncNoPorts')}</Notice>
                </div>
              )}

              {settings && (
              <>
              {group === 'async' && (
                <SettingRow label={t('devices.asiahorse-umbra.port')}>
                  <ChipGroup
                    wrap
                    ariaLabel={t('devices.asiahorse-umbra.port')}
                    activeKey={String(asyncPort ?? 0)}
                    options={populated.map(p => ({
                      key: String(p.index),
                      label: localizeNumbers(String(p.index + 1), numberFormat),
                      ariaLabel: t('devices.asiahorse-umbra.portN', { n: p.index + 1 }),
                      tooltip: t('devices.asiahorse-umbra.ledCount', { n: p.ledCount }),
                    }))}
                    onChange={key => { setAsyncIndex(Number(key)); setColorSlot(0); }}
                  />
                </SettingRow>
              )}

              <div className={styles.colorBlock} data-settings-aside="true">
                <span className={styles.colorLabel}>{t('devices.asiahorse-umbra.effectLabel')}</span>
                <ChipGroup
                  wrap
                  ariaLabel={t('devices.asiahorse-umbra.effectLabel')}
                  activeKey={settings.effect}
                  options={effectList.map(e => ({ key: e.key, label: t(`devices.asiahorse-umbra.effect.${e.key}`) }))}
                  onChange={key => {
                    // Only the effect goes out: the service restores that effect's own last values.
                    edit({ effect: key }, true);
                    setColorSlot(0);
                  }}
                />
              </div>

              {spec?.speed && (
                <Slider
                  // eslint-disable-next-line i18next/no-literal-string -- slider layout enum
                  orientation="stacked"
                  editable
                  trackFill
                  label={t('devices.lianli.lightingSpeed')}
                  ariaLabel={t('devices.lianli.lightingSpeedAria')}
                  value={levelToPercent(settings.speed)}
                  min={0}
                  max={100}
                  step={PERCENT_PER_LEVEL}
                  formatValue={pct}
                  onChange={v => edit({ speed: percentToLevel(v, 0) }, false)}
                  onCommit={v => edit({ speed: percentToLevel(v, 0) }, true)}
                />
              )}

              <Slider
                // eslint-disable-next-line i18next/no-literal-string -- slider layout enum
                orientation="stacked"
                editable
                trackFill
                label={t('devices.lianli.lightingBrightness')}
                ariaLabel={t('devices.lianli.lightingBrightnessAria')}
                value={levelToPercent(settings.brightness)}
                min={levelToPercent(MIN_BRIGHTNESS_LEVEL)}
                max={100}
                step={PERCENT_PER_LEVEL}
                formatValue={pct}
                onChange={v => edit({ brightness: percentToLevel(v, MIN_BRIGHTNESS_LEVEL) }, false)}
                onCommit={v => edit({ brightness: percentToLevel(v, MIN_BRIGHTNESS_LEVEL) }, true)}
              />

              {spec?.direction && (
                <SettingSelect
                  label={t('devices.lianli.lightingDirection')}
                  value={settings.direction}
                  onChange={v => edit({ direction: v as UmbraDirection }, true)}
                  options={DIRECTIONS.map(d => ({
                    value: d,
                    label: t(d === 'forward' ? 'devices.asiahorse-umbra.directionForward' : 'devices.asiahorse-umbra.directionReverse'),
                  }))}
                />
              )}

              {slots > 0 && (
                <div className={styles.colorBlock} data-settings-aside="true">
                  <span className={styles.colorLabel}>{t('devices.asiahorse-umbra.colors')}</span>
                  {slots > 1 && (
                    <ColorSlots
                      ariaLabel={t('devices.asiahorse-umbra.colors')}
                      colors={Array.from({ length: slots }, (_, i) => settings.colors[i] ?? DEFAULT_COLOR)}
                      activeIndex={slot}
                      onSelect={setColorSlot}
                      slotLabel={i => t('devices.lianli.colorN', { n: i + 1 })}
                    />
                  )}
                  <HsvPicker
                    value={settings.colors[slot] ?? DEFAULT_COLOR}
                    onPreview={hex => edit({ colors: withColor(settings.colors, slot, hex, DEFAULT_COLOR) }, false)}
                    onCommit={hex => edit({ colors: withColor(settings.colors, slot, hex, DEFAULT_COLOR) }, true)}
                  />
                </div>
              )}
              </>
              )}
            </>
          )}

          {failed.lighting && <div data-settings-aside="true"><InlineError>{t('devices.asiahorse-umbra.saveFailed')}</InlineError></div>}
        </SettingsSection>

        <SettingsSection
          title={t('devices.asiahorse-umbra.portsSection')}
          description={t('devices.asiahorse-umbra.portsHint')}
          boxClassName={styles.sectionBox}
        >
          <SettingRow
            label={t('devices.asiahorse-umbra.autoDetect')}
            description={t('devices.asiahorse-umbra.autoDetectHint')}
          >
            <Button size="sm" tone="neutral" disabled={!loaded || detecting} onClick={() => { void detect(); }}>
              {t('devices.asiahorse-umbra.autoDetect')}
            </Button>
          </SettingRow>
          <div role="status" data-settings-aside="true">
            {detecting && <Notice tone="info">{t('devices.asiahorse-umbra.autoDetecting')}</Notice>}
          </div>
          {detectFailed && (
            <div data-settings-aside="true"><InlineError>{t('devices.asiahorse-umbra.autoDetectFailed')}</InlineError></div>
          )}
          {loaded && (
            <>
              <SettingRow label={t('devices.asiahorse-umbra.portsWithLeds')}>
                <span className={styles.rowValue}>{localizeNumbers(String(populated.length), numberFormat)}</span>
              </SettingRow>
              <SettingRow label={t('devices.asiahorse-umbra.totalLeds')}>
                <span className={styles.rowValue}>{localizeNumbers(String(totalLeds(ports)), numberFormat)}</span>
              </SettingRow>
            </>
          )}

          <SettingRow label={t('devices.asiahorse-umbra.port')}>
            <ChipGroup
              wrap
              ariaLabel={t('devices.asiahorse-umbra.port')}
              activeKey={String(port?.index ?? 0)}
              options={ports.map(p => ({
                key: String(p.index),
                label: p.ledCount > 0
                  ? `${localizeNumbers(String(p.index + 1), numberFormat)} (${localizeNumbers(String(p.ledCount), numberFormat)})`
                  : localizeNumbers(String(p.index + 1), numberFormat),
                ariaLabel: t('devices.asiahorse-umbra.portN', { n: p.index + 1 }),
                tooltip: t('devices.asiahorse-umbra.ledCount', { n: p.ledCount }),
              }))}
              onChange={key => setPortIndex(Number(key))}
            />
          </SettingRow>

          {port && (
            <>
              <Slider
                // eslint-disable-next-line i18next/no-literal-string -- slider layout enum
                orientation="stacked"
                editable
                trackFill
                label={t('devices.asiahorse-umbra.ledCountLabel')}
                ariaLabel={t('devices.asiahorse-umbra.ledCountAria', { n: port.index + 1 })}
                value={port.ledCount}
                min={0}
                max={MAX_LED_COUNT}
                step={1}
                disabled={detecting}
                onChange={v => {
                  const ledCount = Math.round(v);
                  touch();
                  setState(prev => prev && ({
                    ...prev,
                    ports: prev.ports.map(p => (p.index === port.index ? { ...p, ledCount } : p)),
                  }));
                }}
                onCommit={v => editPort({ ledCount: Math.round(v) })}
              />
              <SettingSelect
                label={t('devices.asiahorse-umbra.flow')}
                value={port.direction}
                disabled={detecting}
                onChange={v => editPort({ direction: v as UmbraDirection })}
                options={DIRECTIONS.map(d => ({
                  value: d,
                  label: t(d === 'forward' ? 'devices.asiahorse-umbra.directionForward' : 'devices.asiahorse-umbra.directionReverse'),
                }))}
              />
              <SettingSelect
                label={t('devices.asiahorse-umbra.order')}
                value={String(port.order)}
                disabled={detecting}
                onChange={v => editPort({ order: Number(v) })}
                options={PORT_ORDERS.map(n => ({ value: String(n), label: localizeNumbers(String(n), numberFormat) }))}
              />
            </>
          )}
          {failed.ports && <div data-settings-aside="true"><InlineError>{t('devices.asiahorse-umbra.saveFailed')}</InlineError></div>}
        </SettingsSection>

        <SettingsSection title={t('devices.asiahorse-umbra.fanSection')} boxClassName={styles.sectionBox}>
          <SettingToggle
            label={t('devices.asiahorse-umbra.fanSync')}
            description={t('devices.asiahorse-umbra.fanSyncHint')}
            checked={state?.fan.syncMb ?? false}
            disabled={!loaded}
            onChange={on => {
              if (!state) return;
              setState(prev => prev && { ...prev, fan: { ...prev.fan, syncMb: on } });
              void write('fan', () => setUmbraFan(on));
            }}
          />
          {loaded && state && !state.fan.syncMb && (
            <CoolingPageLink hint={t('devices.coolingPage.speedHint')} onSectionNavigate={onSectionNavigate} />
          )}
          {failed.fan && <div data-settings-aside="true"><InlineError>{t('devices.asiahorse-umbra.saveFailed')}</InlineError></div>}
        </SettingsSection>

        <SettingsSection title={t('devices.asiahorse-umbra.bootSection')} boxClassName={styles.sectionBox}>
          <SettingSelect
            label={t('devices.asiahorse-umbra.bootMode')}
            description={t('devices.asiahorse-umbra.bootModeHint')}
            descriptionBelow
            value={state?.boot.mode ?? 'memory'}
            disabled={!loaded}
            onChange={v => commitBoot({ mode: v === 'fixed' ? 'fixed' : 'memory' })}
            options={bootOptions}
          />
          <SettingToggle
            label={t('devices.asiahorse-umbra.selfCheck')}
            description={t('devices.asiahorse-umbra.selfCheckHint')}
            checked={state?.boot.selfCheck ?? false}
            disabled={!loaded}
            onChange={on => commitBoot({ selfCheck: on })}
          />
          {failed.boot && <div data-settings-aside="true"><InlineError>{t('devices.asiahorse-umbra.saveFailed')}</InlineError></div>}
        </SettingsSection>
      </div>
    </div>
  );
}
