/***********
 * take the builtwith spreadsheet that has all platforms in it,
 * read the "confirmed location" and save the html for the home page
 *  
 */
const XLSX = require('xlsx');
const XlsxPopulate = require('xlsx-populate');
const dns = require('dns');
const axios = require('axios');
const fs = require('fs');

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

async function processUrl(url) {
  let metadata = '';
  let html = await getHtml(url);

  // save output for when we have other ideas :-)
  fs.writeFile('html/' + url.replace(/[\\/:*?"<>|]/g, '_') + '.htm', html, (err) => {
    if (err) {
      console.error('Error writing to file:', err);
    }
  });

  // if it was 403 that's prolly cloudflare blocking us, just open in firefox
  if (html.includes('error: Request failed with status code 403')) {
    const { exec } = require('child_process');
    const command = process.platform === 'win32' ? 'start firefox' : 'firefox';

    exec(`${command} ${url}`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error occurred launching browser:', error.message);
      } else {
        console.log('Firefox launched successfully.');
      }
    });

    metadata = 'error: 403, opened manually in FF';
    console.log(html);
  } else if (html.startsWith('error')) {
    console.log(html);
    metadata = html;
  } else {
    metadata = getMetadata(html);
  }

  return {
    "Metadata": metadata
  };
}

async function getHtml(url) {
  const urlObj = new URL(url);
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
      timeout: 5000,
      maxRedirects: 5
    };
    // process.stdout.write(url);
    delete axios.defaults.headers.common["Accept"];
    const response = await axios.get(url, config);
    return response.data;
  } catch (error) {
    return "error: " + error.message;
  }
}

async function processXLSXFile(filePath) {
  console.log("opening " + filePath);
  const workbook = await XlsxPopulate.fromFileAsync(filePath);
  const worksheet = workbook.sheet(0);
  const rows = worksheet.usedRange().value();
  const maxWrites = 1100;
  let writeCount = 0;

  // Find the column indices for by column name
  const techPlatformIndex = rows[0].indexOf('Technology Platform');
  const confirmedLocationIndex = rows[0].indexOf('Confirmed Location');
  const rsmCategoryIndex = rows[0].indexOf('RSM Category');
  const metadataIndex = rows[0].indexOf('Metadata');

  for (let i = 1; i < rows.length; i++) {
    const techPlatform = rows[i][techPlatformIndex];
    const confirmedLocation = rows[i][confirmedLocationIndex];
    const rsmCategory = rows[i][rsmCategoryIndex];
    const metadata = rows[i][metadataIndex];

    if (techPlatform == 'Salesforce Commerce Cloud' && metadata === undefined) {
      console.log(confirmedLocation);
      let success = false;
      const result = await processUrl(confirmedLocation);
      // Write the result JSON back to the corresponding row and columns
      Object.entries(result).forEach(([key, value]) => {
        const columnIndex = rows[0].indexOf(key);
        if (key == 'Metadata' && !value.includes('error')) {
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
  console.error('Usage: node builtwith-naics.js <input-file-path>');
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