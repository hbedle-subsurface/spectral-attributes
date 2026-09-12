/* ===========================================================================
   count.js — page-view counting, and nothing else
   Heather Bedle and April Moreno-Ward / AASPI / University of Oklahoma

   The same file is used unchanged by every teaching repository. They are all
   served from hbedle-subsurface.github.io, so one counting account covers all
   of them and the path tells them apart:

       /single-trace/modules/instantaneous.html
       /geometric-attributes/modules/curvature.html
       /attribute_quiz/

   Why this exists: knowing which modules get used decides which ones get built
   next and which need rewriting. Knowing anything about the person using them
   does not, so nothing here tries to.

   WHAT IS SENT, once per page load: the page path with the query string
   stripped off, the page title, the referrer, the screen size, and the
   browser's own user-agent string. No
   cookies are set and no identifier is stored. Nothing that happens inside a
   module — no slider, no click, no computed trace — ever leaves the browser.
   This is the only third-party request a page makes: the stylesheet, the
   typefaces and the module code are all served from the same site.

   THIS IS SWITCHED ON. The account is `hbedle` and the counts are at
     https://hbedle.goatcounter.com, listed by page. The same code is used in
     every repository, which is what makes one dashboard cover all of them.

   TO SWITCH IT OFF
     Empty COUNT_CODE, or delete this file and the one <script> line that loads
     it at the foot of each page. Nothing else depends on it, in any repository.

   The page title is what makes the dashboard readable, since GoatCounter shows
   it beside the path. A page called "Untitled" counts perfectly well and tells
   you nothing.
   =========================================================================== */

(function () {
  'use strict';

  var COUNT_CODE = 'hbedle';           // counts at https://hbedle.goatcounter.com
  var COUNT_HOST = '';                 // <- or a full endpoint, if self-hosted

  // Nothing to do until one of the two above is filled in. Counting is on in
  // this repository, so this guard is for a copy that has emptied them.
  if (!COUNT_CODE && !COUNT_HOST) return;

  // Never count a local copy. A module opened from disk, or served from a
  // laptop during a lecture, is not a visit to the site.
  var host = location.hostname;
  if (location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1') return;

  // Honor Do Not Track, even though this collects no personal data. Someone who
  // has asked not to be counted has asked clearly enough.
  var dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
  if (dnt === '1' || dnt === 'yes') return;

  var endpoint = COUNT_HOST || ('https://' + COUNT_CODE + '.goatcounter.com/count');

  /* The path is sent WITHOUT the query string. Every module writes its slider
     positions into the query string so that a configuration can be handed out
     as a link, and GoatCounter's default path is pathname + search, so a
     shared link would otherwise put a reader's control settings into the
     count. Overriding path with the bare pathname keeps the dashboard to one
     row per page and keeps module state out of it. Referrer is left to the
     default: it is the page someone arrived from, not anything they did here.

     GoatCounter reads window.goatcounter for its settings, so this has to be
     set before its script loads. */
  window.goatcounter = window.goatcounter || {};
  if (window.goatcounter.path == null) window.goatcounter.path = location.pathname;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.setAttribute('data-goatcounter', endpoint);
  // If the script cannot be reached — offline, blocked, service down — the page
  // carries on exactly as before. Counting is never allowed to matter.
  s.onerror = function () { /* not counted, no consequence */ };
  document.head.appendChild(s);
})();
