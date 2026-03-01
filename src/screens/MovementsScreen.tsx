import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Modal,
    TextInput,
    Alert,
    ActivityIndicator,
    Animated,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../styles/theme';
import {
    Colheita,
    ColheitaEdicao,
    createColheitaEdicao,
    deleteMovimentacaoComHistorico,
    getAllApanhadores,
    getEmpresaAtiva,
    getHistoricoEdicoes,
    getTodasMovimentacoes,
    searchApanhadores,
} from '../database/database';
import { triggerFullSync } from '../services/syncService';

type Props = {
    navigation: NativeStackNavigationProp<any>;
};

type AbaDetalhe = 'detalhes' | 'historico';
type CampoDataFiltro = 'inicial' | 'final';

export default function MovementsScreen({ navigation }: Props) {
    const [empresaId, setEmpresaId] = useState<number | null>(null);
    const [movimentacoes, setMovimentacoes] = useState<Colheita[]>([]);
    const [movimentacoesFiltradas, setMovimentacoesFiltradas] = useState<Colheita[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [totalPesoFiltrado, setTotalPesoFiltrado] = useState(0);
    const [totalValorFiltrado, setTotalValorFiltrado] = useState(0);

    const [filtroDataInicial, setFiltroDataInicial] = useState('');
    const [filtroDataFinal, setFiltroDataFinal] = useState('');
    const [filtroNome, setFiltroNome] = useState('');
    const [filtroNomeInput, setFiltroNomeInput] = useState('');
    const [showFiltros, setShowFiltros] = useState(false);
    const [nomeSugestoes, setNomeSugestoes] = useState<string[]>([]);
    const [loadingSugestoes, setLoadingSugestoes] = useState(false);
    const [showNomeSugestoes, setShowNomeSugestoes] = useState(false);
    const nomeSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [showDateModal, setShowDateModal] = useState(false);
    const [showAndroidDatePicker, setShowAndroidDatePicker] = useState(false);
    const [dateFieldAtivo, setDateFieldAtivo] = useState<CampoDataFiltro>('inicial');
    const [dataSelecionadaModal, setDataSelecionadaModal] = useState(new Date());

    const [selectedColheita, setSelectedColheita] = useState<Colheita | null>(null);
    const [showDetails, setShowDetails] = useState(false);
    const [activeTab, setActiveTab] = useState<AbaDetalhe>('detalhes');
    const [historico, setHistorico] = useState<ColheitaEdicao[]>([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);

    const [showEditModal, setShowEditModal] = useState(false);
    const [numeroBagEdit, setNumeroBagEdit] = useState('');
    const [pesoKgEdit, setPesoKgEdit] = useState('');
    const [valorKgEdit, setValorKgEdit] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        });
    };

    const formatWeight = (value: number) => {
        return value.toLocaleString('pt-BR', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        }) + ' kg';
    };

    const parseDateInput = (value: string): Date | null => {
        const cleaned = value.trim();
        const match = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!match) return null;

        const [, dd, mm, yyyy] = match;
        const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
        if (Number.isNaN(date.getTime())) return null;

        if (
            date.getFullYear() !== Number(yyyy) ||
            date.getMonth() !== Number(mm) - 1 ||
            date.getDate() !== Number(dd)
        ) {
            return null;
        }

        return date;
    };

    const formatDateInput = (date: Date): string => {
        const dia = String(date.getDate()).padStart(2, '0');
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const ano = String(date.getFullYear());
        return `${dia}/${mes}/${ano}`;
    };

    const abrirModalData = (campo: CampoDataFiltro) => {
        Keyboard.dismiss();
        setShowNomeSugestoes(false);

        const valorAtual = campo === 'inicial' ? filtroDataInicial : filtroDataFinal;
        const dataBase = parseDateInput(valorAtual) || new Date();

        setDateFieldAtivo(campo);
        setDataSelecionadaModal(dataBase);

        if (Platform.OS === 'android') {
            setShowAndroidDatePicker(true);
            return;
        }

        setShowDateModal(true);
    };

    const aplicarDataNoCampo = (campo: CampoDataFiltro, data: Date) => {
        const valor = formatDateInput(data);
        if (campo === 'inicial') {
            setFiltroDataInicial(valor);
            return;
        }
        setFiltroDataFinal(valor);
    };

    const confirmarDataModal = () => {
        aplicarDataNoCampo(dateFieldAtivo, dataSelecionadaModal);
        setShowDateModal(false);
    };

    const handleAndroidDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (event.type === 'dismissed') {
            setShowAndroidDatePicker(false);
            return;
        }

        if (selectedDate) {
            setDataSelecionadaModal(selectedDate);
            aplicarDataNoCampo(dateFieldAtivo, selectedDate);
        }

        setShowAndroidDatePicker(false);
    };

    const aplicarFiltro = (rowsBase?: Colheita[], nomeFiltroOverride?: string) => {
        const rows = rowsBase || movimentacoes;

        const dataInicialTexto = filtroDataInicial.trim();
        const dataFinalTexto = filtroDataFinal.trim();
        const dataInicio = dataInicialTexto ? parseDateInput(dataInicialTexto) : null;
        const dataFim = dataFinalTexto ? parseDateInput(dataFinalTexto) : null;

        if ((dataInicialTexto && !dataInicio) || (dataFinalTexto && !dataFim)) {
            Alert.alert('Filtro inválido', 'Use o formato de data DD/MM/AAAA.');
            return;
        }

        if (dataInicio && dataFim && dataFim < dataInicio) {
            Alert.alert('Filtro inválido', 'A data final deve ser maior ou igual à data inicial.');
            return;
        }

        if (dataInicio) {
            dataInicio.setHours(0, 0, 0, 0);
        }
        if (dataFim) {
            dataFim.setHours(23, 59, 59, 999);
        }

        const nomeBusca = (nomeFiltroOverride ?? filtroNome).trim().toLowerCase();

        const filtradas = rows.filter((item) => {
            const dataMov = new Date(item.data_hora);
            const dataOk = (!dataInicio || dataMov >= dataInicio) && (!dataFim || dataMov <= dataFim);
            const nomeOk = !nomeBusca || item.apanhador_nome.toLowerCase().includes(nomeBusca);
            return dataOk && nomeOk;
        });

        const totalPeso = filtradas.reduce((acc, item) => acc + item.peso_kg, 0);
        const totalValor = filtradas.reduce((acc, item) => acc + item.valor_total, 0);

        setMovimentacoesFiltradas(filtradas);
        setTotalPesoFiltrado(totalPeso);
        setTotalValorFiltrado(totalValor);
    };

    const loadNomeSugestoes = useCallback(async (nomeQuery: string) => {
        if (!empresaId) {
            setNomeSugestoes([]);
            return;
        }

        setLoadingSugestoes(true);
        try {
            const termo = nomeQuery.trim();
            const apanhadores = termo
                ? await searchApanhadores(empresaId, termo)
                : await getAllApanhadores(empresaId);

            const nomes = Array.from(
                new Set(
                    apanhadores
                        .map((item) => `${item.nome} ${item.sobrenome_apelido || ''}`.trim())
                        .filter(Boolean)
                )
            )
                .sort((a, b) => a.localeCompare(b, 'pt-BR'))
                .slice(0, 20);

            setNomeSugestoes(nomes);
        } catch (error) {
            console.error('Erro ao buscar nomes cadastrados:', error);
            setNomeSugestoes([]);
        } finally {
            setLoadingSugestoes(false);
        }
    }, [empresaId]);

    const agendarBuscaNome = useCallback((value: string) => {
        if (nomeSearchTimeoutRef.current) {
            clearTimeout(nomeSearchTimeoutRef.current);
        }

        nomeSearchTimeoutRef.current = setTimeout(() => {
            loadNomeSugestoes(value);
        }, 180);
    }, [loadNomeSugestoes]);

    const loadData = async () => {
        try {
            const empresa = await getEmpresaAtiva();
            if (!empresa?.id) {
                setMovimentacoes([]);
                setEmpresaId(null);
                return;
            }

            setEmpresaId(empresa.id);
            const rows = await getTodasMovimentacoes(empresa.id);
            setMovimentacoes(rows);
            const dataInicialTexto = filtroDataInicial.trim();
            const dataFinalTexto = filtroDataFinal.trim();
            const dataInicio = dataInicialTexto ? parseDateInput(dataInicialTexto) : null;
            const dataFim = dataFinalTexto ? parseDateInput(dataFinalTexto) : null;
            if ((dataInicialTexto && dataInicio) || (dataFinalTexto && dataFim)) {
                aplicarFiltro(rows);
            } else {
                setMovimentacoesFiltradas(rows);
                setTotalPesoFiltrado(rows.reduce((acc, item) => acc + item.peso_kg, 0));
                setTotalValorFiltrado(rows.reduce((acc, item) => acc + item.valor_total, 0));
            }
        } catch (error) {
            console.error('Erro ao carregar movimentações:', error);
            Alert.alert('Erro', 'Não foi possível carregar as movimentações.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    useEffect(() => {
        if (showFiltros && showNomeSugestoes) {
            loadNomeSugestoes(filtroNomeInput);
        }
    }, [showFiltros, showNomeSugestoes, loadNomeSugestoes]);

    useEffect(() => {
        return () => {
            if (nomeSearchTimeoutRef.current) {
                clearTimeout(nomeSearchTimeoutRef.current);
            }
        };
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const renderFiltros = () => (
        <View>
            <View style={styles.filterToggleBar}>
                <TouchableOpacity
                    style={styles.filterIconButton}
                    onPress={() => {
                        setShowFiltros((prev) => {
                            const next = !prev;
                            if (!next) {
                                setShowNomeSugestoes(false);
                            }
                            return next;
                        });
                    }}
                    activeOpacity={0.8}
                >
                    <Ionicons name="funnel-outline" size={20} color={COLORS.textWhite} />
                </TouchableOpacity>
            </View>

            {showFiltros && (
                <View style={styles.filterCard}>
                    <Text style={styles.filterTitle}>Filtros</Text>

                    <Text style={styles.fieldLabel}>Nome</Text>
                    <TextInput
                        style={styles.input}
                        value={filtroNomeInput}
                        onChangeText={(value) => {
                            setFiltroNomeInput(value);
                            setShowNomeSugestoes(true);
                            agendarBuscaNome(value);
                        }}
                        placeholder="Nome do apanhador"
                        placeholderTextColor={COLORS.textLight}
                        onFocus={() => {
                            setShowNomeSugestoes(true);
                            agendarBuscaNome(filtroNomeInput);
                        }}
                        onSubmitEditing={() => {
                            Keyboard.dismiss();
                            setFiltroNome(filtroNomeInput);
                            setShowNomeSugestoes(false);
                            aplicarFiltro(undefined, filtroNomeInput);
                        }}
                    />

                    {showNomeSugestoes && (
                        <View style={styles.nomeSugestoesBox}>
                            {loadingSugestoes ? (
                                <Text style={styles.nomeSugestaoInfo}>Buscando nomes...</Text>
                            ) : nomeSugestoes.length === 0 ? (
                                <Text style={styles.nomeSugestaoInfo}>Nenhum nome cadastrado encontrado.</Text>
                            ) : (
                                <FlatList
                                    data={nomeSugestoes}
                                    keyExtractor={(item) => item}
                                    keyboardShouldPersistTaps="always"
                                    keyboardDismissMode="none"
                                    renderItem={({ item: nome }) => (
                                        <TouchableOpacity
                                            style={styles.nomeSugestaoItem}
                                            activeOpacity={0.8}
                                            onPress={() => {
                                                setFiltroNomeInput(nome);
                                                setFiltroNome(nome);
                                                setShowNomeSugestoes(false);
                                                aplicarFiltro(undefined, nome);
                                                Keyboard.dismiss();
                                            }}
                                        >
                                            <Text style={styles.nomeSugestaoTexto}>{nome}</Text>
                                        </TouchableOpacity>
                                    )}
                                />
                            )}
                        </View>
                    )}

                    <View style={styles.dateFieldsRow}>
                        <View style={styles.dateFieldCol}>
                            <Text style={styles.fieldLabelSmall}>Data inicial</Text>
                            <TouchableOpacity
                                style={styles.dateInputCompact}
                                activeOpacity={0.8}
                                onPress={() => abrirModalData('inicial')}
                            >
                                <Text style={filtroDataInicial ? styles.dateInputValue : styles.dateInputPlaceholder}>
                                    {filtroDataInicial || 'Selecionar'}
                                </Text>
                                <Ionicons name="calendar-outline" size={16} color={COLORS.textLight} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.dateFieldCol}>
                            <Text style={styles.fieldLabelSmall}>Data final</Text>
                            <TouchableOpacity
                                style={styles.dateInputCompact}
                                activeOpacity={0.8}
                                onPress={() => abrirModalData('final')}
                            >
                                <Text style={filtroDataFinal ? styles.dateInputValue : styles.dateInputPlaceholder}>
                                    {filtroDataFinal || 'Selecionar'}
                                </Text>
                                <Ionicons name="calendar-outline" size={16} color={COLORS.textLight} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.filterButton}
                        onPress={() => {
                            Keyboard.dismiss();
                            setFiltroNome(filtroNomeInput);
                            setShowNomeSugestoes(false);
                            aplicarFiltro(undefined, filtroNomeInput);
                        }}
                    >
                        <Ionicons name="funnel-outline" size={18} color={COLORS.textWhite} />
                        <Text style={styles.filterButtonText}>Filtrar</Text>
                    </TouchableOpacity>

                    <View style={styles.totalsRow}>
                        <View style={styles.totalItem}>
                            <Text style={styles.totalLabel}>Peso total</Text>
                            <Text style={styles.totalValue}>{formatWeight(totalPesoFiltrado)}</Text>
                        </View>
                        <View style={styles.totalItem}>
                            <Text style={styles.totalLabel}>Preço total</Text>
                            <Text style={styles.totalValue}>{formatCurrency(totalValorFiltrado)}</Text>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );

    const loadHistorico = async (item: Colheita) => {
        if (!empresaId) return;
        const grupo = item.grupo_ticket_id || item.id;

        setLoadingHistorico(true);
        try {
            const rows = await getHistoricoEdicoes(grupo, empresaId);
            setHistorico(rows);
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
            setHistorico([]);
        } finally {
            setLoadingHistorico(false);
        }
    };

    const openDetails = async (item: Colheita) => {
        setSelectedColheita(item);
        setActiveTab('detalhes');
        setShowDetails(true);
        await loadHistorico(item);
    };

    const openEditModal = (item: Colheita) => {
        setSelectedColheita(item);
        setNumeroBagEdit(String(item.numero_bag));
        setPesoKgEdit(String(item.peso_kg).replace('.', ','));
        setValorKgEdit(String(item.valor_por_kg).replace('.', ','));
        setShowEditModal(true);
    };

    const handleDeleteMovimentacao = (item: Colheita) => {
        if (!empresaId) return;

        Alert.alert(
            'Excluir movimentação',
            `Deseja excluir o ticket ${item.id}? O histórico vinculado também será removido.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Excluir',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteMovimentacaoComHistorico(item.id, empresaId);
                            if (showDetails && selectedColheita?.id === item.id) {
                                setShowDetails(false);
                                setSelectedColheita(null);
                                setHistorico([]);
                            }
                            await loadData();
                            triggerFullSync();
                        } catch (error) {
                            console.error('Erro ao excluir movimentação:', error);
                            Alert.alert('Erro', 'Não foi possível excluir a movimentação.');
                        }
                    },
                },
            ]
        );
    };

    const handleSaveEdit = async () => {
        if (!selectedColheita) return;

        const numeroBag = parseInt(numeroBagEdit, 10);
        const pesoKg = parseFloat(pesoKgEdit.replace(',', '.'));
        const valorKg = parseFloat(valorKgEdit.replace(',', '.'));

        if (!numeroBag || !pesoKg || pesoKg <= 0 || valorKg < 0) {
            Alert.alert('Validação', 'Preencha os campos com valores válidos.');
            return;
        }

        const valorTotal = pesoKg * valorKg;

        setSavingEdit(true);
        try {
            const colheitaEditada = await createColheitaEdicao(selectedColheita, {
                numero_bag: numeroBag,
                peso_kg: pesoKg,
                valor_por_kg: valorKg,
                valor_total: valorTotal,
            });

            setShowEditModal(false);
            await loadData();
            triggerFullSync();

            Alert.alert(
                'Edição registrada',
                `Ticket atualizado: ${colheitaEditada.id}\nVersão: #${colheitaEditada.numero_ticket || 1}`
            );

            setSelectedColheita(colheitaEditada);
            setShowDetails(true);
            setActiveTab('historico');
            await loadHistorico(colheitaEditada);
        } catch (error) {
            console.error('Erro ao salvar edição:', error);
            Alert.alert('Erro', 'Não foi possível salvar a edição.');
        } finally {
            setSavingEdit(false);
        }
    };

    const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, item: Colheita) => {
        const translateX = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [-30, 0],
            extrapolate: 'clamp',
        });
        const opacity = progress.interpolate({
            inputRange: [0, 0.35, 1],
            outputRange: [0, 0.45, 1],
            extrapolate: 'clamp',
        });

        return (
            <TouchableOpacity style={styles.swipeEditAction} onPress={() => openEditModal(item)} activeOpacity={0.8}>
                <Animated.View style={[styles.swipeActionContent, { opacity, transform: [{ translateX }] }]}>
                    <Ionicons name="create-outline" size={20} color={COLORS.textWhite} />
                    <Text style={styles.swipeActionText}>Editar</Text>
                </Animated.View>
            </TouchableOpacity>
        );
    };

    const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, item: Colheita) => {
        const translateX = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [30, 0],
            extrapolate: 'clamp',
        });
        const opacity = progress.interpolate({
            inputRange: [0, 0.35, 1],
            outputRange: [0, 0.45, 1],
            extrapolate: 'clamp',
        });

        return (
            <TouchableOpacity
                style={styles.swipeDeleteAction}
                onPress={() => handleDeleteMovimentacao(item)}
                activeOpacity={0.8}
            >
                <Animated.View style={[styles.swipeActionContent, { opacity, transform: [{ translateX }] }]}>
                    <Ionicons name="trash-outline" size={20} color={COLORS.textWhite} />
                    <Text style={styles.swipeActionText}>Excluir</Text>
                </Animated.View>
            </TouchableOpacity>
        );
    };

    const renderMovimento = ({ item }: { item: Colheita }) => (
        <Swipeable
            renderLeftActions={(progress) => renderLeftActions(progress, item)}
            renderRightActions={(progress) => renderRightActions(progress, item)}
            leftThreshold={36}
            rightThreshold={36}
            overshootLeft={false}
            overshootRight={false}
        >
            <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => openDetails(item)}>
                <View style={styles.cardHeader}>
                    <Text style={styles.ticket}>Ticket: {item.id}</Text>
                    <Text style={styles.ticketVersao}>Versão #{item.numero_ticket || 1}</Text>
                </View>

                {!!item.ticket_anterior_id && (
                    <Text style={styles.ticketAnterior}>Ticket anterior: {item.ticket_anterior_id}</Text>
                )}

                <Text style={styles.apanhador}>{item.apanhador_nome}</Text>
                <Text style={styles.date}>{formatDate(item.data_hora)}</Text>

                <View style={styles.metricsRow}>
                    <Text style={styles.metric}>Bag #{item.numero_bag}</Text>
                    <Text style={styles.metric}>{formatWeight(item.peso_kg)}</Text>
                    <Text style={styles.metric}>{formatCurrency(item.valor_total)}</Text>
                </View>

                <View style={styles.syncRow}>
                    <View
                        style={[
                            styles.syncChip,
                            item.sincronizado ? styles.syncChipSynced : styles.syncChipPending,
                        ]}
                    >
                        <Ionicons
                            name={item.sincronizado ? 'cloud-done' : 'cloud-offline'}
                            size={14}
                            color={item.sincronizado ? COLORS.success : COLORS.warning}
                        />
                        <Text style={styles.syncChipText}>
                            {item.sincronizado ? 'Sincronizado' : 'Pendente offline'}
                        </Text>
                    </View>
                    {!item.sincronizado && item.sync_error ? (
                        <Text style={styles.syncChipError}>{item.sync_error}</Text>
                    ) : null}
                </View>

                <Text style={styles.swipeHint}>Arraste para direita: Editar • Arraste para esquerda: Excluir</Text>
            </TouchableOpacity>
        </Swipeable>
    );

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
            <View style={styles.filtersWrapper}>
                {renderFiltros()}
            </View>

            <FlatList
                data={movimentacoesFiltradas}
                keyExtractor={(item) => item.id}
                renderItem={renderMovimento}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[COLORS.primary]}
                        tintColor={COLORS.primary}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Ionicons name="documents-outline" size={54} color={COLORS.border} />
                        <Text style={styles.emptyTitle}>Sem movimentações</Text>
                        <Text style={styles.emptyText}>Registre uma colheita para iniciar o histórico.</Text>
                    </View>
                }
            />

            <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Editar movimentação</Text>
                        <Text style={styles.modalSubTitle}>A edição mantém o mesmo ticket e registra histórico.</Text>

                        <Text style={styles.fieldLabel}>Número da bag</Text>
                        <TextInput
                            style={styles.input}
                            value={numeroBagEdit}
                            onChangeText={setNumeroBagEdit}
                            keyboardType="number-pad"
                        />

                        <Text style={styles.fieldLabel}>Peso (kg)</Text>
                        <TextInput
                            style={styles.input}
                            value={pesoKgEdit}
                            onChangeText={setPesoKgEdit}
                            keyboardType="decimal-pad"
                        />

                        <Text style={styles.fieldLabel}>Valor por kg</Text>
                        <TextInput
                            style={styles.input}
                            value={valorKgEdit}
                            onChangeText={setValorKgEdit}
                            keyboardType="decimal-pad"
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowEditModal(false)}>
                                <Text style={styles.cancelText}>Cancelar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.saveButton, savingEdit && { opacity: 0.7 }]}
                                onPress={handleSaveEdit}
                                disabled={savingEdit}
                            >
                                {savingEdit ? (
                                    <ActivityIndicator color={COLORS.textWhite} size="small" />
                                ) : (
                                    <Text style={styles.saveText}>Salvar edição</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={Platform.OS !== 'android' && showDateModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.dateModalCard}>
                        <Text style={styles.modalTitle}>Selecionar data</Text>
                        <Text style={styles.modalSubTitle}>
                            {dateFieldAtivo === 'inicial' ? 'Data inicial do filtro' : 'Data final do filtro'}
                        </Text>

                        <View style={styles.datePickerWrap}>
                            <DateTimePicker
                                value={dataSelecionadaModal}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                                onChange={(_, selectedDate) => {
                                    if (selectedDate) {
                                        setDataSelecionadaModal(selectedDate);
                                    }
                                }}
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowDateModal(false)}>
                                <Text style={styles.cancelText}>Cancelar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.saveButton} onPress={confirmarDataModal}>
                                <Text style={styles.saveText}>Confirmar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {Platform.OS === 'android' && showAndroidDatePicker && (
                <DateTimePicker
                    value={dataSelecionadaModal}
                    mode="date"
                    display="calendar"
                    onChange={handleAndroidDateChange}
                />
            )}

            <Modal visible={showDetails} transparent animationType="fade" onRequestClose={() => setShowDetails(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.detailsCard}>
                        <View style={styles.detailsHeader}>
                            <Text style={styles.modalTitle}>Ticket {selectedColheita?.id}</Text>
                            <TouchableOpacity onPress={() => setShowDetails(false)}>
                                <Ionicons name="close" size={24} color={COLORS.textLight} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.tabsRow}>
                            <TouchableOpacity
                                style={[styles.tabButton, activeTab === 'detalhes' && styles.tabButtonActive]}
                                onPress={() => setActiveTab('detalhes')}
                            >
                                <Text style={[styles.tabText, activeTab === 'detalhes' && styles.tabTextActive]}>Detalhes</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.tabButton, activeTab === 'historico' && styles.tabButtonActive]}
                                onPress={() => setActiveTab('historico')}
                            >
                                <Text style={[styles.tabText, activeTab === 'historico' && styles.tabTextActive]}>Histórico</Text>
                            </TouchableOpacity>
                        </View>

                        {activeTab === 'detalhes' && selectedColheita && (
                            <View style={styles.quickInfoBox}>
                                <Text style={styles.quickInfo}>Apanhador: {selectedColheita.apanhador_nome}</Text>
                                <Text style={styles.quickInfo}>Data: {formatDate(selectedColheita.data_hora)}</Text>
                                <Text style={styles.quickInfo}>Bag: #{selectedColheita.numero_bag}</Text>
                                <Text style={styles.quickInfo}>Peso: {formatWeight(selectedColheita.peso_kg)}</Text>
                                <Text style={styles.quickInfo}>Valor/kg: {formatCurrency(selectedColheita.valor_por_kg)}</Text>
                                <Text style={styles.quickInfo}>Valor total: {formatCurrency(selectedColheita.valor_total)}</Text>
                                <Text style={styles.quickInfo}>Nº ticket: {selectedColheita.numero_ticket || 1}</Text>
                                <Text style={styles.quickInfo}>
                                    Sincronização: {selectedColheita.sincronizado ? 'Sincronizado' : 'Pendente'}
                                </Text>
                                {!selectedColheita.sincronizado && selectedColheita.sync_error ? (
                                    <Text style={styles.quickInfoError}>{selectedColheita.sync_error}</Text>
                                ) : null}
                            </View>
                        )}

                        {activeTab === 'historico' && (
                            <View style={styles.historyBox}>
                                {loadingHistorico ? (
                                    <ActivityIndicator color={COLORS.primary} />
                                ) : historico.length === 0 ? (
                                    <Text style={styles.emptyText}>Sem histórico de edição para este ticket.</Text>
                                ) : (
                                    <FlatList
                                        data={historico}
                                        keyExtractor={(item) => String(item.id)}
                                        renderItem={({ item }) => (
                                            <View style={styles.historyItem}>
                                                <Text style={styles.historyTitle}>Ticket editado: {item.novo_ticket_id}</Text>
                                                <Text style={styles.historySubtitle}>{formatDate(item.editado_em)}</Text>
                                                <Text style={styles.historyResume}>{item.resumo_rapido}</Text>
                                            </View>
                                        )}
                                        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
                                    />
                                )}
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
    },
    listContent: {
        padding: SPACING.md,
        paddingBottom: SPACING.xxl,
    },
    filtersWrapper: {
        paddingHorizontal: SPACING.md,
        paddingTop: SPACING.md,
    },
    filterToggleBar: {
        alignItems: 'flex-end',
        marginBottom: SPACING.sm,
    },
    filterIconButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.small,
    },
    filterCard: {
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        zIndex: 20,
        elevation: 5,
        ...SHADOWS.small,
    },
    filterTitle: {
        color: COLORS.textPrimary,
        fontSize: 16,
        fontWeight: '700',
        marginBottom: SPACING.xs,
    },
    filterButton: {
        marginTop: SPACING.md,
        backgroundColor: COLORS.primary,
        borderRadius: RADIUS.sm,
        paddingVertical: SPACING.sm,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    filterButtonText: {
        color: COLORS.textWhite,
        fontWeight: '700',
        fontSize: 14,
    },
    totalsRow: {
        marginTop: SPACING.md,
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    totalItem: {
        flex: 1,
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.sm,
        padding: SPACING.sm,
    },
    totalLabel: {
        color: COLORS.textSecondary,
        fontSize: 12,
        fontWeight: '600',
    },
    totalValue: {
        marginTop: 4,
        color: COLORS.accent,
        fontSize: 15,
        fontWeight: '700',
    },
    nomeSugestoesBox: {
        marginTop: SPACING.xs,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.sm,
        backgroundColor: COLORS.background,
        maxHeight: 180,
        overflow: 'hidden',
    },
    nomeSugestaoInfo: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.sm,
        color: COLORS.textLight,
        fontSize: 12,
    },
    nomeSugestaoItem: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    nomeSugestaoTexto: {
        color: COLORS.textPrimary,
        fontSize: 14,
        fontWeight: '600',
    },
    card: {
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        ...SHADOWS.small,
    },
    swipeEditAction: {
        flex: 1,
        marginBottom: SPACING.sm,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.accent,
        justifyContent: 'center',
        paddingHorizontal: SPACING.md,
    },
    swipeDeleteAction: {
        flex: 1,
        marginBottom: SPACING.sm,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.error,
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingHorizontal: SPACING.md,
    },
    swipeActionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    swipeActionText: {
        color: COLORS.textWhite,
        fontWeight: '700',
        fontSize: 14,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    ticket: {
        color: COLORS.textPrimary,
        fontWeight: '700',
        fontSize: 14,
    },
    ticketVersao: {
        color: COLORS.info,
        fontSize: 12,
        fontWeight: '600',
    },
    ticketAnterior: {
        marginTop: 4,
        color: COLORS.textSecondary,
        fontSize: 12,
    },
    apanhador: {
        marginTop: SPACING.xs,
        color: COLORS.textPrimary,
        fontWeight: '600',
        fontSize: 15,
    },
    date: {
        marginTop: 2,
        color: COLORS.textLight,
        fontSize: 12,
    },
    metricsRow: {
        marginTop: SPACING.sm,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.xs,
    },
    metric: {
        backgroundColor: COLORS.background,
        color: COLORS.textSecondary,
        fontSize: 12,
        fontWeight: '600',
        borderRadius: RADIUS.sm,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
    },
    syncRow: {
        marginTop: SPACING.xs,
    },
    syncChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 3,
        borderRadius: RADIUS.md,
    },
    syncChipSynced: {
        backgroundColor: 'rgba(56, 142, 60, 0.18)',
    },
    syncChipPending: {
        backgroundColor: 'rgba(251, 192, 45, 0.2)',
    },
    syncChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    syncChipError: {
        marginTop: 4,
        fontSize: 11,
        color: COLORS.error,
    },
    swipeHint: {
        marginTop: SPACING.sm,
        color: COLORS.textLight,
        fontSize: 11,
    },
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: SPACING.xxl,
    },
    emptyTitle: {
        marginTop: SPACING.md,
        fontWeight: '700',
        color: COLORS.textSecondary,
        fontSize: 16,
    },
    emptyText: {
        marginTop: SPACING.xs,
        color: COLORS.textLight,
        textAlign: 'center',
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
        color: COLORS.textPrimary,
        fontSize: 18,
        fontWeight: '700',
    },
    modalSubTitle: {
        marginTop: 4,
        color: COLORS.textLight,
        fontSize: 13,
    },
    fieldLabel: {
        marginTop: SPACING.md,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    fieldLabelSmall: {
        marginTop: SPACING.md,
        marginBottom: 6,
        color: COLORS.textSecondary,
        fontWeight: '600',
        fontSize: 12,
    },
    input: {
        marginTop: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.sm,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.sm,
        color: COLORS.textPrimary,
        backgroundColor: COLORS.background,
    },
    dateFieldsRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    dateFieldCol: {
        flex: 1,
    },
    dateInputCompact: {
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: RADIUS.sm,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 10,
        backgroundColor: COLORS.background,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 42,
    },
    dateInputValue: {
        color: COLORS.textPrimary,
        fontSize: 13,
        fontWeight: '600',
    },
    dateInputPlaceholder: {
        color: COLORS.textLight,
        fontSize: 13,
    },
    modalActions: {
        marginTop: SPACING.lg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: SPACING.sm,
    },
    dateModalCard: {
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
    },
    datePickerWrap: {
        marginTop: SPACING.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.md,
        paddingVertical: SPACING.sm,
    },
    cancelButton: {
        flex: 1,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.sm,
    },
    cancelText: {
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    saveButton: {
        flex: 1,
        borderRadius: RADIUS.sm,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.sm,
    },
    saveText: {
        color: COLORS.textWhite,
        fontWeight: '700',
    },
    detailsCard: {
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.lg,
        maxHeight: '85%',
        padding: SPACING.md,
    },
    detailsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    tabsRow: {
        marginTop: SPACING.md,
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    tabButton: {
        flex: 1,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: SPACING.sm,
        alignItems: 'center',
    },
    tabButtonActive: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.background,
    },
    tabText: {
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    tabTextActive: {
        color: COLORS.primary,
    },
    quickInfoBox: {
        marginTop: SPACING.md,
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.sm,
        padding: SPACING.md,
        gap: SPACING.xs,
    },
    quickInfo: {
        color: COLORS.textPrimary,
        fontSize: 13,
    },
    quickInfoError: {
        color: COLORS.error,
        fontSize: 12,
    },
    historyBox: {
        marginTop: SPACING.md,
        maxHeight: 360,
    },
    historyItem: {
        borderWidth: 1,
        borderColor: COLORS.divider,
        borderRadius: RADIUS.sm,
        padding: SPACING.sm,
    },
    historyTitle: {
        color: COLORS.textPrimary,
        fontWeight: '700',
        fontSize: 13,
    },
    historySubtitle: {
        marginTop: 2,
        color: COLORS.textLight,
        fontSize: 12,
    },
    historyResume: {
        marginTop: SPACING.xs,
        color: COLORS.textSecondary,
        fontSize: 12,
    },
});
