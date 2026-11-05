import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { useUserSettings } from '../../hooks/useUserSettings';

/**
 * Anchored overflow ("three dots") dropdown.
 *
 * Usage 1, a trigger that owns its own menu (easiest, also fine inside list rows):
 *
 *   <DropdownTrigger items={() => [{ label: 'Report', icon: 'flag', destructive: true, onPress: report }]}
 *     accessibilityLabel="More options" style={styles.moreBtn}>
 *     <Icon name="more-horizontal" size={18} color={c} />
 *   </DropdownTrigger>
 *
 * Usage 2, hook, when the trigger is not a TouchableOpacity:
 *
 *   const menu = useDropdownMenu();
 *   <Pressable ref={menu.ref} onPress={menu.open}>...</Pressable>
 *   {menu.render(items)}
 *
 * Selecting an item closes the menu first and runs its onPress after the close animation, so a follow-up
 * dialog or modal never flashes on top of the dropdown. Items marked `async` run at once, show a spinner and
 * close when the promise settles.
 */

export interface DropdownItem {
  label: string;
  onPress: () => void | Promise<unknown>;
  icon?: string;
  destructive?: boolean;
  disabled?: boolean;
  /** run immediately, show a spinner while the returned promise is pending, then close */
  async?: boolean;
  /** thin section divider above this item (destructive items get one automatically after a non-destructive item) */
  separatorBefore?: boolean;
  /** skip the item (handy for inline conditions) */
  hidden?: boolean;
  accessibilityLabel?: string;
}

interface Rect { x: number; y: number; width: number; height: number }

const MARGIN = 8;
const GAP = 4;
const MIN_W = 190;
const MAX_W = 260;
const ITEM_H = 44;
const DANGER = '#EF4444';
// let the dropdown finish fading out before the follow-up action opens another dialog
const CLOSE_DELAY = 170;

export interface DropdownMenuProps {
  visible: boolean;
  anchor: Rect | null;
  items: DropdownItem[];
  onClose: () => void;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ visible, anchor, items, onClose }) => {
  const { themeColors, isDark } = useUserSettings();
  const insets = useSafeAreaInsets();
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [screen, setScreen] = useState<{ w: number; h: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const rootRef = useRef<View>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleItems = useMemo(() => items.filter((i) => !i.hidden), [items]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // fresh measurements on every open (the screen may have rotated or scrolled)
  useEffect(() => {
    if (visible) {
      setPendingKey(null);
      anim.setValue(0);
    }
  }, [visible, anchor, anim]);

  const measureRoot = useCallback((e?: LayoutChangeEvent) => {
    if (e) setScreen({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
    // the modal root can start above/below the window origin on Android (translucent status bar), so
    // compare it with the anchor's window coordinates instead of assuming they share an origin
    requestAnimationFrame(() => {
      rootRef.current?.measureInWindow((x, y) => setOrigin({ x: x || 0, y: y || 0 }));
    });
  }, []);

  const maxW = screen ? Math.min(MAX_W, Math.max(MIN_W, screen.w - 2 * MARGIN)) : MAX_W;

  const layout = useMemo(() => {
    if (!anchor || !screen || !origin || !size) return null;
    const ax = anchor.x - origin.x;
    const ay = anchor.y - origin.y;
    const W = screen.w;
    const H = screen.h;
    const minL = MARGIN + insets.left;
    const maxR = W - MARGIN - insets.right;
    const rightHalf = ax + anchor.width / 2 > W / 2;
    let left = rightHalf ? ax + anchor.width - size.w : ax;
    left = Math.max(minL, Math.min(left, Math.max(minL, maxR - size.w)));

    const minT = MARGIN + insets.top;
    const maxB = H - MARGIN - insets.bottom;
    const below = maxB - (ay + anchor.height + GAP);
    const above = ay - GAP - minT;
    let top: number;
    let openUp = false;
    if (size.h <= below) {
      top = ay + anchor.height + GAP;
    } else if (size.h <= above) {
      top = ay - GAP - size.h;
      openUp = true;
    } else if (above > below) {
      openUp = true;
      top = Math.max(minT, ay - GAP - size.h);
    } else {
      top = Math.min(ay + anchor.height + GAP, Math.max(minT, maxB - size.h));
    }
    top = Math.max(minT, Math.min(top, Math.max(minT, maxB - size.h)));
    // transform origin: the anchor centre, expressed relative to the menu centre
    const ox = ax + anchor.width / 2 - (left + size.w / 2);
    const oy = (openUp ? ay : ay + anchor.height) - (top + size.h / 2);
    return { left, top, ox, oy };
  }, [anchor, screen, origin, size, insets.left, insets.right, insets.top, insets.bottom]);

  useEffect(() => {
    if (visible && layout) {
      Animated.timing(anim, { toValue: 1, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [visible, !!layout, anim]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (item: DropdownItem, key: string) => {
    if (item.disabled || pendingKey) return;
    if (item.async) {
      setPendingKey(key);
      Promise.resolve()
        .then(() => item.onPress())
        .catch(() => {})
        .finally(() => { setPendingKey(null); onClose(); });
      return;
    }
    onClose();
    timer.current = setTimeout(() => { item.onPress(); }, CLOSE_DELAY);
  };

  const maxHeight = screen ? screen.h - insets.top - insets.bottom - 2 * MARGIN : undefined;
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  const tx = layout ? anim.interpolate({ inputRange: [0, 1], outputRange: [layout.ox * 0.1, 0] }) : 0;
  const ty = layout ? anim.interpolate({ inputRange: [0, 1], outputRange: [layout.oy * 0.1, 0] }) : 0;

  const cardBg = themeColors.bgCard || (isDark ? '#1F2937' : '#FFFFFF');
  const sep = themeColors.divider || themeColors.border;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <View ref={rootRef} style={StyleSheet.absoluteFill} onLayout={measureRoot} collapsable={false}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.10)' }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
        <Animated.View
          accessibilityRole={'menu' as any}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setSize((s) => (s && Math.abs(s.w - width) < 0.5 && Math.abs(s.h - height) < 0.5 ? s : { w: width, h: height }));
          }}
          style={[
            styles.card,
            {
              backgroundColor: cardBg,
              borderColor: themeColors.border,
              minWidth: Math.min(MIN_W, maxW),
              maxWidth: maxW,
              maxHeight,
              left: layout ? layout.left : 0,
              top: layout ? layout.top : 0,
              opacity: layout ? anim : 0,
              transform: [{ translateX: tx as any }, { translateY: ty as any }, { scale }],
            },
          ]}
        >
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {visibleItems.map((item, i) => {
              const key = `${i}-${item.label}`;
              const prev = visibleItems[i - 1];
              const divider = i > 0 && (item.separatorBefore || (item.destructive && prev && !prev.destructive));
              const color = item.destructive ? DANGER : themeColors.textPrimary;
              const busy = pendingKey === key;
              return (
                <View key={key}>
                  {i > 0 && <View style={[styles.sep, { backgroundColor: sep }, divider && styles.sepStrong]} />}
                  <TouchableOpacity
                    accessibilityRole={'menuitem' as any}
                    accessibilityLabel={item.accessibilityLabel || item.label}
                    accessibilityState={{ disabled: !!item.disabled, busy }}
                    disabled={item.disabled || !!pendingKey}
                    activeOpacity={0.6}
                    onPress={() => select(item, key)}
                    style={[styles.item, item.disabled && { opacity: 0.4 }]}
                  >
                    {item.icon ? (
                      <View style={styles.iconSlot}>
                        {busy ? <ActivityIndicator size="small" color={color} /> : <Icon name={item.icon} size={18} color={color} />}
                      </View>
                    ) : null}
                    <Text style={[styles.label, { color }]} numberOfLines={1}>{item.label}</Text>
                    {busy && !item.icon ? <ActivityIndicator size="small" color={color} /> : null}
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

type AnchorRef = React.RefObject<any>;

export function useDropdownMenu() {
  const ref = useRef<any>(null);
  const [state, setState] = useState<{ visible: boolean; anchor: Rect | null }>({ visible: false, anchor: null });

  const close = useCallback(() => setState((s) => ({ ...s, visible: false })), []);
  const open = useCallback(() => {
    const node = ref.current;
    if (!node || typeof node.measureInWindow !== 'function') return;
    node.measureInWindow((x: number, y: number, width: number, height: number) => {
      setState({ visible: true, anchor: { x, y, width, height } });
    });
  }, []);

  /** open next to a touch point (long-press on a row or message); pass the event's pageX / pageY */
  const openAt = useCallback((pageX: number, pageY: number) => {
    setState({ visible: true, anchor: { x: pageX - 4, y: pageY, width: 8, height: 28 } });
  }, []);

  const render = useCallback(
    (items: DropdownItem[]) => <DropdownMenu visible={state.visible} anchor={state.anchor} items={items} onClose={close} />,
    [state.visible, state.anchor, close],
  );

  return { ref: ref as AnchorRef, open, openAt, close, visible: state.visible, render };
}

export interface DropdownTriggerProps extends Omit<TouchableOpacityProps, 'onPress'> {
  /** array, or a function evaluated each time the menu opens (so it reads fresh state) */
  items: DropdownItem[] | (() => DropdownItem[]);
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  onOpen?: () => void;
}

export const DropdownTrigger: React.FC<DropdownTriggerProps> = ({ items, children, onOpen, accessibilityLabel, ...rest }) => {
  const menu = useDropdownMenu();
  const [current, setCurrent] = useState<DropdownItem[]>([]);
  const onPress = () => {
    setCurrent(typeof items === 'function' ? items() : items);
    onOpen?.();
    menu.open();
  };
  return (
    <>
      <TouchableOpacity
        ref={menu.ref}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || 'More options'}
        accessibilityHint="Opens a menu"
        accessibilityState={{ expanded: menu.visible }}
        activeOpacity={0.7}
        {...rest}
        onPress={onPress}
      >
        {children}
      </TouchableOpacity>
      {menu.render(current)}
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 12 },
      default: {},
    }),
  },
  item: {
    minHeight: ITEM_H,
    height: ITEM_H,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconSlot: { width: 20, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 14, fontFamily: 'WorkSans-Medium' },
  sep: { height: StyleSheet.hairlineWidth, opacity: 0.7 },
  sepStrong: { height: 6, opacity: 0.35 },
});
