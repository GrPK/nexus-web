import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Film } from 'lucide-react';
import { Button } from '../../common/Button/Button';
import { Checkbox } from '../../common/Checkbox/Checkbox';
import { ConfirmModal } from '../../common/ConfirmModal/ConfirmModal';
import { EffectCard } from '../../common/EffectCard/EffectCard';
import { EmptyState } from '../../common/EmptyState/EmptyState';
import { MediaCropper, type NormalizedCrop } from '../../common/MediaCropper/MediaCropper';
import { Notice, NoticeSecondary } from '../../common/Notice/Notice';
import { SettingSelect, SettingSlider, SettingToggle } from '../../common/SettingRow/SettingRow';
import { SettingsSection } from '../../common/SettingsSection/SettingsSection';
import { Spinner } from '../../common/Spinner/Spinner';
import { ViewHeader } from '../../common/ViewHeader/ViewHeader';
import {
  LIANLI_SCREEN88_SAVER_MINUTES,
  lianLiScreen88VideoAspect,
  deleteLianLiScreen88Media,
  getLianLiScreen88LConnectVideos,
  getLianLiScreen88Media,
  importLianLiScreen88LConnectVideos,
  uploadLianLiScreen88Media,
  type LConnectVideos,
  type LianLiScreen88MediaItem,
} from '../../../api/lianliScreen88';
import { useUnitPrefs } from '../../../hooks/useUiSettings';
import { useTranslation } from '../../../lib/i18n';
import { localizeNumbers } from '../../../lib/units';
import { useLianLiScreen88Screen, type LianLiScreen88Screen } from './useLianLiScreen88Screen';
import styles from './LianLiDevicePage.module.scss';
import pageStyles from './DevicePage.module.scss';

const MEDIA_POLL_MS = 2000;
const BYTES_PER_MB = 1024 * 1024;
// A refused import is a failure, not a hint.
const IMPORT_FAILED_TONE = 'critical' as const;

interface CropTarget {
  src: string;
  file: File;
  /** The mount the crop is made for, fixed when the file is picked: its aspect and which crop field it fills. */
  aspect: number;
  portrait: boolean;
}

interface SectionProps {
  screen: LianLiScreen88Screen;
  /** The Screen section's title; "Screen" by default (the Lian Li page names the device). */
  title?: string;
}

/**
 * The Universal Screen 8.8's screen: a Nexus panel or a video on the glass's own decoder,
 * the video library (uploads and L-Connect's own videos), the screen saver, Offline Mode
 * and the Windows display switch. While the glass sits in its own Windows display mode it
 * shows that instead, with the switch back. The screen, library and saver wording is the
 * OLED Curved's: the same decoder features under the same names.
 */
export function LianLiScreen88Settings({ screen, title }: SectionProps) {
  switch (screen.view) {
    case 'windows': return <LianLiScreen88WindowsDisplay screen={screen} title={title} />;
    case 'restarting': return <LianLiScreen88Restarting screen={screen} title={title} />;
    case 'panel': return <LianLiScreen88PanelSettings screen={screen} title={title} />;
    default: return null;
  }
}

/**
 * Every view of the 8.8's own page (its panel page, its row without a panel, a page whose row has
 * gone) goes through this, so a press on the Windows display switch changes the page at once and
 * the service's pushes settle it, whatever the device list still shows: the Windows display view
 * (heading, notice, the switch), the switch alone while the glass restarts as a panel, or
 * `fallback` (the panel page, or the usual not-connected page).
 */
export function LianLiScreen88PageGate({ name, fallback }: { name: string; fallback: ReactNode }) {
  const screen = useLianLiScreen88Screen(true);
  // The first read decides, so neither view flashes before the right one.
  if (!screen.loaded && !screen.pendingMode) return null;
  if (screen.view !== 'windows' && screen.view !== 'restarting') return <>{fallback}</>;
  return (
    <div className={pageStyles.page}>
      <ViewHeader title={name} />
      <div className={`${pageStyles.pageBody} pageBody`}>
        {/* The page header shows no name of its own here, so the section carries it. */}
        <LianLiScreen88Settings screen={screen} title={name} />
      </div>
    </div>
  );
}

function LianLiScreen88WindowsDisplay({ screen, title }: SectionProps) {
  const { t } = useTranslation();
  // Heading, then the notice, then the card holding only the switch.
  return (
    <SettingsSection
      title={title ?? t('devices.lianliCurve.screenSection')}
      description={(
        <Notice tone="info" role="status">
          <span>{t('devices.lianliScreen88.windowsDisplayActive')}</span>
          <NoticeSecondary>{t('devices.lianliScreen88.windowsDisplayActiveHint')}</NoticeSecondary>
        </Notice>
      )}
    >
      <WindowsDisplaySwitch screen={screen} />
    </SettingsSection>
  );
}

/** On the way back to a panel: only the switch, restarting, until the glass is a panel again. */
function LianLiScreen88Restarting({ screen, title }: SectionProps) {
  const { t } = useTranslation();
  return (
    <SettingsSection title={title ?? t('devices.lianliCurve.screenSection')}>
      <WindowsDisplaySwitch screen={screen} />
    </SettingsSection>
  );
}

/**
 * The glass as a Windows monitor (L-Connect's secondary screen) or a Nexus screen. Either way
 * restarts the glass, so both ask first; the page shows the new mode as soon as the user confirms,
 * and the row says the screen is restarting until the service shows it there. Only the user flips
 * it: Nexus never does.
 */
function WindowsDisplaySwitch({ screen }: { screen: LianLiScreen88Screen }) {
  const { settings, view, pendingMode, write, switchWindowsDisplay } = screen;
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState<'on' | 'off' | null>(null);
  if (!settings && !pendingMode) return null;
  const asWindows = view === 'windows';
  const restarting = pendingMode !== null;
  // Not pressed here: the service may still be on an earlier request (L-Connect open, Nexus Control off).
  const serviceWaiting = !restarting && !!settings
    && (asWindows ? settings.windowsDisplay === false : settings.windowsDisplay === true);
  const checked = restarting ? pendingMode === 'windows' : asWindows !== serviceWaiting;
  const description = restarting
    ? t('devices.lianliScreen88.restarting')
    : asWindows
      ? t(serviceWaiting ? 'devices.lianliScreen88.windowsDisplayReturning' : 'devices.lianliScreen88.windowsDisplayBackHint')
      : t(serviceWaiting ? 'devices.lianliScreen88.windowsDisplaySwitching' : 'devices.lianliScreen88.windowsDisplayHint');
  const onChange = (on: boolean) => {
    // Back to the mode the glass is in only drops the service's waiting request: nothing restarts.
    if (on === asWindows) {
      void write({ windowsDisplay: on });
      return;
    }
    setConfirm(on ? 'on' : 'off');
  };
  return (
    <>
      <SettingToggle
        label={t('devices.lianliScreen88.windowsDisplay')}
        description={description}
        checked={checked}
        disabled={restarting}
        onChange={onChange}
      />
      <ConfirmModal
        open={confirm !== null}
        title={t(confirm === 'off' ? 'devices.lianliScreen88.windowsDisplayOffTitle' : 'devices.lianliScreen88.windowsDisplayOnTitle')}
        message={t(confirm === 'off' ? 'devices.lianliScreen88.windowsDisplayOffMessage' : 'devices.lianliScreen88.windowsDisplayOnMessage')}
        confirmLabel={t('devices.lianliScreen88.restartScreen')}
        destructive={false}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const on = confirm === 'on';
          setConfirm(null);
          void switchWindowsDisplay(on);
        }}
      />
    </>
  );
}

function LianLiScreen88PanelSettings({ screen, title }: SectionProps) {
  const { settings, write, previewBrightness, commitBrightness, refresh: refreshSettings } = screen;
  const { t } = useTranslation();
  const { numberFormat } = useUnitPrefs();
  const [media, setMedia] = useState<LianLiScreen88MediaItem[]>([]);
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mediaError, setMediaError] = useState<'upload' | 'delete' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LianLiScreen88MediaItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const aliveRef = useRef(true);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cropTargetRef = useRef<CropTarget | null>(null);

  const refreshMedia = useCallback(async () => {
    const m = await getLianLiScreen88Media();
    if (aliveRef.current && m) setMedia(m);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void refreshMedia();
    return () => {
      aliveRef.current = false;
      if (cropTargetRef.current) URL.revokeObjectURL(cropTargetRef.current.src);
    };
  }, [refreshMedia]);

  const processing = media.some(m => !m.ready);
  useEffect(() => {
    if (!processing) return undefined;
    const id = window.setInterval(() => { if (!document.hidden) void refreshMedia(); }, MEDIA_POLL_MS);
    return () => window.clearInterval(id);
  }, [processing, refreshMedia]);

  // The thumbnails follow the mount, so a quarter turn reads them again.
  const portrait = settings?.videoPortrait === true;
  const videoAspect = lianLiScreen88VideoAspect(settings);
  const shownPortraitRef = useRef(portrait);
  useEffect(() => {
    if (shownPortraitRef.current === portrait) return;
    shownPortraitRef.current = portrait;
    void refreshMedia();
  }, [portrait, refreshMedia]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMediaError(null);
    const target = { src: URL.createObjectURL(file), file, aspect: videoAspect, portrait };
    cropTargetRef.current = target;
    setCropTarget(target);
  };

  const closeCropper = useCallback((target: CropTarget) => {
    URL.revokeObjectURL(target.src);
    cropTargetRef.current = null;
    setCropTarget(null);
  }, []);

  const onCropConfirm = useCallback(async (crop: NormalizedCrop) => {
    if (!cropTarget) return;
    setUploading(true);
    try {
      const uploaded = await uploadLianLiScreen88Media(cropTarget.file, crop, cropTarget.portrait);
      if (aliveRef.current) setMediaError(uploaded ? null : 'upload');
      if (uploaded?.name) void write({ screenMode: 'video', video: uploaded.name });
      await refreshMedia();
    } finally {
      if (aliveRef.current) {
        setUploading(false);
        closeCropper(cropTarget);
      }
    }
  }, [cropTarget, closeCropper, refreshMedia, write]);

  if (!settings) return null;

  const videoMode = settings.screenMode === 'video';
  const saverOn = settings.screenSaverMinutes > 0;
  const readyMedia = media.filter(m => m.ready);
  const playingLabel = settings.playing
    ? (media.find(m => m.name === settings.playing)?.label ?? settings.playing)
    : null;
  const modeOptions = [
    { value: 'nexus', label: t('devices.lianliCurve.screenModeNexus') },
    { value: 'video', label: t('devices.lianliCurve.screenModeVideo') },
  ];
  const saverVideoValue = settings.screenSaverVideo ?? '';

  return (
    <>
      <SettingsSection title={title ?? t('devices.lianliCurve.screenSection')}>
        <SettingSelect
          label={t('devices.lianliCurve.screenContent')}
          value={settings.screenMode}
          onChange={v => { void write({ screenMode: v === 'video' ? 'video' : 'nexus' }); }}
          options={modeOptions}
        />

        {videoMode && (
          <div className={styles.libraryBlock} data-settings-aside="true">
            <div className={styles.libraryHeaderRow}>
              <Button size="sm" tone="neutral" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? t('devices.lianliCurve.mediaUploading') : t('devices.lianliCurve.mediaUpload')}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className={styles.hiddenInput}
                onChange={onPickFile}
              />
              <Button size="sm" tone="neutral" onClick={() => setImportOpen(true)}>
                {t('devices.lianliScreen88.lconnectImport')}
              </Button>
              {playingLabel && (
                <span className={styles.customNote}>
                  {t('devices.lianliCurve.mediaNowPlaying', { name: playingLabel })}
                </span>
              )}
            </div>
            {mediaError && (
              <p className={styles.customNote} role="alert">
                {mediaError === 'upload'
                  ? t('devices.lianliCurve.mediaUploadFailed')
                  : t('devices.lianliCurve.mediaDeleteFailed')}
              </p>
            )}

            {media.length > 0 ? (
              <div className={portrait ? `${styles.mediaGrid} ${styles.mediaGridPortrait}` : styles.mediaGrid}>
                {media.map(item => (
                  item.ready ? (
                    <EffectCard
                      key={item.name}
                      asDiv
                      label={item.label}
                      thumbUrl={item.thumb ?? null}
                      thumbStatic
                      thumbAspect={videoAspect}
                      active={item.name === settings.video}
                      onClick={() => { void write({ screenMode: 'video', video: item.name }); }}
                      onDelete={() => setPendingDelete(item)}
                      deleteAriaLabel={t('devices.lianliCurve.mediaDeleteAria')}
                    />
                  ) : (
                    <EffectCard
                      key={item.name}
                      asDiv
                      nonInteractive
                      label={item.label}
                      meta={t('devices.lianliCurve.mediaProcessing')}
                      thumbUrl={item.thumb ?? null}
                      thumbStatic
                      thumbAspect={videoAspect}
                      active={false}
                      thumbOverlay={<span className={styles.mediaOverlay} role="status" aria-label={t('devices.lianliCurve.mediaProcessing')}><Spinner size={26} /></span>}
                    />
                  )
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Film size={28} />}
                title={t('devices.lianliCurve.mediaEmpty')}
                hint={t('devices.lianliScreen88.mediaEmptyHint')}
                compact
              />
            )}
          </div>
        )}
        <SettingToggle
          label={t('devices.lianliCurve.offlineMode')}
          description={t('devices.lianliCurve.offlineModeHint')}
          checked={settings.offlineMode === true}
          onChange={offlineMode => { void write({ offlineMode }); }}
        />
        <WindowsDisplaySwitch screen={screen} />
      </SettingsSection>

      <SettingsSection title={t('devices.lianliCurve.saverSection')}>
        <SettingSelect
          label={t('devices.lianliCurve.saverInterval')}
          description={t('devices.lianliScreen88.saverHint')}
          value={String(settings.screenSaverMinutes)}
          onChange={v => { void write({ screenSaverMinutes: Number(v) }); }}
          options={LIANLI_SCREEN88_SAVER_MINUTES.map(n => ({
            value: String(n),
            label: n === 0
              ? t('devices.lianliCurve.saverOff')
              : t('devices.lianliCurve.saverMinutes', { n: localizeNumbers(String(n), numberFormat) }),
          }))}
        />
        <SettingSelect
          label={t('devices.lianliCurve.saverVideo')}
          value={saverVideoValue}
          onChange={v => { void write({ screenSaverVideo: v }); }}
          options={[
            { value: '', label: t('devices.lianliCurve.saverVideoNone') },
            ...readyMedia.map(m => ({ value: m.name, label: m.label })),
          ]}
          disabled={!saverOn || readyMedia.length === 0}
        />
        <SettingSlider
          editable
          trackFill
          label={t('devices.lianliCurve.saverBrightness')}
          value={settings.screenSaverBrightness}
          min={0}
          max={100}
          step={1}
          formatValue={v => localizeNumbers(`${v}%`, numberFormat)}
          ariaLabel={t('devices.lianliCurve.saverBrightnessAria')}
          disabled={!saverOn}
          onChange={(v: number, done?: boolean) => {
            previewBrightness(v);
            if (done) commitBrightness(v);
          }}
          onCommit={commitBrightness}
        />
      </SettingsSection>

      <ConfirmModal
        open={pendingDelete != null}
        title={t('devices.lianliCurve.mediaDeleteTitle')}
        message={t('devices.lianliCurve.mediaDeleteMessage', { name: pendingDelete?.label ?? '' })}
        confirmLabel={t('common.delete')}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const item = pendingDelete;
          setPendingDelete(null);
          if (!item) return;
          void deleteLianLiScreen88Media(item.name).then(ok => {
            if (aliveRef.current) setMediaError(ok ? null : 'delete');
            return Promise.all([refreshMedia(), refreshSettings()]);
          });
        }}
      />

      <LConnectImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => { void refreshMedia(); }}
      />

      {cropTarget && (
        <MediaCropper
          src={cropTarget.src}
          kind="video"
          aspect={cropTarget.aspect}
          busy={uploading}
          onConfirm={onCropConfirm}
          onCancel={() => closeCropper(cropTarget)}
        />
      )}
    </>
  );
}

/**
 * L-Connect's own template videos, read from the user's L-Connect folder. The picked ones are
 * copied into the library (L-Connect's files stay as they are); ones already there are shown
 * ticked and locked.
 */
function LConnectImportModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const { t } = useTranslation();
  const { numberFormat } = useUnitPrefs();
  const [list, setList] = useState<LConnectVideos | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [importing, setImporting] = useState(false);
  const [failed, setFailed] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setPicked(new Set());
    setFailed(false);
    setList(null);
    setLoading(true);
    void getLianLiScreen88LConnectVideos().catch(() => null).then(res => {
      if (cancelled) return;
      setList(res);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open]);

  const videos = list?.videos ?? [];
  const choosable = videos.filter(v => !v.imported);
  const allPicked = choosable.length > 0 && choosable.every(v => picked.has(v.file));
  const empty = !loading && videos.length === 0;
  const size = (bytes: number) => localizeNumbers((bytes / BYTES_PER_MB).toFixed(1), numberFormat);

  const toggle = (file: string, on: boolean) => setPicked(prev => {
    const next = new Set(prev);
    if (on) next.add(file);
    else next.delete(file);
    return next;
  });

  const runImport = async () => {
    if (picked.size === 0 || importing) return;
    setImporting(true);
    setFailed(false);
    const names = await importLianLiScreen88LConnectVideos([...picked]).catch(() => null);
    if (!aliveRef.current) return;
    setImporting(false);
    // Videos copied before a refusal are in the library either way.
    onImported();
    if (names === null) {
      setFailed(true);
      return;
    }
    onClose();
  };

  return (
    <ConfirmModal
      open={open}
      size="wide"
      title={t('devices.lianliScreen88.lconnectImport')}
      message={empty
        ? t('devices.lianliScreen88.lconnectImportEmpty', { folder: list?.folder ?? '' })
        : t('devices.lianliScreen88.lconnectImportHint')}
      note={failed ? t('devices.lianliScreen88.lconnectImportFailed') : undefined}
      noteTone={IMPORT_FAILED_TONE}
      destructive={false}
      hideConfirm={empty}
      confirmLabel={importing ? t('devices.lianliScreen88.lconnectImporting') : t('devices.lianliScreen88.lconnectImportConfirm')}
      confirmDisabled={importing || picked.size === 0}
      onCancel={onClose}
      onConfirm={() => { void runImport(); }}
    >
      {loading && <Spinner size={22} />}
      {!loading && videos.length > 0 && (
        <div className={styles.importList}>
          <Checkbox
            checked={allPicked}
            disabled={importing || choosable.length === 0}
            onChange={on => setPicked(on ? new Set(choosable.map(v => v.file)) : new Set())}
            label={t('devices.lianliScreen88.lconnectImportSelectAll')}
          />
          {videos.map(v => (
            <Checkbox
              key={v.file}
              checked={v.imported || picked.has(v.file)}
              disabled={importing || v.imported}
              onChange={on => toggle(v.file, on)}
              label={(
                <span className={styles.importItem}>
                  <span>{v.label}</span>
                  <span className={styles.customNote}>
                    {v.imported
                      ? t('devices.lianliScreen88.lconnectImportInLibrary', { size: size(v.sizeBytes) })
                      : t('devices.lianliScreen88.lconnectImportSize', { size: size(v.sizeBytes) })}
                  </span>
                </span>
              )}
            />
          ))}
        </div>
      )}
    </ConfirmModal>
  );
}
