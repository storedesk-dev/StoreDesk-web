const fs = require('fs');
const path = require('path');

const layoutFile = path.join(__dirname, 'src/app/admin/layout.tsx');
let content = fs.readFileSync(layoutFile, 'utf8');

content = content.replace(
  /<Link href="\/admin" className="flex items-center gap-2">([\s\S]*?)<\/Link>/,
  `<Link href="/admin" className="flex items-center">
            <img src="/brand/logo-lockup-horizontal.svg" alt="StoreDesk" className="h-10 w-auto object-contain" />
          </Link>`
);

fs.writeFileSync(layoutFile, content);
console.log("Patched admin layout to use full lockup");
