const fs = require('fs');
const path = require('path');

const headerFile = path.join(__dirname, 'src/app/admin/AdminHeader.tsx');
let content = fs.readFileSync(headerFile, 'utf8');

content = content.replace(
  /width=\{160\}\s*height=\{36\}\s*className="h-9 w-auto object-contain"/,
  'width={240}\n            height={48}\n            className="h-12 w-auto object-contain"'
);

fs.writeFileSync(headerFile, content);
console.log("Patched admin header logo size");
