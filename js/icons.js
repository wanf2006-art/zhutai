(function (window) {
  "use strict";

  var paths = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/>',
    daily: '<path d="M6 3h12l2 2v16H4V5z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    plan: '<path d="M4 5h16v16H4z"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="m8 15 2 2 5-5"/>',
    insight: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>',
    product: '<path d="M4 7 12 3l8 4-8 4z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4z"/><path d="M12 11v10"/>',
    learning: '<path d="M3 6.5 12 3l9 3.5-9 3.5z"/><path d="M6 9v6c3 2 9 2 12 0V9"/><path d="M21 7v7"/>',
    meditation: '<path d="M12 3c2 2 3 4 3 6a3 3 0 0 1-6 0c0-2 1-4 3-6Z"/><path d="M5 20c1-4 3-6 7-6s6 2 7 6"/><path d="M8 20h8"/>',
    resources: '<path d="M5 4h14v17H5z"/><path d="M8 4v17M11 8h5M11 12h5M11 16h3"/>',
    dashboard: '<path d="M4 20V10h4v10zM10 20V4h4v16zM16 20v-7h4v7z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    focus: '<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7v5l4 2"/><path d="M17 3h4v4"/><path d="m21 3-5 5"/>',
    task: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3V2h6v1M8 8h8M8 12h5M8 16h7"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    life: '<path d="M12 21s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.5-8 11-8 11Z"/><path d="M9 12h2l1-3 2 6 1-3h2"/>',
    edit: '<path d="m4 20 4.5-1 10-10-3.5-3.5-10 10z"/><path d="m13.5 6.5 3.5 3.5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>',
    build: '<path d="M4 19h16v2H4zM7 14h13v4H7zM11 9h9v4h-9zM15 4h5v4h-5z"/>',
    book: '<path d="M4 5c3-1 6 0 8 2v14c-2-2-5-3-8-2z"/><path d="M20 5c-3-1-6 0-8 2v14c2-2 5-3 8-2z"/>',
    bulb: '<path d="M9 18h6M10 22h4"/><path d="M8 14c-1.5-1.2-2-2.8-2-4.5a6 6 0 0 1 12 0c0 1.7-.5 3.3-2 4.5-1 .8-1 1.4-1 2H9c0-.6 0-1.2-1-2Z"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M9 2h6M12 5v2M12 13l3-3"/>',
    note: '<path d="M5 3h14v18H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>'
  };

  function icon(name, className) {
    var body = paths[name] || paths.note;
    return '<svg class="' + (className || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  window.ZTIcons = { icon: icon };
})(window);
