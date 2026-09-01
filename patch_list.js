const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/app/admin/organizations/page.tsx');
let content = fs.readFileSync(file, 'utf8');

// Replace table headers for Org ID
content = content.replace(
  /<th className="px-6 py-5 font-semibold">Org ID<\/th>/,
  ''
);

content = content.replace(
  /<td className="px-6 py-5 font-mono text-\[11px\] text-gray-400 bg-gray-50\/50 rounded inline-block mt-4 ml-4 mb-4 border border-gray-100">\s*\{org.organizationId\}\s*<\/td>/,
  ''
);

// Add Info tooltip to Org Name
content = content.replace(
  /<td className="px-6 py-5">\s*<div className="font-semibold text-gray-900">\{org.name\}<\/div>\s*<div className="text-xs text-gray-500 mt-0\.5">\/\{org.slug\}<\/div>\s*<\/td>/,
  `<td className="px-6 py-5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">{org.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">/{org.slug}</div>
                    </div>
                    <div className="group relative flex items-center justify-center cursor-help ml-2" title={org.organizationId}>
                      <div className="h-5 w-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs font-bold">i</div>
                    </div>
                  </td>`
);

fs.writeFileSync(file, content);
console.log('Patched org list');
