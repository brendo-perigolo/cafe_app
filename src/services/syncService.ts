import NetInfo from '@react-native-community/netinfo';

import supabase from './supabaseClient';
import {
    Apanhador,
    getApanhadorById,
    getColheitaById,
    getColheitasExcluidasPendentes,
    getEmpresaAtiva,
    getLastLocalPanhadorId,
    getLastLocalRemotePanhadorId,
    linkColheitasToRemoteByUuid,
    linkColheitasToRemotePanhador,
    markApanhadorSincronizado,
    markColheitaExcluidaSincronizada,
    markColheitaSincronizada,
    upsertApanhadoresFromSupabase,
    updateColheitaSyncError,
} from '../database/database';
import type { SyncQueueItem } from '../database/database';
import { completeSyncQueueItem, fetchSyncQueue, hydrateSyncQueue } from './offlineQueueService';
import { notifyColheitaSynced } from './syncEvents';
import { hasNetworkConnection } from '../utils/network';

let isSyncing = false;

export async function validatePanhadorSyncState(): Promise<boolean> {
    try {
        const netState = await NetInfo.fetch();
        if (!hasNetworkConnection(netState)) {
            return false;
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session?.user) {
            return false;
        }

        const empresa = await getEmpresaAtiva();
        if (!empresa?.id || !empresa.remote_id) {
            return false;
        }

        const { data, error } = await supabase
            .from('panhadores')
            .select('id')
            .eq('empresa_id', empresa.remote_id)
            .order('id', { ascending: false })
            .limit(1);

        if (error) {
            console.warn('Erro ao validar panhadores remotos:', error.message);
            return false;
        }

        const remoteLastId = data?.[0]?.id ?? null;
        const localLastRemoteId = await getLastLocalRemotePanhadorId(empresa.id);
        const localFallbackId = await getLastLocalPanhadorId(empresa.id);
        const localReferenceId = localLastRemoteId ?? (localFallbackId ? String(localFallbackId) : null);

        if (!remoteLastId && !localReferenceId) {
            console.info('Nenhum panhador cadastrado localmente ou remotamente.');
            return true;
        }

        if (remoteLastId && localReferenceId && remoteLastId === localReferenceId) {
            console.info('Todos os panhadores estão sincronizados.');
            return true;
        }

        console.info('Diferença detectada entre panhadores locais e remotos. Processo de sincronização necessário.');
        return false;
    } catch (error) {
        console.warn('Falha ao validar sincronização de panhadores:', error);
        return false;
    }
}

export async function triggerFullSync(): Promise<void> {
    if (isSyncing) return;

    isSyncing = true;
    try {
        const netState = await NetInfo.fetch();
        const networkAvailable = hasNetworkConnection(netState);
        if (!networkAvailable) {
            console.info('Rede não confirmada. Tentando sincronizar assim mesmo.');
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session?.user) {
            return;
        }

        const empresa = await getEmpresaAtiva();
        if (!empresa?.id || !empresa.remote_id) {
            return;
        }

        const supabaseUserId = sessionData.session.user.id;

        await hydrateSyncQueue(empresa.id);
        await processSyncQueue(empresa.id, empresa.remote_id, supabaseUserId);
        await pullRemoteApanhadores(empresa.id, empresa.remote_id);
        await pushColheitasExcluidas(empresa.id, empresa.remote_id);
    } catch (error) {
        console.warn('Erro ao sincronizar com o Supabase:', error);
    } finally {
        isSyncing = false;
    }
}

async function processSyncQueue(
    localEmpresaId: number,
    remoteEmpresaId: string,
    supabaseUserId: string
): Promise<void> {
    const queueItems = await fetchSyncQueue(localEmpresaId);
    if (!queueItems.length) return;

    for (const item of queueItems) {
        try {
            switch (item.entity_type) {
                case 'apanhador':
                    await handleApanhadorQueueItem(item, remoteEmpresaId, supabaseUserId);
                    break;
                case 'colheita':
                    await handleColheitaQueueItem(item, remoteEmpresaId, supabaseUserId);
                    break;
                default:
                    break;
            }
        } catch (error) {
            console.warn('Erro ao processar item da fila de sincronização:', error);
        }
    }
}

async function handleApanhadorQueueItem(
    queueItem: SyncQueueItem,
    remoteEmpresaId: string,
    supabaseUserId: string
): Promise<void> {
    const apanhadorId = Number(queueItem.entity_id);
    if (!apanhadorId) {
        await completeSyncQueueItem(queueItem.id);
        return;
    }

    const apanhador = await getApanhadorById(apanhadorId);
    if (!apanhador || !apanhador.id) {
        await completeSyncQueueItem(queueItem.id);
        return;
    }

    const remoteId = await resolveRemotePanhadorId(apanhador, remoteEmpresaId, supabaseUserId);
    if (!remoteId) {
        return;
    }

    await markApanhadorSincronizado(apanhador.id, remoteId);
    if (apanhador.local_uuid) {
        await linkColheitasToRemoteByUuid(apanhador.local_uuid, remoteId);
    }
    await linkColheitasToRemotePanhador(apanhador.id, remoteId);
    await completeSyncQueueItem(queueItem.id);
}

async function handleColheitaQueueItem(
    queueItem: SyncQueueItem,
    remoteEmpresaId: string,
    supabaseUserId: string
): Promise<void> {
    const colheita = await getColheitaById(queueItem.entity_id);
    if (!colheita) {
        await completeSyncQueueItem(queueItem.id);
        return;
    }

    const apanhador = await getApanhadorById(colheita.id_apanhador);
    const remotePanhadorId = colheita.remote_panhador_id || apanhador?.remote_id;

    if (!remotePanhadorId) {
        await updateColheitaSyncError(colheita.id, 'Apanhador ainda não sincronizado.');
        return;
    }

    const payload = {
        codigo: colheita.id,
        empresa_id: remoteEmpresaId,
        user_id: supabaseUserId,
        panhador_id: remotePanhadorId,
        peso_kg: colheita.peso_kg,
        preco_por_kg: colheita.valor_por_kg ?? null,
        valor_total: colheita.valor_total ?? null,
        numero_bag: String(colheita.numero_bag),
        data_colheita: colheita.data_hora,
        sincronizado: true,
    };

    const { data, error } = await supabase
        .from('colheitas')
        .upsert(payload, { onConflict: 'codigo' })
        .select('id')
        .single();

    if (error) {
        await updateColheitaSyncError(colheita.id, error.message);
        console.warn('Erro ao enviar colheita pendente:', error.message);
        return;
    }

    if (data?.id) {
        await markColheitaSincronizada(colheita.id, data.id);
        await completeSyncQueueItem(queueItem.id);
        notifyColheitaSynced(colheita.id);
    }
}

async function resolveRemotePanhadorId(
    apanhador: Apanhador,
    remoteEmpresaId: string,
    supabaseUserId: string
): Promise<string | null> {
    const normalizedName = apanhador.nome.trim();
    const { data: existing, error: findError } = await supabase
        .from('panhadores')
        .select('id')
        .eq('empresa_id', remoteEmpresaId)
        .ilike('nome', normalizedName)
        .limit(1);

    if (findError) {
        console.warn('Erro ao verificar duplicidade de panhador:', findError.message);
        return null;
    }

    if (existing && existing.length) {
        return existing[0].id;
    }

    const payload = {
        nome: normalizedName,
        apelido: apanhador.sobrenome_apelido,
        telefone: apanhador.telefone ?? null,
        cpf: apanhador.cpf ?? null,
        empresa_id: remoteEmpresaId,
        user_id: supabaseUserId,
    };

    const { data, error } = await supabase
        .from('panhadores')
        .insert(payload)
        .select('id')
        .single();

    if (error) {
        console.warn('Falha ao enviar panhador pendente:', error.message);
        return null;
    }

    return data?.id ?? null;
}

async function pullRemoteApanhadores(localEmpresaId: number, remoteEmpresaId: string): Promise<void> {
    const { data, error } = await supabase
        .from('panhadores')
        .select('id,nome,apelido,telefone,cpf,ativo')
        .eq('empresa_id', remoteEmpresaId);

    if (error) {
        console.warn('Erro ao buscar panhadores remotos:', error.message);
        return;
    }

    if (!data || data.length === 0) return;

    await upsertApanhadoresFromSupabase(localEmpresaId, data);
}

async function pushColheitasExcluidas(localEmpresaId: number, remoteEmpresaId: string): Promise<void> {
    const pendentes = await getColheitasExcluidasPendentes(localEmpresaId);
    if (!pendentes.length) return;

    for (const registro of pendentes) {
        try {
            let query = supabase.from('colheitas').delete().eq('empresa_id', remoteEmpresaId);
            if (registro.remote_id) {
                query = query.eq('id', registro.remote_id);
            } else {
                query = query.eq('codigo', registro.colheita_id);
            }

            const { error } = await query;

            if (error) {
                console.warn('Erro ao remover colheita remota:', error.message);
                continue;
            }

            await markColheitaExcluidaSincronizada(registro.id);
        } catch (error) {
            console.warn('Erro inesperado ao remover colheita remota:', error);
        }
    }
}
