/**
 * Sanitize career-article body content (Markdown / limited HTML).
 * Removes scriptable surfaces and dangerous URL schemes.
 * Not a full browser HTML parser — keep allowlists tight; prefer Markdown on the client.
 */
export function sanitizeArticleContent(input: string): string {
  let content = input;

  // Remove high-risk elements and their contents
  content = content.replace(
    /<\s*(script|style|iframe|object|embed|link|meta|base|form|svg|math|template)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    '',
  );
  content = content.replace(
    /<\s*(script|style|iframe|object|embed|link|meta|base|form|svg|math|template)[^>]*\/?\s*>/gi,
    '',
  );

  // Strip inline event handlers (onclick, onerror, …)
  content = content.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Neutralize dangerous URL schemes in href/src/xlink:href/action/formaction
  content = content.replace(
    /\s(href|src|xlink:href|action|formaction|poster)\s*=\s*(['"])\s*(javascript|data|vbscript|file)\s*:/gi,
    ' $1=$2#blocked:',
  );
  content = content.replace(
    /\s(href|src|xlink:href|action|formaction|poster)\s*=\s*(javascript|data|vbscript|file)\s*:/gi,
    ' $1=#blocked:',
  );

  // Remove javascript: / data: even when encoded loosely
  content = content.replace(/(javascript|vbscript|data)\s*:/gi, '#blocked:');

  // Drop expression()-style CSS (legacy IE)
  content = content.replace(/expression\s*\(/gi, 'blocked(');

  return content.trim().slice(0, 200_000);
}
