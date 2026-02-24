import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Animated,
    Modal,
    FlatList,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SignatureScreen from 'react-native-signature-canvas';
import * as Crypto from 'expo-crypto';
import * as Print from 'expo-print';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../styles/theme';
import {
    insertColheita,
    getEmpresaAtiva,
    Colheita,
    Apanhador,
    searchApanhadores,
    insertApanhador,
    getAllApanhadores,
} from '../database/database';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
    navigation: NativeStackNavigationProp<any>;
};

type FieldErrors = {
    apanhador?: string;
    numeroBag?: string;
    pesoKg?: string;
};

type ApanhadorFormErrors = {
    nome?: string;
    sobrenome?: string;
};

export default function HarvestEntryScreen({ navigation }: Props) {
    const [codigoUnico, setCodigoUnico] = useState('');
    const [dataHora, setDataHora] = useState('');
    const [dataHoraISO, setDataHoraISO] = useState('');
    const [numeroBag, setNumeroBag] = useState('');
    const [pesoKg, setPesoKg] = useState('');
    const [valorPorKg, setValorPorKg] = useState('');
    const [assinatura, setAssinatura] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showSignature, setShowSignature] = useState(false);
    const [showSignaturePreview, setShowSignaturePreview] = useState(false);
    const [empresaId, setEmpresaId] = useState<number | null>(null);
    const [empresaNome, setEmpresaNome] = useState('');
    const [errors, setErrors] = useState<FieldErrors>({});
    const [showTicket, setShowTicket] = useState(false);
    const [savedColheita, setSavedColheita] = useState<Colheita | null>(null);
    const [reprintCount, setReprintCount] = useState(0);

    // Apanhador states
    const [apanhadorSearch, setApanhadorSearch] = useState('');
    const [selectedApanhador, setSelectedApanhador] = useState<Apanhador | null>(null);
    const [apanhadorResults, setApanhadorResults] = useState<Apanhador[]>([]);
    const [showApanhadorDropdown, setShowApanhadorDropdown] = useState(false);
    const [showNewApanhadorModal, setShowNewApanhadorModal] = useState(false);
    const [newNome, setNewNome] = useState('');
    const [newSobrenome, setNewSobrenome] = useState('');
    const [newTelefone, setNewTelefone] = useState('');
    const [newCpf, setNewCpf] = useState('');
    const [apanhadorFormErrors, setApanhadorFormErrors] = useState<ApanhadorFormErrors>({});
    const [savingApanhador, setSavingApanhador] = useState(false);

    const signatureRef = useRef<any>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const ticketAnim = useRef(new Animated.Value(0)).current;
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        generateCode();
        loadEmpresa();
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, []);

    const generateCode = async () => {
        const uuid = await Crypto.randomUUID();
        const shortCode = uuid.split('-')[0].toUpperCase();
        setCodigoUnico(`SF-${shortCode}`);
        const now = new Date();
        setDataHora(now.toLocaleString('pt-BR'));
        setDataHoraISO(now.toISOString());
    };

    const loadEmpresa = async () => {
        const emp = await getEmpresaAtiva();
        if (emp?.id) {
            setEmpresaId(emp.id);
            setEmpresaNome(emp.nome);
        }
    };

    const valorTotal = () => {
        const peso = parseFloat(pesoKg.replace(',', '.')) || 0;
        const valor = parseFloat(valorPorKg.replace(',', '.')) || 0;
        return peso * valor;
    };

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatTicketDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const buildTicketHtml = (ticket: Colheita, opts?: { isReprint?: boolean; reprintNumber?: number }) => {
        const isReprint = !!opts?.isReprint;
        const reprintNumber = opts?.reprintNumber || 0;
        const controleImpressao = isReprint ? `${ticket.id}-R${reprintNumber}` : `${ticket.id}-ORIGINAL`;

        const signatureHtml = ticket.assinatura_base64
            ? `<div style="margin-top:14px;">
                    <div style="font-size:11px;color:#6D4C41;font-weight:700;">ASSINATURA</div>
                    <div style="border:1px solid #D7CCC8;border-radius:8px;padding:8px;background:#FAF3E0;margin-top:4px;height:120px;display:flex;align-items:center;justify-content:center;overflow:hidden;">
                        <img src="${ticket.assinatura_base64}" style="height:100%;max-height:100%;width:auto;object-fit:contain;transform: rotate(90deg);" />
                    </div>
                </div>`
            : '';

        const tipoTicketHtml = isReprint
            ? `<div style="margin-bottom:10px;padding:8px 10px;border-radius:8px;background:#FFF3E0;color:#E65100;font-weight:700;">REIMPRESSÃO #${reprintNumber}</div>`
            : `<div style="margin-bottom:10px;padding:8px 10px;border-radius:8px;background:#E8F5E9;color:#1B5E20;font-weight:700;">TICKET ORIGINAL</div>`;

        return `
            <html>
                <head>
                    <style>
                        @page { size: A4 landscape; margin: 10mm; }
                        html, body { width: 100%; height: 100%; }
                    </style>
                </head>
                <body style="font-family: Arial, sans-serif; padding: 16px; color:#3E2723;">
                    <div style="border:1px solid #D7CCC8;border-radius:12px;padding:16px;max-width:700px;">
                        <h2 style="margin:0 0 4px 0;">${empresaNome || 'Safra Café'}</h2>
                        <div style="font-size:12px;color:#6D4C41;margin-bottom:12px;">Comprovante de Colheita</div>
                        ${tipoTicketHtml}

                        <div style="font-size:11px;color:#6D4C41;font-weight:700;">TICKET</div>
                        <div style="font-size:20px;font-weight:800;margin-bottom:10px;">${ticket.id}</div>
                        <div style="margin-bottom:6px;"><strong>Controle de impressão:</strong> ${controleImpressao}</div>

                        <div style="margin-bottom:6px;"><strong>Data/Hora:</strong> ${formatTicketDate(ticket.data_hora)}</div>
                        <div style="margin-bottom:6px;"><strong>Apanhador:</strong> ${ticket.apanhador_nome}</div>
                        <div style="margin-bottom:6px;"><strong>Nº Bag:</strong> ${ticket.numero_bag}</div>
                        <div style="margin-bottom:6px;"><strong>Peso:</strong> ${ticket.peso_kg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</div>
                        <div style="margin-bottom:6px;"><strong>Valor/Kg:</strong> ${formatCurrency(ticket.valor_por_kg)}</div>
                        <div style="margin-bottom:6px;"><strong>Valor Total:</strong> ${formatCurrency(ticket.valor_total)}</div>

                        ${signatureHtml}
                    </div>
                </body>
            </html>
        `;
    };

    const handlePrintTicket = async (ticket: Colheita, opts?: { isReprint?: boolean; reprintNumber?: number }) => {
        try {
            await Print.printAsync({ html: buildTicketHtml(ticket, opts) });
        } catch (error) {
            console.error('Erro ao imprimir ticket:', error);
            Alert.alert('Erro', 'Não foi possível abrir a impressão.');
        }
    };

    const handleReprintTicket = async (ticket: Colheita) => {
        const nextReprint = reprintCount + 1;
        setReprintCount(nextReprint);
        await handlePrintTicket(ticket, { isReprint: true, reprintNumber: nextReprint });
    };

    // =================== APANHADOR SEARCH ===================
    const handleApanhadorSearch = (text: string) => {
        setApanhadorSearch(text);
        setSelectedApanhador(null);
        if (errors.apanhador) setErrors((prev) => ({ ...prev, apanhador: undefined }));

        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        if (!text.trim() || !empresaId) {
            setApanhadorResults([]);
            setShowApanhadorDropdown(false);
            return;
        }

        searchTimeout.current = setTimeout(async () => {
            const results = await searchApanhadores(empresaId, text.trim());
            setApanhadorResults(results);
            setShowApanhadorDropdown(true);
        }, 250);
    };

    const handleSelectApanhador = (ap: Apanhador) => {
        setSelectedApanhador(ap);
        setApanhadorSearch(`${ap.nome} ${ap.sobrenome_apelido}`);
        setShowApanhadorDropdown(false);
        if (errors.apanhador) setErrors((prev) => ({ ...prev, apanhador: undefined }));
    };

    const handleOpenNewApanhador = () => {
        setShowApanhadorDropdown(false);
        setNewNome(apanhadorSearch.trim());
        setNewSobrenome('');
        setNewTelefone('');
        setNewCpf('');
        setApanhadorFormErrors({});
        setShowNewApanhadorModal(true);
    };

    const formatPhone = (text: string) => {
        const cleaned = text.replace(/\D/g, '').slice(0, 11);
        if (cleaned.length > 6) {
            return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
        } else if (cleaned.length > 2) {
            return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
        }
        return cleaned;
    };

    const formatCPF = (text: string) => {
        const cleaned = text.replace(/\D/g, '').slice(0, 11);
        if (cleaned.length > 9) {
            return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
        } else if (cleaned.length > 6) {
            return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
        } else if (cleaned.length > 3) {
            return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
        }
        return cleaned;
    };

    const handleSaveNewApanhador = async () => {
        const formErrors: ApanhadorFormErrors = {};
        if (!newNome.trim()) formErrors.nome = 'Informe o nome';
        if (!newSobrenome.trim()) formErrors.sobrenome = 'Informe o sobrenome ou apelido';
        setApanhadorFormErrors(formErrors);
        if (Object.keys(formErrors).length > 0) return;
        if (!empresaId) return;

        setSavingApanhador(true);
        try {
            const telefoneClean = newTelefone.replace(/\D/g, '') || null;
            const cpfClean = newCpf.replace(/\D/g, '') || null;

            const id = await insertApanhador({
                nome: newNome.trim(),
                sobrenome_apelido: newSobrenome.trim(),
                telefone: telefoneClean ?? undefined,
                cpf: cpfClean ?? undefined,
                id_empresa: empresaId,
            });

            const newAp: Apanhador = {
                id,
                nome: newNome.trim(),
                sobrenome_apelido: newSobrenome.trim(),
                telefone: telefoneClean ?? undefined,
                cpf: cpfClean ?? undefined,
                id_empresa: empresaId,
            };

            setSelectedApanhador(newAp);
            setApanhadorSearch(`${newAp.nome} ${newAp.sobrenome_apelido}`);
            setShowNewApanhadorModal(false);
            setSavingApanhador(false);
        } catch (error) {
            setSavingApanhador(false);
            Alert.alert('Erro', 'Não foi possível cadastrar o apanhador.');
            console.error(error);
        }
    };

    // =================== FIELD VALIDATION ===================
    const handleFieldChange = (field: keyof FieldErrors, value: string, setter: (v: string) => void) => {
        setter(value);
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const validate = (): boolean => {
        const newErrors: FieldErrors = {};
        if (!selectedApanhador) newErrors.apanhador = 'Selecione ou cadastre um apanhador';
        if (!numeroBag.trim()) newErrors.numeroBag = 'Informe o número da bag';
        if (!pesoKg.trim() || parseFloat(pesoKg.replace(',', '.')) <= 0) newErrors.pesoKg = 'Informe o peso em kg';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // =================== SIGNATURE ===================
    const handleSignatureOK = (signature: string) => {
        // react-native-signature-canvas returns a data URI: "data:image/png;base64,..."
        if (signature && signature.length > 0) {
            setAssinatura(signature);
        }
        setShowSignaturePreview(false);
        setShowSignature(false);
    };

    const handleSignatureClear = () => {
        signatureRef.current?.clearSignature();
    };

    // =================== SAVE ===================
    const handleSave = async () => {
        if (!validate()) return;
        if (!empresaId || !selectedApanhador?.id) {
            Alert.alert('Erro', 'Dados incompletos. Tente novamente.');
            return;
        }

        setLoading(true);
        try {
            const colheita: Colheita = {
                id: codigoUnico,
                data_hora: dataHoraISO,
                id_apanhador: selectedApanhador.id,
                apanhador_nome: `${selectedApanhador.nome} ${selectedApanhador.sobrenome_apelido}`,
                numero_bag: parseInt(numeroBag, 10),
                peso_kg: parseFloat(pesoKg.replace(',', '.')),
                valor_por_kg: parseFloat(valorPorKg.replace(',', '.')) || 0,
                valor_total: valorTotal(),
                assinatura_base64: assinatura || undefined,
                id_empresa: empresaId,
            };

            await insertColheita(colheita);
            setSavedColheita(colheita);
            setReprintCount(0);
            setLoading(false);

            setShowTicket(true);
            Animated.spring(ticketAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 50,
                friction: 7,
            }).start();

            Alert.alert(
                'Colheita salva',
                'Deseja imprimir o ticket em uma impressora Bluetooth ou Wi-Fi?',
                [
                    { text: 'Agora não', style: 'cancel' },
                    {
                        text: 'Imprimir',
                        onPress: () => {
                            handlePrintTicket(colheita, { isReprint: false, reprintNumber: 0 });
                        },
                    },
                ]
            );
        } catch (error) {
            setLoading(false);
            Alert.alert('Erro', 'Não foi possível salvar a colheita. Tente novamente.');
            console.error(error);
        }
    };

    const handleCloseTicket = () => {
        Animated.timing(ticketAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            setShowTicket(false);
            navigation.goBack();
        });
    };

    // =================== SIGNATURE FULL SCREEN ===================
    if (showSignature) {
        return (
            <View style={styles.signatureContainer}>
                <View style={styles.signatureHeader}>
                    <TouchableOpacity onPress={() => setShowSignature(false)}>
                        <Ionicons name="close" size={28} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.signatureTitle}>Assinatura</Text>
                    <View style={styles.signatureHeaderSpacer} />
                </View>

                <View style={styles.signatureBody}>
                    <Text style={styles.signatureHint}>Assine no quadro vertical e toque em "Salvar assinatura".</Text>

                    <View style={styles.signatureCanvasWrap}>
                        <SignatureScreen
                            ref={signatureRef}
                            onOK={handleSignatureOK}
                            onEmpty={() => Alert.alert('Atenção', 'Por favor, faça sua assinatura.')}
                            descriptionText=""
                            clearText=""
                            confirmText=""
                            autoClear={false}
                            imageType="image/png"
                            trimWhitespace={true}
                            webStyle={`
            .m-signature-pad { box-shadow: none; border: none; border-radius: 12px; margin: 0; width: 100%; height: 100%; }
            .m-signature-pad--body { border: none; }
            .m-signature-pad--footer { display: none; }
            body, html { background-color: ${COLORS.card}; margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
            canvas { width: 100% !important; height: 100% !important; }
          `}
                            backgroundColor={COLORS.card}
                            penColor={COLORS.textPrimary}
                            minWidth={2}
                            maxWidth={4}
                            dotSize={3}
                            style={{ flex: 1 }}
                        />
                        <View pointerEvents="none" style={styles.signatureGuideLine} />
                    </View>

                    <View style={styles.signatureActionsRow}>
                        <TouchableOpacity
                            style={styles.signatureClearButton}
                            onPress={handleSignatureClear}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                            <Text style={styles.signatureClearButtonText}>Limpar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.signatureSaveButton}
                            onPress={() => signatureRef.current?.readSignature()}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="save-outline" size={20} color={COLORS.textWhite} />
                            <Text style={styles.signatureSaveButtonText}>Salvar assinatura</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    const renderSignaturePreviewModal = () => (
        <Modal visible={showSignaturePreview} transparent animationType="fade" onRequestClose={() => setShowSignaturePreview(false)}>
            <View style={styles.signaturePreviewOverlay}>
                <View style={styles.signaturePreviewCard}>
                    <View style={styles.signaturePreviewHeader}>
                        <Text style={styles.signaturePreviewTitle}>Preview da Assinatura</Text>
                        <TouchableOpacity onPress={() => setShowSignaturePreview(false)}>
                            <Ionicons name="close" size={24} color={COLORS.textLight} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.signaturePreviewImageWrap}>
                        {assinatura ? (
                            <Image source={{ uri: assinatura }} style={styles.signaturePreviewImage} resizeMode="contain" />
                        ) : (
                            <Text style={styles.signatureSubText}>Sem assinatura salva.</Text>
                        )}
                    </View>

                    <View style={styles.signaturePreviewActions}>
                        <TouchableOpacity style={styles.signaturePreviewSecondaryBtn} onPress={() => setShowSignaturePreview(false)}>
                            <Text style={styles.signaturePreviewSecondaryText}>Fechar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.signaturePreviewPrimaryBtn}
                            onPress={() => {
                                setShowSignaturePreview(false);
                                setShowSignature(true);
                            }}
                        >
                            <Ionicons name="pencil" size={16} color={COLORS.textWhite} />
                            <Text style={styles.signaturePreviewPrimaryText}>Alterar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    // =================== NEW APANHADOR MODAL ===================
    const renderNewApanhadorModal = () => (
        <Modal visible={showNewApanhadorModal} transparent animationType="slide">
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Novo Apanhador</Text>
                        <TouchableOpacity onPress={() => setShowNewApanhadorModal(false)}>
                            <Ionicons name="close-circle" size={28} color={COLORS.textLight} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        {/* Nome */}
                        <View style={styles.modalInputGroup}>
                            <Text style={styles.label}>
                                NOME <Text style={styles.required}>*</Text>
                            </Text>
                            <View style={[styles.inputWrapper, apanhadorFormErrors.nome && styles.inputError]}>
                                <Ionicons name="person-outline" size={20} color={apanhadorFormErrors.nome ? COLORS.error : COLORS.textLight} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Nome"
                                    placeholderTextColor={COLORS.textLight}
                                    value={newNome}
                                    onChangeText={(v) => {
                                        setNewNome(v);
                                        if (apanhadorFormErrors.nome) setApanhadorFormErrors((p) => ({ ...p, nome: undefined }));
                                    }}
                                    autoCapitalize="words"
                                    autoFocus
                                />
                            </View>
                            {apanhadorFormErrors.nome && (
                                <View style={styles.errorRow}>
                                    <Ionicons name="alert-circle" size={14} color={COLORS.error} />
                                    <Text style={styles.errorText}>{apanhadorFormErrors.nome}</Text>
                                </View>
                            )}
                        </View>

                        {/* Sobrenome / Apelido */}
                        <View style={styles.modalInputGroup}>
                            <Text style={styles.label}>
                                SOBRENOME / APELIDO <Text style={styles.required}>*</Text>
                            </Text>
                            <View style={[styles.inputWrapper, apanhadorFormErrors.sobrenome && styles.inputError]}>
                                <Ionicons name="text-outline" size={20} color={apanhadorFormErrors.sobrenome ? COLORS.error : COLORS.textLight} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Sobrenome ou apelido"
                                    placeholderTextColor={COLORS.textLight}
                                    value={newSobrenome}
                                    onChangeText={(v) => {
                                        setNewSobrenome(v);
                                        if (apanhadorFormErrors.sobrenome) setApanhadorFormErrors((p) => ({ ...p, sobrenome: undefined }));
                                    }}
                                    autoCapitalize="words"
                                />
                            </View>
                            {apanhadorFormErrors.sobrenome && (
                                <View style={styles.errorRow}>
                                    <Ionicons name="alert-circle" size={14} color={COLORS.error} />
                                    <Text style={styles.errorText}>{apanhadorFormErrors.sobrenome}</Text>
                                </View>
                            )}
                        </View>

                        {/* Telefone */}
                        <View style={styles.modalInputGroup}>
                            <Text style={styles.label}>TELEFONE</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="call-outline" size={20} color={COLORS.textLight} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="(00) 00000-0000"
                                    placeholderTextColor={COLORS.textLight}
                                    value={newTelefone}
                                    onChangeText={(v) => setNewTelefone(formatPhone(v))}
                                    keyboardType="phone-pad"
                                />
                            </View>
                        </View>

                        {/* CPF */}
                        <View style={styles.modalInputGroup}>
                            <Text style={styles.label}>CPF</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="card-outline" size={20} color={COLORS.textLight} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="000.000.000-00"
                                    placeholderTextColor={COLORS.textLight}
                                    value={newCpf}
                                    onChangeText={(v) => setNewCpf(formatCPF(v))}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.modalSaveButton, savingApanhador && styles.saveButtonDisabled]}
                            onPress={handleSaveNewApanhador}
                            disabled={savingApanhador}
                            activeOpacity={0.85}
                        >
                            {savingApanhador ? (
                                <ActivityIndicator color={COLORS.textWhite} />
                            ) : (
                                <>
                                    <Ionicons name="person-add" size={20} color={COLORS.textWhite} />
                                    <Text style={styles.modalSaveText}>Cadastrar Apanhador</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );

    // =================== TICKET PREVIEW MODAL ===================
    const renderTicketModal = () => {
        if (!savedColheita) return null;
        const formatDate = (dateStr: string) => {
            const date = new Date(dateStr);
            return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        };

        return (
            <Modal visible={showTicket} transparent animationType="none">
                <View style={styles.ticketOverlay}>
                    <Animated.View style={[styles.ticketContainer, { transform: [{ scale: ticketAnim }], opacity: ticketAnim }]}>
                        <View style={styles.ticketHeader}>
                            <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
                            <Text style={styles.ticketSuccessText}>Colheita Salva!</Text>
                        </View>

                        <View style={styles.ticketBody}>
                            <View style={styles.ticketDivider}>
                                <View style={styles.ticketNotchLeft} />
                                <View style={styles.ticketDividerLine} />
                                <View style={styles.ticketNotchRight} />
                            </View>

                            <Text style={styles.ticketCompany}>{empresaNome}</Text>
                            <Text style={styles.ticketSubhead}>Comprovante de Colheita</Text>

                            <View style={styles.ticketCodeWrap}>
                                <Text style={styles.ticketCodeLabel}>CÓDIGO</Text>
                                <Text style={styles.ticketCode}>{savedColheita.id}</Text>
                            </View>

                            <View style={styles.ticketRow}>
                                <View style={styles.ticketField}>
                                    <Text style={styles.ticketFieldLabel}>DATA / HORA</Text>
                                    <Text style={styles.ticketFieldValue}>{formatDate(savedColheita.data_hora)}</Text>
                                </View>
                            </View>

                            <View style={styles.ticketRow}>
                                <View style={styles.ticketField}>
                                    <Text style={styles.ticketFieldLabel}>APANHADOR</Text>
                                    <Text style={styles.ticketFieldValue}>{savedColheita.apanhador_nome}</Text>
                                </View>
                                <View style={styles.ticketField}>
                                    <Text style={styles.ticketFieldLabel}>Nº BAG</Text>
                                    <Text style={styles.ticketFieldValue}>{savedColheita.numero_bag}</Text>
                                </View>
                            </View>

                            <View style={styles.ticketRow}>
                                <View style={styles.ticketField}>
                                    <Text style={styles.ticketFieldLabel}>PESO</Text>
                                    <Text style={styles.ticketFieldValue}>
                                        {savedColheita.peso_kg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
                                    </Text>
                                </View>
                                {savedColheita.valor_por_kg > 0 && (
                                    <View style={styles.ticketField}>
                                        <Text style={styles.ticketFieldLabel}>VALOR/KG</Text>
                                        <Text style={styles.ticketFieldValue}>{formatCurrency(savedColheita.valor_por_kg)}</Text>
                                    </View>
                                )}
                            </View>

                            {savedColheita.valor_total > 0 && (
                                <View style={styles.ticketTotalWrap}>
                                    <Text style={styles.ticketTotalLabel}>VALOR TOTAL</Text>
                                    <Text style={styles.ticketTotalValue}>{formatCurrency(savedColheita.valor_total)}</Text>
                                </View>
                            )}

                            {savedColheita.assinatura_base64 && savedColheita.assinatura_base64.length > 10 && (
                                <View style={styles.ticketSignatureWrap}>
                                    <Text style={styles.ticketSignatureLabel}>ASSINATURA</Text>
                                    <View style={styles.ticketSignatureImageWrap}>
                                        <Image
                                            source={{ uri: savedColheita.assinatura_base64 }}
                                            style={styles.ticketSignatureImage}
                                            resizeMode="contain"
                                        />
                                    </View>
                                    <View style={styles.ticketSignatureIndicator}>
                                        <Ionicons name="checkmark-circle" size={14} color={COLORS.accent} />
                                        <Text style={styles.ticketSignatureText}>Assinatura digital registrada</Text>
                                    </View>
                                </View>
                            )}
                        </View>

                        <TouchableOpacity
                            style={styles.ticketPrintButton}
                            onPress={() => handlePrintTicket(savedColheita)}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="print-outline" size={20} color={COLORS.textWhite} />
                            <Text style={styles.ticketPrintText}>Reimprimir Ticket</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.ticketCloseButton} onPress={handleCloseTicket} activeOpacity={0.85}>
                            <Ionicons name="arrow-back" size={20} color={COLORS.textWhite} />
                            <Text style={styles.ticketCloseText}>Voltar ao Dashboard</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>
        );
    };

    // =================== MAIN FORM ===================
    return (
        <View style={styles.container}>
            {renderTicketModal()}
            {renderNewApanhadorModal()}
            {renderSignaturePreviewModal()}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View style={{ opacity: fadeAnim }}>
                        {/* Code & Date Badge */}
                        <View style={styles.badgeRow}>
                            <View style={styles.codeBadge}>
                                <Ionicons name="qr-code-outline" size={16} color={COLORS.primary} />
                                <Text style={styles.codeText}>{codigoUnico}</Text>
                            </View>
                            <View style={styles.dateBadge}>
                                <Ionicons name="time-outline" size={16} color={COLORS.accent} />
                                <Text style={styles.dateText}>{dataHora}</Text>
                            </View>
                        </View>

                        {/* Form */}
                        <View style={styles.formCard}>
                            {/* Apanhador - Search */}
                            <View style={[styles.inputGroup, { zIndex: 10 }]}>
                                <Text style={styles.label}>
                                    APANHADOR <Text style={styles.required}>*</Text>
                                </Text>

                                {selectedApanhador ? (
                                    <View style={styles.selectedApanhadorBox}>
                                        <View style={styles.selectedApanhadorInfo}>
                                            <View style={styles.selectedAvatar}>
                                                <Ionicons name="person" size={18} color={COLORS.textWhite} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.selectedName}>
                                                    {selectedApanhador.nome} {selectedApanhador.sobrenome_apelido}
                                                </Text>
                                                {selectedApanhador.telefone && (
                                                    <Text style={styles.selectedDetail}>
                                                        <Ionicons name="call-outline" size={11} color={COLORS.textLight} /> {selectedApanhador.telefone}
                                                    </Text>
                                                )}
                                            </View>
                                            <TouchableOpacity
                                                style={styles.changeApanhadorBtn}
                                                onPress={() => {
                                                    setSelectedApanhador(null);
                                                    setApanhadorSearch('');
                                                }}
                                            >
                                                <Text style={styles.changeApanhadorText}>Trocar</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                    <>
                                        <View style={[styles.inputWrapper, errors.apanhador && styles.inputError]}>
                                            <Ionicons
                                                name="search-outline"
                                                size={20}
                                                color={errors.apanhador ? COLORS.error : COLORS.textLight}
                                                style={styles.inputIcon}
                                            />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Buscar apanhador pelo nome..."
                                                placeholderTextColor={COLORS.textLight}
                                                value={apanhadorSearch}
                                                onChangeText={handleApanhadorSearch}
                                                autoCapitalize="words"
                                            />
                                            {apanhadorSearch.length > 0 && (
                                                <TouchableOpacity onPress={() => { setApanhadorSearch(''); setShowApanhadorDropdown(false); }}>
                                                    <Ionicons name="close-circle" size={20} color={COLORS.textLight} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                        {errors.apanhador && (
                                            <View style={styles.errorRow}>
                                                <Ionicons name="alert-circle" size={14} color={COLORS.error} />
                                                <Text style={styles.errorText}>{errors.apanhador}</Text>
                                            </View>
                                        )}

                                        {/* Dropdown Results */}
                                        {showApanhadorDropdown && (
                                            <View style={styles.dropdown}>
                                                {apanhadorResults.length > 0 ? (
                                                    apanhadorResults.map((ap) => (
                                                        <TouchableOpacity
                                                            key={ap.id}
                                                            style={styles.dropdownItem}
                                                            onPress={() => handleSelectApanhador(ap)}
                                                            activeOpacity={0.7}
                                                        >
                                                            <View style={styles.dropdownAvatar}>
                                                                <Ionicons name="person" size={14} color={COLORS.textWhite} />
                                                            </View>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={styles.dropdownName}>
                                                                    {ap.nome} {ap.sobrenome_apelido}
                                                                </Text>
                                                                {ap.telefone && <Text style={styles.dropdownDetail}>{ap.telefone}</Text>}
                                                            </View>
                                                            <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
                                                        </TouchableOpacity>
                                                    ))
                                                ) : (
                                                    <View style={styles.dropdownEmpty}>
                                                        <Ionicons name="person-add-outline" size={20} color={COLORS.textLight} />
                                                        <Text style={styles.dropdownEmptyText}>Nenhum apanhador encontrado</Text>
                                                    </View>
                                                )}

                                                {/* Button to add new */}
                                                <TouchableOpacity style={styles.dropdownAddButton} onPress={handleOpenNewApanhador} activeOpacity={0.8}>
                                                    <Ionicons name="add-circle" size={20} color={COLORS.accent} />
                                                    <Text style={styles.dropdownAddText}>Cadastrar novo apanhador</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </>
                                )}
                            </View>

                            {/* Número Bag */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    NÚMERO DA BAG <Text style={styles.required}>*</Text>
                                </Text>
                                <View style={[styles.inputWrapper, errors.numeroBag && styles.inputError]}>
                                    <Ionicons name="cube-outline" size={20} color={errors.numeroBag ? COLORS.error : COLORS.textLight} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Ex: 001"
                                        placeholderTextColor={COLORS.textLight}
                                        value={numeroBag}
                                        onChangeText={(v) => handleFieldChange('numeroBag', v, setNumeroBag)}
                                        keyboardType="numeric"
                                    />
                                </View>
                                {errors.numeroBag && (
                                    <View style={styles.errorRow}>
                                        <Ionicons name="alert-circle" size={14} color={COLORS.error} />
                                        <Text style={styles.errorText}>{errors.numeroBag}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Peso e Valor */}
                            <View style={styles.row}>
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <Text style={styles.label}>
                                        PESO (KG) <Text style={styles.required}>*</Text>
                                    </Text>
                                    <View style={[styles.inputWrapper, errors.pesoKg && styles.inputError]}>
                                        <Ionicons name="scale-outline" size={20} color={errors.pesoKg ? COLORS.error : COLORS.textLight} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="0,00"
                                            placeholderTextColor={COLORS.textLight}
                                            value={pesoKg}
                                            onChangeText={(v) => handleFieldChange('pesoKg', v, setPesoKg)}
                                            keyboardType="decimal-pad"
                                        />
                                    </View>
                                    {errors.pesoKg && (
                                        <View style={styles.errorRow}>
                                            <Ionicons name="alert-circle" size={14} color={COLORS.error} />
                                            <Text style={styles.errorText}>{errors.pesoKg}</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={{ width: SPACING.sm }} />
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <Text style={styles.label}>VALOR/KG (R$)</Text>
                                    <View style={styles.inputWrapper}>
                                        <Ionicons name="pricetag-outline" size={20} color={COLORS.textLight} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Opcional"
                                            placeholderTextColor={COLORS.textLight}
                                            value={valorPorKg}
                                            onChangeText={setValorPorKg}
                                            keyboardType="decimal-pad"
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Total */}
                            {valorPorKg.trim() !== '' && parseFloat(valorPorKg.replace(',', '.')) > 0 && (
                                <View style={styles.totalCard}>
                                    <View>
                                        <Text style={styles.totalLabel}>VALOR TOTAL</Text>
                                        <Text style={styles.totalValue}>{formatCurrency(valorTotal())}</Text>
                                    </View>
                                    <Ionicons name="calculator" size={28} color={COLORS.accent} />
                                </View>
                            )}
                        </View>

                        {/* Signature */}
                        <View style={styles.signatureSection}>
                            <Text style={styles.sectionLabel}>ASSINATURA</Text>
                            <TouchableOpacity
                                style={[styles.signatureButton, assinatura && styles.signatureButtonDone]}
                                onPress={() => {
                                    if (assinatura) {
                                        setShowSignaturePreview(true);
                                        return;
                                    }
                                    setShowSignature(true);
                                }}
                                activeOpacity={0.7}
                            >
                                {assinatura ? (
                                    <View style={styles.signatureDoneWrap}>
                                        <Ionicons name="checkmark-circle" size={28} color={COLORS.success} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.signatureDoneText}>Assinatura salva ✓</Text>
                                            <Text style={styles.signatureSubText}>Toque para visualizar</Text>
                                        </View>
                                        <View style={styles.signatureThumbWrap}>
                                            <Image source={{ uri: assinatura }} style={styles.signatureThumbImage} resizeMode="contain" />
                                        </View>
                                    </View>
                                ) : (
                                    <View style={styles.signatureEmptyWrap}>
                                        <Ionicons name="pencil-outline" size={32} color={COLORS.textLight} />
                                        <Text style={styles.signatureEmptyText}>Toque para assinar</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Save Button */}
                        <TouchableOpacity
                            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                            onPress={handleSave}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color={COLORS.textWhite} />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-done" size={22} color={COLORS.textWhite} />
                                    <Text style={styles.saveButtonText}>Salvar Colheita</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollContent: { padding: SPACING.md, paddingTop: SPACING.lg, paddingBottom: SPACING.xxl },
    badgeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md, gap: SPACING.sm },
    codeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.round, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: SPACING.xs, ...SHADOWS.small },
    codeText: { fontSize: 13, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.5 },
    dateBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.round, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: SPACING.xs, ...SHADOWS.small },
    dateText: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
    formCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOWS.medium },
    inputGroup: { marginBottom: SPACING.md },
    label: { ...FONTS.label, marginBottom: SPACING.xs },
    required: { color: COLORS.error, fontSize: 14, fontWeight: '700' },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, paddingHorizontal: SPACING.md },
    inputError: { borderColor: COLORS.error, backgroundColor: 'rgba(229, 57, 53, 0.04)' },
    inputIcon: { marginRight: SPACING.sm },
    input: { flex: 1, height: 48, fontSize: 15, color: COLORS.textPrimary },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingHorizontal: 4 },
    errorText: { fontSize: 12, color: COLORS.error, fontWeight: '500' },
    row: { flexDirection: 'row' },

    // Selected Apanhador
    selectedApanhadorBox: { backgroundColor: 'rgba(46, 125, 50, 0.06)', borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.accentLight, padding: SPACING.md },
    selectedApanhadorInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    selectedAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
    selectedName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
    selectedDetail: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
    changeApanhadorBtn: { backgroundColor: COLORS.background, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderWidth: 1, borderColor: COLORS.border },
    changeApanhadorText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },

    // Dropdown
    dropdown: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, marginTop: SPACING.xs, ...SHADOWS.medium, overflow: 'hidden' },
    dropdownItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
    dropdownAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
    dropdownName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
    dropdownDetail: { fontSize: 11, color: COLORS.textLight, marginTop: 1 },
    dropdownEmpty: { alignItems: 'center', padding: SPACING.lg, gap: SPACING.xs },
    dropdownEmptyText: { fontSize: 13, color: COLORS.textLight },
    dropdownAddButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.md, gap: SPACING.xs, backgroundColor: 'rgba(46, 125, 50, 0.06)', borderTopWidth: 1, borderTopColor: COLORS.divider },
    dropdownAddText: { fontSize: 14, fontWeight: '600', color: COLORS.accent },

    // Total
    totalCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(46, 125, 50, 0.08)', borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm, borderWidth: 1, borderColor: 'rgba(46, 125, 50, 0.2)' },
    totalLabel: { ...FONTS.label, color: COLORS.accent, marginBottom: 4 },
    totalValue: { fontSize: 24, fontWeight: '800', color: COLORS.accent },

    // Signature
    signatureSection: { marginTop: SPACING.lg },
    sectionLabel: { ...FONTS.label, marginBottom: SPACING.sm },
    signatureButton: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.border, padding: SPACING.lg, alignItems: 'center', justifyContent: 'center', minHeight: 100, ...SHADOWS.small },
    signatureButtonDone: { borderStyle: 'solid', borderColor: COLORS.success, backgroundColor: 'rgba(67, 160, 71, 0.05)' },
    signatureDoneWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, width: '100%' },
    signatureDoneText: { fontSize: 16, fontWeight: '700', color: COLORS.success },
    signatureSubText: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
    signatureThumbWrap: {
        width: 86,
        height: 44,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.card,
        overflow: 'hidden',
    },
    signatureThumbImage: { width: '100%', height: '100%' },
    signatureEmptyWrap: { alignItems: 'center', gap: SPACING.xs },
    signatureEmptyText: { fontSize: 14, color: COLORS.textLight, fontWeight: '500' },

    // Save
    saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent, borderRadius: RADIUS.md, height: 56, marginTop: SPACING.xl, gap: SPACING.sm, ...SHADOWS.medium },
    saveButtonDisabled: { opacity: 0.7 },
    saveButtonText: { fontSize: 17, fontWeight: '700', color: COLORS.textWhite },

    // Signature Full Screen
    signatureContainer: { flex: 1, backgroundColor: COLORS.background },
    signatureHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: SPACING.xxl, paddingBottom: SPACING.md, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
    signatureTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    signatureHeaderSpacer: { width: 28, height: 28 },
    signatureClearText: { fontSize: 15, color: COLORS.error, fontWeight: '600' },
    signatureBody: { flex: 1, padding: SPACING.md },
    signatureHint: { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.sm },
    signatureCanvasWrap: {
        width: '78%',
        alignSelf: 'center',
        aspectRatio: 9 / 16,
        minHeight: 500,
        maxHeight: 740,
        borderRadius: RADIUS.md,
        borderWidth: 2,
        borderColor: COLORS.border,
        overflow: 'hidden',
        backgroundColor: COLORS.card,
        position: 'relative',
        ...SHADOWS.small,
    },
    signatureGuideLine: {
        position: 'absolute',
        width: 2,
        top: '58%',
        bottom: '8%',
        left: '50%',
        marginLeft: -1,
        borderLeftWidth: 1.5,
        borderColor: COLORS.border,
        opacity: 0.8,
    },
    signatureActionsRow: {
        marginTop: SPACING.md,
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    signatureClearButton: {
        flex: 1,
        height: 52,
        borderRadius: RADIUS.md,
        borderWidth: 1.5,
        borderColor: COLORS.error,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: SPACING.xs,
        backgroundColor: COLORS.card,
    },
    signatureClearButtonText: { fontSize: 15, fontWeight: '700', color: COLORS.error },
    signatureSaveButton: {
        flex: 1.5,
        height: 52,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: SPACING.xs,
    },
    signatureSaveButtonText: { fontSize: 16, fontWeight: '700', color: COLORS.textWhite },
    signaturePreviewOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        padding: SPACING.md,
    },
    signaturePreviewCard: {
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        ...SHADOWS.medium,
    },
    signaturePreviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    signaturePreviewTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    signaturePreviewImageWrap: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    signaturePreviewImage: {
        width: '100%',
        height: '100%',
    },
    signaturePreviewActions: {
        marginTop: SPACING.md,
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    signaturePreviewSecondaryBtn: {
        flex: 1,
        height: 44,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    signaturePreviewSecondaryText: {
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    signaturePreviewPrimaryBtn: {
        flex: 1,
        height: 44,
        borderRadius: RADIUS.sm,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: SPACING.xs,
    },
    signaturePreviewPrimaryText: {
        color: COLORS.textWhite,
        fontWeight: '700',
    },

    // New Apanhador Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContainer: { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.lg, paddingBottom: SPACING.xxl, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
    modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
    modalInputGroup: { marginBottom: SPACING.md },
    modalSaveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent, borderRadius: RADIUS.md, height: 52, marginTop: SPACING.md, gap: SPACING.sm },
    modalSaveText: { fontSize: 16, fontWeight: '700', color: COLORS.textWhite },

    // Ticket
    ticketOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
    ticketContainer: { width: '100%', maxWidth: 380 },
    ticketHeader: { alignItems: 'center', marginBottom: SPACING.md },
    ticketSuccessText: { fontSize: 22, fontWeight: '700', color: COLORS.textWhite, marginTop: SPACING.sm },
    ticketBody: { backgroundColor: COLORS.card, borderRadius: RADIUS.xl, padding: SPACING.lg, ...SHADOWS.large },
    ticketDivider: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, marginHorizontal: -SPACING.lg },
    ticketNotchLeft: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.6)', marginLeft: -8 },
    ticketDividerLine: { flex: 1, height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.divider },
    ticketNotchRight: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.6)', marginRight: -8 },
    ticketCompany: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
    ticketSubhead: { fontSize: 12, color: COLORS.textLight, textAlign: 'center', marginTop: 2, marginBottom: SPACING.md, textTransform: 'uppercase', letterSpacing: 1 },
    ticketCodeWrap: { backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', marginBottom: SPACING.md },
    ticketCodeLabel: { fontSize: 10, color: COLORS.textLight, fontWeight: '600', letterSpacing: 1 },
    ticketCode: { fontSize: 20, fontWeight: '800', color: COLORS.primary, letterSpacing: 1.5, marginTop: 2 },
    ticketRow: { flexDirection: 'row', marginBottom: SPACING.sm, gap: SPACING.md },
    ticketField: { flex: 1 },
    ticketFieldLabel: { fontSize: 10, color: COLORS.textLight, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
    ticketFieldValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginTop: 2 },
    ticketTotalWrap: { backgroundColor: 'rgba(46, 125, 50, 0.08)', borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm, borderWidth: 1, borderColor: 'rgba(46, 125, 50, 0.2)', alignItems: 'center' },
    ticketTotalLabel: { fontSize: 10, color: COLORS.accent, fontWeight: '600', letterSpacing: 1 },
    ticketTotalValue: { fontSize: 26, fontWeight: '800', color: COLORS.accent, marginTop: 2 },
    ticketSignatureWrap: { marginTop: SPACING.sm },
    ticketSignatureLabel: { fontSize: 10, color: COLORS.textLight, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
    ticketSignatureImageWrap: {
        marginTop: SPACING.xs,
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.background,
        overflow: 'hidden',
    },
    ticketSignatureImage: { width: '100%', height: '100%' },
    ticketSignatureIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.divider },
    ticketSignatureText: { fontSize: 13, color: COLORS.accent, fontWeight: '500' },
    ticketPrintButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.accent, borderRadius: RADIUS.md, height: 48, marginTop: SPACING.md, gap: SPACING.sm },
    ticketPrintText: { fontSize: 15, fontWeight: '700', color: COLORS.textWhite },
    ticketCloseButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: RADIUS.md, height: 52, marginTop: SPACING.md, gap: SPACING.sm },
    ticketCloseText: { fontSize: 16, fontWeight: '700', color: COLORS.textWhite },
});
