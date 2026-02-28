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
import { existeAdmin, getEmpresaAtiva, insertUsuario } from '../database/database';

type Props = {
    navigation: NativeStackNavigationProp<any>;
};

const PIN_ADMIN = '9999';

export default function AdminSetupScreen({ navigation }: Props) {
    const [empresaId, setEmpresaId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    const [step, setStep] = useState<1 | 2>(1);
    const [pinInput, setPinInput] = useState('');

    const [nome, setNome] = useState('');
    const [telefone, setTelefone] = useState('');
    const [usuarioLogin, setUsuarioLogin] = useState('');
    const [senha, setSenha] = useState('');

    useEffect(() => {
        loadInitial();
    }, []);

    const loadInitial = async () => {
        try {
            const empresa = await getEmpresaAtiva();
            if (!empresa?.id) {
                navigation.reset({ index: 0, routes: [{ name: 'License' }] });
                return;
            }

            const adminExiste = await existeAdmin(empresa.id);
            if (adminExiste) {
                navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                return;
            }

            setEmpresaId(empresa.id);
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Não foi possível iniciar o cadastro do administrador.');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

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

    const handleValidatePin = () => {
        if (pinInput.trim() !== PIN_ADMIN) {
            Alert.alert('PIN inválido', 'O PIN informado está incorreto.');
            return;
        }
        setStep(2);
    };

    const handleCreateAdmin = async () => {
        if (!empresaId) return;

        if (!nome.trim() || !usuarioLogin.trim() || !senha.trim()) {
            Alert.alert('Atenção', 'Preencha nome, usuário e senha.');
            return;
        }

        const telefoneClean = telefone.replace(/\D/g, '');
        if (telefoneClean.length < 10) {
            Alert.alert('Atenção', 'Informe um telefone válido para registro.');
            return;
        }

        setLoading(true);
        try {
            await insertUsuario({
                nome: nome.trim(),
                telefone: telefoneClean,
                usuario_login: usuarioLogin.trim().toLowerCase(),
                senha,
                perfil: 'admin',
                id_empresa: empresaId,
            });

            Alert.alert('Sucesso', 'Administrador criado com sucesso.');
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        } catch (error) {
            console.error(error);
            Alert.alert('Erro', 'Não foi possível criar o administrador. Verifique se o login já existe.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                <View style={styles.card}>
                    <View style={styles.topRow}>
                        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                            <Ionicons name="arrow-back" size={18} color={COLORS.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.title}>Cadastro inicial</Text>
                    </View>

                    <View style={styles.stepRow}>
                        <View style={[styles.stepCircle, styles.stepCircleActive]}>
                            <Text style={styles.stepCircleText}>1</Text>
                        </View>
                        <View style={[styles.stepDivider, step === 2 && styles.stepDividerActive]} />
                        <View style={[styles.stepCircle, step === 2 && styles.stepCircleActive]}>
                            <Text style={[styles.stepCircleText, step !== 2 && styles.stepCircleTextInactive]}>2</Text>
                        </View>
                    </View>

                    {step === 1 ? (
                        <>
                            <Text style={styles.sectionTitle}>Validação de PIN</Text>
                            <Text style={styles.sectionSubtitle}>
                                Digite o PIN secreto para habilitar o cadastro do administrador.
                            </Text>

                            <Text style={styles.label}>PIN SECRETO</Text>
                            <View style={styles.inputWrap}>
                                <Ionicons name="key-outline" size={18} color={COLORS.textLight} />
                                <TextInput
                                    style={styles.input}
                                    value={pinInput}
                                    onChangeText={setPinInput}
                                    placeholder="Digite o PIN"
                                    secureTextEntry
                                    keyboardType="number-pad"
                                    placeholderTextColor={COLORS.textLight}
                                />
                            </View>

                            <TouchableOpacity style={styles.primaryButton} onPress={handleValidatePin}>
                                <Text style={styles.primaryButtonText}>Validar e continuar</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <Text style={styles.sectionTitle}>Dados do Administrador</Text>
                            <Text style={styles.sectionSubtitle}>Este usuário terá permissão de administrador.</Text>

                            <Text style={styles.label}>NOME</Text>
                            <View style={styles.inputWrap}>
                                <Ionicons name="person-outline" size={18} color={COLORS.textLight} />
                                <TextInput
                                    style={styles.input}
                                    value={nome}
                                    onChangeText={setNome}
                                    placeholder="Nome completo"
                                    placeholderTextColor={COLORS.textLight}
                                />
                            </View>

                            <Text style={styles.label}>TELEFONE</Text>
                            <View style={styles.inputWrap}>
                                <Ionicons name="call-outline" size={18} color={COLORS.textLight} />
                                <TextInput
                                    style={styles.input}
                                    value={telefone}
                                    onChangeText={(text) => setTelefone(formatPhone(text))}
                                    keyboardType="phone-pad"
                                    placeholder="(00) 00000-0000"
                                    placeholderTextColor={COLORS.textLight}
                                />
                            </View>

                            <Text style={styles.label}>USUÁRIO</Text>
                            <View style={styles.inputWrap}>
                                <Ionicons name="at-outline" size={18} color={COLORS.textLight} />
                                <TextInput
                                    style={styles.input}
                                    value={usuarioLogin}
                                    onChangeText={setUsuarioLogin}
                                    autoCapitalize="none"
                                    placeholder="usuario.admin"
                                    placeholderTextColor={COLORS.textLight}
                                />
                            </View>

                            <Text style={styles.label}>SENHA</Text>
                            <View style={styles.inputWrap}>
                                <Ionicons name="lock-closed-outline" size={18} color={COLORS.textLight} />
                                <TextInput
                                    style={styles.input}
                                    value={senha}
                                    onChangeText={setSenha}
                                    secureTextEntry
                                    placeholder="Crie uma senha"
                                    placeholderTextColor={COLORS.textLight}
                                />
                            </View>

                            <TouchableOpacity style={styles.primaryButton} onPress={handleCreateAdmin}>
                                <Text style={styles.primaryButtonText}>Criar administrador</Text>
                            </TouchableOpacity>
                        </>
                    )}
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
    card: {
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        ...SHADOWS.medium,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    stepCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
    },
    stepCircleActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    stepCircleText: {
        color: COLORS.textWhite,
        fontWeight: '700',
    },
    stepCircleTextInactive: {
        color: COLORS.textSecondary,
    },
    stepDivider: {
        flex: 1,
        height: 2,
        backgroundColor: COLORS.border,
    },
    stepDividerActive: {
        backgroundColor: COLORS.primary,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    sectionSubtitle: {
        color: COLORS.textLight,
        marginTop: 4,
        marginBottom: SPACING.md,
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
    primaryButton: {
        marginTop: SPACING.lg,
        backgroundColor: COLORS.accent,
        height: 50,
        borderRadius: RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: COLORS.textWhite,
        fontWeight: '700',
        fontSize: 16,
    },
});
