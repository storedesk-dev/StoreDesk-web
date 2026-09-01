const fs = require('fs');
const path = require('path');

const chromeFile = path.join(__dirname, 'src/components/SiteChrome.tsx');
let content = fs.readFileSync(chromeFile, 'utf8');

content = content.replace(
  /width=\{240\}\s*height=\{48\}\s*priority\s*className="h-12 w-auto object-contain"/,
  'width={320}\n            height={64}\n            priority\n            className="h-16 w-auto object-contain"'
);

fs.writeFileSync(chromeFile, content);
console.log("Patched SiteChrome logo to be even bigger");
