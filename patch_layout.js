const fs = require('fs');
const path = require('path');

const layoutFile = path.join(__dirname, 'src/app/layout.tsx');
let content = fs.readFileSync(layoutFile, 'utf8');

// Insert import at the top
content = content.replace(
  /import "\.\/globals\.css";/,
  'import "./globals.css";\nimport { ToastProvider } from "@/components/ToastContext";'
);

// Wrap children
content = content.replace(
  /<body className="bg-\[var\(--background\)\] text-\[var\(--foreground\)\] antialiased">/,
  '<body className="bg-[var(--background)] text-[var(--foreground)] antialiased">\n        <ToastProvider>'
);

content = content.replace(
  /<\/body>/,
  '        </ToastProvider>\n      </body>'
);

fs.writeFileSync(layoutFile, content);
console.log("Patched layout.tsx");
