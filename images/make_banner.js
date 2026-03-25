const Jimp = require('jimp');

async function makeBanner() {
  try {
    const image = await Jimp.read('images/banner/WhatsApp Image 2026-03-22 at 7.37.19 PM (4).jpeg');
    image.cover(1200, 630);
    await image.quality(90).writeAsync('images/banner/banner.jpg');
    console.log('Banner resized to 1200x630!');
  } catch (err) {
    console.error('Error:', err);
  }
}

makeBanner();
