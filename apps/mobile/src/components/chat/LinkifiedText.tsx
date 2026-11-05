import React from 'react';
import { Text, Linking, StyleProp, TextStyle } from 'react-native';

const URL_RE = /(https?:\/\/[^\s<>"']+)/gi;
const TRAILING = /[.,;:!?)\]}]+$/;

/** Chat text where http(s) links are tappable. Only http(s) is ever opened; anything else shows as typed. Renders nested Text, so the parent Text's style and long-press keep working. */
export const LinkifiedText = ({ text, linkStyle }: { text: string; linkStyle?: StyleProp<TextStyle> }) => {
  const parts = text.split(URL_RE);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part ? <React.Fragment key={i}>{part}</React.Fragment> : null;
        const trail = (part.match(TRAILING) || [''])[0];
        const url = trail ? part.slice(0, -trail.length) : part;
        return (
          <React.Fragment key={i}>
            <Text
              style={[{ textDecorationLine: 'underline' }, linkStyle]}
              onPress={() => {
                if (/^https?:\/\//i.test(url)) Linking.openURL(url).catch(() => {});
              }}
            >
              {url}
            </Text>
            {trail}
          </React.Fragment>
        );
      })}
    </>
  );
};

export default LinkifiedText;
