import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

import { triggerFullSync, validatePanhadorSyncState } from '../services/syncService';
import { ensureSupabaseSession } from '../services/sessionService';

export function useOfflineSync(): void {
    useEffect(() => {
        let unsubscribe: (() => void) | null = null;

        const bootstrap = async () => {
            await ensureSupabaseSession();
            await validatePanhadorSyncState();
            await triggerFullSync();

            unsubscribe = NetInfo.addEventListener(() => {
                ensureSupabaseSession().finally(() => {
                    triggerFullSync();
                });
            });
        };

        bootstrap();

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, []);
}
