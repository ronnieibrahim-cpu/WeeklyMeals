import { useState } from 'react';
import { DimensionValue, Image, View } from 'react-native';

import { imageForRecipe } from '@/data/images';
import { Cuisine, Recipe } from '@/domain/models';
import { useTheme } from '@/ui/theme/useTheme';

import { Text } from './Text';

export const CUISINE_EMOJI: Record<Cuisine, string> = {
  Italian: '🍝',
  Mexican: '🌮',
  Greek: '🥙',
  Indian: '🍛',
  Thai: '🍜',
  Japanese: '🍱',
  Chinese: '🥡',
  French: '🥐',
  Mediterranean: '🫒',
  American: '🍔',
  MiddleEastern: '🧆',
  BBQ: '🍖',
};

interface Props {
  recipe: Recipe;
  height: number;
  width?: DimensionValue;
  emojiSize?: number;
  radius?: number;
}

/**
 * Recipe photo with a tinted emoji fallback shown while loading, on error, or
 * when images are disabled. The emoji sits behind; the photo covers it once loaded.
 */
export function RecipeImage({ recipe, height, width = '100%', emojiSize = 44, radius }: Props) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  const uri = imageForRecipe(recipe);

  return (
    <View
      style={{
        width,
        height,
        borderRadius: radius ?? theme.radius.md,
        backgroundColor: theme.colors.backgroundSecondary,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Text style={{ fontSize: emojiSize, lineHeight: emojiSize * 1.15 }}>
        {CUISINE_EMOJI[recipe.cuisine]}
      </Text>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
          style={{ position: 'absolute', width: '100%', height: '100%' }}
        />
      ) : null}
    </View>
  );
}
