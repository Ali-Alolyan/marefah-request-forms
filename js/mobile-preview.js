/*

Mobile Preview Viewer

- Renders letter pages to lightweight JPEG images via canvas-renderer.
- Shows one page at a time (no vertical/horizontal scroll).
- Supports pinch-to-zoom + pan inside the preview.
- Keeps preview consistent with PDF export on Safari/Chrome (iPhone/Mac).

*/

(function(){
  'use strict';

  const PREVIEW_DPI = 150; // fast + stable on phones
  const PREVIEW_BG  = 'assets/letterhead-150.jpg';

  function isMobile(){
    return window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
  }
  function isPreviewView(){
    return (document.body.getAttribute('data-mobile-view') || 'form') === 'preview';
  }

  async function waitFonts(){
    if (document.fonts && document.fonts.ready){
      try{ await document.fonts.ready; }catch(_){}
    }
  }

  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

  function blobUrlFromCanvas(canvas, quality=0.90){
    return new Promise((resolve)=>{
      if (canvas.toBlob){
        canvas.toBlob((blob)=>{
          if (!blob) return resolve(null);
          resolve(URL.createObjectURL(blob));
        }, 'image/jpeg', quality);
      }else{
        // Fallback
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      }
    });
  }

  class MobilePreviewViewer{
    constructor(){
      this.root = document.getElementById('mobilePreview');
      this.viewport = document.getElementById('viewerViewport');
      this.stage = document.getElementById('viewerStage');
      this.img = document.getElementById('viewerImg');
      this.indicator = document.getElementById('viewerIndicator');
      this.btnPrev = document.getElementById('viewerPrev');
      this.btnNext = document.getElementById('viewerNext');
      this.loading = document.getElementById('viewerLoading');

      this.pageUrls = [];
      this.pageCount = 0;
      this.pageIndex = 0;

      this.baseFitScale = 1;
      this.scale = 1;
      this.minScale = 1;
      this.maxScale = 3;
      this.tx = 0;
      this.ty = 0;

      this._raf = null;
      this._pendingState = null;
      this._debounce = null;

      // pointer gestures
      this._pointers = new Map();
      this._gesture = null; // {mode, startScale, startTx, startTy, startMid, startWorld}
      this._swipe = null;   // {t0, x0, y0}

      this._boundResize = () => this.fit();
      this._boundKey = (e)=> {
        const isRTL = document.documentElement.dir === 'rtl';
        if (e.key === 'ArrowLeft') { isRTL ? this.next() : this.prev(); }
        if (e.key === 'ArrowRight') { isRTL ? this.prev() : this.next(); }
      };
    }

    isReady(){
      return !!(this.root && this.viewport && this.stage && this.img);
    }

    init(){
      if (!this.isReady()) return;

      this.btnPrev && this.btnPrev.addEventListener('click', ()=>this.prev());
      this.btnNext && this.btnNext.addEventListener('click', ()=>this.next());

      // Pointer events (preferred)
      this.viewport.addEventListener('pointerdown', (e)=>this.onPointerDown(e), { passive:false });
      this.viewport.addEventListener('pointermove', (e)=>this.onPointerMove(e), { passive:false });
      this.viewport.addEventListener('pointerup', (e)=>this.onPointerUp(e), { passive:false });
      this.viewport.addEventListener('pointercancel', (e)=>this.onPointerUp(e), { passive:false });

      // Prevent iOS rubber-band inside viewport
      this.viewport.addEventListener('touchmove', (e)=>{ if (this._pointers.size) e.preventDefault(); }, { passive:false });

      window.addEventListener('resize', this._boundResize, { passive:true });
      window.addEventListener('orientationchange', this._boundResize, { passive:true });
      window.addEventListener('keydown', this._boundKey);

      // When image loads, fit it
      this.img.addEventListener('load', ()=>this.fit());
    }

    destroyPageUrls(){
      for (const u of this.pageUrls){
        if (typeof u === 'string' && u.startsWith('blob:')){
          try{ URL.revokeObjectURL(u); }catch(_){}
        }
      }
      this.pageUrls = [];
      this.pageCount = 0;
      this.pageIndex = 0;
    }

    setLoading(show){
      if (!this.loading) return;
      this.loading.style.display = show ? 'grid' : 'none';
    }

    schedule(state){
      if (!this.isReady()) return;
      this._pendingState = state;

      // Only render when mobile + preview tab is active (saves battery)
      if (!isMobile() || !isPreviewView()) return;

      if (this._debounce) clearTimeout(this._debounce);
      this._debounce = setTimeout(()=>this.renderNow(), 180);
    }

    async renderNow(){
      if (!this.isReady()) return;
      if (!isMobile() || !isPreviewView()) return;

      const state = this._pendingState;
      if (!state || !window.renderLetterToCanvases) return;

      this.setLoading(true);

      try{
        await waitFonts();

        // Render at a light DPI for preview
        const canvases = await window.renderLetterToCanvases(state, { dpi: PREVIEW_DPI, backgroundSrc: PREVIEW_BG });
        if (!canvases || !canvases.length) throw new Error('no pages');

        // Convert canvases -> blob URLs
        this.destroyPageUrls();
        const urls = [];
        for (const c of canvases){
          const u = await blobUrlFromCanvas(c, 0.88);
          urls.push(u);
        }

        this.pageUrls = urls;
        this.pageCount = urls.length;
        this.pageIndex = clamp(this.pageIndex, 0, this.pageCount-1);

        this.setPage(this.pageIndex, /*reset*/true);
      }catch(err){
        console.error(err);
        // Keep previous preview; just stop spinner
      }finally{
        this.setLoading(false);
      }
    }

    setPage(i, reset){
      if (!this.pageUrls.length) return;
      this.pageIndex = clamp(i, 0, this.pageUrls.length-1);

      const u = this.pageUrls[this.pageIndex];
      if (u) this.img.src = u;

      if (this.indicator) this.indicator.textContent = `${this.pageIndex+1} / ${this.pageUrls.length}`;

      if (reset){
        // reset transform; fit will run on image load
        this.scale = 1;
        this.tx = 0;
        this.ty = 0;
        this.applyTransform();
      }
    }

    prev(){
      if (this.pageIndex > 0) this.setPage(this.pageIndex - 1, true);
    }
    next(){
      if (this.pageIndex < this.pageUrls.length - 1) this.setPage(this.pageIndex + 1, true);
    }

    computeFitScale(){
      const vw = this.viewport.clientWidth;
      const vh = this.viewport.clientHeight;
      const iw = this.img.naturalWidth || 1;
      const ih = this.img.naturalHeight || 1;

      // padding
      const pad = 14;
      const s = Math.min((vw - pad*2)/iw, (vh - pad*2)/ih);
      return clamp(s, 0.1, 2.5);
    }

    fit(){
      if (!this.isReady()) return;
      if (!this.img.naturalWidth || !this.img.naturalHeight) return;

      this.baseFitScale = this.computeFitScale();
      this.minScale = this.baseFitScale;
      this.maxScale = Math.max(this.baseFitScale * 3, 3);

      this.scale = this.baseFitScale;
      // center
      const vw = this.viewport.clientWidth;
      const vh = this.viewport.clientHeight;
      const iw = this.img.naturalWidth;
      const ih = this.img.naturalHeight;
      this.tx = (vw - iw * this.scale) / 2;
      this.ty = (vh - ih * this.scale) / 2;
      this.applyTransform();
    }

    zoomIn(){
      this.zoomTo(this.scale * 1.12);
    }
    zoomOut(){
      this.zoomTo(this.scale / 1.12);
    }
    zoomFit(){
      this.fit();
    }

    zoomTo(newScale){
      if (!this.isReady()) return;
      if (!this.img.naturalWidth) return;

      const vw = this.viewport.clientWidth;
      const vh = this.viewport.clientHeight;

      // zoom around center
      const cx = vw / 2;
      const cy = vh / 2;
      const worldX = (cx - this.tx) / this.scale;
      const worldY = (cy - this.ty) / this.scale;

      this.scale = clamp(newScale, this.minScale, this.maxScale);
      this.tx = cx - worldX * this.scale;
      this.ty = cy - worldY * this.scale;

      this.clampOffsets();
      this.applyTransform();
    }

    clampOffsets(){
      const vw = this.viewport.clientWidth;
      const vh = this.viewport.clientHeight;
      const iw = this.img.naturalWidth || 1;
      const ih = this.img.naturalHeight || 1;

      const w = iw * this.scale;
      const h = ih * this.scale;

      // If the page is smaller than the viewport, keep centered.
      if (w <= vw){
        this.tx = (vw - w) / 2;
      }else{
        this.tx = clamp(this.tx, vw - w, 0);
      }
      if (h <= vh){
        this.ty = (vh - h) / 2;
      }else{
        this.ty = clamp(this.ty, vh - h, 0);
      }
    }

    applyTransform(){
      if (!this.stage) return;
      this.stage.style.transform = `translate3d(${this.tx}px, ${this.ty}px, 0) scale(${this.scale})`;
    }

    onPointerDown(e){
      if (!isMobile() || !isPreviewView()) return;
      // Prevent page scroll/zoom
      e.preventDefault();

      this.viewport.setPointerCapture && this.viewport.setPointerCapture(e.pointerId);
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this._pointers.size === 1){
        this._gesture = {
          mode: 'pan',
          startScale: this.scale,
          startTx: this.tx,
          startTy: this.ty,
          startX: e.clientX,
          startY: e.clientY,
        };
        this._swipe = { t0: performance.now(), x0: e.clientX, y0: e.clientY };
      }else if (this._pointers.size === 2){
        const pts = Array.from(this._pointers.values());
        const mid = { x: (pts[0].x + pts[1].x)/2, y: (pts[0].y + pts[1].y)/2 };
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        const dist = Math.hypot(dx, dy);

        const worldX = (mid.x - this.tx) / this.scale;
        const worldY = (mid.y - this.ty) / this.scale;

        this._gesture = {
          mode: 'pinch',
          startScale: this.scale,
          startTx: this.tx,
          startTy: this.ty,
          startDist: dist,
          startMid: mid,
          startWorld: { x: worldX, y: worldY },
        };
        this._swipe = null;
      }
    }

    onPointerMove(e){
      if (!isMobile() || !isPreviewView()) return;
      if (!this._pointers.has(e.pointerId)) return;
      e.preventDefault();

      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (!this._gesture) return;

      if (this._pointers.size === 1 && this._gesture.mode === 'pan'){
        const g = this._gesture;
        const dx = e.clientX - g.startX;
        const dy = e.clientY - g.startY;

        this.tx = g.startTx + dx;
        this.ty = g.startTy + dy;

        this.clampOffsets();
        this.applyTransform();
        return;
      }

      if (this._pointers.size === 2){
        const g = this._gesture;
        const pts = Array.from(this._pointers.values());
        const mid = { x: (pts[0].x + pts[1].x)/2, y: (pts[0].y + pts[1].y)/2 };
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        const dist = Math.hypot(dx, dy);

        const raw = g.startScale * (dist / (g.startDist || 1));
        this.scale = clamp(raw, this.minScale, this.maxScale);

        // Keep the original world point under the finger midpoint.
        const wx = g.startWorld.x;
        const wy = g.startWorld.y;
        this.tx = mid.x - wx * this.scale;
        this.ty = mid.y - wy * this.scale;

        this.clampOffsets();
        this.applyTransform();
      }
    }

    onPointerUp(e){
      if (!isMobile() || !isPreviewView()) return;
      if (this._pointers.has(e.pointerId)){
        this._pointers.delete(e.pointerId);
      }

      // Swipe navigation (only when at/near fit scale)
      if (this._pointers.size === 0 && this._swipe){
        const dt = performance.now() - this._swipe.t0;
        const dx = e.clientX - this._swipe.x0;
        const dy = e.clientY - this._swipe.y0;

        const nearFit = Math.abs(this.scale - this.baseFitScale) <= (this.baseFitScale * 0.06);
        if (nearFit && dt < 380 && Math.abs(dx) > 70 && Math.abs(dy) < 60){
          const isRTL = document.documentElement.dir === 'rtl';
          if (isRTL) {
            if (dx > 0) this.next(); else this.prev();
          } else {
            if (dx < 0) this.next(); else this.prev();
          }
        }
      }

      if (this._pointers.size === 1){
        // If one pointer remains, switch to pan mode with current transform as start
        const remaining = Array.from(this._pointers.values())[0];
        this._gesture = {
          mode: 'pan',
          startScale: this.scale,
          startTx: this.tx,
          startTy: this.ty,
          startX: remaining.x,
          startY: remaining.y,
        };
        this._swipe = { t0: performance.now(), x0: remaining.x, y0: remaining.y };
      }else if (this._pointers.size === 0){
        this._gesture = null;
        this._swipe = null;
      }
    }
  }

  // Expose a small API for app.js
  const api = {
    _viewer: null,
    init(){
      const v = new MobilePreviewViewer();
      v.init();
      this._viewer = v;
    },
    isEnabled(){
      return !!(this._viewer && this._viewer.isReady() && isMobile());
    },
    schedule(state){
      if (this._viewer) this._viewer.schedule(state);
    },
    renderNow(){
      if (this._viewer) return this._viewer.renderNow();
    },
    zoomIn(){
      if (this._viewer) this._viewer.zoomIn();
    },
    zoomOut(){
      if (this._viewer) this._viewer.zoomOut();
    },
    fit(){
      if (this._viewer) this._viewer.zoomFit();
    },
  };

  window.mobilePreview = api;

  document.addEventListener('DOMContentLoaded', ()=>{
    api.init();
  });

})();
