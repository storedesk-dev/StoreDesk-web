const fs = require('fs');
const path = require('path');

const pageFile = path.join(__dirname, 'src/app/admin/organizations/[orgId]/page.tsx');
let content = fs.readFileSync(pageFile, 'utf8');

content = content.replace(
  /onChange=\{e => setNewUserPassword\(e\.target\.value\)\}\n\s*className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-\[var\(--sd-blue\)\] outline-none"\n\s*placeholder="Enter password"\n\s*required/,
  'onChange={e => setNewUserPassword(e.target.value)}\n                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--sd-blue)] outline-none"\n                  placeholder="Enter password"\n                  minLength={8}\n                  pattern=".*\\\\d.*"\n                  title="Password must be at least 8 characters and include a number"\n                  required'
);

fs.writeFileSync(pageFile, content);
console.log("Patched html validation");
