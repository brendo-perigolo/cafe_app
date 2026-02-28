// SafraCafé - Design Theme
// Paleta inspirada no café com tons premium

export const COLORS = {
    // Primary - tons de café
    primary: '#5D4037',
    primaryDark: '#3E2723',
    primaryLight: '#8D6E63',

    // Accent - verde folha de café
    accent: '#2E7D32',
    accentLight: '#4CAF50',
    accentDark: '#1B5E20',

    // Background
    background: '#FAF3E0',
    backgroundDark: '#F5E6CC',
    card: '#FFFFFF',
    cardShadow: 'rgba(93, 64, 55, 0.12)',

    // Text
    textPrimary: '#3E2723',
    textSecondary: '#6D4C41',
    textLight: '#A1887F',
    textWhite: '#FFFFFF',

    // Status
    success: '#43A047',
    warning: '#FF8F00',
    error: '#E53935',
    info: '#1E88E5',

    // Borders & Dividers
    border: '#D7CCC8',
    divider: '#EFEBE9',

    // Gradient
    gradientStart: '#5D4037',
    gradientEnd: '#3E2723',
};

export const FONT_FAMILY = {
    regular: 'Nunito_400Regular',
    medium: 'Nunito_600SemiBold',
    bold: 'Nunito_700Bold',
};

export const FONTS = {
    regular: {
        fontSize: 14,
        color: COLORS.textPrimary,
        fontFamily: FONT_FAMILY.regular,
    },
    medium: {
        fontSize: 16,
        color: COLORS.textPrimary,
        fontFamily: FONT_FAMILY.medium,
    },
    bold: {
        fontSize: 16,
        color: COLORS.textPrimary,
        fontFamily: FONT_FAMILY.bold,
    },
    title: {
        fontSize: 24,
        color: COLORS.textPrimary,
        fontFamily: FONT_FAMILY.bold,
    },
    subtitle: {
        fontSize: 18,
        color: COLORS.textSecondary,
        fontFamily: FONT_FAMILY.medium,
    },
    small: {
        fontSize: 12,
        color: COLORS.textLight,
        fontFamily: FONT_FAMILY.regular,
    },
    label: {
        fontSize: 13,
        color: COLORS.textSecondary,
        textTransform: 'uppercase' as const,
        letterSpacing: 0.8,
        fontFamily: FONT_FAMILY.medium,
    },
};

export const SPACING = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

export const RADIUS = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    round: 999,
};

export const SHADOWS = {
    small: {
        shadowColor: COLORS.primaryDark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    medium: {
        shadowColor: COLORS.primaryDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 4,
    },
    large: {
        shadowColor: COLORS.primaryDark,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
    },
};
