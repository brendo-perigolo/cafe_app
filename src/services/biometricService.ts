import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_PREF_KEY = 'safraCafe:biometric-enabled';

export async function isBiometricPreferenceEnabled(): Promise<boolean> {
    const value = await AsyncStorage.getItem(BIOMETRIC_PREF_KEY);
    return value === '1';
}

export async function enableBiometricPreference(): Promise<void> {
    await AsyncStorage.setItem(BIOMETRIC_PREF_KEY, '1');
}

export async function disableBiometricPreference(): Promise<void> {
    await AsyncStorage.removeItem(BIOMETRIC_PREF_KEY);
}
