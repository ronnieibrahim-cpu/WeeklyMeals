import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Custom HTML shell for the web build. Crucially sets `viewport-fit=cover` so
 * CSS safe-area env() values (and react-native-safe-area-context) are non-zero
 * on iOS — otherwise bottom buttons / tab icons sit under the home indicator.
 * Also enables standalone "Add to Home Screen" so it runs full-screen like an app.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Weekly Meals" />
        <meta name="theme-color" content="#FFFFFF" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
