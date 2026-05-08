import {useEffect, useState} from 'react';
import {Appearance, ColorSchemeName} from 'react-native';

export {
  darkTokens,
  lightTokens,
  themes,
  tokenMeta,
} from './tokens.generated';
export type {CloudSeaThemeName, CloudSeaTokens} from './tokens.generated';

import {darkTokens, lightTokens} from './tokens.generated';

/** Returns the RN token set for the current system color scheme, defaulting to dark. */
export function getTokensForScheme(scheme?: ColorSchemeName) {
  return scheme === 'light' ? lightTokens : darkTokens;
}

/** React hook that tracks Appearance and returns CloudSea RN tokens, defaulting to dark. */
export function useTokens() {
  const [scheme, setScheme] = useState<ColorSchemeName>(() => Appearance.getColorScheme());

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({colorScheme}) => {
      setScheme(colorScheme);
    });

    return () => subscription.remove();
  }, []);

  return getTokensForScheme(scheme);
}
