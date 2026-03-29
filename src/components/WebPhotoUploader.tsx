import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text, Button, IconButton } from 'react-native-paper';
import { ApiService } from '../services/api';
import { theme } from '../theme';
import { deleteByDownloadUrl, uploadCompanyPhotoFromFile } from '../services/firebaseStorage';

interface WebPhotoUploaderProps {
  companyId: number;
  existingPhotos?: string[];
  maxPhotos?: number;
  onUploadSuccess?: (photoUrl: string) => void;
  onDeleteSuccess?: (photoUrl: string) => void;
}

export const WebPhotoUploader = ({
  companyId,
  existingPhotos = [],
  maxPhotos = 10,
  onUploadSuccess,
  onDeleteSuccess,
}: WebPhotoUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [photos, setPhotos] = useState<string[]>(existingPhotos);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Only render on web
  if (Platform.OS !== 'web') {
    return null;
  }

  const handleFileSelect = async (event: any) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Check limit
    const remainingSlots = maxPhotos - photos.length;
    if (remainingSlots <= 0) {
      alert(`Maximum ${maxPhotos} fotografii permise`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots) as File[];

    setUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];

        // 1) Upload to Firebase Storage
        const downloadUrl = await uploadCompanyPhotoFromFile(companyId, file);
        // 2) Persist URL in backend (append to company.photos)
        const response = await ApiService.request(`/companies/${companyId}/photos`, {
          method: 'POST',
          body: JSON.stringify({ photo_url: downloadUrl }),
        });

        if (response.success) {
          const photoUrl = response.data.photo_url;
          setPhotos(prev => [...prev, photoUrl]);
          onUploadSuccess?.(photoUrl);
        } else {
          throw new Error(response.message || 'Upload failed');
        }

        setUploadProgress((i + 1) / filesToUpload.length);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || 'Failed to upload photos');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (photoUrl: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;

    try {
      await ApiService.deleteCompanyPhoto(companyId, photoUrl);
      try { await deleteByDownloadUrl(photoUrl); } catch {}
      setPhotos(prev => prev.filter(url => url !== photoUrl));
      onDeleteSuccess?.(photoUrl);
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete photo');
    }
  };

  const getPhotoSrc = (photoUrl: string) => {
    // If URL starts with http, use it directly, otherwise prepend API URL
    if (photoUrl.startsWith('http')) {
      return photoUrl;
    }
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
    return `${apiUrl}${photoUrl}`;
  };

  return (
    <View style={styles.container}>
      {/* File input for gallery (hidden) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Camera input (hidden) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        capture="environment"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Button row */}
      <View style={styles.buttonRow}>
        {/* Camera button */}
        <Button
          mode="contained"
          onPress={() => cameraInputRef.current?.click()}
          disabled={uploading || photos.length >= maxPhotos}
          style={styles.cameraButton}
          buttonColor={theme.colors.accent.main}
          icon="camera"
        >
          {uploading ? 'Se încarcă...' : 'Cameră'}
        </Button>

        {/* Gallery button */}
        <Button
          mode="contained"
          onPress={() => fileInputRef.current?.click()}
          disabled={uploading || photos.length >= maxPhotos}
          style={styles.uploadButton}
          buttonColor={theme.colors.primary.main}
          icon="image"
        >
          {uploading ? `${Math.round(uploadProgress * 100)}%` : 'Galerie'}
        </Button>
      </View>

      {/* Upload progress */}
      {uploading && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${uploadProgress * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>
            Se încarcă {Math.round(uploadProgress * 100)}%
          </Text>
        </View>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <View style={styles.photoGrid}>
          {photos.map((photoUrl, index) => (
            <View key={index} style={styles.photoItem}>
              <img
                src={getPhotoSrc(photoUrl)}
                alt={`Photo ${index + 1}`}
                style={styles.photoImage as any}
              />
              <IconButton
                icon="close-circle"
                size={24}
                onPress={() => handleDelete(photoUrl)}
                style={styles.deleteButton}
                iconColor="#fff"
              />
            </View>
          ))}
        </View>
      )}

      {/* Info text */}
      <Text style={styles.infoText}>
        {photos.length} of {maxPhotos} photos
        {photos.length >= maxPhotos && ' (Limită atinsă)'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  cameraButton: {
    flex: 1,
  },
  uploadButton: {
    flex: 1,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.colors.surface.segmentTrack,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary.main,
    borderRadius: 4,
  },
  progressText: {
    marginTop: 8,
    textAlign: 'center',
    color: theme.colors.neutral[600],
    fontSize: 14,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  photoItem: {
    width: 150,
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: theme.colors.surface.cream,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  infoText: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12,
    color: theme.colors.neutral[600],
  },
});
