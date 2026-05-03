import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../hooks/useAuth';
import {
  useUpdateProfileImage,
  useMyCertifications,
  useUploadCertification,
  useDeleteCertification,
} from '../hooks/useProfileSetup';
import { useGuideBaseLocation, useSaveGuideBaseLocation } from '../hooks/useGuide';
import { apiFetch } from '../lib/api-client';
import LocationMap from '../components/LocationMap';
import type { UserProfileResponse } from '../types/api';
import {
  changeLanguage,
  SUPPORTED_LANGUAGES,
  LANGUAGE_DISPLAY_NAMES,
  type SupportedLanguage,
} from '../i18n';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

function BaseLocationModal({
  visible,
  initialLat,
  initialLng,
  onSave,
  onDismiss,
}: {
  visible: boolean;
  initialLat: number | null;
  initialLng: number | null;
  onSave: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [lat, setLat] = useState(initialLat ?? 37.5665);
  const [lng, setLng] = useState(initialLng ?? 126.978);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const save = useSaveGuideBaseLocation();

  async function handleSearch() {
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const params = new URLSearchParams({ q, format: 'json', limit: '5', 'accept-language': 'ko,en' });
      const res = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: { 'User-Agent': 'LocalNow/1.0 (contact: localnow@example.com)' },
      });
      const data: NominatimResult[] = await res.json();
      setSearchResults(data);
    } catch {
      // ignore search errors silently
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSave() {
    save.mutate(
      { lat, lng },
      {
        onSuccess: onSave,
        onError: (err: unknown) => {
          const msg =
            err && typeof err === 'object' && 'message' in err
              ? String((err as { message: unknown }).message)
              : t('profileEdit.saveFailedTitle');
          Alert.alert(t('profileEdit.saveFailedTitle'), msg);
        },
      },
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.title}>{t('profileEdit.setLocationTitle')}</Text>
          <TouchableOpacity onPress={onDismiss} testID="base-loc-cancel">
            <Text style={modalStyles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>

        <View style={modalStyles.searchRow}>
          <TextInput
            style={modalStyles.searchInput}
            placeholder={t('profileEdit.searchAddress')}
            placeholderTextColor="#525252"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            testID="base-loc-search-input"
          />
          <TouchableOpacity
            style={modalStyles.searchBtn}
            onPress={handleSearch}
            disabled={isSearching}
            testID="base-loc-search-button"
          >
            {isSearching ? (
              <ActivityIndicator color="#0a0a0a" size="small" />
            ) : (
              <Text style={modalStyles.searchBtnText}>{t('common.search')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {searchResults.length > 0 && (
          <ScrollView
            style={modalStyles.resultsList}
            keyboardShouldPersistTaps="handled"
          >
            {searchResults.map((r, i) => (
              <TouchableOpacity
                key={i}
                style={modalStyles.resultItem}
                onPress={() => {
                  setLat(parseFloat(r.lat));
                  setLng(parseFloat(r.lon));
                  setSearchQuery(r.display_name);
                  setSearchResults([]);
                }}
              >
                <Text style={modalStyles.resultText} numberOfLines={2}>
                  {r.display_name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={modalStyles.mapContainer}>
          <LocationMap
            lat={lat}
            lng={lng}
            onLocationChange={(newLat, newLng) => {
              setLat(newLat);
              setLng(newLng);
            }}
          />
        </View>

        <View style={modalStyles.footer}>
          <Text style={modalStyles.coordText}>
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </Text>
          <TouchableOpacity
            style={[modalStyles.saveBtn, save.isPending && modalStyles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={save.isPending}
            testID="base-loc-save-button"
          >
            {save.isPending ? (
              <ActivityIndicator color="#0a0a0a" size="small" />
            ) : (
              <Text style={modalStyles.saveBtnText}>{t('common.save')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function ProfileEditScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { role } = useAuth();
  const [certName, setCertName] = useState('');
  const [showBaseLocModal, setShowBaseLocModal] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await apiFetch<UserProfileResponse>('/auth/me');
      if (!res.success || !res.data) throw new Error(res.error?.message ?? t('profileEdit.loadFailed'));
      return res.data;
    },
  });

  const { data: baseLoc } = useGuideBaseLocation();
  const { data: certs, isLoading: certsLoading } = useMyCertifications();
  const uploadImageMutation = useUpdateProfileImage();
  const uploadCertMutation = useUploadCertification();
  const deleteCertMutation = useDeleteCertification();

  async function handlePickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('profileEdit.permRequired'), t('profileEdit.galleryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      uploadImageMutation.mutate(result.assets[0].uri, {
        onError: (err) => Alert.alert(t('common.errorTitle'), err.message),
      });
    }
  }

  async function handleAddCertification() {
    if (!certName.trim()) {
      Alert.alert(t('profileEdit.certNameRequired'));
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    uploadCertMutation.mutate(
      { name: certName.trim(), fileUri: asset.uri },
      {
        onSuccess: () => setCertName(''),
        onError: (err) => Alert.alert(t('common.errorTitle'), err.message),
      },
    );
  }

  function handleDeleteCertification(certId: number) {
    Alert.alert(t('profileEdit.deleteCertTitle'), t('profileEdit.deleteCertMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          deleteCertMutation.mutate(certId, {
            onError: (err) => Alert.alert(t('common.errorTitle'), err.message),
          }),
      },
    ]);
  }

  const initials = profile?.name
    ? profile.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const resolvedBase = (i18n.resolvedLanguage ?? i18n.language ?? 'ko').split('-')[0];
  const currentLang = (
    SUPPORTED_LANGUAGES.includes(resolvedBase as SupportedLanguage) ? resolvedBase : 'ko'
  ) as SupportedLanguage;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.langSection}>
        <Text style={styles.langSectionTitle}>{t('settings.language')}</Text>
        <View style={styles.langRow}>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const active = currentLang === lang;
            return (
              <TouchableOpacity
                key={lang}
                style={[styles.langBtn, active ? styles.langBtnActive : styles.langBtnInactive]}
                onPress={() => void changeLanguage(lang)}
                testID={`lang-button-${lang}`}
              >
                <Text style={[styles.langBtnText, active && styles.langBtnTextActive]}>
                  {LANGUAGE_DISPLAY_NAMES[lang]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} testID="back-button">
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('profileEdit.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Profile Image Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profileEdit.profileImage')}</Text>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={handlePickImage}
          disabled={uploadImageMutation.isPending}
          testID="profile-image-button"
        >
          {profile?.profileImageUrl ? (
            <Image source={{ uri: profile.profileImageUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          {uploadImageMutation.isPending && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color="#f59e0b" />
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.avatarHint}>{t('profileEdit.imageHint')}</Text>
      </View>

      {/* Basic Info Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profileEdit.basicInfo')}</Text>

        <Text style={styles.fieldLabel}>{t('auth.name')}</Text>
        <View style={[styles.input, styles.readOnlyInput]}>
          <Text style={styles.readOnlyText}>
            {profileLoading ? '...' : (profile?.name ?? '')}
          </Text>
        </View>

        <Text style={styles.fieldLabel}>{t('profileEdit.birthYear')}</Text>
        <View style={[styles.input, styles.readOnlyInput]}>
          <Text style={styles.readOnlyText}>
            {profileLoading
              ? '...'
              : profile?.birthYear != null
                ? String(profile.birthYear)
                : t('profileEdit.notSet')}
          </Text>
        </View>

        <Text style={styles.fieldLabel}>{t('profileEdit.bio')}</Text>
        <View style={[styles.input, styles.readOnlyInput, styles.bioInput]}>
          <Text style={styles.readOnlyText}>
            {profileLoading ? '...' : (profile?.bio ?? t('profileEdit.notSet'))}
          </Text>
        </View>
      </View>

      {/* Base Location Section — GUIDE only */}
      {role === 'GUIDE' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profileEdit.baseLocation')}</Text>
          <Text style={styles.baseLocText} testID="base-loc-display">
            {baseLoc
              ? `${baseLoc.lat.toFixed(4)}, ${baseLoc.lng.toFixed(4)}`
              : t('profileEdit.notSet')}
          </Text>
          <TouchableOpacity
            style={styles.setLocBtn}
            onPress={() => setShowBaseLocModal(true)}
            testID="set-base-location-button"
          >
            <Text style={styles.setLocBtnText}>{t('profileEdit.setLocation')}</Text>
          </TouchableOpacity>
          <BaseLocationModal
            key={showBaseLocModal ? 'open' : 'closed'}
            visible={showBaseLocModal}
            initialLat={baseLoc?.lat ?? null}
            initialLng={baseLoc?.lng ?? null}
            onSave={() => setShowBaseLocModal(false)}
            onDismiss={() => setShowBaseLocModal(false)}
          />
        </View>
      )}

      {/* Certifications Section — GUIDE only */}
      {role === 'GUIDE' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profileEdit.certifications')}</Text>

          {certsLoading ? (
            <ActivityIndicator color="#f59e0b" style={styles.certsLoader} />
          ) : certs && certs.length > 0 ? (
            certs.map((cert) => (
              <View key={cert.id} style={styles.certRow}>
                <Text style={styles.certName} numberOfLines={1}>
                  {cert.name}
                </Text>
                <TouchableOpacity
                  onPress={() => handleDeleteCertification(cert.id)}
                  disabled={deleteCertMutation.isPending}
                  testID={`delete-cert-${cert.id}`}
                >
                  <Text style={styles.deleteText}>{t('profileEdit.delete')}</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.emptyHint}>{t('profileEdit.certEmptyHint')}</Text>
          )}

          <View style={styles.addCertRow}>
            <TextInput
              style={styles.certNameInput}
              placeholder={t('profileEdit.certName')}
              placeholderTextColor="#525252"
              value={certName}
              onChangeText={setCertName}
              testID="cert-name-input"
            />
            <TouchableOpacity
              style={[styles.addCertBtn, uploadCertMutation.isPending && styles.btnDisabled]}
              onPress={handleAddCertification}
              disabled={uploadCertMutation.isPending}
              testID="add-cert-button"
            >
              {uploadCertMutation.isPending ? (
                <ActivityIndicator color="#0a0a0a" size="small" />
              ) : (
                <Text style={styles.addCertBtnText}>{t('profileEdit.addPdf')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  langSection: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#141414',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
  },
  langSectionTitle: {
    color: '#737373',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.8,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  langBtnInactive: {
    backgroundColor: '#1c1c1c',
    borderColor: '#262626',
  },
  langBtnActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  langBtnText: {
    color: '#a3a3a3',
    fontSize: 13,
    fontWeight: '500',
  },
  langBtnTextActive: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingTop: 8,
  },
  backText: {
    color: '#f59e0b',
    fontSize: 14,
    width: 50,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 50,
  },
  section: {
    backgroundColor: '#141414',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#737373',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  avatarContainer: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#a3a3a3',
    fontSize: 24,
    fontWeight: '600',
  },
  avatarOverlay: {
    position: 'absolute',
    inset: 0,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    color: '#525252',
    fontSize: 12,
    textAlign: 'center',
  },
  fieldLabel: {
    color: '#a3a3a3',
    fontSize: 12,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 14,
    color: '#ffffff',
  },
  readOnlyInput: {
    opacity: 0.7,
  },
  readOnlyText: {
    color: '#a3a3a3',
    fontSize: 14,
  },
  bioInput: {
    minHeight: 72,
  },
  baseLocText: {
    color: '#a3a3a3',
    fontSize: 14,
    marginBottom: 12,
  },
  setLocBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  setLocBtnText: {
    color: '#0a0a0a',
    fontWeight: '600',
    fontSize: 14,
  },
  certRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1c',
  },
  certName: {
    color: '#e5e5e5',
    fontSize: 14,
    flex: 1,
    marginRight: 12,
  },
  deleteText: {
    color: '#ef4444',
    fontSize: 13,
  },
  emptyHint: {
    color: '#525252',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
  addCertRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  certNameInput: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
  },
  addCertBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCertBtnText: {
    color: '#0a0a0a',
    fontWeight: '500',
    fontSize: 14,
  },
  btnDisabled: {
    backgroundColor: '#404040',
  },
  certsLoader: {
    marginVertical: 12,
  },
});

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelText: {
    color: '#f59e0b',
    fontSize: 14,
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 56,
  },
  searchBtnText: {
    color: '#0a0a0a',
    fontWeight: '600',
    fontSize: 14,
  },
  resultsList: {
    maxHeight: 160,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#141414',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
  },
  resultItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  resultText: {
    color: '#e5e5e5',
    fontSize: 13,
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#262626',
  },
  footer: {
    padding: 16,
    gap: 8,
  },
  coordText: {
    color: '#525252',
    fontSize: 12,
    textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#404040',
  },
  saveBtnText: {
    color: '#0a0a0a',
    fontWeight: '600',
    fontSize: 15,
  },
});
