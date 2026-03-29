/**
 * UserDashboardScreen - Main dashboard for pet owners
 *
 * Features:
 * - Banner VetFinder + bară centrală de căutare (Clinică | Serviciu) tip hero
 * - Filtru locație, sortare, hartă
 * - Listă clinici + pull-to-refresh
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
  TouchableOpacity,
  Dimensions,
  Alert,
  BackHandler,
  Platform,
  TextInput as RNTextInput,
  Image,
} from 'react-native';
import { Text, ActivityIndicator, Button, Snackbar, Portal, Dialog, Menu } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';

// Web map is rendered via Leaflet inside a WebView/HTML snippet (no Google Maps API key required).

import { ApiService } from '../services/api';
import { Company } from '../types/company.types';
import { RouteDistance } from '../types/routes.types';
import { RootStackParamList } from '../types/navigation.types';
import { VetCompanyCard } from '../components/VetCompanyCard';
import { useLocation, calculateDistance } from '../hooks/useLocation';
import { useRouteDistance } from '../hooks/useRouteDistance';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import LeafletMapWeb from '../components/LeafletMapWeb';

type NavigationProp = StackNavigationProp<RootStackParamList, 'UserDashboard'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const HERO_DOG_IMAGE = require('../../assets/caine-removebg-preview.png');
const HERO_CAT_IMAGE = require('../../assets/pisica-removebg-preview.png');
/** Pixeli sursă PNG — actualizați dacă înlocuiți asset-urile; aspectRatio evită letterboxing la contain. */
const HERO_DOG_PX = { w: 341, h: 215 } as const;
const HERO_CAT_PX = { w: 323, h: 243 } as const;
const HERO_MASCOT_DISPLAY_WIDTH = Math.min(181, SCREEN_WIDTH * 0.306);
/** Pisică mai mică decât câinele (doar ea folosește această lățime). */
const HERO_CAT_DISPLAY_WIDTH = HERO_MASCOT_DISPLAY_WIDTH * 0.8;

/** Leaflet map HTML (works in WebView on native and in iframe/WebView-like HTML). */
function getMapHtml(
  center: { latitude: number; longitude: number; label?: string },
  companies: Company[]
): string {
  const isUserLocation = center.label === 'My Location' || center.label === 'Home';
  const clinics = (companies || [])
    .filter((c) => typeof (c as any)?.latitude === 'number' && typeof (c as any)?.longitude === 'number')
    .map((c) => ({ id: c.id, name: c.name, lat: (c as any).latitude, lng: (c as any).longitude }));

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
    <style>html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; }</style>
  </head>
  <body><div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
    <script>
      (function () {
        var center = [${center.latitude}, ${center.longitude}];
        var isUserLocation = ${isUserLocation ? 'true' : 'false'};
        var map = L.map('map', { zoomControl: true }).setView(center, 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OSM' }).addTo(map);
        if (isUserLocation) {
          L.circleMarker(center, { radius: 7, color: '#2563eb', weight: 2, fillColor: '#2563eb', fillOpacity: 0.7 })
            .addTo(map).bindPopup(${JSON.stringify(center.label === 'Home' ? 'Home' : 'You')});
        }
        var clinics = ${JSON.stringify(clinics)};
        var markers = [];
        clinics.forEach(function(c) {
          var m = L.circleMarker([c.lat, c.lng], { radius: 7, color: '#ef4444', weight: 2, fillColor: '#ef4444', fillOpacity: 0.75 })
            .addTo(map).bindPopup(c.name);
          m.on('click', function() {
            try {
              var p = JSON.stringify({ type: 'clinic_select', id: c.id, name: c.name });
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) window.ReactNativeWebView.postMessage(p);
            } catch (e) {}
          });
          markers.push(m);
        });
        if (markers.length) {
          var group = L.featureGroup((isUserLocation ? [L.marker(center)] : []).concat(markers));
          map.fitBounds(group.getBounds().pad(0.25));
        }
      })();
    </script>
  </body>
</html>`;
}

export const UserDashboardScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { logout, user } = useAuth();
  const { location, permissionStatus, requestPermission, refreshLocation, isLoading: locationLoading } = useLocation();
  const {
    fetchDistances,
    getDistance,
    clearCache: clearRouteCache,
    isLoading: isLoadingRoutes,
    error: routeError,
  } = useRouteDistance();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [companiesWithDistance, setCompaniesWithDistance] = useState<
    Array<{ company: Company; distance?: number; matchedService?: any }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  /** Căutare după nume/adresă clinică vs după serviciu oferit */
  const [searchScope, setSearchScope] = useState<'clinic' | 'service'>('service');
  const [scopeMenuVisible, setScopeMenuVisible] = useState(false);
  const [sortMode, setSortMode] = useState<'none' | 'closest' | 'min_asc' | 'max_desc' | 'rating_desc'>('none');
  // Snackbar for web/native feedback
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  // Filtru după rază dezactivat – păstrăm variabila mereu null pentru compatibilitate cu codul existent
  const selectedDistance: number | null = null;

  // Map modal state
  const [mapVisible, setMapVisible] = useState(false);
  const [selectedMapClinic, setSelectedMapClinic] = useState<{ id: number; name: string } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ latitude: number; longitude: number; label?: string } | null>(null);

  // "Disponibil acum" mode: show clinics open now + (if user flag) emergency-only
  const [availableNowMode, setAvailableNowMode] = useState(false);
  const [availableNowData, setAvailableNowData] = useState<{ openNow: Company[]; emergencyOnly: Company[] }>({ openNow: [], emergencyOnly: [] });
  const [loadingAvailableNow, setLoadingAvailableNow] = useState(false);

  // Location source: 'current' = GPS, 'home' = user's home address from DB
  const [locationSource, setLocationSource] = useState<'current' | 'home' | null>(null);
  const isLocationActive = locationSource === 'current' || locationSource === 'home';
  // Alertă „locație necesară” la Sortează după distanță (Dialog pe web, unde Alert.alert poate să nu apară)
  const [locationRequiredAlertVisible, setLocationRequiredAlertVisible] = useState(false);

  // Coordinates for distance and map: from GPS when 'current', from user record when 'home'.
  // useMemo avoids new object each render → prevents useEffect/useCallback dependency churn.
  const effectiveLocation = useMemo((): { latitude: number; longitude: number } | null => {
    if (locationSource === 'current' && location?.latitude != null && location?.longitude != null) {
      return { latitude: location.latitude, longitude: location.longitude };
    }
    if (locationSource === 'home' && user?.latitude != null && user?.longitude != null) {
      return { latitude: Number(user.latitude), longitude: Number(user.longitude) };
    }
    return null;
  }, [locationSource, location?.latitude, location?.longitude, user?.latitude, user?.longitude]);

  // La „Disponibil acum” afișăm întotdeauna și clinicile în regim de urgență (cu detaliile corespunzătoare)
  const effectiveEmergencyOnly = useMemo(() => availableNowData.emergencyOnly, [availableNowData.emergencyOnly]);

  // Lista completă "Disponibil acum" (deschise + urgență dacă e activat), fără filtrare
  const availableNowFullList = useMemo(() => {
    const openNow = availableNowData.openNow;
    return openNow.map((c) => ({ company: c, distance: undefined as number | undefined, isEmergency: false }))
      .concat(effectiveEmergencyOnly.map((c) => ({ company: c, distance: undefined as number | undefined, isEmergency: true })));
  }, [availableNowData.openNow, effectiveEmergencyOnly]);

  // Lista "Disponibil acum" fără filtrare după rază (nu mai avem filtru de distanță)
  const availableNowDisplayList = availableNowFullList;

  // Web map is rendered via Leaflet in an iframe/WebView-like HTML (no API key required).

  const isServiceSearchActive = (searchQuery || '').trim().length > 0;

  // Android back behavior: when searching, back should exit search and return to dashboard state.
  useEffect(() => {
    const onBackPress = () => {
      const hasSearchText = (searchQuery || '').trim().length > 0;
      if (hasSearchText) {
        setSearchQuery('');
        setSortMode('none');

        // restore default list
        setFilteredCompanies(companies);
        setCompaniesWithDistance(companies.map((company) => ({ company })));
        return true; // handled
      }

      return false; // allow default navigation
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [companies, searchQuery]);

  // Web/browser back behavior: when searching, back should exit search and keep user on dashboard.
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      const hasSearchText = (searchQuery || '').trim().length > 0;
      if (!hasSearchText) return;

      // Prevent leaving the dashboard; instead clear search state.
      e.preventDefault();
      setSearchQuery('');
      setSortMode('none');
      setFilteredCompanies(companies);
      setCompaniesWithDistance(companies.map((company) => ({ company })));
    });

    return unsubscribe;
  }, [companies, navigation, searchQuery]);

  /**
   * Fetch all companies from API
   */
  const fetchCompanies = useCallback(async () => {
    try {
      setError(null);
      const data = await ApiService.searchCompanies();
      // Sort by creation date (newest first)
      const sorted = data.sort((a: any, b: any) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });
      setCompanies(sorted);
    } catch (err: any) {
      setError(err.message || 'Failed to load vet companies');
      console.error('Error fetching companies:', err);
    }
  }, []);

  /**
   * Initial data load
   */
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await fetchCompanies();
      setIsLoading(false);
    };
    loadData();
  }, [fetchCompanies]);

  /**
   * Filter and calculate distances when location or distance filter changes
   * This is the OLD system - only runs when location toggle is OFF
   */
  useEffect(() => {
    // Skip if location toggle is active - new system handles filtering
    if (isLocationActive) return;

    if (!companies.length) {
      setFilteredCompanies([]);
      setCompaniesWithDistance([]);
      return;
    }

    // If no distance filter selected, show all companies
    if (selectedDistance === null) {
      setFilteredCompanies(companies);
      setCompaniesWithDistance(companies.map((company) => ({ company })));
      return;
    }

    // If distance selected but no location permission
    if (!location) {
      setFilteredCompanies(companies);
      setCompaniesWithDistance(companies.map((company) => ({ company })));
      return;
    }

    // Calculate distances and filter
    const withDistances = companies
      .map((company) => {
        if (company.latitude && company.longitude) {
          const distance = calculateDistance(
            location.latitude,
            location.longitude,
            company.latitude,
            company.longitude
          );
          return { company, distance };
        }
        return { company, distance: undefined };
      })
      .filter((item) => {
        // If company has no location, include it anyway
        if (item.distance === undefined) return true;
        // Filter by distance
        return item.distance <= selectedDistance;
      })
      .sort((a, b) => {
        // Sort by distance (companies without location go to end)
        if (a.distance === undefined) return 1;
        if (b.distance === undefined) return -1;
        return a.distance - b.distance;
      });

    setFilteredCompanies(withDistances.map((item) => item.company));
    setCompaniesWithDistance(withDistances);
  }, [companies, selectedDistance, location, isLocationActive]);

  /**
   * Sort all companies by distance (no radius filter). Used when "Sortează după distanță" is selected.
   */
  const sortAllCompaniesByDistance = useCallback(() => {
    if (!isLocationActive) return;
    const coords = effectiveLocation || (locationSource === 'current' ? location : null);
    if (!coords?.latitude || !coords?.longitude) return;
    const withDist = companies.map((company) => {
      if (!company.latitude || !company.longitude) return { company, distance: undefined as number | undefined };
      const distance = calculateDistance(coords.latitude, coords.longitude, company.latitude, company.longitude);
      return { company, distance };
    });
    withDist.sort((a, b) => {
      if (a.distance === undefined) return 1;
      if (b.distance === undefined) return -1;
      return a.distance - b.distance;
    });
    setCompaniesWithDistance(withDist);
    setFilteredCompanies(withDist.map((x) => x.company));
  }, [companies, isLocationActive, effectiveLocation, locationSource, location]);

  /**
   * Search companies for a given service name and attach matched service/pricing
   */
  const searchCompaniesByService = useCallback(
    async (query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) {
        if (isLocationActive && sortMode === 'closest') {
          sortAllCompaniesByDistance();
        } else {
          setFilteredCompanies(companies);
          setCompaniesWithDistance(companies.map((company) => ({ company })));
        }
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      try {
        // Base list respects distance filter when active
        const baseList = selectedDistance === null ? companies : filteredCompanies.length ? filteredCompanies : companies;

        // Fetch services for each company in parallel (safe with Promise.allSettled)
        const promises = baseList.map((c) => ApiService.getServices(c.id).then((s) => ({ company: c, services: s })));
        const results = await Promise.allSettled(promises);

        const matches: Array<{ company: Company; matchedService: any; distance?: number }> = [];

        results.forEach((res) => {
          if (res.status === 'fulfilled') {
            const { company, services } = res.value as { company: Company; services: any[] };
            const found = (services || []).find((svc) => svc && svc.service_name && svc.service_name.toLowerCase().includes(q));
            if (found) {
              // calculate haversine distance if location is available
              let d: number | undefined = undefined;
              const orig = effectiveLocation || location;
              if (orig && company.latitude && company.longitude) {
                d = calculateDistance(orig.latitude, orig.longitude, company.latitude, company.longitude);
              }
              matches.push({ company, matchedService: found, distance: d });
            }
          }
        });

        // Sort matches by distance when available by default
        matches.sort((a, b) => {
          if (a.distance === undefined) return 1;
          if (b.distance === undefined) return -1;
          return a.distance - b.distance;
        });

        // Apply user-selected sorting
        if (sortMode === 'closest') {
          // Closest first (if distance is unknown, keep it at the end)
          matches.sort((a, b) => {
            const ad = typeof a.distance === 'number' ? a.distance : Number.POSITIVE_INFINITY;
            const bd = typeof b.distance === 'number' ? b.distance : Number.POSITIVE_INFINITY;
            return ad - bd;
          });
        } else if (sortMode === 'rating_desc') {
          matches.sort((a, b) => {
            const ar = typeof (a.company as any).avg_rating === 'number' ? (a.company as any).avg_rating : Number((a.company as any).avg_rating || 0);
            const br = typeof (b.company as any).avg_rating === 'number' ? (b.company as any).avg_rating : Number((b.company as any).avg_rating || 0);
            return (br || 0) - (ar || 0);
          });
        } else if (sortMode === 'min_asc') {
          matches.sort((a, b) => {
            const pa = a.matchedService?.price_min ?? Number.POSITIVE_INFINITY;
            const pb = b.matchedService?.price_min ?? Number.POSITIVE_INFINITY;
            return pa - pb;
          });
        } else if (sortMode === 'max_desc') {
          matches.sort((a, b) => {
            const pa = a.matchedService?.price_max ?? Number.NEGATIVE_INFINITY;
            const pb = b.matchedService?.price_max ?? Number.NEGATIVE_INFINITY;
            return pb - pa;
          });
        }

        setFilteredCompanies(matches.map((m) => m.company));
        setCompaniesWithDistance(matches.map((m) => ({ company: m.company, distance: m.distance, matchedService: m.matchedService })));
      } catch (err) {
        console.error('Service search error:', err);
      } finally {
        setIsSearching(false);
      }
    },
    // NOTE: Do NOT include companiesWithDistance in dependencies to avoid infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companies, filteredCompanies, location, effectiveLocation, selectedDistance, sortMode, isLocationActive, sortAllCompaniesByDistance]
  );

  /**
   * Filtrează clinicile după nume, adresă, oraș, județ sau descriere.
   */
  const searchCompaniesByClinic = useCallback(
    async (query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) {
        if (isLocationActive && sortMode === 'closest') {
          sortAllCompaniesByDistance();
        } else {
          setFilteredCompanies(companies);
          setCompaniesWithDistance(companies.map((company) => ({ company })));
        }
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      try {
        const baseList = selectedDistance === null ? companies : filteredCompanies.length ? filteredCompanies : companies;

        const matches: Array<{ company: Company; distance?: number }> = [];

        for (const company of baseList) {
          const name = (company.name || '').toLowerCase();
          const address = (company.address || '').toLowerCase();
          const city = (company.city || '').toLowerCase();
          const county = (company.county || '').toLowerCase();
          const desc = (company.description || '').toLowerCase();
          if (name.includes(q) || address.includes(q) || city.includes(q) || county.includes(q) || desc.includes(q)) {
            let d: number | undefined = undefined;
            const orig = effectiveLocation || location;
            if (orig && company.latitude && company.longitude) {
              d = calculateDistance(orig.latitude, orig.longitude, company.latitude, company.longitude);
            }
            matches.push({ company, distance: d });
          }
        }

        matches.sort((a, b) => {
          if (a.distance === undefined) return 1;
          if (b.distance === undefined) return -1;
          return a.distance - b.distance;
        });

        if (sortMode === 'closest') {
          matches.sort((a, b) => {
            const ad = typeof a.distance === 'number' ? a.distance : Number.POSITIVE_INFINITY;
            const bd = typeof b.distance === 'number' ? b.distance : Number.POSITIVE_INFINITY;
            return ad - bd;
          });
        } else if (sortMode === 'rating_desc') {
          matches.sort((a, b) => {
            const ar = typeof (a.company as any).avg_rating === 'number' ? (a.company as any).avg_rating : Number((a.company as any).avg_rating || 0);
            const br = typeof (b.company as any).avg_rating === 'number' ? (b.company as any).avg_rating : Number((b.company as any).avg_rating || 0);
            return (br || 0) - (ar || 0);
          });
        }

        setFilteredCompanies(matches.map((m) => m.company));
        setCompaniesWithDistance(matches.map((m) => ({ company: m.company, distance: m.distance })));
      } catch (err) {
        console.error('Clinic search error:', err);
      } finally {
        setIsSearching(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companies, filteredCompanies, location, effectiveLocation, selectedDistance, sortMode, isLocationActive, sortAllCompaniesByDistance]
  );

  const refreshSearchResults = useCallback(() => {
    const q = (searchQuery || '').trim();
    if (!q) return;
    if (searchScope === 'clinic') {
      void searchCompaniesByClinic(searchQuery);
    } else {
      void searchCompaniesByService(searchQuery);
    }
  }, [searchQuery, searchScope, searchCompaniesByClinic, searchCompaniesByService]);

  // Debounce search queries
  useEffect(() => {
    if (!searchQuery || !searchQuery.trim()) {
      return;
    }

    const t = setTimeout(() => {
      refreshSearchResults();
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, searchScope, refreshSearchResults]);

  // If the user selected "Closest" but location was missing, once location becomes available
  // automatically re-run the search so distances are computed and the list is sorted properly.
  useEffect(() => {
    if (sortMode !== 'closest') return;
    const orig = effectiveLocation || location;
    if (!orig) return;
    if ((searchQuery || '').trim().length === 0) return;

    refreshSearchResults();
  }, [effectiveLocation, location, refreshSearchResults, searchQuery, sortMode]);

  /**
   * Fetch route distances when "Sortează după distanță" is active and companies are loaded
   * This provides actual driving distances from Google Routes API
   */
  useEffect(() => {
    const origin = effectiveLocation || location;
    if (sortMode !== 'closest' || !origin || filteredCompanies.length === 0) {
      return;
    }

    // Get company IDs that have coordinates
    const companyIdsWithCoords = filteredCompanies
      .filter((c) => c.latitude && c.longitude)
      .map((c) => String(c.id));

    if (companyIdsWithCoords.length === 0) {
      return;
    }

    // Get access token from localStorage (for web) or AsyncStorage (for mobile)
    const accessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

    if (accessToken) {
      fetchDistances(origin, companyIdsWithCoords, accessToken);
    }
  }, [sortMode, effectiveLocation, location, filteredCompanies, fetchDistances]);

  /**
   * Handle distance selection
   * Works with both the location toggle and the old permission system
   */
  /** Use GPS for distance and map. Toggle off if already 'current'. */
  const handleUseCurrentLocation = async () => {
    if (locationSource === 'current') {
      setLocationSource(null);
      return;
    }
    if (Platform.OS === 'web') {
      await refreshLocation();
    } else {
      await requestPermission();
    }
    setLocationSource('current');
  };

  /** Use Home Address from user record. Toggle off if already 'home'. */
  const handleUseHomeAddress = () => {
    if (locationSource === 'home') {
      setLocationSource(null);
      return;
    }
    const lat = user?.latitude;
    const lng = user?.longitude;
    if (lat == null || lng == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
      Alert.alert(
        'Adresă de acasă lipsă',
        'Nu ai adresa de acasă completată. Adaugă-o la înregistrare sau în setările contului.'
      );
      return;
    }
    setLocationSource('home');
  };

  /**
   * When "Sortează după distanță" is active and location is available, keep list sorted by distance
   */
  useEffect(() => {
    if (sortMode !== 'closest' || !isLocationActive) return;
    sortAllCompaniesByDistance();
  }, [sortMode, isLocationActive, sortAllCompaniesByDistance]);

  const handleAvailableNowPress = async () => {
    if (availableNowMode) {
      setAvailableNowMode(false);
      return;
    }
    setLoadingAvailableNow(true);
    try {
      const data = await ApiService.getAvailableNow();
      setAvailableNowData(data);
      setAvailableNowMode(true);
    } catch (e) {
      console.error('getAvailableNow error:', e);
      setSnackMessage('Nu s-au putut încărca clinicile disponibile');
      setSnackVisible(true);
    } finally {
      setLoadingAvailableNow(false);
    }
  };

  /**
   * Handle pull-to-refresh
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    clearRouteCache();
    await fetchCompanies();
    if (availableNowMode) {
      try {
        const data = await ApiService.getAvailableNow();
        setAvailableNowData(data);
      } catch {
        // keep previous data
      }
    }
    if (isLocationActive && sortMode === 'closest') {
      sortAllCompaniesByDistance();
    }
    setIsRefreshing(false);
  };

  /**
   * Navigate to company detail
   */
  const handleCompanyPress = (companyId: number) => {
    navigation.navigate('VetCompanyDetail', { companyId });
  };

  /**
   * Handle sort requests coming from the card buttons.
   * dir: 'asc' => sort by matchedService.price_min ascending
   * dir: 'desc' => sort by matchedService.price_max descending
   */
  const handleSortPrice = (dir: 'asc' | 'desc') => {
    if (searchScope === 'clinic') return;
    const mode = dir === 'asc' ? 'min_asc' : 'max_desc';
    setSortMode(mode);

    // If we have a current search with matchedService info, re-sort those results
    const matches = companiesWithDistance.filter((c) => c.matchedService) as Array<{ company: Company; distance?: number; matchedService: any }>;
    if (matches.length === 0) return;

    if (mode === 'min_asc') {
      matches.sort((a, b) => (a.matchedService?.price_min ?? Number.POSITIVE_INFINITY) - (b.matchedService?.price_min ?? Number.POSITIVE_INFINITY));
    } else if (mode === 'max_desc') {
      matches.sort((a, b) => (b.matchedService?.price_max ?? Number.NEGATIVE_INFINITY) - (a.matchedService?.price_max ?? Number.NEGATIVE_INFINITY));
    }

    setFilteredCompanies(matches.map((m) => m.company));
    setCompaniesWithDistance(matches);
  };

  const handleSortRating = () => {
    const mode: 'rating_desc' = 'rating_desc';
    setSortMode(mode);

    const hasSearch = (searchQuery || '').trim().length > 0;
    const listToSort = hasSearch
      ? (searchScope === 'clinic'
          ? ([...companiesWithDistance] as Array<{ company: Company; distance?: number; matchedService?: any }>)
          : (companiesWithDistance.filter((c) => c.matchedService) as Array<{ company: Company; distance?: number; matchedService: any }>))
      : [...companiesWithDistance];

    if (listToSort.length === 0) return;

    listToSort.sort((a, b) => {
      const ar = typeof (a.company as any).avg_rating === 'number' ? (a.company as any).avg_rating : Number((a.company as any).avg_rating || 0);
      const br = typeof (b.company as any).avg_rating === 'number' ? (b.company as any).avg_rating : Number((b.company as any).avg_rating || 0);
      return (br || 0) - (ar || 0);
    });

    setFilteredCompanies(listToSort.map((m) => m.company));
    setCompaniesWithDistance(listToSort.map((m) => ({ company: m.company, distance: m.distance, matchedService: (m as any).matchedService })));

    if (hasSearch) {
      refreshSearchResults();
    }
  };

  const handleSortClosest = () => {
    const mode: 'closest' = 'closest';
    setSortMode(mode);

    // On mobile, Closest requires current location.
    if (!location) {
      setSnackMessage('Activează locația pentru Closest');
      setSnackVisible(true);

      // Re-request permission on mobile devices.
      if (Platform.OS !== 'web') {
        requestPermission();
      }
      return;
    }

    const matches = (searchScope === 'clinic'
      ? [...companiesWithDistance]
      : companiesWithDistance.filter((c) => c.matchedService)) as Array<{ company: Company; distance?: number; matchedService: any }>;
    if (matches.length === 0) return;

    // Compute distance from current user location to each clinic (if possible)
    const matchesWithDistance = matches.map((m) => {
      if (typeof m.distance === 'number') return m;
      if (!location || !m.company?.latitude || !m.company?.longitude) return m;
      const d = calculateDistance(location.latitude, location.longitude, m.company.latitude, m.company.longitude);
      return { ...m, distance: d };
    });

    matchesWithDistance.sort((a, b) => {
      const ad = typeof a.distance === 'number' ? a.distance : Number.POSITIVE_INFINITY;
      const bd = typeof b.distance === 'number' ? b.distance : Number.POSITIVE_INFINITY;
      return ad - bd;
    });

    setFilteredCompanies(matchesWithDistance.map((m) => m.company));
    setCompaniesWithDistance(matchesWithDistance);

    if ((searchQuery || '').trim().length > 0) {
      refreshSearchResults();
    }
  };

  /** Sortează după distanță: doar dacă ai locație activă și permisiuni (pentru current); altfel Alert */
  const handleSortByDistance = () => {
    if (!isLocationActive) {
      setLocationRequiredAlertVisible(true);
      return;
    }
    if (locationSource === 'current' && permissionStatus === 'denied') {
      Alert.alert(
        'Permisiuni necesare',
        'Nu ai acordat permisiunile de locație. Pentru a sorta după distanță, acordă permisiunile (apasă pe „Folosește locația curentă” și acceptă când browserul sau aplicația îți cere accesul la locație).',
        [{ text: 'OK' }, { text: 'Acordă permisiuni', onPress: () => requestPermission() }]
      );
      return;
    }
    setSortMode('closest');
    if ((searchQuery || '').trim().length > 0) {
      handleSortClosest();
    } else {
      sortAllCompaniesByDistance();
    }
  };

  /**
   * Handle user logout
   */
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const pickSearchScope = (scope: 'clinic' | 'service') => {
    setScopeMenuVisible(false);
    setSearchScope(scope);
    const q = (searchQuery || '').trim();
    if (!q) return;
    if (scope === 'clinic') void searchCompaniesByClinic(searchQuery);
    else void searchCompaniesByService(searchQuery);
  };

  /**
   * Open map with clinics. Uses selected location source:
   * - current: GPS location (when available)
   * - home: user home coordinates from DB
   * Fallback: Timișoara center.
   */
  const openMap = async () => {
    const TIMISOARA_CENTER = { latitude: 45.75372, longitude: 21.22571, label: 'Timișoara Centru' };
    let coords: { latitude: number; longitude: number; label?: string } | null = null;

    if (locationSource === 'home' && user?.latitude != null && user?.longitude != null) {
      coords = { latitude: Number(user.latitude), longitude: Number(user.longitude), label: 'Acasă' };
    } else if (locationSource === 'current') {
      if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
        coords = { latitude: location.latitude, longitude: location.longitude, label: 'Locația mea' };
      } else {
        try {
          if (Platform.OS === 'web') await refreshLocation();
          else await requestPermission();
        } catch {
          // ignore
        }
        if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
          coords = { latitude: location.latitude, longitude: location.longitude, label: 'Locația mea' };
        }
      }
    }

    // Fallback: try to obtain current location (if nothing selected)
    if (!coords) {
      if (!location) {
        try {
          if (Platform.OS === 'web') await refreshLocation();
          else await requestPermission();
        } catch {
          // ignore
        }
      }
      if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
        coords = { latitude: location.latitude, longitude: location.longitude, label: 'Locația mea' };
      }
    }

    if (!coords) coords = TIMISOARA_CENTER;

    setMapCenter(coords);
    setSelectedMapClinic(null);
    setMapVisible(true);
  };

  const handleMapClinicOpen = () => {
    if (!selectedMapClinic) return;
    setMapVisible(false);
    navigation.navigate('VetCompanyDetail', { companyId: selectedMapClinic.id });
  };

  /**
   * Render loading state
   */
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
          <Text style={styles.loadingText}>Se încarcă clinicile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary[800]]}
            tintColor={theme.colors.primary[800]}
          />
        }
      >
        {/* Compact Header */}
        <LinearGradient
          colors={[...theme.gradients.bannerDuo]}
          style={styles.compactHeader}
        >
          <View style={styles.compactHeaderContent}>
            <View style={styles.headerLeft}>
              <MaterialCommunityIcons name="paw" size={28} color="#FFFFFF" />
              <Text style={styles.compactHeaderTitle}>VetFinder</Text>
            </View>

            <View style={styles.headerRight}>
              <View style={styles.sortControls}>
                <Menu
                  visible={menuVisible}
                  onDismiss={closeMenu}
                  anchor={
                    <TouchableOpacity
                      onPress={openMenu}
                      style={styles.headerIconButton}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Menu"
                    >
                      <Ionicons name="menu" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                  }
                >
                  <Menu.Item
                    title="Programările mele"
                    onPress={() => {
                      closeMenu();
                      navigation.navigate('MyAppointments');
                    }}
                    leadingIcon="calendar-month-outline"
                  />
                  <Menu.Item
                    title="Setări"
                    onPress={() => {
                      closeMenu();
                      navigation.navigate('UserSettings');
                    }}
                    leadingIcon="cog-outline"
                  />
                  <Menu.Item
                    title="Deconectare"
                    onPress={async () => {
                      closeMenu();
                      await handleLogout();
                    }}
                    leadingIcon="logout"
                  />
                </Menu>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Zonă hero dedicată căutării (fundal lavandă, bile lăbuțe, bară tip pill ca în mockup) */}
        <View style={styles.searchHeroSection}>
          <View style={styles.searchHeroPawDecor} pointerEvents="none">
            <Ionicons name="paw" size={26} color="rgba(100, 180, 210, 0.35)" style={styles.searchHeroPawDecorIcon} />
            <Ionicons name="paw" size={22} color="rgba(100, 180, 210, 0.28)" style={styles.searchHeroPawDecorIconAlt} />
            <Ionicons name="paw" size={24} color="rgba(100, 180, 210, 0.32)" style={styles.searchHeroPawDecorIconRight} />
          </View>

          <View style={styles.searchHeroContent}>
            <View style={styles.heroMascotsAndSearch}>
              <View style={styles.heroMascotsRow} pointerEvents="none">
                <Image
                  source={HERO_DOG_IMAGE}
                  style={styles.heroMascotDog}
                  resizeMode="contain"
                  accessibilityLabel="Ilustrație câine"
                />
                <Image
                  source={HERO_CAT_IMAGE}
                  style={styles.heroMascotCat}
                  resizeMode="contain"
                  accessibilityLabel="Ilustrație pisică"
                />
              </View>

              <View style={styles.heroSearchGroupCard}>
                <View style={styles.heroSearchInner}>
                  <View style={styles.heroSearchRow}>
                    <View style={styles.heroLeftCluster}>
                      <View style={styles.heroPawCircle}>
                        <MaterialCommunityIcons name="paw" size={22} color="#FFFFFF" />
                      </View>
                      <Menu
                        visible={scopeMenuVisible}
                        onDismiss={() => setScopeMenuVisible(false)}
                        anchor={
                          <TouchableOpacity
                            onPress={() => setScopeMenuVisible(true)}
                            style={styles.heroScopeTrigger}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel="Tip căutare: clinică sau serviciu"
                          >
                            <Text style={styles.heroScopeTriggerText} numberOfLines={1}>
                              {searchScope === 'clinic' ? 'Clinică' : 'Serviciu'}
                            </Text>
                            <Ionicons name="chevron-down" size={17} color="#475569" />
                          </TouchableOpacity>
                        }
                      >
                        <Menu.Item
                          title="Clinică"
                          onPress={() => pickSearchScope('clinic')}
                          leadingIcon="hospital-building"
                        />
                        <Menu.Item
                          title="Serviciu"
                          onPress={() => pickSearchScope('service')}
                          leadingIcon="stethoscope"
                        />
                      </Menu>
                    </View>

                    <View style={styles.heroVsep} />

                    <View style={styles.heroSearchFieldWrap}>
                      <RNTextInput
                        style={styles.heroSearchInput}
                        placeholder={
                          searchScope === 'clinic'
                            ? 'Nume clinică, oraș sau adresă…'
                            : 'Ex.: consult, vaccin...'
                        }
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        returnKeyType="search"
                        onSubmitEditing={refreshSearchResults}
                        accessibilityLabel="Câmp căutare"
                      />
                      {(searchQuery || '').trim().length > 0 && (
                        <TouchableOpacity
                          onPress={() => {
                            setSearchQuery('');
                            setSortMode('none');
                            setFilteredCompanies(companies);
                            setCompaniesWithDistance(companies.map((c) => ({ company })));
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="Șterge căutarea"
                        >
                          <Ionicons name="close-circle" size={22} color="#94a3b8" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <TouchableOpacity
                      style={styles.heroSearchCta}
                      onPress={refreshSearchResults}
                      activeOpacity={0.88}
                      accessibilityRole="button"
                      accessibilityLabel="Caută"
                    >
                      {isSearching ? (
                        <ActivityIndicator size="small" color="#1e293b" />
                      ) : (
                        <>
                          <Ionicons name="search" size={20} color="#1e293b" />
                          <Text style={styles.heroSearchCtaText}>Caută</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Find Clinics Section */}
        {!isServiceSearchActive && (
          <View style={styles.findClinicsSection}>
            <View style={styles.findClinicsHeader}>
              <Text style={styles.sectionTitle}>Găsește clinici</Text>
              <TouchableOpacity
                onPress={handleAvailableNowPress}
                style={[styles.availableNowButton, availableNowMode && styles.availableNowButtonActive]}
                disabled={loadingAvailableNow}
                activeOpacity={0.8}
              >
                {loadingAvailableNow ? (
                  <ActivityIndicator size="small" color={availableNowMode ? '#fff' : theme.colors.primary.main} />
                ) : (
                  <>
                    <View style={[styles.availableNowDot, availableNowMode && styles.availableNowDotActive]} />
                    <Text style={[styles.availableNowButtonText, availableNowMode && styles.availableNowButtonTextActive]}>
                      Disponibil ACUM
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Location Filter Banner */}
            <View style={styles.filterCard}>
              <View style={styles.filterHeader}>
                <Ionicons name="location" size={20} color={theme.colors.primary.main} />
                <Text style={styles.filterTitle}>
                  Locație și sortare
                </Text>
                <TouchableOpacity
                  onPress={openMap}
                  activeOpacity={0.85}
                  style={styles.seeMapButton}
                  accessibilityRole="button"
                  accessibilityLabel="See map with clinics"
                >
                  <Ionicons name="map-outline" size={16} color={theme.colors.primary.main} />
                  <Text style={styles.seeMapButtonText}>Vezi harta cu clinici</Text>
                </TouchableOpacity>
              </View>

              {/* Location source: current GPS or Home Address */}
              <View style={styles.locationSourceRow}>
                <TouchableOpacity
                  onPress={handleUseCurrentLocation}
                  style={[
                    styles.locationSourceButton,
                    locationSource === 'current' && styles.locationSourceButtonSelected,
                  ]}
                  activeOpacity={0.8}
                >
                  {locationSource === 'current' && locationLoading && (
                    <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
                  )}
                  <MaterialCommunityIcons
                    name={locationSource === 'current' ? 'map-marker' : 'map-marker-outline'}
                    size={18}
                    color={locationSource === 'current' ? '#fff' : theme.colors.neutral[600]}
                  />
                  <Text style={[styles.locationSourceButtonText, locationSource === 'current' && styles.locationSourceButtonTextSelected]}>
                    Folosește locația curentă
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleUseHomeAddress}
                  style={[
                    styles.locationSourceButton,
                    locationSource === 'home' && styles.locationSourceButtonSelected,
                  ]}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={locationSource === 'home' ? 'home' : 'home-outline'}
                    size={18}
                    color={locationSource === 'home' ? '#fff' : theme.colors.neutral[600]}
                  />
                  <Text style={[styles.locationSourceButtonText, locationSource === 'home' && styles.locationSourceButtonTextSelected]}>
                    Folosește Home Address
                  </Text>
                </TouchableOpacity>
              </View>

              {isLocationActive && locationSource !== 'current' && (
                <View style={[styles.locationInfoBanner, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={[styles.locationInfoText, { color: '#065f46' }]}>
                    Locație activă! Poți sorta după distanță și vedea distanțele pe carduri.
                  </Text>
                </View>
              )}
              {isLocationActive && locationSource === 'current' && permissionStatus === 'granted' && (
                <View style={[styles.locationInfoBanner, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={[styles.locationInfoText, { color: '#065f46' }]}>
                    Locație activă! Poți sorta după distanță și vedea distanțele pe carduri.
                  </Text>
                </View>
              )}
              {isLocationActive && locationSource === 'current' && permissionStatus === 'denied' && (
                <View style={styles.locationPermissionBanner}>
                  <Ionicons name="warning" size={20} color="#b45309" />
                  <View style={styles.locationPermissionBannerTextWrap}>
                    <Text style={styles.locationPermissionBannerText}>
                      Nu ai acordat permisiunile de locație. Pentru a sorta după distanță și a vedea distanța pe carduri, acordă permisiunile.
                    </Text>
                    <TouchableOpacity
                      style={styles.locationPermissionButton}
                      onPress={() => requestPermission()}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.locationPermissionButtonText}>Acordă permisiuni</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Sort: Implicit, Rating, Sortează după distanță */}
              <View style={styles.filterRow}>
                <Text style={styles.filterRowLabel}>Sortează</Text>
                <View style={styles.filterChipsRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setSortMode('none');
                      if ((searchQuery || '').trim().length > 0) {
                        refreshSearchResults();
                      } else {
                        setFilteredCompanies(companies);
                        setCompaniesWithDistance(companies.map((c) => ({ company: c })));
                      }
                    }}
                    style={[styles.filterChip, sortMode === 'none' && styles.filterChipSelected]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.filterChipText, sortMode === 'none' && styles.filterChipTextSelected]}>Implicit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSortRating}
                    style={[styles.filterChip, sortMode === 'rating_desc' && styles.filterChipSelected]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.filterChipText, sortMode === 'rating_desc' && styles.filterChipTextSelected]}>Rating ★</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSortByDistance}
                    style={[styles.filterChip, sortMode === 'closest' && styles.filterChipSelected]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="location" size={16} color={sortMode === 'closest' ? '#fff' : theme.colors.primary.main} />
                    <Text style={[styles.filterChipText, sortMode === 'closest' && styles.filterChipTextSelected]}>Sortează după distanță</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Results Count */}
              <View style={styles.resultsContainer}>
                <Text style={styles.resultsText}>
                  <Text style={styles.resultsCount}>{filteredCompanies.length}</Text>{' '}
                  clinic{filteredCompanies.length !== 1 ? 'e' : ''} veterinar{filteredCompanies.length !== 1 ? 'e' : ''}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle" size={48} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty State */}
        {!error && !availableNowMode && filteredCompanies.length === 0 && (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="magnify" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Nu s-au găsit clinici veterinare</Text>
            <Text style={styles.emptySubtitle}>
              Nu există încă clinici înregistrate sau niciuna nu corespunde căutării.
            </Text>
          </View>
        )}

        {/* Available now empty: no open clinics and no emergency (or user has no emergency flag) */}
        {!error && availableNowMode && availableNowDisplayList.length === 0 && (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="clock-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Nicio clinică disponibilă acum</Text>
            <Text style={styles.emptySubtitle}>
              Nu există clinici deschise în acest moment și nici clinici care acceptă urgențe când sunt închise.
            </Text>
            <TouchableOpacity style={styles.clearFilterButton} onPress={() => setAvailableNowMode(false)}>
              <Text style={styles.clearFilterButtonText}>Înapoi la toate clinicile</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Company Cards List (normal or "Disponibil acum") */}
        {!error && (availableNowMode ? availableNowDisplayList.length > 0 : filteredCompanies.length > 0) && (
          <View style={styles.cardsContainer}>
            {availableNowMode && (
              <View style={styles.availableNowSummary}>
                <Text style={styles.availableNowSummaryText}>
                  {availableNowData.openNow.length > 0 && `${availableNowData.openNow.length} deschise acum`}
                  {availableNowData.openNow.length > 0 && effectiveEmergencyOnly.length > 0 && ' · '}
                  {effectiveEmergencyOnly.length > 0 && `${effectiveEmergencyOnly.length} în regim de urgență`}
                </Text>
              </View>
            )}
            {!availableNowMode && (searchQuery || '').trim().length > 0 && (
              <View style={styles.resultsSortSection}>
                <Text style={styles.resultsSortLabel}>Sortează după:</Text>
                <View style={styles.resultsSortBar}>
                  {searchScope === 'service' && (
                    <>
                      <TouchableOpacity
                        onPress={() => handleSortPrice('asc')}
                        style={[styles.sortChip, sortMode === 'min_asc' && styles.sortChipActive]}
                      >
                        <Text style={[styles.sortChipText, sortMode === 'min_asc' && { color: '#ffffff' }]}>Preț ↑</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleSortPrice('desc')}
                        style={[styles.sortChip, sortMode === 'max_desc' && styles.sortChipActive]}
                      >
                        <Text style={[styles.sortChipText, sortMode === 'max_desc' && { color: '#ffffff' }]}>Preț ↓</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  <TouchableOpacity
                    onPress={handleSortRating}
                    style={[styles.sortChip, sortMode === 'rating_desc' && styles.sortChipActive]}
                  >
                    <Text style={[styles.sortChipText, sortMode === 'rating_desc' && { color: '#ffffff' }]}>Rating ★</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSortClosest}
                    style={[styles.sortChip, sortMode === 'closest' && styles.sortChipActive]}
                  >
                    <Text style={[styles.sortChipText, sortMode === 'closest' && { color: '#ffffff' }]}>Closest</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {availableNowMode
              ? availableNowDisplayList.map(({ company, distance, isEmergency }) => (
                  <VetCompanyCard
                    key={company.id}
                    company={company}
                    distance={isLocationActive ? distance : undefined}
                    routeDistance={isLocationActive ? getDistance(String(company.id)) : undefined}
                    matchedService={undefined}
                    emergencyOnly={isEmergency ? { emergency_fee: company.emergency_fee, emergency_contact_phone: company.emergency_contact_phone } : undefined}
                    onPress={() => handleCompanyPress(company.id)}
                  />
                ))
              : companiesWithDistance.map(({ company, distance, matchedService }) => {
                  const showDistance = sortMode === 'closest';
                  const distanceProp = showDistance ? distance : undefined;
                  return (
                    <VetCompanyCard
                      key={company.id}
                      company={company}
                      distance={distanceProp}
                      routeDistance={showDistance ? getDistance(String(company.id)) : undefined}
                      matchedService={matchedService}
                      onPress={() => handleCompanyPress(company.id)}
                    />
                  );
                })}
          </View>
        )}

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
      {/* Alertă locație necesară (pe web Alert.alert nu apare, folosim Dialog) */}
      <Portal>
        <Dialog visible={locationRequiredAlertVisible} onDismiss={() => setLocationRequiredAlertVisible(false)} style={{ maxWidth: 400, alignSelf: 'center', width: '92%' }}>
          <Dialog.Title>Locația este necesară</Dialog.Title>
          <Dialog.Content>
            <Text style={{ fontSize: 15, lineHeight: 22 }}>
              Activează locația: apasă pe „Folosește locația curentă” sau „Folosește Home Address”, apoi Sortează după distanță.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLocationRequiredAlertVisible(false)}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      {/* Map dialog: interactive only on web */}
      <Portal>
        <Dialog visible={mapVisible} onDismiss={() => setMapVisible(false)} style={{ maxWidth: 720, alignSelf: 'center', width: '92%' }}>
          <Dialog.Title>Map</Dialog.Title>
          <Dialog.Content>
            {!mapCenter ? (
              <View style={{ gap: 12 }}>
                <Text>Nu avem încă locația curentă.</Text>
                {locationLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator />
                    <Text>Se obține locația...</Text>
                  </View>
                ) : (
                  <Button
                    mode="contained"
                    onPress={async () => {
                      if (Platform.OS !== 'web') {
                        await requestPermission();
                      }
                      await refreshLocation();
                    }}
                  >
                    Permite locația
                  </Button>
                )}
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <View style={{ height: 420, width: '100%', borderRadius: 12, overflow: 'hidden' }}>
                  {Platform.OS === 'web' ? (
                    <LeafletMapWeb
                      center={mapCenter}
                      companies={filteredCompanies}
                      onClinicSelect={(id, name) => setSelectedMapClinic({ id, name })}
                      style={{ width: '100%', height: 420, borderRadius: 12, overflow: 'hidden' }}
                    />
                  ) : (
                  <WebView
                    originWhitelist={['*']}
                    javaScriptEnabled
                    domStorageEnabled
                    onMessage={(e) => {
                      try {
                        const data = JSON.parse(e.nativeEvent.data);
                        if (data?.type === 'clinic_select' && typeof data?.id === 'number') {
                          setSelectedMapClinic({ id: data.id, name: String(data?.name || 'Clinic') });
                        }
                      } catch {
                        // ignore
                      }
                    }}
                    source={{
                      html: `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      (function () {
        const center = [${mapCenter.latitude}, ${mapCenter.longitude}];

        const map = L.map('map', {
          zoomControl: true,
        }).setView(center, 14);

        // OpenStreetMap tiles (no API key)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        // User marker
        L.circleMarker(center, {
          radius: 7,
          color: '#2563eb',
          weight: 2,
          fillColor: '#2563eb',
          fillOpacity: 0.7,
        })
          .addTo(map)
          .bindPopup(${JSON.stringify(mapCenter.label === 'Home' ? 'Home' : 'You')});

        const clinics = ${JSON.stringify(
          (filteredCompanies || [])
            .filter((c) => typeof (c as any)?.latitude === 'number' && typeof (c as any)?.longitude === 'number')
            .map((c) => ({ id: c.id, name: c.name, lat: c.latitude, lng: c.longitude }))
        )};

        const markers = [];

        clinics.forEach((c) => {
          const m = L.circleMarker([c.lat, c.lng], {
            radius: 7,
            color: '#ef4444',
            weight: 2,
            fillColor: '#ef4444',
            fillOpacity: 0.75,
          })
            .addTo(map)
            .bindPopup(c.name);

          // Uber/Bolt-like: select clinic on marker click
          m.on('click', function () {
            try {
              const payload = JSON.stringify({ type: 'clinic_select', id: c.id, name: c.name });
              if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(payload);
              }
            } catch (e) {}
          });
          markers.push(m);
        });

        // Fit bounds if we have clinics
        if (markers.length) {
          const group = L.featureGroup([L.marker(center), ...markers]);
          map.fitBounds(group.getBounds().pad(0.25));
        }
      })();
    </script>
  </body>
</html>`,
                    }}
                  />
                  )}
                </View>

                {selectedMapClinic ? (
                  <View
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: theme.colors.surface.cream,
                      borderWidth: 1,
                      borderColor: theme.colors.surface.border,
                    }}
                  >
                    <Text style={{ fontWeight: '700', fontSize: 16, color: theme.colors.neutral[900] }}>
                      {selectedMapClinic.name}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                      <Button mode="contained" onPress={handleMapClinicOpen}>
                        Open details
                      </Button>
                    </View>
                  </View>
                ) : (
                  <Text style={{ color: theme.colors.neutral[600] }}>
                    Apasă pe o bulină ca să vezi detalii.
                  </Text>
                )}
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setMapVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      {/* Feedback Snackbar (web + native) */}
      <Snackbar
        visible={snackVisible}
        onDismiss={() => setSnackVisible(false)}
        duration={3000}
        action={{ label: 'OK', onPress: () => setSnackVisible(false) }}
      >
        {snackMessage}
      </Snackbar>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 16,
  },
  headerGradient: {
    paddingBottom: 8,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  titleTextContainer: {
    flex: 1,
  },
  titleMain: {
    fontSize: 24,
    fontWeight: '300',
    color: '#374151',
  },
  titleHighlight: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.primary.main,
  },
  filterCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: theme.spacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  seeMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  seeMapButtonText: {
    color: theme.colors.primary.main,
    fontWeight: '700',
    fontSize: 13,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    flex: 1,
  },
  filterRow: {
    marginBottom: 14,
  },
  filterRowLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipWithMenu: {
    paddingRight: 10,
  },
  filterChipSelected: {
    backgroundColor: theme.colors.primary.main,
    borderColor: theme.colors.primary.main,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  filterChipTextSelected: {
    color: '#ffffff',
  },
  distanceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  resultsSortSection: {
    marginBottom: theme.spacing.lg,
  },
  resultsSortLabel: {
    color: theme.colors.neutral[700],
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  resultsSortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortChip: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sortChipActive: {
    backgroundColor: theme.colors.primary.main,
    borderColor: theme.colors.primary.main,
    shadowColor: theme.colors.primary.main,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  sortChipText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  distanceChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  distanceChipSelected: {
    backgroundColor: theme.colors.primary.main,
    borderColor: theme.colors.primary.main,
  },
  distanceChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  distanceChipTextSelected: {
    color: '#ffffff',
  },
  locationWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    padding: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 10,
  },
  locationWarningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  locationStatusText: {
    fontSize: 13,
    color: '#6b7280',
  },
  resultsContainer: {
    marginTop: 4,
    marginBottom: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  resultsText: {
    fontSize: 14,
    color: '#6b7280',
  },
  resultsCount: {
    fontWeight: '700',
    color: theme.colors.primary.main,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: theme.spacing['2xl'],
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.borderRadius.md,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    paddingTop: 64,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  clearFilterButton: {
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.primary.main,
    borderRadius: theme.borderRadius.md,
  },
  clearFilterButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  cardsContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  bottomPadding: {
    height: 32,
  },
  // Compact Header Styles
  compactHeader: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  compactHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compactHeaderTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  /** Hero dedicat căutării — lavandă foarte pal, ca în mockup */
  searchHeroSection: {
    position: 'relative',
    backgroundColor: '#f3f0fa',
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing['2xl'],
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    overflow: 'visible',
  },
  searchHeroPawDecor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    pointerEvents: 'none',
  },
  searchHeroPawDecorIcon: {
    transform: [{ rotate: '-18deg' }],
  },
  searchHeroPawDecorIconAlt: {
    marginTop: 8,
    transform: [{ rotate: '12deg' }],
  },
  searchHeroPawDecorIconRight: {
    transform: [{ rotate: '22deg' }],
  },
  searchHeroContent: {
    position: 'relative',
    zIndex: 2,
    alignItems: 'center',
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  /** Mascote în fundalul lavandă, chenarul alb doar pentru căutare */
  heroMascotsAndSearch: {
    width: '100%',
    alignItems: 'stretch',
    position: 'relative',
  },
  /** Doar bara de căutare (mascotele sunt în afara acestui chenar) */
  heroSearchGroupCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#9dcfe8',
    paddingHorizontal: 5,
    paddingVertical: 5,
    overflow: 'visible',
    zIndex: 1,
    ...theme.shadows.md,
    shadowColor: '#6ba2c4',
  },
  heroMascotsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: Math.min(10, SCREEN_WIDTH * 0.024),
    /* Trage pill-ul sub lăbuțe — mascotele rămân deasupra chenarului */
    marginBottom: -46,
    zIndex: 3,
    paddingHorizontal: 2,
  },
  heroMascotDog: {
    width: HERO_MASCOT_DISPLAY_WIDTH,
    aspectRatio: HERO_DOG_PX.w / HERO_DOG_PX.h,
    transform: [{ translateY: 12 }],
  },
  heroMascotCat: {
    width: HERO_CAT_DISPLAY_WIDTH,
    aspectRatio: HERO_CAT_PX.w / HERO_CAT_PX.h,
    transform: [{ translateY: 28 }],
  },
  heroSearchInner: {
    zIndex: 1,
    paddingVertical: 5,
  },
  heroSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
  },
  heroLeftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 2,
    flexShrink: 0,
  },
  heroPawCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6bb8d6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroScopeTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    maxWidth: SCREEN_WIDTH * 0.28,
    minWidth: 84,
  },
  heroScopeTriggerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    flexShrink: 1,
  },
  heroVsep: {
    width: StyleSheet.hairlineWidth * 2,
    alignSelf: 'stretch',
    backgroundColor: '#cbd5e1',
    marginVertical: 10,
    minHeight: 28,
  },
  heroSearchFieldWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    minWidth: 0,
  },
  heroSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    paddingHorizontal: 6,
    minWidth: 0,
  },
  heroSearchCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    minHeight: 46,
    backgroundColor: '#f5d547',
    borderRadius: 28,
    marginLeft: 4,
    flexShrink: 0,
  },
  heroSearchCtaText: {
    color: '#1e293b',
    fontWeight: '800',
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.neutral[700],
  },
  // Find Clinics Section Styles
  findClinicsSection: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  findClinicsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  availableNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.primary.main,
    backgroundColor: 'transparent',
  },
  availableNowButtonActive: {
    backgroundColor: theme.colors.primary.main,
    borderColor: theme.colors.primary.main,
  },
  availableNowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  availableNowDotActive: {
    backgroundColor: '#ffffff',
  },
  availableNowButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary.main,
  },
  availableNowButtonTextActive: {
    color: '#ffffff',
  },
  availableNowSummary: {
    marginBottom: theme.spacing.md,
  },
  availableNowSummaryText: {
    fontSize: 14,
    color: theme.colors.neutral[600],
    fontWeight: '600',
  },
  searchContainer: {
    marginBottom: theme.spacing.md,
  },
  locationSourceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  locationSourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  locationSourceButtonSelected: {
    backgroundColor: theme.colors.primary.main,
    borderColor: theme.colors.primary.main,
  },
  locationSourceButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  locationSourceButtonTextSelected: {
    color: '#ffffff',
  },
  locationInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  locationInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    fontWeight: '500',
  },
  locationPermissionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  locationPermissionBannerTextWrap: {
    flex: 1,
  },
  locationPermissionBannerText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '500',
    marginBottom: 10,
  },
  locationPermissionButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#d97706',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  locationPermissionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});

export default UserDashboardScreen;
