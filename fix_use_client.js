const fs = require('fs');
const path = require('path');

const files = [
  'src/app/admin/organizations/[orgId]/page.tsx',
  'src/app/admin/organizations/[orgId]/stores/[storeId]/page.tsx',
  'src/app/admin/organizations/page.tsx'
];

for (const file of files) {
  const p = path.join(__dirname, file);
  let c = fs.readFileSync(p, 'utf8');
  
  // If the file starts with the import instead of "use client";
  if (c.startsWith('import { useToast }')) {
    // Remove "use client"; from wherever it is
    c = c.replace(/"use client";\n?/g, '');
    // And add it strictly to the very top
    c = '"use client";\n' + c;
    fs.writeFileSync(p, c);
    console.log("Fixed", file);
  } else if (c.includes('"use client";') && c.indexOf('"use client";') !== 0) {
    c = c.replace(/"use client";\n?/g, '');
    c = '"use client";\n' + c;
    fs.writeFileSync(p, c);
    console.log("Fixed", file);
  }
}
