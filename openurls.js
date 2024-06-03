import { openInBrowser } from './processUrl.js'

let urls = `
https://www.tricot.cl/
https://www.tts-group.co.uk/
https://www.tts-international.com/
https://www.tyg.se/
https://www.unode50.com/
https://www.usa.bardot.com/
https://www.us-onlinestore.com/
https://www.vangils.eu/
https://store.wacoal.jp/
https://www.wivai.com/
https://world.sisley.com/
https://www.zonedenmarkshop.com/

`;

urls.split('\n').forEach(url => {
  if (url.length > 3) openInBrowser(url);

});