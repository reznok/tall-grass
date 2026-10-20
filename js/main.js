/* TALL GRASS — main.js
 * Boot: engine init -> UI -> optional systems (Acts 3–4) -> offline catch-up -> loop.
 */
(function () {
  'use strict';
  var TG = window.TG = window.TG || {};

  function missingData() {
    var need = ['pokemon', 'routes', 'producers', 'upgrades', 'gyms', 'story'];
    return need.filter(function (k) { return !TG.data || !TG.data[k]; });
  }

  function boot() {
    var missing = missingData();
    if (missing.length) console.warn('[TG] missing data files: ' + missing.join(', ') + ' — running with what is available.');
    TG.data.routes = TG.data.routes || [];
    TG.data.producers = TG.data.producers || [];
    TG.data.upgrades = TG.data.upgrades || [];
    TG.data.gyms = TG.data.gyms || [];
    TG.data.pokemon = TG.data.pokemon || [];
    TG.data.story = TG.data.story || {};
    TG.data.events = TG.data.events || [];

    var loaded = TG.init();
    TG.ui.init();

    // late-game systems (js/systems/*.js) are optional
    if (TG.systems && typeof TG.systems === 'object') {
      Object.keys(TG.systems).forEach(function (k) {
        var sys = TG.systems[k];
        if (sys && typeof sys.init === 'function') {
          try { sys.init(); } catch (e) { console.error('[TG] system "' + k + '" init failed', e); }
        }
      });
    }

    if (loaded) TG.catchUp();      // emits 'offline' -> "While you were away..." modal
    else TG.state.lastTick = Date.now();
    TG.start();

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) TG.save();
    });
    window.addEventListener('pagehide', function () { TG.save(); });
    window.addEventListener('beforeunload', function () { TG.save(); });

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !TG.config.noServiceWorker) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline install is optional */ });
    }
    TG.booted = true;
    TG.emit('boot', { loaded: loaded });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
