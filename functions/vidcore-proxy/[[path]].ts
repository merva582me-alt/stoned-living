function buildRuntimeAdBlockerScript(): string {
  return `<script>
(function() {
  'use strict';
  var AD_DOMAINS = [
    'ferocitycandour.com', 'alaphoid.com', 'portalfluently.com',
    'bakestubborn.com', 'workdeadlinededicate.com', 'indirectlyrawpick.com',
    'pushcrew.com', 'biomanos.org', 'show-creative1.com',
    'holdbitter.com', 'apiguinee.org', 'onesignal.com'
  ];

  function isAdUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return AD_DOMAINS.some(function(domain) {
      return url.indexOf(domain) !== -1;
    });
  }

  // 1. Intercept document.createElement to catch dynamic script/iframe creation
  var origCreateElement = document.createElement;
  document.createElement = function(tagName) {
    var el = origCreateElement.call(document, tagName);
    var tag = (tagName || '').toLowerCase();

    if (tag === 'script' || tag === 'iframe' || tag === 'link') {
      // Monitor property assignment to .src or .href
      var urlProp = (tag === 'link') ? 'href' : 'src';
      
      Object.defineProperty(el, urlProp, {
        set: function(val) {
          if (isAdUrl(val)) {
            console.warn('[VidCore Proxy] Blocked dynamic ' + tag + ':', val);
            // Defang the element by pointing it to a safe dummy blob
            el.setAttribute(urlProp, 'about:blank');
            return;
          }
          el.setAttribute(urlProp, val);
        },
        get: function() {
          return el.getAttribute(urlProp);
        },
        configurable: true
      });

      var origSetAttribute = el.setAttribute;
      el.setAttribute = function(name, value) {
        if ((name === 'src' || name === 'href') && isAdUrl(value)) {
          console.warn('[VidCore Proxy] Blocked attribute on ' + tag + ':', value);
          return origSetAttribute.call(this, name, 'about:blank');
        }
        return origSetAttribute.apply(this, arguments);
      };
    }
    return el;
  };

  // 2. Intercept DOM node insertions to block direct appends of bad elements
  function checkNode(node) {
    if (!node || !node.tagName) return false;
    var tag = node.tagName.toLowerCase();
    if (tag === 'script' || tag === 'iframe') {
      var src = node.src || node.getAttribute('src');
      if (isAdUrl(src)) {
        console.warn('[VidCore Proxy] Blocked node insertion:', tag, src);
        return true;
      }
    }
    return false;
  }

  var origAppendChild = Element.prototype.appendChild;
  Element.prototype.appendChild = function(child) {
    if (checkNode(child)) return child; // Discard insertion
    return origAppendChild.call(this, child);
  };

  var origInsertBefore = Element.prototype.insertBefore;
  Element.prototype.insertBefore = function(newNode, referenceNode) {
    if (checkNode(newNode)) return newNode;
    return origInsertBefore.call(this, newNode, referenceNode);
  };
})();
</script>`;
}
