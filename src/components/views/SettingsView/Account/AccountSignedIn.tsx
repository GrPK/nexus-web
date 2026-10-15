import type { AuthAccount, AuthBackend } from '../../../../api/authBackend';
import type { UseCloudAccountsResult } from '../../../../hooks/useCloudAccounts';
import { AccountAuthenticationSection } from './AccountAuthenticationSection';
import { AccountDangerZoneSection } from './AccountDangerZoneSection';
import { AccountDevicesSection } from './AccountDevicesSection';
import { Suspense, lazy } from 'react';
import { AccountPurchasesSection } from './AccountPurchasesSection';
import styles from './Account.module.scss';

export type AccountSignedInTab = 'account' | 'purchases';

// Raw defines, not DEV_TOOLS: only the literal folds far enough to drop the import() from production.
const AccountEffectDownloadsSection = (import.meta.env.DEV || __DEV_TOOLS__)
  ? lazy(() => import('./AccountEffectDownloadsSection'))
  : null;

interface AccountSignedInProps {
  backend: AuthBackend;
  account: AuthAccount;
  accounts: UseCloudAccountsResult;
  recoveryFresh: boolean;
  onRecoveryFreshConsumed: () => void;
  /** Which tab the route names; the caller owns the tab strip. */
  tab: AccountSignedInTab;
  /** Opens an app's store page from Marketplace downloads. */
  onOpenStoreApp?: (appId: string) => void;
  /** Opens a lighting effect's Marketplace page from Marketplace downloads. */
  onOpenStoreEffect?: (listingId: string) => void;
}

// Identity and devices only. Cloud profile backup and cross-machine import
// live under Manage Profiles, next to the profiles they act on.
export function AccountSignedIn({ backend, account, accounts, recoveryFresh, onRecoveryFreshConsumed, tab, onOpenStoreApp, onOpenStoreEffect }: AccountSignedInProps) {
  if (tab === 'purchases') {
    return (
      <div className={styles.tabPanel}>
        <AccountPurchasesSection onOpenStoreApp={onOpenStoreApp} />
        {AccountEffectDownloadsSection && (
          <Suspense fallback={null}>
            <AccountEffectDownloadsSection onOpenStoreEffect={onOpenStoreEffect} />
          </Suspense>
        )}
      </div>
    );
  }

  return (
    <div className={styles.tabPanel}>
      <AccountAuthenticationSection
        backend={backend}
        account={account}
        onAccountChanged={() => void accounts.refresh()}
        recoveryFresh={recoveryFresh}
        onRecoveryFreshConsumed={onRecoveryFreshConsumed}
        onLoggedOut={() => void accounts.refresh()}
      />

      <AccountDevicesSection backend={backend} prefillFromLocalSpecs showThisSystem />

      <AccountDangerZoneSection
        backend={backend}
        recoveryFresh={recoveryFresh}
        onRecoveryFreshConsumed={onRecoveryFreshConsumed}
        onDeleted={() => void accounts.refresh()}
      />
    </div>
  );
}
