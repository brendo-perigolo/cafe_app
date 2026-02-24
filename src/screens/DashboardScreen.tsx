import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    RefreshControl,
    Animated,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../styles/theme';
import {
    getEmpresaAtiva,
    getColheitaStats,
    getColheitas,
    getUltimaColheita,
    Empresa,
    Colheita,
} from '../database/database';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
    navigation: NativeStackNavigationProp<any>;
};

export default function DashboardScreen({ navigation }: Props) {
    const [empresa, setEmpresa] = useState<Empresa | null>(null);
    const [stats, setStats] = useState({ totalColheitas: 0, pesoTotal: 0, valorTotal: 0 });
    const [ultimaColheita, setUltimaColheita] = useState<Colheita | null>(null);
    const [colheitas, setColheitas] = useState<Colheita[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    const loadData = async () => {
        try {
            const emp = await getEmpresaAtiva();
            if (!emp || !emp.id) return;
            setEmpresa(emp);

            const [statsData, colheitasData, ultima] = await Promise.all([
                getColheitaStats(emp.id),
                getColheitas(emp.id, 20),
                getUltimaColheita(emp.id),
            ]);

            setStats(statsData);
            setColheitas(colheitasData);
            setUltimaColheita(ultima);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }).start();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

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
        return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kg';
    };

    const renderHeader = () => (
        <Animated.View style={{ opacity: fadeAnim }}>
            {/* Header Bar */}
            <View style={styles.headerBar}>
                <View>
                    <Text style={styles.greeting}>Bem-vindo 👋</Text>
                    <Text style={styles.empresaNome}>{empresa?.nome || 'Carregando...'}</Text>
                </View>
                <View style={styles.headerBadge}>
                    <Ionicons name="leaf" size={20} color={COLORS.accent} />
                </View>
            </View>

            {/* Stats Cards */}
            <View style={styles.statsRow}>
                <TouchableOpacity
                    style={[styles.statCard, styles.statCardPrimary]}
                    onPress={() => navigation.navigate('Movements')}
                    activeOpacity={0.85}
                >
                    <Ionicons name="layers-outline" size={24} color={COLORS.textWhite} />
                    <Text style={styles.statValue}>{stats.totalColheitas}</Text>
                    <Text style={styles.statLabel}>Colheitas</Text>
                </TouchableOpacity>
                <View style={[styles.statCard, styles.statCardSecondary]}>
                    <Ionicons name="scale-outline" size={24} color={COLORS.textWhite} />
                    <Text style={styles.statValue}>{formatWeight(stats.pesoTotal)}</Text>
                    <Text style={styles.statLabel}>Peso Total</Text>
                </View>
            </View>

            <View style={styles.statsRow}>
                <View style={[styles.statCard, styles.statCardAccent]}>
                    <Ionicons name="cash-outline" size={24} color={COLORS.textWhite} />
                    <Text style={styles.statValue}>{formatCurrency(stats.valorTotal)}</Text>
                    <Text style={styles.statLabel}>Valor Total</Text>
                </View>
                <View style={[styles.statCard, styles.statCardInfo]}>
                    <Ionicons name="time-outline" size={24} color={COLORS.textWhite} />
                    <Text style={[styles.statValue, { fontSize: 14 }]}>
                        {ultimaColheita ? formatDate(ultimaColheita.data_hora) : '--'}
                    </Text>
                    <Text style={styles.statLabel}>Última Colheita</Text>
                </View>
            </View>

            {/* New Harvest Button */}
            <TouchableOpacity
                style={styles.newHarvestButton}
                onPress={() => navigation.navigate('HarvestEntry')}
                activeOpacity={0.85}
            >
                <View style={styles.newHarvestIconWrap}>
                    <Ionicons name="add" size={28} color={COLORS.textWhite} />
                </View>
                <View style={styles.newHarvestTextWrap}>
                    <Text style={styles.newHarvestTitle}>Nova Colheita</Text>
                    <Text style={styles.newHarvestSubtitle}>Registrar novo lançamento</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={COLORS.accent} />
            </TouchableOpacity>

            {/* Recent Label */}
            {colheitas.length > 0 && (
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Últimas Colheitas</Text>
                    <Text style={styles.sectionCount}>{colheitas.length} registros</Text>
                </View>
            )}
        </Animated.View>
    );

    const renderColheitaItem = ({ item }: { item: Colheita }) => (
        <View style={styles.colheitaCard}>
            <View style={styles.colheitaLeft}>
                <View style={styles.colheitaIcon}>
                    <Ionicons name="cafe" size={18} color={COLORS.primary} />
                </View>
            </View>
            <View style={styles.colheitaCenter}>
                <Text style={styles.colheitaApanhador}>{item.apanhador_nome}</Text>
                <Text style={styles.colheitaDate}>{formatDate(item.data_hora)}</Text>
                <View style={styles.colheitaTags}>
                    <View style={styles.tag}>
                        <Text style={styles.tagText}>Bag #{item.numero_bag}</Text>
                    </View>
                    <View style={styles.tag}>
                        <Text style={styles.tagText}>{formatWeight(item.peso_kg)}</Text>
                    </View>
                </View>
            </View>
            <View style={styles.colheitaRight}>
                <Text style={styles.colheitaValor}>{formatCurrency(item.valor_total)}</Text>
                <Text style={styles.colheitaValorKg}>{formatCurrency(item.valor_por_kg)}/kg</Text>
            </View>
        </View>
    );

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="cafe-outline" size={64} color={COLORS.border} />
            <Text style={styles.emptyTitle}>Nenhuma colheita registrada</Text>
            <Text style={styles.emptySubtitle}>
                Toque em "Nova Colheita" para começar a registrar
            </Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
            <FlatList
                data={colheitas}
                keyExtractor={(item) => item.id}
                renderItem={renderColheitaItem}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmpty}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[COLORS.primary]}
                        tintColor={COLORS.primary}
                    />
                }
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    listContent: {
        paddingHorizontal: SPACING.md,
        paddingTop: SPACING.xxl + SPACING.lg,
        paddingBottom: SPACING.xxl,
    },
    headerBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    greeting: {
        fontSize: 14,
        color: COLORS.textLight,
    },
    empresaNome: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginTop: 2,
    },
    headerBadge: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(46, 125, 50, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statsRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    statCard: {
        flex: 1,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        alignItems: 'flex-start',
        gap: SPACING.xs,
    },
    statCardPrimary: {
        backgroundColor: COLORS.primary,
    },
    statCardSecondary: {
        backgroundColor: COLORS.primaryLight,
    },
    statCardAccent: {
        backgroundColor: COLORS.accent,
    },
    statCardInfo: {
        backgroundColor: COLORS.info,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textWhite,
    },
    statLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.75)',
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    newHarvestButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        marginTop: SPACING.sm,
        marginBottom: SPACING.lg,
        ...SHADOWS.medium,
        borderWidth: 1.5,
        borderColor: COLORS.accentLight,
    },
    newHarvestIconWrap: {
        width: 48,
        height: 48,
        borderRadius: RADIUS.md,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    newHarvestTextWrap: {
        flex: 1,
    },
    newHarvestTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: COLORS.accent,
    },
    newHarvestSubtitle: {
        fontSize: 13,
        color: COLORS.textLight,
        marginTop: 2,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    sectionCount: {
        fontSize: 13,
        color: COLORS.textLight,
    },
    colheitaCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.card,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        ...SHADOWS.small,
        alignItems: 'center',
    },
    colheitaLeft: {
        marginRight: SPACING.md,
    },
    colheitaIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.backgroundDark,
        alignItems: 'center',
        justifyContent: 'center',
    },
    colheitaCenter: {
        flex: 1,
    },
    colheitaApanhador: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    colheitaDate: {
        fontSize: 12,
        color: COLORS.textLight,
        marginTop: 2,
    },
    colheitaTags: {
        flexDirection: 'row',
        gap: SPACING.xs,
        marginTop: SPACING.xs,
    },
    tag: {
        backgroundColor: COLORS.background,
        borderRadius: RADIUS.sm,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 2,
    },
    tagText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    colheitaRight: {
        alignItems: 'flex-end',
        marginLeft: SPACING.sm,
    },
    colheitaValor: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.accent,
    },
    colheitaValorKg: {
        fontSize: 11,
        color: COLORS.textLight,
        marginTop: 2,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.xxl * 2,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginTop: SPACING.md,
    },
    emptySubtitle: {
        fontSize: 14,
        color: COLORS.textLight,
        marginTop: SPACING.xs,
        textAlign: 'center',
    },
});
