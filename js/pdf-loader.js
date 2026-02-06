/*
 * Lazy-load pdf.js from CDN for rendering PDF attachments.
 * Only loads when the user uploads their first PDF file.
 */

(function(){
  'use strict';

  const PDFJS_VERSION = '4.0.379';
  const PDFJS_CDN = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/`;

  let loadPromise = null;
  let isLoaded = false;

  /**
   * Lazily load pdf.js library from CDN.
   * Returns a promise that resolves to the pdfjsLib object.
   * Subsequent calls return the same cached promise.
   */
  async function loadPdfJs(){
    if (isLoaded && window.pdfjsLib){
      return window.pdfjsLib;
    }

    if (loadPromise){
      return loadPromise;
    }

    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PDFJS_CDN + 'pdf.min.mjs';
      script.type = 'module';
      script.crossOrigin = 'anonymous';

      script.onload = () => {
        // pdf.js with ES module exports to window.pdfjsLib
        const checkLib = () => {
          if (window.pdfjsLib){
            // Configure the worker
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN + 'pdf.worker.min.mjs';
            isLoaded = true;
            resolve(window.pdfjsLib);
          } else {
            // Module may need a moment to initialize
            setTimeout(checkLib, 50);
          }
        };
        checkLib();
      };

      script.onerror = () => {
        loadPromise = null;
        reject(new Error('Failed to load pdf.js from CDN'));
      };

      document.head.appendChild(script);
    });

    return loadPromise;
  }

  /**
   * Check if pdf.js is already loaded
   */
  function isPdfJsLoaded(){
    return isLoaded && !!window.pdfjsLib;
  }

  // Expose globally
  window.loadPdfJs = loadPdfJs;
  window.isPdfJsLoaded = isPdfJsLoaded;

})();
