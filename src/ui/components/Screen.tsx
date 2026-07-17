import { ReactNode } from 'react';
import { ScrollView, View, ViewStyle } from 'react-native';
import { Edge, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/ui/theme/useTheme';

import { Text } from './Text';

interface Props {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  edges?: Edge[];
}

/**
 * Standard page wrapper: safe-area background, optional large-title header,
 * and a scrolling (default) or static content area.
 */
export function Screen({
  children,
  title,
  subtitle,
  headerRight,
  scroll = true,
  contentStyle,
  edges = ['top', 'left', 'right'],
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const header = title ? (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.sm,
        paddingBottom: theme.spacing.md,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="largeTitle">{title}</Text>
        {subtitle ? (
          <Text variant="subhead" color="secondary" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {headerRight ? <View style={{ marginTop: 4 }}>{headerRight}</View> : null}
    </View>
  ) : null;

  const body = (
    <View
      style={[
        {
          paddingHorizontal: theme.spacing.xl,
          paddingBottom: theme.spacing.xxl + insets.bottom,
          flexGrow: 1,
        },
        // Non-scrolling mode hosts a child that needs a real bounded height
        // (e.g. a FlatList) rather than growing to fit its content. Without
        // an explicit minHeight, web flexbox lets flexGrow's basis default
        // to the content's own (unbounded) size, so a FlatList that keeps
        // rendering more cells to "fill" that ever-growing box never stops.
        !scroll && { flex: 1, minHeight: 0 },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={edges}>
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {header}
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {header}
          {body}
        </View>
      )}
    </SafeAreaView>
  );
}
