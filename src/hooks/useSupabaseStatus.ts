import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import supabase from '../services/supabaseClient';
import { fetchSyncQueue } from '../services/offlineQueueService';
import { getEmpresaAtiva, getSessaoAtiva } from '../database/database';
import { hasNetworkConnection } from '../utils/network';

type ConnectionStatus = 'online' | 'offline';

type StatusState = {
    status: ConnectionStatus;
    pending: number;
    lastChecked: string | null;
};

const INITIAL_STATE: StatusState = {
    status: 'offline',
    pending: 0,
    lastChecked: null,
};

export function useSupabaseStatus(pollIntervalMs: number = 15000): StatusState {
    const [state, setState] = useState<StatusState>(INITIAL_STATE);

    useEffect(() => {
        let isMounted = true;
        let pollTimer: ReturnType<typeof setTimeout> | null = null;
        let unsubscribeNet: (() => void) | null = null;
        let authSubscription: { unsubscribe: () => void } | null = null;

        const evaluateStatus = async (netState?: NetInfoState | null) => {
            if (!isMounted) return;
            try {
                const networkOk = hasNetworkConnection(netState);
                const [{ data: sessionData }, empresa, sessaoLocal] = await Promise.all([
                    supabase.auth.getSession(),
                    getEmpresaAtiva(),
                    getSessaoAtiva(),
                ]);
                const hasSupabaseSession = !!sessionData.session?.user;
                const hasLocalSession = !!sessaoLocal;
                const hasSession = hasSupabaseSession || hasLocalSession;
                let pending = 0;
                if (empresa?.id) {
                    const queue = await fetchSyncQueue(empresa.id);
                    pending = queue.length;
                }
                let supabaseReachable = false;
                if (hasSupabaseSession && empresa?.remote_id) {
                    const { error } = await supabase
                        .from('panhadores')
                        .select('id', { head: true, count: 'exact' })
                        .eq('empresa_id', empresa.remote_id)
                        .limit(1);
                    supabaseReachable = !error;
                }
                if (!supabaseReachable && hasLocalSession && networkOk) {
                    supabaseReachable = true;
                }
                setState({
                    status: hasSession && (networkOk || supabaseReachable) ? 'online' : 'offline',
                    pending,
                    lastChecked: new Date().toISOString(),
                });
            } catch (error) {
                console.warn('Falha ao avaliar status do Supabase:', error);
                setState({ status: 'offline', pending: 0, lastChecked: new Date().toISOString() });
            }
        };

        const { data: authListener } = supabase.auth.onAuthStateChange(() => evaluateStatus());
        authSubscription = authListener?.subscription ?? null;

        const startPolling = () => {
            if (pollTimer) clearTimeout(pollTimer);
            const tick = () => {
                evaluateStatus();
                pollTimer = setTimeout(tick, pollIntervalMs);
            };
            pollTimer = setTimeout(tick, pollIntervalMs);
        };

        NetInfo.fetch().then((state) => evaluateStatus(state));
        unsubscribeNet = NetInfo.addEventListener((netState) => evaluateStatus(netState));
        startPolling();

        return () => {
            isMounted = false;
            if (pollTimer) clearTimeout(pollTimer);
            if (unsubscribeNet) unsubscribeNet();
            authSubscription?.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pollIntervalMs]);

    return state;
}
