import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { chatKeyFor, resolveChatParams } from '../../utils/chatParams';
import { MessagesListScreen } from './MessagesListScreen';
import { ConversationScreen } from './ConversationScreen';
import { Icon } from '../../components/common/Icon';
import { useResponsive } from '../../hooks/useResponsive';
import { useUserSettings } from '../../hooks/useUserSettings';
import { withTabletColumn } from '../../components/common/TabletContainer';

/** Width of the list of conversations on a wide tablet; the open chat gets the rest. */
const LIST_WIDTH = 380;
/** Below this the two panes would be cramped, so the list and the chat stay separate screens. */
const MIN_SPLIT_WIDTH = 840;

// on a small tablet the list is a centred column, as before
const ListOnly = withTabletColumn(MessagesListScreen, 720);

/**
 * Messages on a wide tablet: the conversations on the left, the open chat on the right (like WhatsApp Web or iPad Messages).
 * On a phone or a small tablet this is just the list, and opening a chat goes to the chat screen as it always did.
 */
export const MessagesSplitScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  const { width, isTablet } = useResponsive();
  const { themeColors } = useUserSettings();
  const [open, setOpen] = useState<any | null>(null);

  // the list asks to open a chat: show it on the right instead of leaving the screen
  const listNavigation = useMemo(
    () => ({
      ...navigation,
      navigate: (name: string, params?: any) => {
        if (name === 'Conversation') setOpen(params || {});
        else navigation.navigate(name, params);
      },
      push: (name: string, params?: any) => {
        if (name === 'Conversation') setOpen(params || {});
        else navigation.push?.(name, params);
      },
    }),
    [navigation]
  );

  // the chat's back button closes it (there is nothing to go back to on this screen)
  const chatNavigation = useMemo(
    () => ({
      ...navigation,
      canGoBack: () => true,
      goBack: () => setOpen(null),
      navigate: (name: string, params?: any) => {
        if (name === 'Messages') setOpen(null);
        else navigation.navigate(name, params);
      },
    }),
    [navigation]
  );

  const isSplit = isTablet && width >= MIN_SPLIT_WIDTH;

  // hardware Back closes the open chat pane first (same as the chat's own Back arrow)
  useFocusEffect(
    useCallback(() => {
      if (!isSplit || !open) return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setOpen(null);
        return true;
      });
      return () => sub.remove();
    }, [isSplit, open])
  );

  // another screen sent us here with a person to message (recipientId / partnerId / userId): open that chat in the pane
  const incoming = resolveChatParams(route?.params);
  const incomingId = incoming.partnerId || incoming.conversationId;
  const [handledIncoming, setHandledIncoming] = useState<string | null>(null);
  React.useEffect(() => {
    if (isSplit && incomingId && handledIncoming !== incomingId) {
      setHandledIncoming(incomingId);
      setOpen(incoming);
    }
  }, [isSplit, incomingId, handledIncoming, incoming]);

  if (!isSplit) {
    return <ListOnly navigation={navigation} route={route} />;
  }

  const chatKey = open ? chatKeyFor(open) : 'none';

  return (
    <View style={[styles.row, { backgroundColor: themeColors.bgScreen }]}>
      <View style={[styles.list, { borderRightColor: themeColors.border }]}>
        <MessagesListScreen navigation={listNavigation} route={{ params: undefined }} />
      </View>
      <View style={styles.chat}>
        {open ? (
          <ConversationScreen key={chatKey} navigation={chatNavigation} route={{ key: `conversation-${chatKey}`, name: 'Conversation', params: open }} />
        ) : (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
              <Icon name="message-circle" size={34} color={themeColors.iconMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>Your messages</Text>
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>Choose a conversation on the left, or start a new one.</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  list: { width: LIST_WIDTH, borderRightWidth: StyleSheet.hairlineWidth },
  chat: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 13, textAlign: 'center', maxWidth: 280 },
});

export default MessagesSplitScreen;
