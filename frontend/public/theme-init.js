(function () {
  'use strict';

  // Runs before styles/Angular. This is the single owner of theme resolution and persistence.
  var storageKey = 'novax.theme';
  var eventName = 'novax:theme-change';
  var themes = ['light', 'dark'];
  var media = window.matchMedia('(prefers-color-scheme: dark)');
  var preference = readPreference();

  function normalize(value) {
    return themes.indexOf(value) !== -1 ? value : 'system';
  }

  function readPreference() {
    try {
      return normalize(window.localStorage.getItem(storageKey));
    } catch (_) {
      return 'system';
    }
  }

  function state() {
    return Object.freeze({
      preference: preference,
      resolved:
        preference === 'system'
          ? media.matches
            ? 'dark'
            : 'light'
          : preference,
    });
  }

  function apply() {
    var current = state();
    document.documentElement.setAttribute('data-theme', current.resolved);
    document.documentElement.setAttribute(
      'data-theme-preference',
      current.preference,
    );
    window.dispatchEvent(new CustomEvent(eventName, { detail: current }));
  }

  window.novaxTheme = Object.freeze({
    storageKey: storageKey,
    eventName: eventName,
    getState: state,
    setPreference: function (value) {
      preference = normalize(value);
      try {
        window.localStorage.setItem(storageKey, preference);
      } catch (_) {
        /* The selection remains usable when browser storage is disabled. */
      }
      apply();
    },
  });

  media.addEventListener('change', function () {
    if (preference === 'system') apply();
  });
  window.addEventListener('storage', function (event) {
    if (event.key === storageKey || event.key === null) {
      preference = readPreference();
      apply();
    }
  });
  apply();
})();
