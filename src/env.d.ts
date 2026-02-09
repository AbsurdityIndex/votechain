/// <reference types="astro/client" />

export {};

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: Element | string,
        params: {
          sitekey: string;
          callback?: (token: string) => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
    };

    votechainPocTurnstileCallback?: (token: string) => Promise<void> | void;
  }
}

