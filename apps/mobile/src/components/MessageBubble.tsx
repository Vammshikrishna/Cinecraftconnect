import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface MessageBubbleProps {
  content: string;
  isSelf: boolean;
  timestamp?: string;
  isEncrypted?: boolean;
  senderName?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  content,
  isSelf,
  timestamp,
  isEncrypted = true,
  senderName,
}) => {
  return (
    <View style={[styles.container, isSelf ? styles.selfContainer : styles.otherContainer]}>
      {!isSelf && senderName && (
        <Text style={styles.senderName}>{senderName}</Text>
      )}
      <View
        style={[
          styles.bubble,
          isSelf ? styles.selfBubble : styles.otherBubble,
        ]}
      >
        <Text style={[styles.text, isSelf ? styles.selfText : styles.otherText]}>
          {content}
        </Text>
        <View style={styles.footer}>
          {isEncrypted && (
            <Text style={styles.lockIcon}>🔒</Text>
          )}
          {timestamp && (
            <Text style={[styles.timestamp, isSelf ? styles.selfTimestamp : styles.otherTimestamp]}>
              {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: theme.spacing.md,
    maxWidth: '80%',
  },
  selfContainer: {
    alignSelf: 'flex-end',
  },
  otherContainer: {
    alignSelf: 'flex-start',
  },
  senderName: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.xs,
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.lg,
  },
  selfBubble: {
    backgroundColor: theme.colors.accent.primary,
    borderBottomRightRadius: 2,
  },
  otherBubble: {
    backgroundColor: theme.colors.background.surface,
    borderBottomLeftRadius: 2,
    borderColor: theme.colors.border.subtle,
    borderWidth: 1,
  },
  text: {
    fontSize: theme.typography.fontSize.md,
    lineHeight: 20,
  },
  selfText: {
    color: '#FFFFFF',
  },
  otherText: {
    color: theme.colors.text.primary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  lockIcon: {
    fontSize: 10,
  },
  timestamp: {
    fontSize: 10,
  },
  selfTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherTimestamp: {
    color: theme.colors.text.muted,
  },
});
