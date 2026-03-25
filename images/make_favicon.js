const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function makeFavicon() {
  try {

      .ico()
      .toFile('images/icon/favicon.ico');
    fs.copyFileSync('images/icon/favicon.ico', path.join('web_subs', 'public', 'favicon.ico'));
    console.log('Favicon.ico generated and copied to web_subs/public/favicon.ico');
  } catch (err) {
    console.error('Error:', err);
  }
}

makeFavicon();
