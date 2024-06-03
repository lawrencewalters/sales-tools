import dns from 'dns';
import axios from 'axios';
import https from 'https';
import child_process from 'child_process';
import { logger } from './logger.js';

const agent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * html and final url
 * @typedef {object} getHtmlResponse
 * @property {string} html - the html or error message
 * @property {string} responseUrl - the final responding url after following redirects
 * @property {boolean} success - did the request succeed?
 */

/**
 * get the html for a given url. follows redirects. checks for errors. on 403 attempts to open browser to review, otherwise does dns lookup on other errors.
 * @param {string} url - the url to request
 * @return {getHtmlResponse}
 */
export async function getHtml(url) {
  const urlObj = new URL(url);
  let responseUrl = '';
  let html = '';
  let success = false;
  try {
    const config = {
      headers: {
        "Host": urlObj.hostname,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0",
        "Accept-Language": "en-US,en;q=0.8,de-DE;q=0.5,de;q=0.3",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache",
        "TE": "trailers",
      },
      timeout: 6000,
      maxRedirects: 5,
      httpsAgent: agent
    };
    logger.debug('Requesting %s', url);
    delete axios.defaults.headers.common["Accept"];
    const response = await axios.get(url, config);
    responseUrl = response.request.res.responseUrl;
    html = castToString(response);
    success = true;
  } catch (error) {
    logger.info('error requesting %s: %s / %s', url, error.message, error.code);
    responseUrl = handleErrorWithResponse(error, responseUrl);
    html = await handleError(error, url, urlObj, html);
  }
  return {
    "responseUrl": responseUrl,
    "html": html,
    "success": success
  };
}

/**
 * Generic error handling - if 403 that means cloudflare, so open a browser window to pass bot check. If timeout, check DNS to see if this is a valid host
 * @param {AxiosError} error 
 * @param {string} url 
 * @param {object} urlObj 
 * @param {string} html 
 * @returns {string} html with error message
 */
async function handleError(error, url, urlObj, html) {
  html = 'error: ' + error.message;
  if (error.message.indexOf('Request failed with status code 403') == 0) {
    logger.info('403 error, opening in browser for %s', url);
    openInBrowser(url);
  } else if (error.message.indexOf('timeout') > 0) {
    const dnsResult = await checkDNS(urlObj.hostname);
    if (dnsResult !== true) {
      html = 'dns error: ' + dnsResult;
    }
  }
  return html;
}

/**
 * when there's an error but an actual HTTP response was given
 * @param {AxiosError} error 
 * @param {string} responseUrl 
 * @returns {string}
 */
function handleErrorWithResponse(error, responseUrl) {
  if (error.response) {
    logger.info("Request error that returned a response - here are the details\nStatus: %s\nHeader object:\n%s\nData:\n%s",
      error.response.status,
      error.response.headers,
      error.response.data);
    // cloudflare bot checks might reveal a final redirect url
    let errorBody = castToString(error.response);
    const cfZoneRegex = /cZone: "([^"]+)",/i;
    const match = errorBody.match(cfZoneRegex);
    if (match && match.length > 1) {
      const cfZone = match[1];
      logger.debug('cloudflare zone: %s', cfZone);
      responseUrl = "https://" + cfZone;
    }
  }
  return responseUrl;
}

/**
 * If the response is JSON, convert that to text
 * @param {Axios.response} response response from https request
 * @returns {string}
 */
function castToString(response) {
  let html = '';
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    try {
      html = JSON.stringify(response.data);
    } catch (e) {
      html = "error: Response was type application/json, but was unparsable";
    }
  } else {
    html = response.data;
  }
  return html;
}

export function openInBrowser(url) {
  const command = process.platform === 'win32' ? 'start firefox' : 'firefox';
  child_process.exec(`${command} ${url}`, (error, stdout, stderr) => {
    if (error) {
      logger.error('Error opening %s in browser: %s', url, error.message);
    } else {
      console.info('Firefox launched successfully to review %s', url);
    }
  });
}

async function checkDNS(hostname) {
  try {
    logger.info('checking DNS for ' + hostname);
    const address = await dns.promises.lookup(hostname);
    logger.info('success: ' + JSON.stringify(address));
    return true;
  } catch (err) {
    logger.info('no entry found: %s', err.message);
    return "hostname does not exist";
  }
}
