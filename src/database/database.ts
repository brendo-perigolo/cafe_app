import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

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
            data_ativacao TEXT NOT NULL
        );
    `);

    await database.execAsync(`
        CREATE TABLE IF NOT EXISTS apanhador (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            sobrenome_apelido TEXT NOT NULL,
            telefone TEXT,
            cpf TEXT,
            id_empresa INTEGER NOT NULL,
            FOREIGN KEY (id_empresa) REFERENCES empresa(id)
        );
    `);

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
}

// ===================== EMPRESA =====================

export interface Empresa {
    id?: number;
    nome: string;
    cnpj: string;
    codigo_licenca?: string;
    licenca_ativa: number;
    data_ativacao: string;
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

// ===================== APANHADOR =====================

export interface Apanhador {
    id?: number;
    nome: string;
    sobrenome_apelido: string;
    telefone?: string;
    cpf?: string;
    id_empresa: number;
}

export async function insertApanhador(apanhador: Apanhador): Promise<number> {
    const database = await getDatabase();
    const result = await database.runAsync(
        'INSERT INTO apanhador (nome, sobrenome_apelido, telefone, cpf, id_empresa) VALUES (?, ?, ?, ?, ?)',
        apanhador.nome,
        apanhador.sobrenome_apelido,
        apanhador.telefone || '',
        apanhador.cpf || '',
        apanhador.id_empresa
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
            id_empresa
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        colheita.id_empresa
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
             grupo_ticket_id = ?
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

    const registro = await database.getFirstAsync<Pick<Colheita, 'id' | 'grupo_ticket_id'>>(
        'SELECT id, grupo_ticket_id FROM colheita WHERE id = ? AND id_empresa = ? LIMIT 1',
        id,
        idEmpresa
    );

    if (!registro) return;

    const grupoTicketId = registro.grupo_ticket_id || registro.id;

    await database.runAsync(
        'DELETE FROM colheita_edicao WHERE grupo_ticket_id = ? AND id_empresa = ?',
        grupoTicketId,
        idEmpresa
    );

    await database.runAsync('DELETE FROM colheita WHERE id = ? AND id_empresa = ?', id, idEmpresa);
}
