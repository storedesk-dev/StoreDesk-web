const fs = require('fs');
const path = require('path');

const chromeFile = path.join(__dirname, 'src/components/SiteChrome.tsx');
let content = fs.readFileSync(chromeFile, 'utf8');

// The original has:
// width={200}
// height={42}
// priority
// className="h-9 w-auto object-contain"

content = content.replace(
  /width=\{200\}\s*height=\{42\}\s*priority\s*className="h-9 w-auto object-contain"/,
  'width={240}\n            height={48}\n            priority\n            className="h-12 w-auto object-contain"'
);

fs.writeFileSync(chromeFile, content);
console.log("Patched SiteChrome logo size");
