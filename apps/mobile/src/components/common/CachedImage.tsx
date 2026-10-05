import React, { useState } from 'react';
import {
  Image,
  ImageProps,
  StyleSheet,
  View,
  ActivityIndicator,
  StyleProp,
  ImageStyle,
  ImageSourcePropType,
} from 'react-native';
import FastImage from 'react-native-fast-image';

export interface CachedImageProps extends Omit<ImageProps, 'source'> {
  uri?: string | null;
  source?: ImageSourcePropType | { uri?: string } | any;
  fallbackSource?: any;
  style?: StyleProp<ImageStyle>;
  showLoading?: boolean;
  priority?: 'low' | 'normal' | 'high';
  headers?: Record<string, string>;
}

/**
 * Lightweight, direct CachedImage component
 * Direct FastImage rendering without duplicate layout containers.
 */
export const CachedImage: React.FC<CachedImageProps> = React.memo(({
  uri: uriProp,
  source: sourceProp,
  fallbackSource,
  style,
  showLoading = false,
  resizeMode = 'cover',
  priority = 'normal',
  ...props
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [fastImageFailed, setFastImageFailed] = useState(false);

  // Extract URI either from uri prop or source prop
  const uri = uriProp || (sourceProp && typeof sourceProp === 'object' && 'uri' in sourceProp ? sourceProp.uri : null);

  // Reset errors when URI changes
  React.useEffect(() => {
    setError(false);
    setFastImageFailed(false);
  }, [uri]);

  const isValidUri = typeof uri === 'string' && uri.trim().length > 0 && !error;

  const fastPriority =
    priority === 'high'
      ? FastImage.priority.high
      : priority === 'low'
      ? FastImage.priority.low
      : FastImage.priority.normal;

  const fastResizeMode =
    resizeMode === 'contain'
      ? FastImage.resizeMode.contain
      : resizeMode === 'stretch'
      ? FastImage.resizeMode.stretch
      : resizeMode === 'center'
      ? FastImage.resizeMode.center
      : FastImage.resizeMode.cover;

  if (isValidUri && !fastImageFailed) {
    return (
      <View style={[{ overflow: 'hidden' }, style]}>
        <FastImage
          {...(props as any)}
          source={{
            uri: uri.trim(),
            priority: fastPriority,
            headers: (props as any).headers,
          }}
          style={StyleSheet.absoluteFill}
          resizeMode={fastResizeMode}
          onLoadStart={() => {
            if (showLoading) setLoading(true);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setFastImageFailed(true);
            setLoading(false);
          }}
        />
        {loading && showLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#94A3B8" />
          </View>
        )}
      </View>
    );
  }

  // Resilient fallback to native React Native Image if FastImage fails
  if (isValidUri && fastImageFailed) {
    return (
      <Image
        {...props}
        source={{ uri: uri.trim() }}
        style={[{ overflow: 'hidden' }, style]}
        resizeMode={resizeMode}
        onError={() => setError(true)}
      />
    );
  }

  if (sourceProp && !isValidUri && !error) {
    return (
      <Image
        {...props}
        source={sourceProp}
        style={[{ overflow: 'hidden' }, style]}
        resizeMode={resizeMode}
      />
    );
  }

  if (fallbackSource) {
    return (
      <Image
        {...props}
        source={fallbackSource}
        style={[{ overflow: 'hidden' }, style]}
        resizeMode={resizeMode}
      />
    );
  }

  return <View style={[{ overflow: 'hidden' }, style]} />;
});

CachedImage.displayName = 'CachedImage';

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
