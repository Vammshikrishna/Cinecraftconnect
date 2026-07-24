const fs = require('fs');

const origPath = 'e:\\Cinecraftconnect\\CreatePost_original.tsx';
const currPath = 'e:\\Cinecraftconnect\\src\\pages\\CreatePost.tsx';

const origContent = fs.readFileSync(origPath, 'utf8');
const currContent = fs.readFileSync(currPath, 'utf8');

// Extract the original preview layout block
const origStartStr = "{/* Step 2: Preview */}";
const origEndStr = "{/* Step 3: Details */}";
const origStartIdx = origContent.indexOf(origStartStr);
const origEndIdx = origContent.indexOf(origEndStr);
const origPreviewBlock = origContent.substring(origStartIdx + origStartStr.length, origEndIdx).trim();

// Ensure we successfully extract the block
if (origStartIdx === -1 || origEndIdx === -1) {
    console.error("Could not find the original preview block");
    process.exit(1);
}

// Extract the current mobile preview layout block
const currStartStr = "{/* Step 2: Instagram Mobile APK Photo Editor */}";
const currEndStr = "{/* Step 3: Details */}";
const currStartIdx = currContent.indexOf(currStartStr);
const currEndIdx = currContent.indexOf(currEndStr);
const currPreviewBlock = currContent.substring(currStartIdx + currStartStr.length, currEndIdx).trim();

if (currStartIdx === -1 || currEndIdx === -1) {
    console.error("Could not find the current preview block");
    process.exit(1);
}

// We need to unwrap both from `{step === 'preview' && ( ... )}` so we can wrap them in the conditional.
// In orig:
// {step === 'preview' && (
//      <div className="flex-1 ...
// )}
// In curr:
// {step === 'preview' && (
//      <div className="flex-1 ...
// )}
// We can just regex out the `{step === 'preview' && (` and the trailing `)}`

function unwrapPreview(str) {
    return str.replace(/^{step === 'preview' && \(\s*/m, '').replace(/\s*\)}$/m, '');
}

const origUnwrapped = unwrapPreview(origPreviewBlock);
const currUnwrapped = unwrapPreview(currPreviewBlock);

// Create the merged block
const mergedBlock = `
                    {/* Step 2: Combined Preview/Editor Layout */}
                    {step === 'preview' && (
                        !isMobile ? (
                            // PC LAYOUT
                            ${origUnwrapped}
                        ) : (
                            // MOBILE LAYOUT
                            ${currUnwrapped}
                        )
                    )}
`;

// Replace the block in the current file
const newCurrContent = currContent.substring(0, currStartIdx) + mergedBlock + '\n                    ' + currContent.substring(currEndIdx);

fs.writeFileSync(currPath, newCurrContent);
console.log("Successfully merged layouts!");
