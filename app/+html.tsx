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
        {/*
          iOS "Add to Home Screen" apps report the wrong window.innerHeight at
          launch (a known WebKit bug in standalone display mode), so the
          `height: 100%` chain from ScrollViewStyleReset renders with blank
          margins top/bottom until something forces a relayout (e.g. focusing
          a text input pops the keyboard, which happens to trigger it). This
          measures the real viewport with visualViewport and feeds it back in
          as a CSS var so every tab is sized correctly from the first paint.
        */}
        <style
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `html,body,#root{height:100%;height:var(--app-height,100%)}`,
          }}
        />
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `(function(){function setAppHeight(){var h=(window.visualViewport&&window.visualViewport.height)||window.innerHeight;document.documentElement.style.setProperty('--app-height',h+'px');}setAppHeight();window.addEventListener('resize',setAppHeight);window.addEventListener('orientationchange',setAppHeight);if(window.visualViewport){window.visualViewport.addEventListener('resize',setAppHeight);}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
