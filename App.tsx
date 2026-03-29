import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as PaperProvider } from 'react-native-paper';
import { paperTheme, theme } from './src/theme';
import { AuthProvider } from './src/context/AuthContext';
import { CompanyProvider } from './src/context/CompanyContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <PaperProvider theme={paperTheme}>
      <AuthProvider>
        <CompanyProvider>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.surface.background }}>
            <AppNavigator />
            <StatusBar style="auto" />
          </GestureHandlerRootView>
        </CompanyProvider>
      </AuthProvider>
    </PaperProvider>
  );
}
