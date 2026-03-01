import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import * as LocalAuthentication from 'expo-local-authentication';
import Constants from 'expo-constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../styles/theme';
import { getEmpresaAtiva, getSessaoAtiva } from '../database/database';
import { signInWithSupabase, resumeSessionWithBiometrics } from '../services/authService';
import { useSupabaseStatus } from '../hooks/useSupabaseStatus';
import {
    enableBiometricPreference,
    disableBiometricPreference,
    isBiometricPreferenceEnabled,
} from '../services/biometricService';

type Props = {
    navigation: NativeStackNavigationProp<any>;
};

const APP_VERSION = Constants.expoConfig?.version ?? Constants.manifest?.version ?? 'dev';
const VERSION_LABEL = `v${APP_VERSION}`;

export default function LoginScreen({ navigation }: Props) {
    const [empresaNome, setEmpresaNome] = useState('');
    const [initializing, setInitializing] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    const [biometricLoading, setBiometricLoading] = useState(false);
    const biometricRuntimeUnavailableLogged = useRef(false);

    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [mostrarSenha, setMostrarSenha] = useState(false);

    const { status: supabaseStatus } = useSupabaseStatus(20000);
    const isOnline = supabaseStatus === 'online';

    const requestBiometricPermissions = useCallback(async () => {
        const requestPermissions = (LocalAuthentication as any)?.requestPermissionsAsync;
        if (typeof requestPermissions === 'function') {
            try {
                await requestPermissions();
            } catch (error) {
                console.warn('Permissão de biometria não concedida:', error);
            }
        }
    }, []);

    const getBiometricSupport = useCallback(async () => {
        if (Platform.OS === 'web') {
            return { supported: false, hardwareAvailable: false, enrolled: false };
        }

        if (typeof LocalAuthentication?.hasHardwareAsync !== 'function') {
            return { supported: false, hardwareAvailable: false, enrolled: false };
        }

        try {
            const hardwareAvailable = await LocalAuthentication.hasHardwareAsync();
            if (!hardwareAvailable) {
                return { supported: true, hardwareAvailable: false, enrolled: false };
            }

            const enrolled = typeof LocalAuthentication?.isEnrolledAsync === 'function'
                ? await LocalAuthentication.isEnrolledAsync()
                : false;

            return { supported: true, hardwareAvailable, enrolled };
        } catch (error) {
            if (!biometricRuntimeUnavailableLogged.current) {
                console.warn('Biometria indisponível neste ambiente de execução.', error);
                biometricRuntimeUnavailableLogged.current = true;
            }
            return { supported: false, hardwareAvailable: false, enrolled: false };
        }
    }, []);

    const refreshBiometricState = useCallback(async () => {
        try {
            const [support, preferenceEnabled] = await Promise.all([
                getBiometricSupport(),
                isBiometricPreferenceEnabled(),
            ]);

            if (!support.supported) {
                setBiometricAvailable(false);
                setBiometricEnabled(false);
                return;
            }

            if (support.hardwareAvailable) {
                await requestBiometricPermissions();
            }

            const sessao = await getSessaoAtiva();
            const canUseBiometrics =
                support.hardwareAvailable && support.enrolled && preferenceEnabled && !!sessao?.refreshToken;

            setBiometricAvailable(support.hardwareAvailable && support.enrolled);
            setBiometricEnabled(canUseBiometrics);
        } catch (error) {
            console.warn('Falha ao verificar biometria', error);
            setBiometricAvailable(false);
            setBiometricEnabled(false);
        }
    }, [getBiometricSupport, requestBiometricPermissions]);

    const loadInitial = useCallback(async () => {
        try {
            const empresa = await getEmpresaAtiva();
            if (empresa?.nome) {
                setEmpresaNome(empresa.nome);
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Não foi possível carregar os dados de acesso.');
        } finally {
            await refreshBiometricState();
            setInitializing(false);
        }
    }, [refreshBiometricState]);

    const maybePromptBiometricOptIn = useCallback(async () => {
        try {
            const support = await getBiometricSupport();
            const hardwareAvailable = support.hardwareAvailable;
            const enrolled = support.enrolled;

            if (!hardwareAvailable || !enrolled) {
                return;
            }

            const alreadyEnabled = await isBiometricPreferenceEnabled();
            if (alreadyEnabled) {
                return;
            }

            await new Promise<void>((resolve) => {
                Alert.alert(
                    'Entrar usando biometria',
                    'Deseja usar sua digital nas próximas entradas?',
                    [
                        {
                            text: 'Agora não',
                            style: 'cancel',
                            onPress: () => resolve(),
                        },
                        {
                            text: 'Sim',
                            onPress: () => {
                                enableBiometricPreference()
                                    .catch((error) => console.warn('Erro ao habilitar biometria', error))
                                    .finally(resolve);
                            },
                        },
                    ],
                    { cancelable: true }
                );
            });
        } catch (error) {
            console.warn('Falha ao perguntar sobre biometria', error);
        }
    }, [getBiometricSupport]);

    useEffect(() => {
        loadInitial();
    }, [loadInitial]);

    const handleLogin = async () => {
        if (!email.trim() || !senha.trim()) {
            Alert.alert('Atenção', 'Informe e-mail e senha.');
            return;
        }

        setSubmitting(true);
        try {
            await signInWithSupabase(email.trim(), senha);
            await maybePromptBiometricOptIn();
            await refreshBiometricState();
            navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível realizar o login.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleBiometricLogin = async () => {
        if (!LocalAuthentication?.authenticateAsync) {
            Alert.alert('Biometria', 'Este dispositivo não suporta autenticação biométrica.');
            return;
        }

        if (!biometricAvailable || !biometricEnabled) {
            return;
        }

        setBiometricLoading(true);
        try {
            await requestBiometricPermissions();
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Entrar com biometria',
                fallbackLabel: 'Usar senha',
                cancelLabel: 'Cancelar',
            });

            if (!result.success) {
                if (result.error && result.error !== 'user_cancel' && result.error !== 'system_cancel') {
                    Alert.alert('Biometria', 'Não foi possível confirmar sua identidade.');
                }
                return;
            }

            await resumeSessionWithBiometrics();
            await refreshBiometricState();
            navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
        } catch (error) {
            console.error(error);
            if (error instanceof Error && error.message.includes('Nenhuma sessão')) {
                await disableBiometricPreference();
                await refreshBiometricState();
            }
            Alert.alert('Biometria', error instanceof Error ? error.message : 'Falha ao validar biometria.');
        } finally {
            setBiometricLoading(false);
        }
    };

    const handleOpenSettings = async () => {
        try {
            const support = await getBiometricSupport();
            const hasHardware = support.hardwareAvailable;
            const enrolled = support.enrolled;

            if (!support.supported) {
                Alert.alert('Configurações', 'Este dispositivo não suporta biometria.');
                return;
            }

            if (!hasHardware) {
                Alert.alert('Configurações', 'Biometria não disponível neste dispositivo.');
                return;
            }

            if (!enrolled) {
                Alert.alert('Configurações', 'Cadastre uma digital no sistema antes de habilitar.');
                return;
            }

            await requestBiometricPermissions();

            Alert.alert(
                'Configurações',
                'Deseja habilitar o login com biometria?',
                [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                        text: 'Habilitar',
                        onPress: async () => {
                            try {
                                await enableBiometricPreference();
                                await refreshBiometricState();
                                Alert.alert('Biometria', 'Login por biometria habilitado.');
                            } catch (error) {
                                console.error('Falha ao habilitar biometria', error);
                                Alert.alert('Biometria', 'Não foi possível habilitar a biometria.');
                            }
                        },
                    },
                ],
                { cancelable: true }
            );
        } catch (error) {
            console.error('Configurações de biometria', error);
            Alert.alert('Biometria', 'Não foi possível acessar as configurações.');
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

                    {biometricAvailable && biometricEnabled && (
                        <TouchableOpacity
                            style={[styles.biometricButton, biometricLoading && styles.biometricButtonDisabled]}
                            onPress={handleBiometricLogin}
                            activeOpacity={0.85}
                            disabled={biometricLoading}
                        >
                            {biometricLoading ? (
                                <ActivityIndicator size="small" color={COLORS.accent} />
                            ) : (
                                <>
                                    <Ionicons name="finger-print-outline" size={20} color={COLORS.accent} />
                                    <Text style={styles.biometricButtonText}>Entrar com biometria</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.settingsButton} onPress={handleOpenSettings} activeOpacity={0.85}>
                        <Ionicons name="settings-outline" size={18} color={COLORS.textSecondary} />
                        <Text style={styles.settingsButtonText}>Configurações</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.footerInfo}>
                    <View style={styles.statusPill}>
                        <View style={[styles.statusDot, isOnline ? styles.statusDotOnline : styles.statusDotOffline]} />
                        <Text style={styles.statusPillText}>{isOnline ? 'Online' : 'Offline'}</Text>
                    </View>
                    <Text style={styles.versionBadge}>{VERSION_LABEL}</Text>
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
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.md,
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING.sm,
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
    versionBadge: {
        marginTop: SPACING.xs,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: RADIUS.sm,
        backgroundColor: COLORS.background,
        color: COLORS.textSecondary,
        fontWeight: '700',
        fontSize: 12,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 0,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: RADIUS.sm,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    statusDotOnline: {
        backgroundColor: COLORS.success,
    },
    statusDotOffline: {
        backgroundColor: COLORS.error,
    },
    statusPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textSecondary,
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
        marginTop: SPACING.sm,
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
        marginTop: SPACING.md,
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
    biometricButton: {
        marginTop: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.accent,
        backgroundColor: COLORS.background,
        height: 48,
        borderRadius: RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: SPACING.xs,
    },
    biometricButtonDisabled: {
        opacity: 0.7,
    },
    biometricButtonText: {
        color: COLORS.accent,
        fontWeight: '700',
        fontSize: 14,
    },
    settingsButton: {
        marginTop: SPACING.md,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.xs,
        paddingHorizontal: SPACING.md,
        paddingVertical: 10,
    },
    settingsButtonText: {
        color: COLORS.textSecondary,
        fontWeight: '700',
    },
    footerInfo: {
        marginTop: SPACING.lg,
        alignItems: 'center',
        gap: SPACING.sm,
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
