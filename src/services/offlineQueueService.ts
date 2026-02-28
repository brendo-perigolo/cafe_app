import {
    enqueueSyncOperation,
    getApanhadoresPendentesSync,
    getColheitasPendentesSync,
    getSyncQueue,
    removeSyncQueueItem,
    SyncQueueItem,
} from '../database/database';

export async function queueApanhadorForSync(apanhadorId: number, idEmpresa: number): Promise<void> {
    if (!apanhadorId || !idEmpresa) return;
    await enqueueSyncOperation('apanhador', apanhadorId, 'insert', idEmpresa);
}

export async function queueColheitaForSync(colheitaId: string, idEmpresa: number): Promise<void> {
    if (!colheitaId || !idEmpresa) return;
    await enqueueSyncOperation('colheita', colheitaId, 'insert', idEmpresa);
}

export async function hydrateSyncQueue(idEmpresa: number): Promise<void> {
    if (!idEmpresa) return;
    const [pendingApanhadores, pendingColheitas] = await Promise.all([
        getApanhadoresPendentesSync(idEmpresa),
        getColheitasPendentesSync(idEmpresa),
    ]);

    for (const apanhador of pendingApanhadores) {
        if (apanhador.id) {
            await queueApanhadorForSync(apanhador.id, idEmpresa);
        }
    }

    for (const colheita of pendingColheitas) {
        await queueColheitaForSync(colheita.id, idEmpresa);
    }
}

export async function fetchSyncQueue(idEmpresa: number): Promise<SyncQueueItem[]> {
    if (!idEmpresa) return [];
    return getSyncQueue(idEmpresa);
}

export async function completeSyncQueueItem(queueId: number): Promise<void> {
    if (!queueId) return;
    await removeSyncQueueItem(queueId);
}
