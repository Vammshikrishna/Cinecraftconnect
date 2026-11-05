import React, { forwardRef, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { orTerm } from '../../utils/postgrest';
import { mentionLabel, type MentionUser } from '../../utils/mentions';
import { CachedImage } from './CachedImage';
import { useUserSettings } from '../../hooks/useUserSettings';

interface Props extends Omit<TextInputProps, 'onChangeText' | 'value'> {
  value: string;
  onChangeText: (text: string) => void;
  onMentionSelected?: (user: MentionUser) => void;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Text box with @mention suggestions (port of web mention-textarea + useMentionSuggestions).
 * Type "@" at the start of a word plus 2+ letters to see up to 5 matching people; people you blocked are left out.
 */
export const MentionInput = forwardRef<TextInput, Props>(
  ({ value, onChangeText, onMentionSelected, containerStyle, onSelectionChange, ...rest }, ref) => {
    const { themeColors } = useUserSettings();
    const [cursor, setCursor] = useState(0);
    const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
    const blockedRef = useRef<Set<string> | null>(null);
    const meRef = useRef<string | null>(null);

    // the open "@word" just before the cursor, or null
    const active = (() => {
      const before = value.substring(0, cursor);
      const at = before.lastIndexOf('@');
      if (at === -1) return null;
      const query = before.substring(at + 1);
      const charBefore = at > 0 ? before[at - 1] : '';
      if (/\s/.test(query) || !(charBefore === '' || charBefore === ' ' || charBefore === '\n')) return null;
      return { at, query };
    })();
    const query = active?.query ?? '';

    useEffect(() => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }
      let cancelled = false;
      const t = setTimeout(async () => {
        try {
          const supabase = getSupabaseClient() as any;
          if (blockedRef.current === null) {
            blockedRef.current = new Set();
            try {
              const { data: sess } = await supabase.auth.getSession();
              const me = sess?.session?.user?.id;
              meRef.current = me || null;
              if (me) {
                const { data: b } = await supabase.from('blocked_users').select('blocked_user_id').eq('user_id', me);
                blockedRef.current = new Set((b || []).map((x: any) => x.blocked_user_id));
              }
            } catch {}
          }
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url')
            .or(`full_name.ilike.%${orTerm(query)}%,username.ilike.%${orTerm(query)}%`)
            .limit(8);
          if (cancelled) return;
          const blocked = blockedRef.current || new Set<string>();
          setSuggestions(((data || []) as MentionUser[]).filter((u) => u.id !== meRef.current && !blocked.has(u.id)).slice(0, 5));
        } catch {
          if (!cancelled) setSuggestions([]);
        }
      }, 250);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }, [query]);

    const pick = (u: MentionUser) => {
      if (!active) return;
      const label = mentionLabel(u);
      const next = value.substring(0, active.at) + `@${label} ` + value.substring(cursor);
      onChangeText(next);
      setCursor(active.at + label.length + 2);
      setSuggestions([]);
      onMentionSelected?.(u);
    };

    const handleSelection = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      setCursor(e.nativeEvent.selection.start);
      onSelectionChange?.(e);
    };

    const show = !!active && suggestions.length > 0;

    return (
      <View style={containerStyle}>
        <TextInput
          {...rest}
          ref={ref}
          value={value}
          onChangeText={(t) => {
            onChangeText(t);
            // typing at the end: the selection event can lag behind, so follow the text length when it grew
            if (t.length > value.length && cursor >= value.length) setCursor(t.length);
          }}
          onSelectionChange={handleSelection}
        />
        {show && (
          <View style={[styles.list, { backgroundColor: themeColors.bgElevated, borderColor: themeColors.border }]}>
            {suggestions.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={styles.row}
                onPress={() => pick(u)}
                accessibilityRole="button"
                accessibilityLabel={`Mention ${u.full_name || u.username}`}
              >
                {u.avatar_url ? (
                  <CachedImage uri={u.avatar_url} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: themeColors.border, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: themeColors.textSecondary, fontWeight: '700' }}>{(u.full_name || u.username || '?')[0]}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: themeColors.textPrimary, fontWeight: '600', fontSize: 14 }}>
                    {u.full_name || u.username}
                  </Text>
                  {u.username ? (
                    <Text numberOfLines={1} style={{ color: themeColors.textSecondary, fontSize: 12 }}>
                      @{u.username}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  },
);

MentionInput.displayName = 'MentionInput';

const styles = StyleSheet.create({
  list: { borderWidth: 1, borderRadius: 12, marginTop: 4, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8, minHeight: 44 },
  avatar: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden' },
});

export default MentionInput;
