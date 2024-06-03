/***********
 * take the wappalyzer spreadsheet that has all platforms in it,
 * read the "url" and look at the hosts there
 * and try to detect SFCC storefront version, and write that back
 * to the spreadsheet in the "Confirmed Location" and 
 * "Platform Version" columns
 */
const XLSX = require('xlsx');
const XlsxPopulate = require('xlsx-populate');
const dns = require('dns');
const axios = require('axios');
const https = require('https');
const fs = require('fs');

const agent = new https.Agent({
  rejectUnauthorized: false
});

function getMetadata(html) {
  const descriptionRegex = /<meta\s+name=["']description["']\s+content=["'](.+)["']\s*\/?>/i;

  // Use the regular expression to extract the content of the meta tag
  const match = html.match(descriptionRegex);

  if (match && match.length > 1) {
    const description = match[1];
    console.log('Description:', description);
    return description;
  } else {
    console.log(' Description meta tag not found or empty\n');
    return 'Not found';
  }
}


function storefrontVersion(html) {
  if (html.includes('mobify') || html.includes('api.commercecloud.salesforce.com')) return 'PWA-kit';

  if (!html.includes('demandware.store')) return 'not SFCC';

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

async function processHost(originalHost) {
  const host = originalHost.replace(/\/\*/g, '')

  // do it once
  let retval = await processUrl('http://' + host);

  // check DNS
  if (retval['Platform Version'].includes('error')) {
    const dnsResult = await checkDNS(host);
    if (dnsResult !== true) {
      retval['Platform Version'] = 'error: ' + dnsResult;
    }
  }
  return retval;
}

async function checkDNS(hostname) {
  try {
    console.log(' checking DNS for ' + hostname);
    const address = await dns.promises.lookup(hostname);
    console.log('    success: ' + address);
    return true;
  } catch (err) {
    console.log('    no entry found');
    return "hostname does not exist";
  }
}

async function handleErrors(storefrontVersion, url) {
  // if it was 403 that's prolly cloudflare blocking us, just open in firefox
  if (storefrontVersion.includes('error: Request failed with status code 403')) {

    const { exec } = require('child_process');

    const command = process.platform === 'win32' ? 'start firefox' : 'firefox';

    exec(`${command} ${url}`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error occurred:', error.message);
      } else {
        console.log('Firefox launched successfully.');
      }
    });

    return 'error: 403, opened manually in FF';
  } else if (storefrontVersion.includes('error')) {
    const dnsResult = await checkDNS(host);
    if (dnsResult !== true) {
      return 'error: ' + dnsResult;
    }
  }
  return storefrontVersion;
}

async function processUrl(url) {
  const urlObj = new URL(url);
  let confirmedLocation = '';
  let version = '';
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
      timeout: 3000,
      maxRedirects: 5,
      httpsAgent: agent
    };
    process.stdout.write(url);
    delete axios.defaults.headers.common["Accept"];
    const response = await axios.get(url, config);
    confirmedLocation = response.request.res.responseUrl;
    if (confirmedLocation != url) {
      process.stdout.write(" -> " + confirmedLocation);
    }
    // save output for when we have other ideas :-)
    fs.writeFile('html/' + url.replace(/[\\/:*?"<>|]/g, '_') + '.htm', response.data, (err) => {
      if (err) {
        console.error('Error writing to file:', err);
      }
    });
    version = storefrontVersion(response.data);
    version = await handleErrors(version, url);
  } catch (error) {
    version = "error: " + error.message;
  }
  console.log(' ' + version);
  return {
    "Confirmed Location": confirmedLocation,
    "Platform Version": version,
  };
}

async function processXLSXFile(filePath) {
  console.log("opening " + filePath);
  const workbook = await XlsxPopulate.fromFileAsync(filePath);
  const worksheet = workbook.sheet(0);
  const rows = worksheet.usedRange().value();
  const maxWrites = 20;
  let writeCount = 0;

  const urlIndex = rows[0].indexOf('URL');
  const newIndex = rows[0].indexOf('New Static');
  const confirmedLocationIndex = rows[0].indexOf('Confirmed Location');
  const platformVersionIndex = rows[0].indexOf('Platform Version');

  for (let i = 1; i < rows.length; i++) {
    const url = rows[i][urlIndex];
    const isNew = rows[i][newIndex];
    const confirmedLocation = rows[i][confirmedLocationIndex];
    const platformVersion = rows[i][platformVersionIndex];
    // console.log("looking at row with url " + url + " and isNew = '" + isNew + "'");

    if (isNew === 'Yes' && confirmedLocation === undefined && platformVersion === undefined) {
      let success = false;
      const result = await processUrl(url);
      // Write the result JSON back to the corresponding row and columns
      Object.entries(result).forEach(([key, value]) => {
        const columnIndex = rows[0].indexOf(key);
        if (key == 'Platform Version' && !value.includes('error')) {
          success = true;
        }
        if (columnIndex !== -1) {
          worksheet.cell(i + 1, columnIndex + 1).value(value);
        }
      });
      writeCount++;
    }
    if (writeCount > maxWrites) {
      break;
    }
  }

  // Save the changes back to the XLSX file
  console.log("Writing " + filePath);
  await workbook.toFileAsync(filePath);
}

if (process.argv.length !== 3) {
  console.error('Usage: node builtwith-storefrontVersion.js <input-file-path>');
  process.exit(1);
}

const inputFile = process.argv[2];
processXLSXFile(inputFile)
  .then(() => {
    console.log('Processing completed.');
  })
  .catch((err) => {
    console.error('Error occurred:', err);
  });