// `ui-section` grow: the section takes the shared fill class, so boxes in a
// stretched row match heights; without it the section keeps its natural size.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

vi.mock('../../api/auth', () => ({ getToken: async () => 'tok', getTokenSync: () => 't k' }));
vi.mock('../../api/service', () => ({ postService: vi.fn(async () => ({ error: false })) }));

import { Section } from '../ui/richComponents';
import styles from '../../components/common/SettingsSection/SettingsSection.module.scss';

afterEach(() => cleanup());

const section = (grow?: boolean) => {
  const el = render(<Section title="Identity" grow={grow}><span>x</span></Section>).container.querySelector('section') as HTMLElement;
  return { section: el };
};

describe('ui-section grow', () => {
  it('fills the parent', () => {
    expect(section(true).section.className).toContain(styles.fill);
    expect(section(true).section.className).toContain(styles.flush);
  });

  it('keeps the natural size by default', () => {
    expect(section().section.className).not.toContain(styles.fill);
    expect(section().section.className).not.toContain(styles.flush);
  });
});
