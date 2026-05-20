const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png');
const destLargePath = path.join(__dirname, 'android/app/src/main/res/drawable/ic_large_icon.png');
const destStatPath = path.join(__dirname, 'android/app/src/main/res/drawable/ic_stat_icon_default.png');

try {
    // Create drawable directory if not exists
    const drawableDir = path.dirname(destLargePath);
    if (!fs.existsSync(drawableDir)) {
        fs.mkdirSync(drawableDir, { recursive: true });
    }

    fs.copyFileSync(srcPath, destLargePath);
    console.log('Successfully copied logo to ic_large_icon.png');
    
    fs.copyFileSync(srcPath, destStatPath);
    console.log('Successfully copied logo to ic_stat_icon_default.png');
} catch (err) {
    console.error('Error copying assets:', err);
    process.exit(1);
}
