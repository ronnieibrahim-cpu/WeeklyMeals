import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useTheme } from '@/ui/theme/useTheme';

import { Text } from './Text';

interface Props {
  values: string[];
  suggestions: string[];
  onAdd: (item: string) => void;
  onRemove: (item: string) => void;
  placeholder?: string;
  maxSuggestions?: number;
}

/**
 * Fast ingredient entry: type to filter a dictionary, tap to add as a tag, or add
 * a custom item the dictionary doesn't know. Existing tags are removable chips.
 */
export function AutocompleteTagInput({
  values,
  suggestions,
  onAdd,
  onRemove,
  placeholder = 'Add an ingredient…',
  maxSuggestions = 6,
}: Props) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const has = (item: string) => values.some((v) => v.toLowerCase() === item.toLowerCase());

  const filtered = useMemo(() => {
    if (!q) return [];
    const matches = suggestions.filter((s) => s.includes(q) && !has(s));
    matches.sort((a, b) => Number(b.startsWith(q)) - Number(a.startsWith(q)));
    return matches.slice(0, maxSuggestions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, suggestions, values, maxSuggestions]);

  const showCustomAdd = q.length > 0 && !has(q) && !suggestions.some((s) => s === q);

  const add = (item: string) => {
    const value = item.trim();
    if (!value) return;
    onAdd(value);
    setQuery('');
  };

  return (
    <View>
      {values.length > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
            marginBottom: theme.spacing.md,
          }}
        >
          {values.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${value}`}
              onPress={() => onRemove(value)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingVertical: theme.spacing.xs,
                paddingLeft: theme.spacing.md,
                paddingRight: theme.spacing.sm,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.accentMuted,
              }}
            >
              <Text variant="subhead" color="accent">
                {value}
              </Text>
              <Ionicons name="close-circle" size={16} color={theme.colors.accent} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: theme.colors.card,
        }}
      >
        <Ionicons name="search" size={18} color={theme.colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => add(query)}
          style={{
            flex: 1,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.sm,
            fontSize: 17,
            color: theme.colors.text,
          }}
        />
      </View>

      {filtered.length > 0 || showCustomAdd ? (
        <View
          style={{
            marginTop: theme.spacing.sm,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
            overflow: 'hidden',
          }}
        >
          {filtered.map((item, i) => (
            <Pressable
              key={item}
              onPress={() => add(item)}
              style={{
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: theme.colors.separator,
              }}
            >
              <Text variant="body">{item}</Text>
            </Pressable>
          ))}
          {showCustomAdd ? (
            <Pressable
              onPress={() => add(query)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.md,
                borderTopWidth: filtered.length === 0 ? 0 : 1,
                borderTopColor: theme.colors.separator,
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color={theme.colors.accent} />
              <Text variant="body" color="accent">
                Add “{query.trim()}”
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
