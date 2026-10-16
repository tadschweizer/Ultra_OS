// Shared by API and renderer. Never fetch a user-supplied URL to validate it.
const ACTIVE_FILE = /\.(?:html?|xhtml|svgz?|xml|js|mjs|cjs|exe|msi|com|bat|cmd|ps1|sh|jar|scr|hta|vbs|docm|xlsm|pptm|zip|rar|7z|tar|gz)(?:$|[.;/])/i;
export function safeResourceUrl(value) {
  if (typeof value !== 'string' || !value || value.length > 2048
    || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) return null;
    const path = decodeURIComponent(url.pathname);
    if (ACTIVE_FILE.test(path) || /[\u0000-\u001f\u007f\\]/.test(path)) return null;
    return url.href;
  } catch { return null; }
}
export function safeSharedDocument(doc) {
  return { ...doc, resource_url: safeResourceUrl(doc.resource_url) };
}
