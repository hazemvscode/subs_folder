const Jimp = require('jimp');

async function makeCircleIcon() {
  try {
    const image = await Jimp.read('images/icon/icon.jpg');
    const size = Math.min(image.bitmap.width, image.bitmap.height);
    image.resize(size, size);
    image.scan(0, 0, size, size, (x, y, idx) => {
      const dx = x - size / 2;
      const dy = y - size / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > size / 2) {
        image.bitmap.data[idx + 3] = 0; // transparent
      }
    });
    await image.writeAsync('images/icon/icon.png');
    console.log('Circular icon.png created successfully!');
  } catch (err) {
    console.error('Error:', err);
  }
}

makeCircleIcon();
