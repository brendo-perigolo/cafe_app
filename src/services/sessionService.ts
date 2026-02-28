import supabase from './supabaseClient';
import { getSessaoAtiva } from '../database/database';

export async function ensureSupabaseSession(): Promise<void> {
    try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
            return;
        }

        const sessao = await getSessaoAtiva();
        if (!sessao?.accessToken || !sessao.refreshToken) {
            return;
        }

        const { error } = await supabase.auth.setSession({
            access_token: sessao.accessToken,
            refresh_token: sessao.refreshToken,
        });

        if (error) {
            console.warn('Falha ao restaurar sessão Supabase:', error.message);
        }
    } catch (error) {
        console.warn('Erro ao garantir sessão Supabase:', error);
    }
}
