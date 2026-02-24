import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    ActivityIndicator,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../styles/theme';
import { insertEmpresa } from '../database/database';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
    navigation: NativeStackNavigationProp<any>;
};

export default function LicenseScreen({ navigation }: Props) {
    const [nome, setNome] = useState('');
    const [cnpj, setCnpj] = useState('');
    const [codigoLicenca, setCodigoLicenca] = useState('');
    const [loading, setLoading] = useState(false);
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
        }).start();
    }, []);

    const formatCNPJ = (text: string) => {
        const cleaned = text.replace(/\D/g, '').slice(0, 14);
        let formatted = cleaned;
        if (cleaned.length > 12) {
            formatted = `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`;
        } else if (cleaned.length > 8) {
            formatted = `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8)}`;
        } else if (cleaned.length > 5) {
            formatted = `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5)}`;
        } else if (cleaned.length > 2) {
            formatted = `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
        }
        return formatted;
    };

    const handleActivate = async () => {
        if (!nome.trim()) {
            Alert.alert('Atenção', 'Informe o nome da empresa.');
            return;
        }
        if (!cnpj.trim() || cnpj.replace(/\D/g, '').length < 14) {
            Alert.alert('Atenção', 'Informe um CNPJ válido.');
            return;
        }

        setLoading(true);
        try {
            const id = await insertEmpresa({
                nome: nome.trim(),
                cnpj: cnpj.trim(),
                codigo_licenca: codigoLicenca.trim() || 'TRIAL',
                licenca_ativa: 1,
                data_ativacao: new Date().toISOString(),
            });

            setTimeout(() => {
                setLoading(false);
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Dashboard' }],
                });
            }, 500);
        } catch (error) {
            setLoading(false);
            Alert.alert('Erro', 'Não foi possível ativar a licença. Tente novamente.');
            console.error(error);
        }
    };

    return (
        <View style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="leaf" size={48} color={COLORS.textWhite} />
                            </View>
                            <Text style={styles.appName}>SafraCafé</Text>
                            <Text style={styles.appSubtitle}>Gestão de Colheita de Café</Text>
                        </View>

                        {/* Form Card */}
                        <View style={styles.formCard}>
                            <Text style={styles.formTitle}>Ativação de Licença</Text>
                            <Text style={styles.formDescription}>
                                Cadastre os dados da sua empresa para começar a usar o app.
                            </Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>NOME DA EMPRESA</Text>
                                <View style={styles.inputWrapper}>
                                    <Ionicons name="business-outline" size={20} color={COLORS.textLight} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Ex: Fazenda Boa Vista"
                                        placeholderTextColor={COLORS.textLight}
                                        value={nome}
                                        onChangeText={setNome}
                                        autoCapitalize="words"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>CNPJ</Text>
                                <View style={styles.inputWrapper}>
                                    <Ionicons name="document-text-outline" size={20} color={COLORS.textLight} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="00.000.000/0000-00"
                                        placeholderTextColor={COLORS.textLight}
                                        value={cnpj}
                                        onChangeText={(text) => setCnpj(formatCNPJ(text))}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>CÓDIGO DE LICENÇA (OPCIONAL)</Text>
                                <View style={styles.inputWrapper}>
                                    <Ionicons name="key-outline" size={20} color={COLORS.textLight} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Insira o código ou deixe em branco"
                                        placeholderTextColor={COLORS.textLight}
                                        value={codigoLicenca}
                                        onChangeText={setCodigoLicenca}
                                        autoCapitalize="characters"
                                    />
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.activateButton, loading && styles.buttonDisabled]}
                                onPress={handleActivate}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color={COLORS.textWhite} size="small" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle" size={22} color={COLORS.textWhite} />
                                        <Text style={styles.buttonText}>Ativar e Entrar</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.footer}>
                            Todos os dados são salvos localmente no dispositivo
                        </Text>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.primary,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.xxl,
    },
    content: {
        alignItems: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    iconContainer: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.md,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    appName: {
        fontSize: 32,
        fontWeight: '800',
        color: COLORS.textWhite,
        letterSpacing: 1,
    },
    appSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        marginTop: SPACING.xs,
        letterSpacing: 0.5,
    },
    formCard: {
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.xl,
        padding: SPACING.lg,
        width: '100%',
        ...SHADOWS.large,
    },
    formTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    formDescription: {
        fontSize: 14,
        color: COLORS.textLight,
        marginBottom: SPACING.lg,
        lineHeight: 20,
    },
    inputGroup: {
        marginBottom: SPACING.md,
    },
    label: {
        ...FONTS.label,
        marginBottom: SPACING.xs,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: SPACING.md,
    },
    inputIcon: {
        marginRight: SPACING.sm,
    },
    input: {
        flex: 1,
        height: 48,
        fontSize: 15,
        color: COLORS.textPrimary,
    },
    activateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.accent,
        borderRadius: RADIUS.md,
        height: 52,
        marginTop: SPACING.lg,
        gap: 8,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textWhite,
    },
    footer: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginTop: SPACING.lg,
        textAlign: 'center',
    },
});
