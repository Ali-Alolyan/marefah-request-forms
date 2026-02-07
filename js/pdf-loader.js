/*
 * Deterministic pdf.js loader.
 * - Tries local bundled assets first, then CDN as fallback.
 * - Uses explicit timeouts.
 * - Uses worker only when a same-origin worker file is available.
 */

(function(){
  'use strict';

  const PDFJS_VERSION = '4.0.379';
  const PDFJS_LEGACY_VERSION = '3.11.174';
  const LOAD_TIMEOUT_MS = 10_000;
  const WORKER_CHECK_TIMEOUT_MS = 4_000;

  const CDN_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/`;
  const CDN_LEGACY_SCRIPT_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_LEGACY_VERSION}/build/`;
  const LOCAL_BASE = new URL('assets/vendor/pdfjs/', document.baseURI).href;

  const CANDIDATES = [
    {
      kind: 'module',
      name: 'local',
      moduleUrl: new URL('pdf.min.mjs', LOCAL_BASE).href,
      workerUrl: new URL('pdf.worker.min.mjs', LOCAL_BASE).href,
    },
    {
      kind: 'script',
      name: 'cdn-legacy-script',
      scriptUrl: `${CDN_LEGACY_SCRIPT_BASE}pdf.min.js`,
      workerUrl: `${CDN_LEGACY_SCRIPT_BASE}pdf.worker.min.js`,
    },
    {
      kind: 'module',
      name: 'cdn',
      moduleUrl: `${CDN_BASE}pdf.min.mjs`,
      workerUrl: `${CDN_BASE}pdf.worker.min.mjs`,
    }
  ];

  let loadPromise = null;
  let isLoaded = false;
  let pdfjsLibRef = null;
  let workerEnabled = false;
  let loadSource = null;

  function withTimeout(promise, timeoutMs, label){
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  async function importPdfJs(moduleUrl){
    return withTimeout(import(moduleUrl), LOAD_TIMEOUT_MS, `Loading pdf.js (${moduleUrl})`);
  }

  async function loadPdfJsScript(scriptUrl){
    if (window.pdfjsLib && typeof window.pdfjsLib.getDocument === 'function'){
      return window.pdfjsLib;
    }
    return withTimeout(new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = scriptUrl;
      s.async = true;
      s.onload = () => {
        if (window.pdfjsLib && typeof window.pdfjsLib.getDocument === 'function'){
          resolve(window.pdfjsLib);
        } else {
          reject(new Error('Legacy pdf.js script loaded but pdfjsLib is unavailable'));
        }
      };
      s.onerror = () => reject(new Error(`Failed to load script ${scriptUrl}`));
      document.head.appendChild(s);
    }), LOAD_TIMEOUT_MS, `Loading pdf.js legacy script (${scriptUrl})`);
  }

  function getCandidateByName(name){
    return CANDIDATES.find(c => c.name === name) || null;
  }

  async function canUseWorker(url){
    try {
      const res = await withTimeout(
        fetch(url, { method: 'HEAD', cache: 'no-store' }),
        WORKER_CHECK_TIMEOUT_MS,
        'Checking pdf.js worker'
      );
      return !!res.ok;
    } catch (_) {
      return false;
    }
  }

  function normalizePdfJsModule(mod){
    const lib = mod?.default || mod?.pdfjsLib || mod;
    if (!lib || typeof lib.getDocument !== 'function') {
      throw new Error('Loaded module is not a valid pdf.js build');
    }
    return lib;
  }

  async function configurePdfJs(lib, candidate){
    // Keep worker execution same-origin only to remain compatible with CSP.
    workerEnabled = candidate.name === 'local' && !!candidate.workerUrl && await canUseWorker(candidate.workerUrl);
    if (workerEnabled) {
      lib.GlobalWorkerOptions.workerSrc = candidate.workerUrl;
    } else {
      lib.GlobalWorkerOptions.workerSrc = '';
    }
    return lib;
  }

  async function loadPdfJs(){
    if (isLoaded && pdfjsLibRef){
      return pdfjsLibRef;
    }
    if (loadPromise){
      return loadPromise;
    }

    loadPromise = (async () => {
      let lastError = null;

      for (const candidate of CANDIDATES){
        try {
          let loaded;
          if (candidate.kind === 'script'){
            loaded = await loadPdfJsScript(candidate.scriptUrl);
          } else {
            loaded = await importPdfJs(candidate.moduleUrl);
          }
          const lib = normalizePdfJsModule(loaded);
          pdfjsLibRef = await configurePdfJs(lib, candidate);
          isLoaded = true;
          loadSource = candidate.name;
          return pdfjsLibRef;
        } catch (error) {
          lastError = error;
          console.warn('[pdf-loader] Failed candidate:', candidate.name, error);
        }
      }

      throw lastError || new Error('Failed to load pdf.js');
    })();

    try {
      return await loadPromise;
    } finally {
      if (!isLoaded) loadPromise = null;
    }
  }

  async function forceReloadPdfJs(sourceName){
    const candidate = getCandidateByName(sourceName);
    if (!candidate){
      throw new Error(`Unknown pdf.js source "${sourceName}"`);
    }

    let loaded;
    if (candidate.kind === 'script'){
      loaded = await loadPdfJsScript(candidate.scriptUrl);
    } else {
      loaded = await importPdfJs(candidate.moduleUrl);
    }

    const lib = normalizePdfJsModule(loaded);
    pdfjsLibRef = await configurePdfJs(lib, candidate);
    isLoaded = true;
    loadSource = candidate.name;
    loadPromise = Promise.resolve(pdfjsLibRef);
    return pdfjsLibRef;
  }

  function getPdfDocumentInit(data){
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (workerEnabled){
      return { data: bytes, isEvalSupported: false };
    }
    return { data: bytes, disableWorker: true, isEvalSupported: false };
  }

  async function openPdfDocument(data){
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const primaryLib = await loadPdfJs();
    const primaryInit = getPdfDocumentInit(bytes);

    try {
      return await primaryLib.getDocument(primaryInit).promise;
    } catch (primaryError){
      const currentSource = loadSource || '';
      // Parse-time fallback: some PDFs fail on modern build but work on legacy build.
      if (currentSource !== 'cdn-legacy-script'){
        try {
          const legacyLib = await forceReloadPdfJs('cdn-legacy-script');
          const legacyInit = getPdfDocumentInit(bytes);
          return await legacyLib.getDocument(legacyInit).promise;
        } catch (legacyError){
          const err = legacyError instanceof Error ? legacyError : new Error(String(legacyError || 'Failed to parse PDF'));
          err.cause = primaryError;
          throw err;
        }
      }
      throw primaryError;
    }
  }

  function isPdfJsLoaded(){
    return isLoaded && !!pdfjsLibRef;
  }

  function getPdfJsStatus(){
    return {
      loaded: isLoaded,
      source: loadSource,
      workerEnabled
    };
  }

  window.loadPdfJs = loadPdfJs;
  window.forceReloadPdfJs = forceReloadPdfJs;
  window.openPdfDocument = openPdfDocument;
  window.isPdfJsLoaded = isPdfJsLoaded;
  window.getPdfDocumentInit = getPdfDocumentInit;
  window.getPdfJsStatus = getPdfJsStatus;

})();
