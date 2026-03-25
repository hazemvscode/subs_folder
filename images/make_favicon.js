const fs = require('fs');
const path = require('path');

try {
  fs.copyFileSync('images/icon/icon.png', path.join('web_subs', 'public', 'favicon.png'));
  console.log('Favicon PNG copied to web_subs/public/favicon.png');
} catch (err) {
  console.error('Error:', err);
}
