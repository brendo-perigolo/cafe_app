import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import LicenseScreen from './src/screens/LicenseScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import HarvestEntryScreen from './src/screens/HarvestEntryScreen';
import MovementsScreen from './src/screens/MovementsScreen';
import { getEmpresaAtiva } from './src/database/database';
import { COLORS, RADIUS } from './src/styles/theme';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    checkEmpresa();
  }, []);

  const checkEmpresa = async () => {
    try {
      const empresa = await getEmpresaAtiva();
      setInitialRoute(empresa ? 'Dashboard' : 'License');
    } catch (error) {
      console.error('Error checking empresa:', error);
      setInitialRoute('License');
    }
  };

  if (!initialRoute) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerStyle: {
              backgroundColor: COLORS.background,
            },
            headerTintColor: COLORS.textPrimary,
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 18,
            },
            headerShadowVisible: false,
            contentStyle: {
              backgroundColor: COLORS.background,
            },
          }}
        >
          <Stack.Screen
            name="License"
            component={LicenseScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="HarvestEntry"
            component={HarvestEntryScreen}
            options={{
              title: 'Nova Colheita',
              headerBackTitle: 'Voltar',
            }}
          />
          <Stack.Screen
            name="Movements"
            component={MovementsScreen}
            options={{
              title: 'Movimentações',
              headerBackTitle: 'Voltar',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});
