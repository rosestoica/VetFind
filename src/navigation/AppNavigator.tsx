import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { blurActiveElementIfWeb, disableBlockingAriaHiddenOverlays } from '../utils/dom';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../types/navigation.types';

// Navigators
import AuthNavigator from './AuthNavigator';

// Screens
import DashboardScreen from '../screens/DashboardScreen';
import ClinicDetailScreen from '../screens/ClinicDetailScreen';
import BookAppointmentScreen from '../screens/BookAppointmentScreen';
import MyAppointmentsScreen from '../screens/MyAppointmentsScreen';
import { CreateCompanyScreen } from '../screens/CreateCompanyScreen';
import { CompanyCreatedSuccessScreen } from '../screens/CompanyCreatedSuccessScreen';
import { CompanyDashboardScreen } from '../screens/CompanyDashboardScreen';
import { CompanyManageAppointmentsScreen } from '../screens/CompanyManageAppointmentsScreen';
import { CompanyAddAppointmentScreen } from '../screens/CompanyAddAppointmentScreen';
import { UserDashboardScreen } from '../screens/UserDashboardScreen';
import { VetCompanyDetailScreen } from '../screens/VetCompanyDetailScreen';
import UserSettingsScreen from '../screens/UserSettingsScreen';
import CompanySettingsScreen from '../screens/CompanySettingsScreen';
import CompanyReviewsScreen from '../screens/CompanyReviewsScreen';
import ManageServicesScreen from '../screens/ManageServicesScreen';
import ManagePricesScreen from '../screens/ManagePricesScreen';
import { ManagePhotosScreen } from '../screens/ManagePhotosScreen';

// Stack navigators
const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const { isLoading, isAuthenticated } = useAuth();

  // Ensure web pages allow scrolling and remove blocking overlays when navigation changes
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Force html/body overflow to auto while app is mounted (fixes pages where body was set to hidden)
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;
    html.style.overflow = 'auto';
    body.style.overflow = 'auto';
    html.style.backgroundColor = '#ffffff';
    body.style.backgroundColor = '#ffffff';

    // Disable any blocking aria-hidden overlays on mount
    const restoreOverlays = disableBlockingAriaHiddenOverlays();

    return () => {
      try {
        html.style.overflow = prevHtmlOverflow;
        body.style.overflow = prevBodyOverflow;
        html.style.backgroundColor = prevHtmlBg;
        body.style.backgroundColor = prevBodyBg;
      } catch (e) {
        // ignore
      }
      try {
        restoreOverlays();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  // Track a per-entry history index (vfIdx) so we can detect back navigation vs forward.
  // We attach vfIdx to each history entry via replaceState after navigation changes.
  const vfIdxRef = useRef<number>(Date.now());

  // Initialize current history state with vfIdx if missing
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const st = window.history.state || {};
      if (typeof st.vfIdx !== 'number') {
        window.history.replaceState({ ...st, vfIdx: vfIdxRef.current }, '');
      } else {
        vfIdxRef.current = st.vfIdx;
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Listen for popstate and reload only when navigating back (vfIdx decreases)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPopState = (e: PopStateEvent) => {
      const newIdx = e.state && typeof e.state.vfIdx === 'number' ? e.state.vfIdx : null;
      if (newIdx !== null) {
        // if newIdx < current -> user went back
        if (newIdx < vfIdxRef.current) {
          setTimeout(() => {
            try {
              window.location.reload();
            } catch (err) {
              // ignore
            }
          }, 0);
        }
        // update ref with the current entry's idx
        vfIdxRef.current = newIdx;
      } else {
        // no vfIdx available on the popped state: fallback to full reload
        setTimeout(() => {
          try {
            window.location.reload();
          } catch (err) {
            // ignore
          }
        }, 0);
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      try {
        window.removeEventListener('popstate', onPopState);
      } catch (e) {
        // ignore
      }
    };
  }, []);

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }
  // Configure web deep links so screens map to readable URLs (e.g. /company/:companyId)
  const linking = typeof window !== 'undefined' ? {
    prefixes: [window.location.origin],
    config: {
      screens: {
        // main
        Dashboard: 'dashboard',
        UserDashboard: 'dashboard/user',
        UserSettings: 'dashboard/user/settings',
        // company detail
        VetCompanyDetail: 'company/:companyId',
        // other routes - keep defaults
        CreateCompany: 'company/create',
        CompanyCreatedSuccess: 'company/created',
        CompanyDashboard: 'company/dashboard',
        CompanyManageAppointments: 'company/appointments',
        CompanyAddAppointment: 'company/appointments/new',
        ManagePhotos: 'company/photos',
        CompanySettings: 'company/settings',
        ClinicDetail: 'clinic/:clinicId',
        BookAppointment: 'book/:clinicId',
        MyAppointments: 'appointments',
      },
    },
  } : undefined;

  return (
    <NavigationContainer
      linking={linking}
        onStateChange={() => {
          blurActiveElementIfWeb();
          // Whenever navigation state changes we attach a new vfIdx to the current history entry
          // so subsequent popstate events include it and we can detect back/forward.
          if (typeof window !== 'undefined') {
            try {
              vfIdxRef.current = (vfIdxRef.current || 0) + 1;
              const st = window.history.state || {};
              window.history.replaceState({ ...st, vfIdx: vfIdxRef.current }, '');
            } catch (e) {
              // ignore
            }
          }
        }}
    >
      {isAuthenticated ? (
        // Main app stack (protected routes)
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="CreateCompany" component={CreateCompanyScreen} />
          <Stack.Screen
            name="CompanyCreatedSuccess"
            component={CompanyCreatedSuccessScreen}
            options={{
              gestureEnabled: false, // Prevent back swipe
              headerShown: false,
            }}
          />
          <Stack.Screen name="CompanyDashboard" component={CompanyDashboardScreen} />
          <Stack.Screen name="CompanySettings" component={CompanySettingsScreen} />
          <Stack.Screen name="CompanyManageAppointments" component={CompanyManageAppointmentsScreen} />
          <Stack.Screen name="CompanyAddAppointment" component={CompanyAddAppointmentScreen} />
          <Stack.Screen name="ManageServices" component={ManageServicesScreen} />
          <Stack.Screen name="ManagePrices" component={ManagePricesScreen} />
          <Stack.Screen name="ManagePhotos" component={ManagePhotosScreen} />
          <Stack.Screen name="UserDashboard" component={UserDashboardScreen} />
          <Stack.Screen name="UserSettings" component={UserSettingsScreen} />
          <Stack.Screen name="VetCompanyDetail" component={VetCompanyDetailScreen} />
          <Stack.Screen name="CompanyReviews" component={CompanyReviewsScreen} />
          <Stack.Screen name="ClinicDetail" component={ClinicDetailScreen} />
          <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} />
          <Stack.Screen name="MyAppointments" component={MyAppointmentsScreen} />
        </Stack.Navigator>
      ) : (
        // Auth stack (public routes)
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});

export default AppNavigator;
