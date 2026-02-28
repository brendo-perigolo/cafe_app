import NetInfo from '@react-native-community/netinfo';

import supabase from './supabaseClient';
import {
    createSessaoLocal,
    logoutSessaoAtual,
    upsertEmpresaFromSupabase,
    upsertUsuarioFromSupabase,
} from '../database/database';
import { triggerFullSync } from './syncService';
import { hasNetworkConnection } from '../utils/network';

export async function signInWithSupabase(email: string, password: string): Promise<void> {
    const netState = await NetInfo.fetch();
    if (!hasNetworkConnection(netState)) {
        throw new Error('É necessário estar conectado à internet para entrar.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error || !data.session || !data.user) {
        console.error('Falha ao autenticar no Supabase', {
            message: error?.message,
            status: error?.status,
            email: normalizedEmail,
        });
        throw new Error(error?.message || 'Falha ao autenticar.');
    }

    const { data: vinculo, error: vinculoError } = await supabase
        .from('empresas_usuarios')
        .select('empresa_id,cargo,ativo,empresas(id,nome,cnpj)')
        .eq('user_id', data.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (vinculoError) {
        console.error('Erro ao buscar empresa do usuário', vinculoError.message);
        throw new Error('Não foi possível verificar o vínculo da empresa.');
    }

    if (!vinculo?.empresa_id) {
        throw new Error('Nenhuma empresa ativa foi encontrada para o usuário.');
    }

    if (vinculo.ativo === false) {
        throw new Error('Seu acesso à empresa foi desativado.');
    }

    const empresaJoin = Array.isArray(vinculo.empresas) ? vinculo.empresas[0] : vinculo.empresas;

    const empresaRemota = empresaJoin || {
        id: vinculo.empresa_id,
        nome: 'Empresa',
        cnpj: '',
    };

    const empresaLocal = await upsertEmpresaFromSupabase({
        id: empresaRemota.id,
        nome: empresaRemota.nome || 'Empresa',
        cnpj: empresaRemota.cnpj || '',
        codigo_licenca: 'SUPABASE',
    });

    const perfil = vinculo.cargo?.toLowerCase() === 'admin' ? 'admin' : 'usuario';
    const displayName = (data.user.user_metadata?.full_name as string) || data.user.email || 'Usuário';
    const telefone = (data.user.user_metadata?.telefone as string) || '';

    const usuarioLocalId = await upsertUsuarioFromSupabase({
        id: data.user.id,
        nome: displayName,
        email: data.user.email || '',
        telefone,
        perfil,
        id_empresa: empresaLocal.id!,
    });

    await createSessaoLocal(usuarioLocalId, data.session.access_token, data.session.refresh_token);

    await triggerFullSync();
}

export async function signOutSupabase(): Promise<void> {
    await logoutSessaoAtual();
    try {
        await supabase.auth.signOut();
    } catch (error) {
        console.warn('Falha ao encerrar sessão no Supabase:', error);
    }
}
