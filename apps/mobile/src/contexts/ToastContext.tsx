import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  PanResponder,
  Vibration,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
  Alert as RNAlert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Polyline, Line, Polygon } from 'react-native-svg';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastOptions {
  id?: string;
  title?: string;
  message?: string;
  type?: ToastType;
  duration?: number; // ms, default 3200
  action?: ToastAction;
  onDismiss?: () => void;
  haptic?: boolean;
}

export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertOptions {
  title?: string;
  message?: string;
  buttons?: AlertButton[];
  cancelable?: boolean;
}

interface ToastContextValue {
  showToast: (options: ToastOptions | string, message?: string, type?: ToastType) => void;
  hideToast: () => void;
  showAlert: (title: string, message?: string, buttons?: AlertButton[], options?: { cancelable?: boolean }) => void;
  hideAlert: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Global imperative reference holder for non-React callers
let globalShowToast: ((options: ToastOptions | string, message?: string, type?: ToastType) => void) | null = null;
let globalShowAlert: ((title: string, message?: string, buttons?: AlertButton[], options?: { cancelable?: boolean }) => void) | null = null;

export const showToast = (options: ToastOptions | string, message?: string, type?: ToastType) => {
  if (globalShowToast) {
    globalShowToast(options, message, type);
  }
};

export const showCineAlert = (title: string, message?: string, buttons?: AlertButton[], options?: { cancelable?: boolean }) => {
  if (globalShowAlert) {
    globalShowAlert(title, message, buttons, options);
  } else {
    RNAlert.alert(title, message, buttons as any, options);
  }
};

export const Toast = {
  show: (options: ToastOptions | string, message?: string, type?: ToastType) => showToast(options, message, type),
  success: (title: string, message?: string, options?: Partial<ToastOptions>) =>
    showToast({ ...options, title, message, type: 'success' }),
  error: (title: string, message?: string, options?: Partial<ToastOptions>) =>
    showToast({ ...options, title, message, type: 'error' }),
  warning: (title: string, message?: string, options?: Partial<ToastOptions>) =>
    showToast({ ...options, title, message, type: 'warning' }),
  info: (title: string, message?: string, options?: Partial<ToastOptions>) =>
    showToast({ ...options, title, message, type: 'info' }),
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      showToast,
      hideToast: () => {},
      showAlert: showCineAlert,
      hideAlert: () => {},
      Toast,
    };
  }
  return { ...context, Toast };
};

// ── Smart Type Inferrer for Alert.alert monkey patch ──────────────────────────
const inferToastType = (title?: string, message?: string): ToastType => {
  const combined = `${title || ''} ${message || ''}`.toLowerCase();
  
  if (
    combined.includes('error') ||
    combined.includes('failed') ||
    combined.includes('denied') ||
    combined.includes('mismatch') ||
    combined.includes('banned') ||
    combined.includes('invalid') ||
    combined.includes('cannot') ||
    combined.includes('could not') ||
    combined.includes('missing') ||
    combined.includes('required')
  ) {
    return 'error';
  }

  if (
    combined.includes('warn') ||
    combined.includes('caution') ||
    combined.includes('offline') ||
    combined.includes('unavailable') ||
    combined.includes('not ready') ||
    combined.includes('already')
  ) {
    return 'warning';
  }

  if (
    combined.includes('success') ||
    combined.includes('saved') ||
    combined.includes('updated') ||
    combined.includes('cleared') ||
    combined.includes('purged') ||
    combined.includes('freed') ||
    combined.includes('copied') ||
    combined.includes('published') ||
    combined.includes('connected') ||
    combined.includes('bookmarked') ||
    combined.includes('created') ||
    combined.includes('submitted') ||
    combined.includes('helpful') ||
    combined.includes('erased') ||
    combined.includes('deleted') ||
    combined.includes('done') ||
    combined.includes('✨') ||
    combined.includes('✅') ||
    combined.includes('🔐') ||
    combined.includes('★') ||
    combined.includes('👍') ||
    combined.includes('🔖') ||
    combined.includes('🧹')
  ) {
    return 'success';
  }

  return 'info';
};

// ── Install Universal Alert.alert Interceptor ─────────────────────────────────
let isAlertPatched = false;
export const installAlertInterceptor = () => {
  if (isAlertPatched) return;
  isAlertPatched = true;

  const originalAlert = RNAlert.alert.bind(RNAlert);

  // @ts-ignore
  RNAlert.alert = (title: string, message?: string, buttons?: AlertButton[], options?: any) => {
    // If there are no buttons or just 1 simple button (e.g. OK/Dismiss)
    if (!buttons || buttons.length === 0 || (buttons.length === 1 && !buttons[0].onPress)) {
      const type = inferToastType(title, message);
      showToast({
        title,
        message,
        type,
        duration: 3200,
      });
      return;
    }

    if (buttons.length === 1 && buttons[0].onPress) {
      const singleBtn = buttons[0];
      const type = inferToastType(title, message);
      showToast({
        title,
        message,
        type,
        duration: 3500,
        action: singleBtn.text && singleBtn.text.toLowerCase() !== 'ok'
          ? {
              label: singleBtn.text,
              onPress: () => singleBtn.onPress?.(),
            }
          : undefined,
        onDismiss: () => singleBtn.onPress?.(),
      });
      return;
    }

    // 2 or more buttons -> Multi-choice confirmation dialog modal
    if (globalShowAlert) {
      globalShowAlert(title, message, buttons, options);
    } else {
      originalAlert(title, message, buttons as any, options);
    }
  };
};

// ── Toast Icon Component ──────────────────────────────────────────────────────
const ToastIcon: React.FC<{ type: ToastType }> = ({ type }) => {
  switch (type) {
    case 'success':
      return (
        <View style={[styles.iconWrapper, { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: 'rgba(16, 185, 129, 0.4)' }]}>
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
            <Polyline points="20 6 9 17 4 12" />
          </Svg>
        </View>
      );
    case 'error':
      return (
        <View style={[styles.iconWrapper, { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.4)' }]}>
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
            <Circle cx={12} cy={12} r={10} />
            <Line x1={15} y1={9} x2={9} y2={15} />
            <Line x1={9} y1={9} x2={15} y2={15} />
          </Svg>
        </View>
      );
    case 'warning':
      return (
        <View style={[styles.iconWrapper, { backgroundColor: 'rgba(245, 158, 11, 0.2)', borderColor: 'rgba(245, 158, 11, 0.4)' }]}>
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
            <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <Line x1={12} y1={9} x2={12} y2={13} />
            <Line x1={12} y1={17} x2={12.01} y2={17} />
          </Svg>
        </View>
      );
    case 'info':
    default:
      return (
        <View style={[styles.iconWrapper, { backgroundColor: 'rgba(255, 75, 51, 0.2)', borderColor: 'rgba(255, 75, 51, 0.4)' }]}>
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#FF4B33" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
            <Circle cx={12} cy={12} r={10} />
            <Line x1={12} y1={16} x2={12} y2={12} />
            <Line x1={12} y1={8} x2={12.01} y2={8} />
          </Svg>
        </View>
      );
  }
};

// ── Toast Provider & Android-Styled Pill Toast ────────────────────────────────
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentToast, setCurrentToast] = useState<ToastOptions | null>(null);
  const [currentAlert, setCurrentAlert] = useState<AlertOptions | null>(null);
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(50)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const dismissToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 35,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.92,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (currentToast?.onDismiss) {
        currentToast.onDismiss();
      }
      setCurrentToast(null);
    });
  }, [translateY, opacity, scale, currentToast]);

  const displayToast = useCallback(
    (options: ToastOptions | string, message?: string, type: ToastType = 'info') => {
      let opts: ToastOptions;
      if (typeof options === 'string') {
        opts = {
          title: options,
          message: message || '',
          type: type || 'info',
        };
      } else {
        opts = {
          ...options,
          title: options.title || '',
          message: options.message || message || '',
          type: options.type || type || 'info',
        };
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Micro haptic vibration
      if (opts.haptic !== false) {
        try {
          Vibration.vibrate(20);
        } catch {}
      }

      setCurrentToast(opts);

      // Reset animation values for bottom slide-up
      translateY.setValue(50);
      opacity.setValue(0);
      scale.setValue(0.92);

      const duration = opts.duration || 3200;

      // Enter animation: Spring slide-up from bottom
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 75,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 8,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss timer
      timerRef.current = setTimeout(() => {
        dismissToast();
      }, duration);
    },
    [translateY, opacity, scale, dismissToast]
  );

  const displayAlert = useCallback(
    (title: string, message?: string, buttons?: AlertButton[], options?: { cancelable?: boolean }) => {
      try {
        Vibration.vibrate(30);
      } catch {}
      setCurrentAlert({
        title,
        message,
        buttons: buttons || [{ text: 'OK', style: 'default' }],
        cancelable: options?.cancelable ?? true,
      });
    },
    []
  );

  const dismissAlert = useCallback(() => {
    setCurrentAlert(null);
  }, []);

  useEffect(() => {
    globalShowToast = displayToast;
    globalShowAlert = displayAlert;
    installAlertInterceptor();

    return () => {
      globalShowToast = null;
      globalShowAlert = null;
    };
  }, [displayToast, displayAlert]);

  // Gesture responder to swipe down toast to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 4,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 15 || gestureState.vy > 0.4) {
          dismissToast();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            friction: 8,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Bottom inset safe positioning (above tab bar / bottom navigation)
  const bottomInset = Math.max(insets.bottom + 65, 75);

  const getTypeAccentColor = (type?: ToastType) => {
    switch (type) {
      case 'success':
        return '#10B981';
      case 'error':
        return '#EF4444';
      case 'warning':
        return '#F59E0B';
      case 'info':
      default:
        return '#FF4B33';
    }
  };

  const accentColor = getTypeAccentColor(currentToast?.type);

  // Combine title and message cleanly if title is short or message is primary
  const hasTitle = Boolean(currentToast?.title?.trim());
  const hasMessage = Boolean(currentToast?.message?.trim());

  return (
    <ToastContext.Provider
      value={{
        showToast: displayToast,
        hideToast: dismissToast,
        showAlert: displayAlert,
        hideAlert: dismissAlert,
      }}
    >
      {children}

      {/* ── CINECRAFT NEAT ANDROID-STYLE PILL TOAST OVERLAY (ON TOP OF ALL MODALS) ── */}
      {Boolean(currentToast) && (
        <Modal
          visible={Boolean(currentToast)}
          transparent={true}
          statusBarTranslucent={true}
          animationType="none"
          onRequestClose={dismissToast}
        >
          <View style={styles.modalToastContainer} pointerEvents="box-none">
            <Animated.View
              style={[
                styles.toastWrapper,
                {
                  bottom: bottomInset,
                  transform: [{ translateY }, { scale }],
                  opacity,
                },
              ]}
              {...panResponder.panHandlers}
            >
              <TouchableOpacity
                style={[
                  styles.toastPill,
                  {
                    borderColor: `${accentColor}40`,
                  },
                ]}
                activeOpacity={0.85}
                onPress={dismissToast}
              >
                {/* Left compact icon */}
                <View style={styles.iconContainer}>
                  <ToastIcon type={currentToast?.type || 'info'} />
                </View>

                {/* Content Text */}
                <View style={styles.contentContainer}>
                  {hasTitle && (
                    <Text style={styles.titleText} numberOfLines={2}>
                      {currentToast?.title}
                    </Text>
                  )}
                  {hasMessage && (
                    <Text style={styles.messageText} numberOfLines={2}>
                      {currentToast?.message}
                    </Text>
                  )}
                </View>

                {/* Optional Action Button */}
                {currentToast?.action && (
                  <TouchableOpacity
                    style={[styles.pillActionBtn, { backgroundColor: `${accentColor}20`, borderColor: `${accentColor}45` }]}
                    onPress={() => {
                      currentToast?.action?.onPress();
                      dismissToast();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillActionText, { color: accentColor }]}>
                      {currentToast?.action?.label}
                    </Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* ── CINECRAFT CUSTOM MULTI-BUTTON CONFIRMATION MODAL ── */}
      {currentAlert && (
        <Modal
          visible={Boolean(currentAlert)}
          transparent
          statusBarTranslucent
          animationType="fade"
          onRequestClose={() => {
            if (currentAlert.cancelable) dismissAlert();
          }}
        >
          <TouchableWithoutFeedback onPress={() => (currentAlert.cancelable ? dismissAlert() : null)}>
            <View style={styles.modalBackdrop}>
              <TouchableWithoutFeedback>
                <View style={styles.alertCard}>
                  {/* Glowing header badge */}
                  <View style={styles.alertIconBadge}>
                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#FF4B33" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                      <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </Svg>
                  </View>

                  {/* Title & Message */}
                  {Boolean(currentAlert.title) && (
                    <Text style={styles.alertTitle}>{currentAlert.title}</Text>
                  )}
                  {Boolean(currentAlert.message) && (
                    <Text style={styles.alertMessage}>{currentAlert.message}</Text>
                  )}

                  {/* Buttons */}
                  <View style={styles.alertButtonContainer}>
                    {currentAlert.buttons?.map((btn, index) => {
                      const isDestructive = btn.style === 'destructive';
                      const isCancel = btn.style === 'cancel';
                      const isPrimary = !isDestructive && !isCancel;

                      return (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.dialogBtn,
                            isPrimary && styles.dialogBtnPrimary,
                            isDestructive && styles.dialogBtnDestructive,
                            isCancel && styles.dialogBtnCancel,
                          ]}
                          activeOpacity={0.75}
                          onPress={() => {
                            dismissAlert();
                            btn.onPress?.();
                          }}
                        >
                          <Text
                            style={[
                              styles.dialogBtnText,
                              isPrimary && styles.dialogBtnTextPrimary,
                              isDestructive && styles.dialogBtnTextDestructive,
                              isCancel && styles.dialogBtnTextCancel,
                            ]}
                          >
                            {btn.text || 'OK'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </ToastContext.Provider>
  );
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  modalToastContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  // ── Android-style Pill Toast Container ──
  toastWrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 999999,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
  },
  toastPill: {
    maxWidth: Math.min(SCREEN_WIDTH - 40, 360),
    minHeight: 40,
    backgroundColor: '#16161A',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  iconContainer: {
    marginRight: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flexShrink: 1,
    justifyContent: 'center',
  },
  titleText: {
    color: '#F9FAFB',
    fontSize: 13,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  messageText: {
    color: '#9CA3AF',
    fontSize: 11.5,
    fontFamily: 'Lora-Regular',
    lineHeight: 15,
    marginTop: 1,
  },
  pillActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginLeft: 10,
  },
  pillActionText: {
    fontSize: 11,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Custom CineCraft Confirmation Modal Styles ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertCard: {
    width: Math.min(SCREEN_WIDTH - 48, 380),
    backgroundColor: '#18181C',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2D2D35',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 20,
  },
  alertIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 75, 51, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 51, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 18,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 13.5,
    fontFamily: 'Lora-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  alertButtonContainer: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  dialogBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogBtnPrimary: {
    backgroundColor: '#FF4B33',
  },
  dialogBtnDestructive: {
    backgroundColor: '#DC2626',
  },
  dialogBtnCancel: {
    backgroundColor: '#26262C',
    borderWidth: 1,
    borderColor: '#383842',
  },
  dialogBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    fontFamily: 'Lora-Bold',
  },
  dialogBtnTextPrimary: {
    color: '#FFFFFF',
  },
  dialogBtnTextDestructive: {
    color: '#FFFFFF',
  },
  dialogBtnTextCancel: {
    color: '#D1D5DB',
  },
});

export default ToastProvider;
