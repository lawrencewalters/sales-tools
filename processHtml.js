import { logger } from './logger.js';

export function getMetadata(html) {
  const descriptionRegex = /<meta\s+name=["']description["']\s+content=["'](.+)["']\s*\/?>/i;
  const match = html.match(descriptionRegex);

  if (match && match.length > 1) {
    const description = match[1];
    logger.debug('meta description: %s', description);
    return description;
  } else {
    logger.debug('Description meta tag not found or empty');
    return 'Not found';
  }
}

/**
 * figure out SFCC storefront version based on html
 * @param {string} html 
 */
export function getStorefrontVersion(html) {
  if (html.includes('mobify') || html.includes('api.commercecloud.salesforce.com')) return 'PWA-kit';

  if (html.indexOf('/_Incapsula_Resource') !== -1) return 'error: Blocked by Incapsula';

  if (html.indexOf('demandware') === -1) {
    if (html.indexOf('/_next/static/chunks/') !== -1) {
      return 'Nextjs (maybe not SFCC?)';
    }
    return 'not SFCC';
  }

  if (html.indexOf('/_next/static/chunks/') !== -1) return 'Nextjs';

  if (!html.includes('app.js') && !html.includes('app.min.js') && html.includes('main.js')) return 'SFRA';

  if (html.includes('continueUrl') && html.includes('?dwcont=')) {
    return 'SG Pipelines';
  }

  if (html.includes('app.urls')) {
    return 'SG Pipelines';
  }

  if (html.includes('window.Resources')) {
    return 'SG Controllers';
  }

  return 'unknown SFCC';
}