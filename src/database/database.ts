import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

let db: SQLite.SQLiteDatabase | null = null;

export type SyncStatus = 'pending_sync' | 'synced' | 'failed';
export type SyncEntityType = 'apanhador' | 'colheita';
export type SyncOperationType = 'insert' | 'update';

export interface SyncQueueItem {
    id: number;
    entity_type: SyncEntityType;
    entity_id: string;
    operation: SyncOperationType;
    id_empresa: number;
    created_at: string;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (db) return db;
    db = await SQLite.openDatabaseAsync('safra_cafe.db');
    await initDatabase(db);
    return db;
}

async function initDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
    await database.execAsync('PRAGMA journal_mode = WAL;');

    await database.execAsync(`
        CREATE TABLE IF NOT EXISTS empresa (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            cnpj TEXT NOT NULL,
            codigo_licenca TEXT,
            licenca_ativa INTEGER DEFAULT 1,
            data_ativacao TEXT NOT NULL,
            remote_id TEXT
        );
    `);

    const empresaAlterStatements = ['ALTER TABLE empresa ADD COLUMN remote_id TEXT;'];
    for (const statement of empresaAlterStatements) {
        try {
            await database.execAsync(statement);
        } catch {
            // column already exists
        }
    }

    await database.execAsync(`
        CREATE TABLE IF NOT EXISTS apanhador (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            sobrenome_apelido TEXT NOT NULL,
            telefone TEXT,
            cpf TEXT,
            id_empresa INTEGER NOT NULL,
            local_uuid TEXT,
            remote_id TEXT,
            sincronizado INTEGER NOT NULL DEFAULT 0,
            sync_status TEXT NOT NULL DEFAULT 'synced',
            FOREIGN KEY (id_empresa) REFERENCES empresa(id)
        );
    `);

    const apanhadorAlterStatements = [
        'ALTER TABLE apanhador ADD COLUMN remote_id TEXT;',
        'ALTER TABLE apanhador ADD COLUMN sincronizado INTEGER NOT NULL DEFAULT 0;',
        "ALTER TABLE apanhador ADD COLUMN local_uuid TEXT;",
        "ALTER TABLE apanhador ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'synced';",
    ];
    for (const statement of apanhadorAlterStatements) {
        try {
            await database.execAsync(statement);
        } catch {
            // column already exists
        }
    }

    await database.execAsync(`
        CREATE TABLE IF NOT EXISTS colheita (
            id TEXT PRIMARY KEY,
            data_hora TEXT NOT NULL,
            id_apanhador INTEGER NOT NULL DEFAULT 0,
            apanhador_nome TEXT NOT NULL DEFAULT '',
            numero_bag INTEGER NOT NULL,
            peso_kg REAL NOT NULL,
            valor_por_kg REAL NOT NULL,
            valor_total REAL NOT NULL,
            assinatura_base64 TEXT,
            ticket_anterior_id TEXT,
            numero_ticket INTEGER NOT NULL DEFAULT 1,
            grupo_ticket_id TEXT,
            local_panhador_uuid TEXT,
            remote_panhador_id TEXT,
            remote_id TEXT,
            sincronizado INTEGER NOT NULL DEFAULT 0,
            sync_error TEXT,
            sync_status TEXT NOT NULL DEFAULT 'synced',
            id_empresa INTEGER NOT NULL,
            FOREIGN KEY (id_apanhador) REFERENCES apanhador(id),
            FOREIGN KEY (id_empresa) REFERENCES empresa(id)
        );
    `);

    const alterStatements = [
        'ALTER TABLE colheita ADD COLUMN ticket_anterior_id TEXT;',
        'ALTER TABLE colheita ADD COLUMN numero_ticket INTEGER NOT NULL DEFAULT 1;',
        'ALTER TABLE colheita ADD COLUMN grupo_ticket_id TEXT;',
    ];

    for (const statement of alterStatements) {
        try {
            await database.execAsync(statement);
        } catch {
            // column already exists
        }
    }

    const colheitaSyncAlterStatements = [
        'ALTER TABLE colheita ADD COLUMN remote_id TEXT;',
        'ALTER TABLE colheita ADD COLUMN sincronizado INTEGER NOT NULL DEFAULT 0;',
        'ALTER TABLE colheita ADD COLUMN sync_error TEXT;',
        'ALTER TABLE colheita ADD COLUMN local_panhador_uuid TEXT;',
        'ALTER TABLE colheita ADD COLUMN remote_panhador_id TEXT;',
        "ALTER TABLE colheita ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'synced';",
    ];

    for (const statement of colheitaSyncAlterStatements) {
        try {
            await database.execAsync(statement);
        } catch {
            // column already exists
        }
    }

    await database.execAsync(`
        CREATE TABLE IF NOT EXISTS colheita_edicao (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            grupo_ticket_id TEXT NOT NULL,
            ticket_anterior_id TEXT NOT NULL,
            novo_ticket_id TEXT NOT NULL,
            editado_em TEXT NOT NULL,
            resumo_rapido TEXT NOT NULL,
            id_empresa INTEGER NOT NULL,
            FOREIGN KEY (id_empresa) REFERENCES empresa(id)
        );
    `);

    await database.execAsync(`
        CREATE TABLE IF NOT EXISTS colheita_excluida (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            colheita_id TEXT NOT NULL,
            remote_id TEXT,
            id_empresa INTEGER NOT NULL,
            deletado_em TEXT NOT NULL,
            FOREIGN KEY (id_empresa) REFERENCES empresa(id)
        );
    `);

    await database.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            operation TEXT NOT NULL,
            id_empresa INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (id_empresa) REFERENCES empresa(id)
        );
    `);

    await database.execAsync(`
        CREATE TABLE IF NOT EXISTS usuario (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            telefone TEXT NOT NULL,
            usuario_login TEXT NOT NULL UNIQUE,
            senha TEXT NOT NULL,
            email TEXT,
            supabase_user_id TEXT,
            perfil TEXT NOT NULL CHECK(perfil IN ('admin', 'usuario')),
            ativo INTEGER NOT NULL DEFAULT 1,
            criado_em TEXT NOT NULL,
            id_empresa INTEGER NOT NULL,
            FOREIGN KEY (id_empresa) REFERENCES empresa(id)
        );
    `);

    const usuarioAlterStatements = [
        'ALTER TABLE usuario ADD COLUMN email TEXT;',
        'ALTER TABLE usuario ADD COLUMN supabase_user_id TEXT;',
    ];

    for (const statement of usuarioAlterStatements) {
        try {
            await database.execAsync(statement);
        } catch {
            // column already exists
        }
    }

    await database.execAsync(`
        CREATE TABLE IF NOT EXISTS sessao (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_usuario INTEGER NOT NULL,
            token TEXT NOT NULL,
            criado_em TEXT NOT NULL,
            ativa INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (id_usuario) REFERENCES usuario(id)
        );
    `);

    const sessaoAlterStatements = [
        'ALTER TABLE sessao ADD COLUMN token_refresh TEXT;',
    ];

    for (const statement of sessaoAlterStatements) {
        try {
            await database.execAsync(statement);
        } catch {
            // column already exists
        }
    }

    await ensureLocalIdentifiers(database);
}

async function ensureLocalIdentifiers(database: SQLite.SQLiteDatabase): Promise<void> {
    const pendingApanhadores = await database.getAllAsync<{ id: number; sincronizado?: number | null }>(
        'SELECT id, sincronizado FROM apanhador WHERE local_uuid IS NULL'
    );

    for (const row of pendingApanhadores) {
        const uuid = await Crypto.randomUUID();
        const status: SyncStatus = row.sincronizado ? 'synced' : 'pending_sync';
        await database.runAsync(
            `UPDATE apanhador SET local_uuid = ?, sync_status = COALESCE(sync_status, ?) WHERE id = ?`,
            uuid,
            status,
            row.id
        );
    }

    const pendingColheitas = await database.getAllAsync<{ id: string; sincronizado?: number | null; sync_status?: SyncStatus | null }>(
        `SELECT id, sincronizado, sync_status FROM colheita WHERE sync_status IS NULL OR sync_status = ''`
    );

    for (const row of pendingColheitas) {
        const status: SyncStatus = row.sincronizado ? 'synced' : 'pending_sync';
        await database.runAsync(
            `UPDATE colheita SET sync_status = ? WHERE id = ?`,
            status,
            row.id
        );
    }
}

export async function getColheitaById(id: string): Promise<Colheita | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<Colheita>(
        'SELECT * FROM colheita WHERE id = ? LIMIT 1',
        id
    );
    return row || null;
}

export async function getColheitasPendentesSync(idEmpresa: number): Promise<Colheita[]> {
    const database = await getDatabase();
    return database.getAllAsync<Colheita>(
        `SELECT * FROM colheita
         WHERE id_empresa = ? AND (sincronizado = 0 OR remote_id IS NULL)
         ORDER BY data_hora ASC`,
        idEmpresa
    );
}

export async function markColheitaSincronizada(id: string, remoteId: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
        `UPDATE colheita
         SET remote_id = ?, sincronizado = 1, sync_error = NULL, sync_status = 'synced'
         WHERE id = ?`,
        remoteId,
        id
    );
}

export async function updateColheitaSyncError(id: string, error?: string | null): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
        `UPDATE colheita
         SET sync_error = ?, sincronizado = 0, sync_status = 'failed'
         WHERE id = ?`,
        error || null,
        id
    );
}

export async function queueColheitaExcluida(colheitaId: string, remoteId: string | null, idEmpresa: number): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
        `INSERT INTO colheita_excluida (colheita_id, remote_id, id_empresa, deletado_em)
         VALUES (?, ?, ?, ?)`,
        colheitaId,
        remoteId || null,
        idEmpresa,
        new Date().toISOString()
    );
}

export async function getColheitasExcluidasPendentes(idEmpresa: number): Promise<ColheitaExcluidaPendente[]> {
    const database = await getDatabase();
    return database.getAllAsync<ColheitaExcluidaPendente>(
        'SELECT * FROM colheita_excluida WHERE id_empresa = ? ORDER BY deletado_em ASC',
        idEmpresa
    );
}

export async function markColheitaExcluidaSincronizada(queueId: number): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM colheita_excluida WHERE id = ?', queueId);
}

// ===================== SYNC QUEUE =====================

export async function enqueueSyncOperation(
    entityType: SyncEntityType,
    entityId: string | number,
    operation: SyncOperationType,
    idEmpresa: number
): Promise<void> {
    const database = await getDatabase();
    const normalizedEntityId = String(entityId);
    const existing = await database.getFirstAsync<{ id: number }>(
        `SELECT id FROM sync_queue
         WHERE entity_type = ? AND entity_id = ? AND operation = ? AND id_empresa = ?
         LIMIT 1`,
        entityType,
        normalizedEntityId,
        operation,
        idEmpresa
    );

    if (existing?.id) {
        return;
    }

    await database.runAsync(
        `INSERT INTO sync_queue (entity_type, entity_id, operation, id_empresa, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        entityType,
        normalizedEntityId,
        operation,
        idEmpresa,
        new Date().toISOString()
    );
}

export async function getSyncQueue(idEmpresa: number): Promise<SyncQueueItem[]> {
    const database = await getDatabase();
    return database.getAllAsync<SyncQueueItem>(
        `SELECT * FROM sync_queue
         WHERE id_empresa = ?
         ORDER BY datetime(created_at) ASC, id ASC`,
        idEmpresa
    );
}

export async function removeSyncQueueItem(queueId: number): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM sync_queue WHERE id = ?', queueId);
}
// ===================== EMPRESA =====================

export interface Empresa {
    id?: number;
    nome: string;
    cnpj: string;
    codigo_licenca?: string;
    licenca_ativa: number;
    data_ativacao: string;
    remote_id?: string | null;
}

export async function insertEmpresa(empresa: Empresa): Promise<number> {
    const database = await getDatabase();
    const result = await database.runAsync(
        'INSERT INTO empresa (nome, cnpj, codigo_licenca, licenca_ativa, data_ativacao) VALUES (?, ?, ?, ?, ?)',
        empresa.nome, empresa.cnpj, empresa.codigo_licenca || '', empresa.licenca_ativa, empresa.data_ativacao
    );
    return result.lastInsertRowId;
}

export async function getEmpresaAtiva(): Promise<Empresa | null> {
    const database = await getDatabase();
    const result = await database.getFirstAsync<Empresa>(
        'SELECT * FROM empresa WHERE licenca_ativa = 1 ORDER BY id DESC LIMIT 1'
    );
    return result || null;
}

export interface RemoteEmpresaPayload {
    id: string;
    nome: string;
    cnpj?: string | null;
    codigo_licenca?: string | null;
}

export async function upsertEmpresaFromSupabase(payload: RemoteEmpresaPayload): Promise<Empresa> {
    const database = await getDatabase();
    const existing = await database.getFirstAsync<Empresa>(
        'SELECT * FROM empresa WHERE remote_id = ? LIMIT 1',
        payload.id
    );

    const normalizedCnpj = payload.cnpj || '';
    const codigo = payload.codigo_licenca || 'SUPABASE';

    if (existing?.id) {
        await database.runAsync(
            `UPDATE empresa
             SET nome = ?, cnpj = ?, codigo_licenca = ?, licenca_ativa = 1, remote_id = ?
             WHERE id = ?`,
            payload.nome,
            normalizedCnpj,
            codigo,
            payload.id,
            existing.id
        );

        return {
            ...existing,
            nome: payload.nome,
            cnpj: normalizedCnpj,
            codigo_licenca: codigo,
            licenca_ativa: 1,
            remote_id: payload.id,
        };
    }

    const dataAtivacao = new Date().toISOString();
    const result = await database.runAsync(
        `INSERT INTO empresa (nome, cnpj, codigo_licenca, licenca_ativa, data_ativacao, remote_id)
         VALUES (?, ?, ?, 1, ?, ?)`,
        payload.nome,
        normalizedCnpj,
        codigo,
        dataAtivacao,
        payload.id
    );

    return {
        id: result.lastInsertRowId,
        nome: payload.nome,
        cnpj: normalizedCnpj,
        codigo_licenca: codigo,
        licenca_ativa: 1,
        data_ativacao: dataAtivacao,
        remote_id: payload.id,
    };
}

// ===================== APANHADOR =====================

export interface Apanhador {
    id?: number;
    nome: string;
    sobrenome_apelido: string;
    telefone?: string;
    cpf?: string;
    id_empresa: number;
    remote_id?: string | null;
    sincronizado?: number;
    local_uuid?: string | null;
    sync_status?: SyncStatus;
}

export async function insertApanhador(apanhador: Apanhador): Promise<number> {
    const database = await getDatabase();
    const localUuid = apanhador.local_uuid ?? (await Crypto.randomUUID());
    const syncStatus: SyncStatus = apanhador.sync_status ?? 'pending_sync';
    const sincronizado = syncStatus === 'synced' ? 1 : 0;
    const result = await database.runAsync(
        `INSERT INTO apanhador (nome, sobrenome_apelido, telefone, cpf, id_empresa, local_uuid, sync_status, sincronizado, remote_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        apanhador.nome,
        apanhador.sobrenome_apelido,
        apanhador.telefone || '',
        apanhador.cpf || '',
        apanhador.id_empresa,
        localUuid,
        syncStatus,
        sincronizado,
        apanhador.remote_id || null
    );
    return result.lastInsertRowId;
}

export async function searchApanhadores(idEmpresa: number, query: string): Promise<Apanhador[]> {
    const database = await getDatabase();
    const searchTerm = `%${query}%`;
    const results = await database.getAllAsync<Apanhador>(
        `SELECT * FROM apanhador 
         WHERE id_empresa = ? AND (nome LIKE ? OR sobrenome_apelido LIKE ?)
         ORDER BY nome ASC LIMIT 20`,
        idEmpresa, searchTerm, searchTerm
    );
    return results;
}

export async function getAllApanhadores(idEmpresa: number): Promise<Apanhador[]> {
    const database = await getDatabase();
    const results = await database.getAllAsync<Apanhador>(
        'SELECT * FROM apanhador WHERE id_empresa = ? ORDER BY nome ASC',
        idEmpresa
    );
    return results;
}

export interface RemoteApanhadorPayload {
    id: string;
    nome: string;
    apelido?: string | null;
    telefone?: string | null;
    cpf?: string | null;
    ativo?: boolean | null;
}

export async function upsertApanhadoresFromSupabase(
    idEmpresa: number,
    apanhadores: RemoteApanhadorPayload[]
): Promise<void> {
    if (!apanhadores.length) return;

    const database = await getDatabase();
    await database.execAsync('BEGIN TRANSACTION;');
    try {
        for (const remote of apanhadores) {
            if (remote.ativo === false) {
                // Skip inactive remote panhadores but keep their local history intact.
                continue;
            }

            const existing = await database.getFirstAsync<Apanhador>(
                'SELECT * FROM apanhador WHERE remote_id = ? AND id_empresa = ? LIMIT 1',
                remote.id,
                idEmpresa
            );

            const sobrenome = remote.apelido?.trim() || remote.nome.split(' ').slice(1).join(' ') || remote.nome;
            const telefone = remote.telefone?.trim() || '';
            const cpf = remote.cpf?.trim() || '';

            if (existing?.id) {
                await database.runAsync(
                    `UPDATE apanhador
                     SET nome = ?, sobrenome_apelido = ?, telefone = ?, cpf = ?, sincronizado = 1, sync_status = 'synced'
                     WHERE id = ?`,
                    remote.nome,
                    sobrenome,
                    telefone,
                    cpf,
                    existing.id
                );
            } else {
                const localUuid = await Crypto.randomUUID();
                await database.runAsync(
                    `INSERT INTO apanhador (nome, sobrenome_apelido, telefone, cpf, id_empresa, remote_id, sincronizado, local_uuid, sync_status)
                     VALUES (?, ?, ?, ?, ?, ?, 1, ?, 'synced')`,
                    remote.nome,
                    sobrenome,
                    telefone,
                    cpf,
                    idEmpresa,
                    remote.id,
                    localUuid
                );
            }
        }
        await database.execAsync('COMMIT;');
    } catch (error) {
        await database.execAsync('ROLLBACK;');
        throw error;
    }
}

export async function getApanhadoresPendentesSync(idEmpresa: number): Promise<Apanhador[]> {
    const database = await getDatabase();
    return database.getAllAsync<Apanhador>(
        `SELECT * FROM apanhador
         WHERE id_empresa = ? AND (remote_id IS NULL OR sincronizado = 0 OR sync_status != 'synced')
         ORDER BY nome ASC`,
        idEmpresa
    );
}

export async function markApanhadorSincronizado(idLocal: number, remoteId: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
        `UPDATE apanhador
         SET remote_id = ?, sincronizado = 1, sync_status = 'synced'
         WHERE id = ?`,
        remoteId,
        idLocal
    );
}

export async function getApanhadorById(idApanhador: number): Promise<Apanhador | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<Apanhador>(
        'SELECT * FROM apanhador WHERE id = ? LIMIT 1',
        idApanhador
    );
    return row || null;
}

export async function getApanhadorByLocalUuid(localUuid: string): Promise<Apanhador | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<Apanhador>(
        'SELECT * FROM apanhador WHERE local_uuid = ? LIMIT 1',
        localUuid
    );
    return row || null;
}

export async function getLastLocalRemotePanhadorId(idEmpresa: number): Promise<string | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ remote_id: string | null }>(
        `SELECT remote_id FROM apanhador
         WHERE id_empresa = ? AND remote_id IS NOT NULL
         ORDER BY id DESC
         LIMIT 1`,
        idEmpresa
    );
    return row?.remote_id || null;
}

export async function getLastLocalPanhadorId(idEmpresa: number): Promise<number | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ id: number }>(
        'SELECT id FROM apanhador WHERE id_empresa = ? ORDER BY id DESC LIMIT 1',
        idEmpresa
    );
    return row?.id || null;
}

// ===================== COLHEITA =====================

export interface Colheita {
    id: string;
    data_hora: string;
    id_apanhador: number;
    apanhador_nome: string;
    numero_bag: number;
    peso_kg: number;
    valor_por_kg: number;
    valor_total: number;
    assinatura_base64?: string;
    ticket_anterior_id?: string | null;
    numero_ticket?: number;
    grupo_ticket_id?: string;
    id_empresa: number;
    remote_id?: string | null;
    sincronizado?: number;
    sync_error?: string | null;
    local_panhador_uuid?: string | null;
    remote_panhador_id?: string | null;
    sync_status?: SyncStatus;
}

export interface ColheitaEdicao {
    id?: number;
    grupo_ticket_id: string;
    ticket_anterior_id: string;
    novo_ticket_id: string;
    editado_em: string;
    resumo_rapido: string;
    id_empresa: number;
}

export interface ColheitaExcluidaPendente {
    id: number;
    colheita_id: string;
    remote_id?: string | null;
    id_empresa: number;
    deletado_em: string;
}

export type ColheitaEditableFields = {
    numero_bag: number;
    peso_kg: number;
    valor_por_kg: number;
    valor_total: number;
};

export async function insertColheita(colheita: Colheita): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
        `INSERT INTO colheita (
            id,
            data_hora,
            id_apanhador,
            apanhador_nome,
            numero_bag,
            peso_kg,
            valor_por_kg,
            valor_total,
            assinatura_base64,
            ticket_anterior_id,
            numero_ticket,
            grupo_ticket_id,
            id_empresa,
            local_panhador_uuid,
            remote_panhador_id,
            sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        colheita.id,
        colheita.data_hora,
        colheita.id_apanhador,
        colheita.apanhador_nome,
        colheita.numero_bag,
        colheita.peso_kg,
        colheita.valor_por_kg,
        colheita.valor_total,
        colheita.assinatura_base64 || '',
        colheita.ticket_anterior_id ?? null,
        colheita.numero_ticket ?? 1,
        colheita.grupo_ticket_id || colheita.id,
        colheita.id_empresa,
        colheita.local_panhador_uuid || null,
        colheita.remote_panhador_id || null,
        colheita.sync_status ?? 'pending_sync'
    );
}

export async function linkColheitasToRemotePanhador(localApanhadorId: number, remotePanhadorId: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
        `UPDATE colheita
         SET remote_panhador_id = ?, sync_error = NULL
         WHERE id_apanhador = ? AND (sincronizado = 0 OR remote_id IS NULL)`,
        remotePanhadorId,
        localApanhadorId
    );
}

export async function linkColheitasToRemoteByUuid(localUuid: string, remotePanhadorId: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
        `UPDATE colheita
         SET remote_panhador_id = ?, sync_error = NULL
         WHERE local_panhador_uuid = ? AND (sincronizado = 0 OR remote_id IS NULL)`,
        remotePanhadorId,
        localUuid
    );
}

export async function createColheitaEdicao(base: Colheita, updates: ColheitaEditableFields): Promise<Colheita> {
    const database = await getDatabase();
    const grupoTicketId = base.grupo_ticket_id || base.id;
    const numeroTicket = (base.numero_ticket || 1) + 1;

    await database.runAsync(
        `UPDATE colheita
         SET numero_bag = ?,
             peso_kg = ?,
             valor_por_kg = ?,
             valor_total = ?,
             numero_ticket = ?,
             grupo_ticket_id = ?,
             sincronizado = 0,
             sync_error = NULL
         WHERE id = ?`,
        updates.numero_bag,
        updates.peso_kg,
        updates.valor_por_kg,
        updates.valor_total,
        numeroTicket,
        grupoTicketId,
        base.id
    );

    const resumoRapido = `Bag ${base.numero_bag}→${updates.numero_bag} | Peso ${base.peso_kg.toFixed(1)}→${updates.peso_kg.toFixed(1)}kg | Valor/kg ${base.valor_por_kg.toFixed(2)}→${updates.valor_por_kg.toFixed(2)}`;

    await database.runAsync(
        `INSERT INTO colheita_edicao (
            grupo_ticket_id,
            ticket_anterior_id,
            novo_ticket_id,
            editado_em,
            resumo_rapido,
            id_empresa
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        grupoTicketId,
        base.id,
        base.id,
        new Date().toISOString(),
        resumoRapido,
        base.id_empresa
    );

    return {
        ...base,
        ...updates,
        numero_ticket: numeroTicket,
        grupo_ticket_id: grupoTicketId,
    };
}

export async function getColheitas(idEmpresa: number, limit: number = 50): Promise<Colheita[]> {
    const database = await getDatabase();
    const results = await database.getAllAsync<Colheita>(
        'SELECT * FROM colheita WHERE id_empresa = ? ORDER BY data_hora DESC LIMIT ?',
        idEmpresa, limit
    );
    return results;
}

export async function getTodasMovimentacoes(idEmpresa: number): Promise<Colheita[]> {
    const database = await getDatabase();
    const results = await database.getAllAsync<Colheita>(
        'SELECT * FROM colheita WHERE id_empresa = ? ORDER BY data_hora DESC',
        idEmpresa
    );
    return results;
}

export async function getHistoricoEdicoes(grupoTicketId: string, idEmpresa: number): Promise<ColheitaEdicao[]> {
    const database = await getDatabase();
    const results = await database.getAllAsync<ColheitaEdicao>(
        `SELECT * FROM colheita_edicao
         WHERE grupo_ticket_id = ? AND id_empresa = ?
         ORDER BY editado_em DESC`,
        grupoTicketId,
        idEmpresa
    );
    return results;
}

export async function getColheitaStats(idEmpresa: number): Promise<{
    totalColheitas: number;
    pesoTotal: number;
    valorTotal: number;
}> {
    const database = await getDatabase();
    const result = await database.getFirstAsync<{
        totalColheitas: number;
        pesoTotal: number;
        valorTotal: number;
    }>(
        `SELECT 
      COUNT(*) as totalColheitas, 
      COALESCE(SUM(peso_kg), 0) as pesoTotal, 
      COALESCE(SUM(valor_total), 0) as valorTotal 
    FROM colheita WHERE id_empresa = ?`,
        idEmpresa
    );
    return result || { totalColheitas: 0, pesoTotal: 0, valorTotal: 0 };
}

export async function getUltimaColheita(idEmpresa: number): Promise<Colheita | null> {
    const database = await getDatabase();
    const result = await database.getFirstAsync<Colheita>(
        'SELECT * FROM colheita WHERE id_empresa = ? ORDER BY data_hora DESC LIMIT 1',
        idEmpresa
    );
    return result || null;
}

export async function deleteColheita(id: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM colheita WHERE id = ?', [id]);
}

export async function deleteMovimentacaoComHistorico(id: string, idEmpresa: number): Promise<void> {
    const database = await getDatabase();

    const registro = await database.getFirstAsync<Pick<Colheita, 'id' | 'grupo_ticket_id' | 'remote_id'>>(
        'SELECT id, grupo_ticket_id, remote_id FROM colheita WHERE id = ? AND id_empresa = ? LIMIT 1',
        id,
        idEmpresa
    );

    if (!registro) return;

    const grupoTicketId = registro.grupo_ticket_id || registro.id;

    await queueColheitaExcluida(registro.id, registro.remote_id || null, idEmpresa);

    await database.runAsync(
        'DELETE FROM colheita_edicao WHERE grupo_ticket_id = ? AND id_empresa = ?',
        grupoTicketId,
        idEmpresa
    );

    await database.runAsync('DELETE FROM colheita WHERE id = ? AND id_empresa = ?', id, idEmpresa);
}

// ===================== USUÁRIO E AUTENTICAÇÃO =====================

export interface Usuario {
    id?: number;
    nome: string;
    telefone: string;
    usuario_login: string;
    senha: string;
    email?: string;
    supabase_user_id?: string | null;
    perfil: 'admin' | 'usuario';
    ativo: number;
    criado_em: string;
    id_empresa: number;
}

type SessaoAtivaRow = {
    id_sessao: number;
    id_usuario: number;
    nome: string;
    telefone: string;
    usuario_login: string;
    perfil: 'admin' | 'usuario';
    id_empresa: number;
    email?: string | null;
    supabase_user_id?: string | null;
    token?: string | null;
    token_refresh?: string | null;
};

export type UsuarioSessao = Omit<Usuario, 'senha' | 'ativo' | 'criado_em'> & {
    id: number;
    accessToken?: string | null;
    refreshToken?: string | null;
};

export async function getUsuarioById(idUsuario: number): Promise<Usuario | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<Usuario>(
        'SELECT * FROM usuario WHERE id = ? LIMIT 1',
        idUsuario
    );
    return row || null;
}

export async function getUsuarios(idEmpresa: number): Promise<Usuario[]> {
    const database = await getDatabase();
    return database.getAllAsync<Usuario>(
        'SELECT * FROM usuario WHERE id_empresa = ? ORDER BY nome ASC',
        idEmpresa
    );
}

export async function existeAdmin(idEmpresa: number): Promise<boolean> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ total: number }>(
        "SELECT COUNT(*) as total FROM usuario WHERE id_empresa = ? AND perfil = 'admin' AND ativo = 1",
        idEmpresa
    );
    return (row?.total || 0) > 0;
}

export async function insertUsuario(usuario: Omit<Usuario, 'id' | 'ativo' | 'criado_em'>): Promise<number> {
    const database = await getDatabase();
    const result = await database.runAsync(
        `INSERT INTO usuario (nome, telefone, usuario_login, senha, perfil, ativo, criado_em, id_empresa)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        usuario.nome.trim(),
        usuario.telefone.trim(),
        usuario.usuario_login.trim().toLowerCase(),
        usuario.senha,
        usuario.perfil,
        new Date().toISOString(),
        usuario.id_empresa
    );
    return result.lastInsertRowId;
}

export async function createSessaoLocal(
    idUsuario: number,
    accessToken?: string | null,
    refreshToken?: string | null
): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('UPDATE sessao SET ativa = 0');
    await database.runAsync(
        'INSERT INTO sessao (id_usuario, token, token_refresh, criado_em, ativa) VALUES (?, ?, ?, ?, 1)',
        idUsuario,
        accessToken || `sessao-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        refreshToken || null,
        new Date().toISOString()
    );
}

export interface RemoteUsuarioPayload {
    id: string;
    nome: string;
    email: string;
    telefone?: string | null;
    perfil: 'admin' | 'usuario';
    id_empresa: number;
}

export async function upsertUsuarioFromSupabase(payload: RemoteUsuarioPayload): Promise<number> {
    const database = await getDatabase();
    const existing = await database.getFirstAsync<Usuario>(
        'SELECT * FROM usuario WHERE supabase_user_id = ? LIMIT 1',
        payload.id
    );

    const telefone = payload.telefone?.trim() || '';
    const email = (payload.email || '').trim().toLowerCase() || `user-${payload.id}@supabase.local`;

    if (existing?.id) {
        await database.runAsync(
            `UPDATE usuario
             SET nome = ?, telefone = ?, usuario_login = ?, perfil = ?, email = ?, id_empresa = ?
             WHERE id = ?`,
            payload.nome,
            telefone,
            email,
            payload.perfil,
            email,
            payload.id_empresa,
            existing.id
        );

        return existing.id;
    }

    const result = await database.runAsync(
        `INSERT INTO usuario (nome, telefone, usuario_login, senha, perfil, ativo, criado_em, id_empresa, email, supabase_user_id)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        payload.nome,
        telefone,
        email,
        '__remote__',
        payload.perfil,
        new Date().toISOString(),
        payload.id_empresa,
        email,
        payload.id
    );

    return result.lastInsertRowId;
}

export async function autenticarUsuario(
    usuarioLogin: string,
    senha: string,
    idEmpresa: number
): Promise<UsuarioSessao | null> {
    const database = await getDatabase();
    const user = await database.getFirstAsync<Usuario>(
        `SELECT *
         FROM usuario
         WHERE id_empresa = ? AND ativo = 1 AND usuario_login = ? AND senha = ?
         LIMIT 1`,
        idEmpresa,
        usuarioLogin.trim().toLowerCase(),
        senha
    );

    if (!user?.id) return null;

    await createSessaoLocal(user.id);

    return {
        id: user.id,
        nome: user.nome,
        telefone: user.telefone,
        usuario_login: user.usuario_login,
        perfil: user.perfil,
        id_empresa: user.id_empresa,
    };
}

export async function getSessaoAtiva(): Promise<UsuarioSessao | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<SessaoAtivaRow>(
        `SELECT
            s.id as id_sessao,
            u.id as id_usuario,
            u.nome,
            u.telefone,
            u.usuario_login,
            u.perfil,
            u.id_empresa,
            u.email,
            u.supabase_user_id,
            s.token,
            s.token_refresh
         FROM sessao s
         INNER JOIN usuario u ON u.id = s.id_usuario
         WHERE s.ativa = 1 AND u.ativo = 1
         ORDER BY s.id DESC
         LIMIT 1`
    );

    if (!row) return null;

    return {
        id: row.id_usuario,
        nome: row.nome,
        telefone: row.telefone,
        usuario_login: row.usuario_login,
        perfil: row.perfil,
        id_empresa: row.id_empresa,
        email: row.email || undefined,
        supabase_user_id: row.supabase_user_id || undefined,
        accessToken: row.token || undefined,
        refreshToken: row.token_refresh || undefined,
    };
}

export async function logoutSessaoAtual(): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('UPDATE sessao SET ativa = 0 WHERE ativa = 1');
}
