const fs = require('fs');
const path = require('path');

const layoutFile = path.join(__dirname, 'src/app/admin/layout.tsx');
let content = fs.readFileSync(layoutFile, 'utf8');

// The original content has:
// <Link href="/admin" className="flex items-center gap-2">
//   <div className="h-8 w-8 rounded-lg bg-[var(--sd-blue)]" />
//   <span className="font-bold tracking-tight text-lg">Control Plane</span>
// </Link>

content = content.replace(
  /<div className="h-8 w-8 rounded-lg bg-\[var\(--sd-blue\)\]" \/>/,
  '<img src="/brand/logo-mark.svg" alt="StoreDesk" className="h-8 w-8 object-contain" />'
);

fs.writeFileSync(layoutFile, content);
console.log("Patched admin layout blue box");
