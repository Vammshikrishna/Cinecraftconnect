import React from 'react';
import { Text, StyleSheet, Linking, TextStyle, StyleProp } from 'react-native';

interface FormattedTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  hashtagStyle?: StyleProp<TextStyle>;
  mentionStyle?: StyleProp<TextStyle>;
  urlStyle?: StyleProp<TextStyle>;
  onPressHashtag?: (tag: string) => void;
  onPressMention?: (username: string) => void;
  onPressUrl?: (url: string) => void;
  numberOfLines?: number;
}

export const FormattedText: React.FC<FormattedTextProps> = ({
  text,
  style,
  hashtagStyle,
  mentionStyle,
  urlStyle,
  onPressHashtag,
  onPressMention,
  onPressUrl,
  numberOfLines,
}) => {
  if (!text) return null;

  // Split text by URLs, @mentions, and #hashtags
  const regex = /(https?:\/\/[^\s]+|@[a-zA-Z0-9_.-]+|#[a-zA-Z0-9_\u0080-\uFFFF-]+)/g;
  const parts = text.split(regex);

  return (
    <Text style={[styles.defaultText, style]} numberOfLines={numberOfLines}>
      {parts.map((part, index) => {
        if (!part) return null;

        // URL
        if (part.startsWith('http://') || part.startsWith('https://')) {
          return (
            <Text
              key={index}
              style={[styles.url, urlStyle]}
              onPress={() => {
                if (onPressUrl) {
                  onPressUrl(part);
                } else {
                  Linking.openURL(part).catch(() => {});
                }
              }}
            >
              {part}
            </Text>
          );
        }

        // Mention
        if (part.startsWith('@')) {
          const username = part.substring(1);
          return (
            <Text
              key={index}
              style={[styles.mention, mentionStyle]}
              onPress={() => {
                if (onPressMention) {
                  onPressMention(username);
                }
              }}
            >
              {part}
            </Text>
          );
        }

        // Hashtag
        if (part.startsWith('#')) {
          const tag = part.substring(1);
          return (
            <Text
              key={index}
              style={[styles.hashtag, hashtagStyle]}
              onPress={() => {
                if (onPressHashtag) {
                  onPressHashtag(tag);
                }
              }}
            >
              {part}
            </Text>
          );
        }

        return <Text key={index}>{part}</Text>;
      })}
    </Text>
  );
};

const styles = StyleSheet.create({
  defaultText: {
    color: '#1F2937',
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: 'Lora-Regular',
    fontWeight: '400',
  },
  hashtag: {
    color: '#FF4B33',
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
  },
  mention: {
    color: '#FF4B33',
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
  },
  url: {
    color: '#3B82F6',
    fontFamily: 'Lora-Medium',
    textDecorationLine: 'underline',
  },
});

export default FormattedText;
