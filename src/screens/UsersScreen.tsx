import React, { useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Modal,
    TextInput,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../styles/theme';
import {
    getSessaoAtiva,
    getUsuarios,
    insertUsuario,
    Usuario,
    UsuarioSessao,
} from '../database/database';

type Props = {
    navigation: NativeStackNavigationProp<any>;
};

export default function UsersScreen({ navigation }: Props) {
    const [sessao, setSessao] = useState<UsuarioSessao | null>(null);
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [showModal, setShowModal] = useState(false);

    const [nome, setNome] = useState('');
    const [telefone, setTelefone] = useState('');
    const [usuarioLogin, setUsuarioLogin] = useState('');
    const [senha, setSenha] = useState('');
    const [perfil, setPerfil] = useState<'admin' | 'usuario'>('usuario');

    const loadData = async () => {
        const sessaoAtiva = await getSessaoAtiva();
        if (!sessaoAtiva) {
            Alert.alert('Sessão expirada', 'Faça login novamente.');
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            return;
        }

        if (sessaoAtiva.perfil !== 'admin') {
            Alert.alert('Acesso negado', 'Apenas administradores podem acessar o módulo de usuários.');
            navigation.goBack();
            return;
        }

        setSessao(sessaoAtiva);
        const rows = await getUsuarios(sessaoAtiva.id_empresa);
        setUsuarios(rows);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const formatPhone = (text: string) => {
        const cleaned = text.replace(/\D/g, '').slice(0, 11);
        if (cleaned.length > 6) {
            return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
        }
        if (cleaned.length > 2) {
            return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
        }
        return cleaned;
    };

    const resetForm = () => {
        setNome('');
        setTelefone('');
        setUsuarioLogin('');
        setSenha('');
        setPerfil('usuario');
    };

    const handleCreateUser = async () => {
        if (!sessao) return;

        if (!nome.trim() || !usuarioLogin.trim() || !senha.trim()) {
            Alert.alert('Atenção', 'Preencha nome, usuário e senha.');
            return;
        }

        const telefoneClean = telefone.replace(/\D/g, '');
        if (telefoneClean.length < 10) {
            Alert.alert('Atenção', 'Informe um telefone válido para registro.');
            return;
        }

        try {
            await insertUsuario({
                nome: nome.trim(),
                telefone: telefoneClean,
                usuario_login: usuarioLogin.trim().toLowerCase(),
                senha,
                perfil,
                id_empresa: sessao.id_empresa,
            });

            setShowModal(false);
            resetForm();
            await loadData();
            Alert.alert('Sucesso', 'Usuário cadastrado com sucesso.');
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Não foi possível cadastrar o usuário. Verifique se o login já existe.');
        }
    };

    const renderItem = ({ item }: { item: Usuario }) => (
        <View style={styles.userCard}>
            <View style={styles.userIcon}>
                <Ionicons
                    name={item.perfil === 'admin' ? 'shield-checkmark-outline' : 'person-outline'}
                    size={18}
                    color={COLORS.textWhite}
                />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{item.nome}</Text>
                <Text style={styles.userSub}>@{item.usuario_login}</Text>
                <Text style={styles.userSub}>Telefone: {item.telefone}</Text>
            </View>
            <View style={[styles.badge, item.perfil === 'admin' ? styles.badgeAdmin : styles.badgeUser]}>
                <Text style={styles.badgeText}>{item.perfil === 'admin' ? 'ADMIN' : 'USUÁRIO'}</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>Módulo de Usuários</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
                    <Ionicons name="add" size={20} color={COLORS.textWhite} />
                    <Text style={styles.addBtnText}>Novo</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={usuarios}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={<Text style={styles.empty}>Nenhum usuário cadastrado.</Text>}
            />

            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Cadastrar usuário</Text>

                        <Text style={styles.label}>NOME</Text>
                        <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Nome completo" />

                        <Text style={styles.label}>TELEFONE</Text>
                        <TextInput
                            style={styles.input}
                            value={telefone}
                            onChangeText={(text) => setTelefone(formatPhone(text))}
                            keyboardType="phone-pad"
                            placeholder="(00) 00000-0000"
                        />

                        <Text style={styles.label}>USUÁRIO</Text>
                        <TextInput
                            style={styles.input}
                            value={usuarioLogin}
                            onChangeText={setUsuarioLogin}
                            autoCapitalize="none"
                            placeholder="usuario.login"
                        />

                        <Text style={styles.label}>SENHA</Text>
                        <TextInput
                            style={styles.input}
                            value={senha}
                            onChangeText={setSenha}
                            secureTextEntry
                            placeholder="Digite a senha"
                        />

                        <Text style={styles.label}>PERFIL</Text>
                        <View style={styles.perfilRow}>
                            <TouchableOpacity
                                style={[styles.perfilBtn, perfil === 'usuario' && styles.perfilBtnActive]}
                                onPress={() => setPerfil('usuario')}
                            >
                                <Text style={[styles.perfilBtnText, perfil === 'usuario' && styles.perfilBtnTextActive]}>
                                    Usuário
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.perfilBtn, perfil === 'admin' && styles.perfilBtnActive]}
                                onPress={() => setPerfil('admin')}
                            >
                                <Text style={[styles.perfilBtnText, perfil === 'admin' && styles.perfilBtnTextActive]}>
                                    Admin
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                                <Text style={styles.cancelBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleCreateUser}>
                                <Text style={styles.saveBtnText}>Salvar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        padding: SPACING.md,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    addBtn: {
        height: 40,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.accent,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        gap: 6,
    },
    addBtnText: {
        color: COLORS.textWhite,
        fontWeight: '700',
    },
    listContent: {
        paddingBottom: SPACING.xxl,
    },
    userCard: {
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        flexDirection: 'row',
        alignItems: 'center',
        ...SHADOWS.small,
    },
    userIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.sm,
    },
    userName: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    userSub: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    badge: {
        borderRadius: RADIUS.sm,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
    },
    badgeAdmin: {
        backgroundColor: COLORS.primary,
    },
    badgeUser: {
        backgroundColor: COLORS.info,
    },
    badgeText: {
        color: COLORS.textWhite,
        fontSize: 10,
        fontWeight: '700',
    },
    empty: {
        marginTop: SPACING.xl,
        textAlign: 'center',
        color: COLORS.textLight,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
        padding: SPACING.md,
    },
    modalCard: {
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
    },
    label: {
        ...FONTS.label,
        marginTop: SPACING.xs,
        marginBottom: SPACING.xs,
    },
    input: {
        height: 46,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md,
        color: COLORS.textPrimary,
        backgroundColor: COLORS.background,
    },
    perfilRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    perfilBtn: {
        flex: 1,
        height: 40,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    perfilBtnActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    perfilBtnText: {
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    perfilBtnTextActive: {
        color: COLORS.textWhite,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: SPACING.sm,
    },
    cancelBtn: {
        height: 42,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtnText: {
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    saveBtn: {
        height: 42,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveBtnText: {
        color: COLORS.textWhite,
        fontWeight: '700',
    },
});
