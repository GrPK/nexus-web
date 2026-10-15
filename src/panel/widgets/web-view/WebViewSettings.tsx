import { useState } from 'react';
import { useTranslation } from '../../../lib/i18n';
import type { WidgetSettingsProps } from '../types';
import { SettingsInput, SettingsRow, SettingsSection } from '../common/SettingsRow/SettingsRow';
import { normalizeWebViewUrl } from './webViewUrl';

export function WebViewSettings({ widget, onUpdate }: WidgetSettingsProps) {
  const { t } = useTranslation();
  const saved = typeof widget.config?.url === 'string' ? widget.config.url : '';
  const [draft, setDraft] = useState(saved);
  const normalized = normalizeWebViewUrl(draft);
  const invalid = draft.trim() !== '' && normalized === null;

  // Saved on blur or Enter, never per keystroke: a half-typed address would
  // otherwise navigate the live view.
  const commit = () => {
    if (draft.trim() === '') {
      if (saved !== '') onUpdate({ url: '' });
      return;
    }
    if (normalized === null) return;
    setDraft(normalized);
    if (normalized !== saved) onUpdate({ url: normalized });
  };

  return (
    <SettingsSection title={t('panel.widget.web-view')} description={invalid ? t('panel.widget.web-view.settings.invalid') : t('panel.widget.web-view.settings.hint')}>
      <SettingsRow label={t('panel.settings.url')}>
        <SettingsInput
          type="text"
          inputMode="url"
          spellCheck={false}
          value={draft}
          // eslint-disable-next-line i18next/no-literal-string -- URL format hint
          placeholder="https://example.com"
          aria-invalid={invalid}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); }}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
