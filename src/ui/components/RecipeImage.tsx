import { useState } from 'react';
import { DimensionValue, Image, View } from 'react-native';

import { CUISINE_TILE_COLORS, imageForRecipe } from '@/data/images';
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
  Other: '🌍',
};

interface Props {
  recipe: Recipe;
  height: number;
  width?: DimensionValue;
  emojiSize?: number;
  radius?: number;
}

/**
 * Recipe artwork. By default this is a clean, deterministic two-tone tile keyed
 * to the recipe's cuisine (see CUISINE_TILE_COLORS) with the cuisine emoji on a
 * soft translucent disc — it always looks intentional and needs no network. If
 * real photos are enabled (RECIPE_IMAGES_ENABLED), the photo covers the tile
 * once loaded and falls back to the tile on error.
 */
export function RecipeImage({ recipe, height, width = '100%', emojiSize = 44, radius }: Props) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  const uri = imageForRecipe(recipe);
  const [top, bottom] = CUISINE_TILE_COLORS[recipe.cuisine] ?? ['#7C8AA5', '#5B6B86'];
  const disc = Math.round(emojiSize * 1.55);

  return (
    <View
      style={{
        width,
        height,
        borderRadius: radius ?? theme.radius.md,
        backgroundColor: top,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Soft lower wash for a subtle two-tone gradient feel (no extra deps). */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '55%',
          backgroundColor: bottom,
          opacity: 0.85,
        }}
      />
      {/* Translucent disc so the emoji reads as an intentional badge. */}
      <View
        style={{
          width: disc,
          height: disc,
          borderRadius: disc / 2,
          backgroundColor: 'rgba(255,255,255,0.22)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: emojiSize, lineHeight: emojiSize * 1.15 }}>
          {CUISINE_EMOJI[recipe.cuisine]}
        </Text>
      </View>
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
