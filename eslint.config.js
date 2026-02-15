import js from '@eslint/js';

export default [
  {
    ignores: ['js/vendor/**', 'assets/vendor/**', 'node_modules/**', 'coverage/**', '_site/**'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        Image: 'readonly',
        HTMLElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        Event: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        Uint8Array: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        Intl: 'readonly',
        screen: 'readonly',
        matchMedia: 'readonly',
        performance: 'readonly',
        CustomEvent: 'readonly',
        queueMicrotask: 'readonly',
        structuredClone: 'readonly',
        module: 'readonly',
        Object: 'readonly',
        Array: 'readonly',
        Number: 'readonly',
        String: 'readonly',
        Math: 'readonly',
        Date: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        Promise: 'readonly',
        RegExp: 'readonly',
        Error: 'readonly',
        JSON: 'readonly',
        isNaN: 'readonly',
        parseInt: 'readonly',
        parseFloat: 'readonly',

        // Cross-module globals used in the project
        hijriConverter: 'writable',
        escapeHtml: 'writable',
        formatNumberArabic: 'writable',
        formatAmountArabic: 'writable',
        parseAmount: 'writable',
        clampInt: 'writable',
        padLeft: 'writable',
        toLocalISODate: 'writable',
        parseISOToLocalDate: 'writable',
        HijriConverter: 'writable',

        // Template globals
        shouldShowCostCenterLine: 'writable',
        buildSubjectByType: 'writable',
        buildCostCenterBlock: 'writable',
        renderLetterBlocks: 'writable',
        EXECUTIVE_DIRECTOR: 'writable',

        // Supabase
        supabase: 'readonly',

        // date-picker.js
        DualCalendarPicker: 'writable',

        // pagination.js
        buildPages: 'writable',

        // app.js globals
        collectState: 'writable',
        refresh: 'writable',
        el: 'writable',
        showToast: 'writable',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-redeclare': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'eqeqeq': ['error', 'smart'],
      'no-var': 'off',
      'prefer-const': 'off',
    },
  },
];
