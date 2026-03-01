// SafraCafé - Design Theme
// Paleta inspirada no café com tons premium

export const COLORS = {
    // Primary - inspirado no painel web (azul do botão sincronizar)
    primary: '#2D96C2',
    primaryDark: '#1F6F93',
    primaryLight: '#66B7D8',

    // Accent - tom elegante de apoio (teal/verde do status)
    accent: '#0FA17E',
    accentLight: '#7FD7C1',
    accentDark: '#0B7A60',

    // Background
    background: '#EEF2F6',
    backgroundDark: '#E3E9F0',
    card: '#FFFFFF',
    cardShadow: 'rgba(27, 39, 54, 0.10)',

    // Text
    textPrimary: '#1E2A36',
    textSecondary: '#415466',
    textLight: '#78899A',
    textWhite: '#FFFFFF',

    // Status
    success: '#1E9E6A',
    warning: '#D18B1F',
    error: '#D64545',
    info: '#2D96C2',

    // Borders & Dividers
    border: '#D3DEE8',
    divider: '#E7EDF3',

    // Gradient
    gradientStart: '#2A211B',
    gradientEnd: '#1C1511',
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
        shadowColor: '#1B2736',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
        elevation: 2,
    },
    medium: {
        shadowColor: '#1B2736',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    large: {
        shadowColor: '#1B2736',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
    },
};
