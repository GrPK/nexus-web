import { useEffect, useRef, useState } from 'react';
import { InfoTooltip } from '../../../../components/common/InfoTooltip/InfoTooltip';
import { Select, type SelectOption } from '../../../../components/common/Select/Select';
import { useTranslation } from '../../../../lib/i18n';
import { setLightingMaxRate } from '../../../../api/lighting';
import styles from './LedMapEditor.module.scss';

export const RATE_CAP_OPTIONS_HZ = [30, 20, 15, 10, 5, 1] as const;
const OFF = '';

interface Props {
  id: string;
  /** The stored cap in Hz; null = Off. */
  value: number | null;
  onFail: () => void;
  /** Called after the newest save succeeds, so the parent refetches the device list. */
  onSaved?: () => void;
}

/** Per-device frame-rate cap. Applies on change; reverts when the save fails. */
export function RateCapSelect({ id, value, onFail, onSaved }: Props) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState<number | null>(value);
  // Newest request wins: a response from an older request, or one that started
  // on another card, must neither revert nor confirm anything.
  const seq = useRef(0);
  useEffect(() => { seq.current += 1; }, [id]);
  useEffect(() => { setCurrent(value); }, [value, id]);

  const options: SelectOption[] = [
    { value: OFF, label: t('lighting.ledMap.rateCapOff') },
    ...RATE_CAP_OPTIONS_HZ.map(hz => ({
      value: String(hz), label: t('lighting.ledMap.rateCapHz', { hz }),
    })),
  ];

  const handleChange = (v: string) => {
    const next = v === OFF ? null : Number(v);
    const prev = current;
    const mine = ++seq.current;
    setCurrent(next);
    const fail = () => {
      if (mine !== seq.current) return;
      setCurrent(prev);
      onFail();
    };
    setLightingMaxRate(id, next)
      .then(r => {
        if (!r || r.error) fail();
        else if (mine === seq.current) onSaved?.();
      })
      .catch(fail);
  };

  return (
    <div className={styles.rateCapField}>
      <span>{t('lighting.ledMap.rateCap')}</span>
      <InfoTooltip message={t('lighting.ledMap.rateCapHint')} side="top" />
      <Select
        value={current == null ? OFF : String(current)}
        onChange={handleChange}
        options={options}
        ariaLabel={t('lighting.ledMap.rateCap')}
      />
    </div>
  );
}
