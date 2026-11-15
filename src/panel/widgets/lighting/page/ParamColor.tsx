import { useId, useRef, useState } from 'react';
import { HsvPicker } from '../../../../components/common/HsvPicker/HsvPicker';
import { Popover } from '../../../../components/common/Popover/Popover';
import pageStyles from '../LightingPage.module.scss';

/** A param row for a colour: the label on the left, one swatch right-aligned that opens the shared HSV picker. */
export function ParamColor({ label, value, onPreview, onCommit }: {
  label: string;
  value: string;
  onPreview: (hex: string) => void;
  onCommit: (hex: string) => void;
}) {
  const id = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <div className={pageStyles.paramRow} role="group" aria-labelledby={id}>
      <span id={id} className={pageStyles.paramEnumLabel}>{label}</span>
      <div ref={anchorRef}>
        <button
          type="button"
          className={`${pageStyles.staticSwatch} ${open ? pageStyles.staticSwatchActive : ''}`}
          style={{ backgroundColor: value }}
          onClick={() => setOpen(o => !o)}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
        />
        <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} placement="bottom-end" portal ariaLabel={label}>
          <HsvPicker value={value} onPreview={onPreview} onCommit={onCommit} />
        </Popover>
      </div>
    </div>
  );
}
