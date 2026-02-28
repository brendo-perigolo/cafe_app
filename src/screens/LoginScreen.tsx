import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../styles/theme';
import { getEmpresaAtiva } from '../database/database';
import { signInWithSupabase } from '../services/authService';

type Props = {
    navigation: NativeStackNavigationProp<any>;
};

export default function LoginScreen({ navigation }: Props) {
    const [empresaNome, setEmpresaNome] = useState('');
    const [initializing, setInitializing] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [mostrarSenha, setMostrarSenha] = useState(false);

    useEffect(() => {
        loadInitial();
    }, []);

    const loadInitial = async () => {
        try {
            const empresa = await getEmpresaAtiva();
            if (empresa?.nome) {
                setEmpresaNome(empresa.nome);
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Não foi possível carregar os dados de acesso.');
        } finally {
            setInitializing(false);
        }
    };

    const handleLogin = async () => {
        if (!email.trim() || !senha.trim()) {
            Alert.alert('Atenção', 'Informe e-mail e senha.');
            return;
        }

        setSubmitting(true);
        try {
            await signInWithSupabase(email.trim(), senha);
            navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível realizar o login.');
        } finally {
            setSubmitting(false);
        }
    };

    if (initializing) {
        return (
            <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="leaf" size={30} color={COLORS.textWhite} />
                    </View>
                    <Text style={styles.appTitle}>SafraCafé</Text>
                    <Text style={styles.appSubtitle}>Acesso ao sistema da fazenda</Text>
                    {!!empresaNome && <Text style={styles.empresaText}>{empresaNome}</Text>}
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Entrar</Text>
                    <Text style={styles.cardSubtitle}>Faça login com sua conta do Supabase</Text>

                    <Text style={styles.label}>E-MAIL</Text>
                    <View style={styles.inputWrap}>
                        <Ionicons name="person-outline" size={18} color={COLORS.textLight} />
                        <TextInput
                            style={styles.input}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="nome@empresa.com"
                            autoCapitalize="none"
                            keyboardType="email-address"
                            placeholderTextColor={COLORS.textLight}
                            editable={!submitting}
                        />
                    </View>

                    <Text style={styles.label}>SENHA</Text>
                    <View style={styles.inputWrap}>
                        <Ionicons name="lock-closed-outline" size={18} color={COLORS.textLight} />
                        <TextInput
                            style={styles.input}
                            value={senha}
                            onChangeText={setSenha}
                            placeholder="Digite sua senha"
                            secureTextEntry={!mostrarSenha}
                            placeholderTextColor={COLORS.textLight}
                            editable={!submitting}
                        />
                        <TouchableOpacity
                            onPress={() => setMostrarSenha((prev) => !prev)}
                            activeOpacity={0.8}
                            style={styles.showPasswordButton}
                        >
                            <Ionicons
                                name={mostrarSenha ? 'eye-off-outline' : 'eye-outline'}
                                size={20}
                                color={COLORS.textLight}
                            />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
                        onPress={handleLogin}
                        activeOpacity={0.85}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color={COLORS.textWhite} />
                        ) : (
                            <>
                                <Ionicons name="log-in-outline" size={20} color={COLORS.textWhite} />
                                <Text style={styles.primaryButtonText}>Entrar</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: SPACING.lg,
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    iconCircle: {
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.sm,
        ...SHADOWS.small,
    },
    appTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    appSubtitle: {
        color: COLORS.textLight,
        marginTop: 2,
    },
    empresaText: {
        marginTop: SPACING.xs,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    card: {
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        ...SHADOWS.medium,
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    cardSubtitle: {
        marginTop: 2,
        marginBottom: SPACING.md,
        color: COLORS.textLight,
    },
    label: {
        ...FONTS.label,
        marginTop: SPACING.xs,
        marginBottom: SPACING.xs,
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md,
        gap: SPACING.xs,
    },
    input: {
        flex: 1,
        height: 48,
        color: COLORS.textPrimary,
    },
    showPasswordButton: {
        padding: SPACING.xs,
    },
    primaryButton: {
        marginTop: SPACING.lg,
        backgroundColor: COLORS.accent,
        height: 50,
        borderRadius: RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: SPACING.xs,
    },
    primaryButtonDisabled: {
        opacity: 0.7,
    },
    primaryButtonText: {
        color: COLORS.textWhite,
        fontWeight: '700',
        fontSize: 16,
    },
    setupCard: {
        marginTop: SPACING.md,
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    setupTextWrap: {
        flex: 1,
    },
    setupTitle: {
        color: COLORS.textPrimary,
        fontWeight: '700',
    },
    setupSubtitle: {
        color: COLORS.textLight,
        fontSize: 12,
        marginTop: 2,
    },
    setupButton: {
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.sm,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 8,
    },
    setupButtonText: {
        color: COLORS.textWhite,
        fontWeight: '700',
        fontSize: 12,
    },
});
