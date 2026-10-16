import { useEffect, useState } from 'react';
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
}

/** Per-device frame-rate cap. Applies on change; reverts when the save fails. */
export function RateCapSelect({ id, value, onFail }: Props) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState<number | null>(value);
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
    setCurrent(next);
    setLightingMaxRate(id, next)
      .then(r => { if (!r || r.error) { setCurrent(prev); onFail(); } })
      .catch(() => { setCurrent(prev); onFail(); });
  };

  return (
    <div className={styles.rateCapField}>
      <span>{t('lighting.ledMap.rateCap')}</span>
      <Select
        value={current == null ? OFF : String(current)}
        onChange={handleChange}
        options={options}
        ariaLabel={t('lighting.ledMap.rateCap')}
      />
    </div>
  );
}
