import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConsumeSkippedOffers, type ConsumeSkippedOffersInput } from './useConsumeSkippedOffers';
import { dismissNexus2Welcome } from '../api/migration';
import { dismissFanControlImport } from '../api/fancontrol';

vi.mock('../api/migration', () => ({ dismissNexus2Welcome: vi.fn().mockResolvedValue({ dismissed: true }) }));
vi.mock('../api/fancontrol', () => ({ dismissFanControlImport: vi.fn().mockResolvedValue({ dismissed: true }) }));

const base: ConsumeSkippedOffersInput = {
  runOver: true, decidedFromServer: true, coolingOn: false,
  fanControlPending: true, nexus2Pending: true, nexus2NonCooling: false,
};
const run = (over: Partial<ConsumeSkippedOffersInput> = {}) => renderHook(p => useConsumeSkippedOffers(p), { initialProps: { ...base, ...over } });

describe('useConsumeSkippedOffers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dismisses FanControl and a fan-curve-only Nexus 2 offer when the run is over with Cooling off', () => {
    run();
    expect(dismissFanControlImport).toHaveBeenCalledTimes(1);
    expect(dismissNexus2Welcome).toHaveBeenCalledTimes(1);
  });

  it('keeps a Nexus 2 offer that holds other content', () => {
    run({ nexus2NonCooling: true });
    expect(dismissFanControlImport).toHaveBeenCalledTimes(1);
    expect(dismissNexus2Welcome).not.toHaveBeenCalled();
  });

  it('does nothing while Cooling is on', () => {
    run({ coolingOn: true });
    expect(dismissFanControlImport).not.toHaveBeenCalled();
    expect(dismissNexus2Welcome).not.toHaveBeenCalled();
  });

  it('does nothing while the run is still going (welcome, features, import or later gates open)', () => {
    run({ runOver: false });
    expect(dismissFanControlImport).not.toHaveBeenCalled();
  });

  it('does nothing on values that are only the local cache after a failed read', () => {
    run({ decidedFromServer: false });
    expect(dismissFanControlImport).not.toHaveBeenCalled();
    expect(dismissNexus2Welcome).not.toHaveBeenCalled();
  });

  it('dismisses each offer once, however often it re-renders', () => {
    const view = run();
    view.rerender({ ...base });
    view.rerender({ ...base, nexus2NonCooling: false });
    expect(dismissFanControlImport).toHaveBeenCalledTimes(1);
    expect(dismissNexus2Welcome).toHaveBeenCalledTimes(1);
  });
});
