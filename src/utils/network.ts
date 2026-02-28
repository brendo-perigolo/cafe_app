import { type NetInfoState } from '@react-native-community/netinfo';

export function hasNetworkConnection(state?: NetInfoState | null): boolean {
    if (!state) return true;
    const { isConnected, isInternetReachable } = state;
    if (isConnected === false) return false;
    if (isInternetReachable === false) return false;
    return true;
}
