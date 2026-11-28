import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import type { SoundBlasterState } from '../../../api/soundBlaster';
import type { PresetToolbar } from '../../common/PresetToolbar/PresetToolbar';
import { SoundBlasterDevicePage } from './SoundBlasterDevicePage';

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    language: 'en',
    t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key}:${JSON.stringify(vars)}` : key),
  }),
}));

const api = vi.hoisted(() => ({
  fetchSoundBlaster: vi.fn(),
  setSoundBlasterParameter: vi.fn(),
  setSoundBlasterSbx: vi.fn(),
  setSoundBlasterScout: vi.fn(),
  setSoundBlasterOutput: vi.fn(),
  setSoundBlasterFilter: vi.fn(),
  setSoundBlasterMicBoost: vi.fn(),
  setSoundBlasterFeature: vi.fn(),
  setSoundBlasterVoiceMorph: vi.fn(),
  setSoundBlasterMicEq: vi.fn(),
  setSoundBlasterMixer: vi.fn(),
  saveSoundBlasterMode: vi.fn(),
  applySoundBlasterMode: vi.fn(),
  renameSoundBlasterMode: vi.fn(),
  deleteSoundBlasterMode: vi.fn(),
}));
vi.mock('../../../api/soundBlaster', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../api/soundBlaster')>()),
  ...api,
}));

// The toolbar has its own tests; here its props are captured and its callbacks called directly.
const toolbar = vi.hoisted(() => ({ props: null as unknown }));
vi.mock('../../common/PresetToolbar/PresetToolbar', () => ({
  PresetToolbar: (props: unknown) => { toolbar.props = props; return <div data-testid="modes" />; },
}));
const bar = () => toolbar.props as ComponentProps<typeof PresetToolbar>;

// What a G8 answered: SBX on, Crystalizer on at 50 %, bass crossover 80 Hz, speakers, filter 1.
const state = (over: Partial<SoundBlasterState> = {}): SoundBlasterState => ({
  present: true,
  name: 'Creative Sound Blaster G8',
  firmware: '1.0.240911.1010',
  sbx: true,
  scout: false,
  voiceClarity: false,
  values: {
    '96:00': 0, '96:01': 0.12, '96:02': 0, '96:03': 0, '96:04': 0, '96:05': 0, '96:06': 0, '96:07': 1, '96:08': 0.5,
    '96:09': 0, '96:0a': 0, '96:0b': 0, '96:0c': 0, '96:0d': 0, '96:0e': 0, '96:0f': 0, '96:10': 0, '96:11': 0,
    '96:12': 0, '96:13': 0, '96:14': 0, '96:17': 80, '96:18': 0, '96:19': 0.5,
    '95:00': 0, '95:04': 0, '95:05': 0, '95:0a': 0, '95:13': 0, '95:2c': 0, '95:2d': 0.74, '97:02': 2,
  },
  output: 'speakers',
  outputs: ['speakers', 'headphones'],
  dacFilter: 1,
  dacFilters: [1, 2, 3, 4, 5],
  micBoost: 0,
  features: { directMode: false, spdifDirect: false, speakerVirtualization: false, logoLed: true, energySaving: false, volumeSync: false },
  voiceMorph: null,
  micEq: null,
  voicePresets: [{ id: 'Neutral', name: 'Neutral' }, { id: 'Robot', name: 'Robot' }],
  micEqPresets: [{ id: 'Preset1', name: 'Preset 1', values: [-3, -4, 0, 2, 3, -3, 4, 5] }],
  micEqBandHz: [31, 62, 125, 250, 500, 1000, 2000, 4000],
  mixer: [
    { id: 'spk', name: 'Speakers', direction: 'playback', volume: 0.24, muted: false },
    { id: 'line', name: 'Line', direction: 'recording', volume: 0.68, muted: true },
  ],
  modes: ['Music'],
  activeMode: null,
  ...over,
});

const P = 'devices.soundBlaster.';

async function mount(s: SoundBlasterState) {
  api.fetchSoundBlaster.mockResolvedValue(s);
  await act(async () => { render(<SoundBlasterDevicePage />); });
}

describe('SoundBlasterDevicePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const fn of Object.values(api)) fn.mockImplementation(async () => state());
  });

  it('shows a not-found state when no Sound Blaster is present, without tabs', async () => {
    await mount(state({ present: false }));
    expect(screen.getByText(`${P}notFound`)).toBeInTheDocument();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('shows what the device holds and its firmware', async () => {
    await mount(state());
    expect(screen.getByText(`${P}firmware:{"version":"1.0.240911.1010"}`)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: `${P}sbx` })).toBeChecked();
    expect(screen.getByRole('switch', { name: `${P}crystalizer` })).toBeChecked();
    expect(screen.getByRole('switch', { name: `${P}surround` })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: `${P}speakers` })).toBeChecked();
  });

  it('writes an effect switch as the parameter Creative uses', async () => {
    await mount(state());
    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: `${P}crystalizer` })); });
    expect(api.setSoundBlasterParameter).toHaveBeenCalledWith(0x96, 0x07, 0);
  });

  it('turns SBX off and switches the output', async () => {
    await mount(state());
    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: `${P}sbx` })); });
    expect(api.setSoundBlasterSbx).toHaveBeenCalledWith(false);
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: `${P}headphones` })); });
    expect(api.setSoundBlasterOutput).toHaveBeenCalledWith('headphones');
  });

  it('holds the effects under a veil while Scout Mode is on, with a way out', async () => {
    await mount(state({ scout: true, sbx: false }));
    // Under the veil the effects are hidden from assistive tech as well as disabled.
    expect(screen.getByRole('switch', { name: `${P}crystalizer`, hidden: true })).toBeDisabled();
    expect(screen.queryByRole('switch', { name: `${P}crystalizer` })).toBeNull();
    expect(screen.getByRole('switch', { name: `${P}scout` })).toBeChecked();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: `${P}scoutOff` })); });
    expect(api.setSoundBlasterScout).toHaveBeenCalledWith(false);
  });

  it('keeps the effects usable with SBX off, as the device turns SBX on with them', async () => {
    await mount(state({ sbx: false }));
    expect(screen.getByRole('switch', { name: `${P}surround` })).toBeEnabled();
    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: `${P}surround` })); });
    expect(api.setSoundBlasterParameter).toHaveBeenCalledWith(0x96, 0x00, 1);
  });

  it('holds the effects under a Direct Mode veil, with a way out', async () => {
    await mount(state({ features: { directMode: true, logoLed: true } }));
    expect(screen.getByRole('switch', { name: `${P}surround`, hidden: true })).toBeDisabled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: `${P}directOff` })); });
    expect(api.setSoundBlasterFeature).toHaveBeenCalledWith('directMode', false);
  });

  it('switches device features and names the DAC filters', async () => {
    await mount(state());
    expect(screen.getByRole('radio', { name: `${P}filter1` })).toBeChecked();
    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: `${P}logoLed` })); });
    expect(api.setSoundBlasterFeature).toHaveBeenCalledWith('logoLed', false);
    await act(async () => { fireEvent.click(screen.getByRole('switch', { name: `${P}spdifDirect` })); });
    expect(api.setSoundBlasterFeature).toHaveBeenCalledWith('spdifDirect', true);
  });

  it('mutes and unmutes a mixer channel', async () => {
    await mount(state());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: `${P}mute:{"name":"${P}chSpeakers"}` })); });
    expect(api.setSoundBlasterMixer).toHaveBeenCalledWith('spk', { muted: true });
    const unmute = screen.getByRole('button', { name: `${P}unmute:{"name":"${P}chLine"}` });
    // A muted channel's row stays usable, so its mute button can be pressed again.
    expect(unmute.closest('[class*="disabled"]')).toBeNull();
    await act(async () => { fireEvent.click(unmute); });
    expect(api.setSoundBlasterMixer).toHaveBeenCalledWith('line', { muted: false });
  });

  it('applies, saves, renames and deletes modes through the toolbar', async () => {
    await mount(state());
    expect(bar().presets).toEqual([{ id: 'Music', name: 'Music' }]);
    await act(async () => { bar().onLoad('Music'); });
    expect(api.applySoundBlasterMode).toHaveBeenCalledWith('Music');
    await act(async () => { await bar().onCreate(' Night ', { fresh: false }); });
    expect(api.saveSoundBlasterMode).toHaveBeenCalledWith('Night');
    await act(async () => { bar().onRename('Music', 'Albums'); });
    expect(api.renameSoundBlasterMode).toHaveBeenCalledWith('Music', 'Albums');
    await act(async () => { bar().onDelete('Music'); });
    expect(api.deleteSoundBlasterMode).toHaveBeenCalledWith('Music');
  });

  it('shows the microphone under the playback settings and sets the mic boost', async () => {
    await mount(state());
    expect(screen.queryByRole('tab')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: '+20 dB' })); });
    expect(api.setSoundBlasterMicBoost).toHaveBeenCalledWith(20);
  });
});
