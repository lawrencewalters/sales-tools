import yargs from 'yargs';
import XlsxPopulate from 'xlsx-populate';
import fs from 'fs';
import { logger } from './logger.js';
import * as ProcessHtml from './processHtml.js';
import { getHtml } from './processUrl.js';

var argv = yargs(process.argv.slice(2))
  .usage('Usage: $0 --max=[num] --log-level=[level] --file=[file]')
  .alias('m', 'max')
  .alias('l', 'log-level')
  .alias('f', 'file')
  .default('log-level', 'info')
  .default('max', 1000)
  .demandOption('file', 'filename required')
  .argv;

logger.level = argv.logLevel;
logger.info('Max urls to process: %d', argv.max);
logger.info('File: %s', argv.file);

try {
  await processXLSXFile(argv.file, argv.max);
} catch (error) {
  logger.error(error.message + error.stack);
}

/**
 * read urls from excel file and save results
 * @param {string} filePath 
 * @param {number} maxRows 
 */
async function processXLSXFile(filePath, maxRows) {
  logger.info("opening " + filePath);
  const workbook = await XlsxPopulate.fromFileAsync(filePath);
  const worksheet = workbook.sheet(0);
  const rows = worksheet.usedRange().value();
  let writeCount = 0;
  let writeCountSinceLastSave = 0;

  const urlIndex = rows[0].indexOf('URL');
  const newIndex = rows[0].indexOf('New Static');
  const confirmedLocationIndex = rows[0].indexOf('Confirmed Location');
  const platformVersionIndex = rows[0].indexOf('Platform Version');
  const metadataIndex = rows[0].indexOf('Description');

  for (let i = 1; i < rows.length; i++) {
    const url = rows[i][urlIndex];
    const isNew = rows[i][newIndex];
    const confirmedLocation = rows[i][confirmedLocationIndex];
    const platformVersion = rows[i][platformVersionIndex];
    const metadata = rows[i][metadataIndex];
    logger.debug("looking at row with url " + url + " and isNew = '" + isNew + "'");

    if (isNew === 'Yes' && platformVersion === 'error: timeout of 3000ms exceeded') {
      const result = await getHtml(url);
      if (result.success) {
        // save html for future use
        saveHtml(result.html, result.responseUrl);

        // process output
        const newStorefrontVersion = ProcessHtml.getStorefrontVersion(result.html);
        const newMetadata = ProcessHtml.getMetadata(result.html);

        let logurl = url;
        if (result.responseUrl.indexOf(url) != 0) {
          logurl = logurl + ' -> ' + result.responseUrl;
        }
        logger.info('%s %s', logurl, newStorefrontVersion);
        if (platformVersionIndex !== -1 && newStorefrontVersion) {
          worksheet.cell(i + 1, platformVersionIndex + 1).value(newStorefrontVersion);
        }
        if (metadataIndex !== -1 && newMetadata && (metadata === undefined || metadata.includes("error"))) {
          worksheet.cell(i + 1, metadataIndex + 1).value(newMetadata);
        }
      } else {
        // store error text in platform version
        if (platformVersionIndex !== -1 && result && result.html && result.html.length < 500) {
          worksheet.cell(i + 1, platformVersionIndex + 1).value(result.html);
        }
      }

      if (confirmedLocationIndex !== -1 && result.responseUrl) {
        worksheet.cell(i + 1, confirmedLocationIndex + 1).value(result.responseUrl);
      }
      writeCount++;
      writeCountSinceLastSave++;
    }
    if (writeCount >= maxRows) {
      break;
    }
    if (writeCountSinceLastSave > 100) {
      // Save the changes back to the XLSX file
      console.log("Writing " + filePath);
      await workbook.toFileAsync(filePath);
      writeCountSinceLastSave = 0;
    }
  }

  // Save the changes back to the XLSX file
  console.log("Writing " + filePath);
  await workbook.toFileAsync(filePath);
}

function saveHtml(html, url) {
  try {
    // if (typeof html !== 'string' && !(html instanceof String)) {
    // html = JSON.stringify(html);
    // }
    fs.writeFileSync('html/' + url.replace(/[\\/:*?"<>|]/g, '_') + '.htm', html);
  } catch (error) {
    logger.error('Error writing html for %s to file %s %s', url, error.message, error.stack);
  }
}