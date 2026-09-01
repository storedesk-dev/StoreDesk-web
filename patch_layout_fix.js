const fs = require('fs');
const path = require('path');

const layoutFile = path.join(__dirname, 'src/app/layout.tsx');
let content = fs.readFileSync(layoutFile, 'utf8');

content = content.replace(
  /<body className=\{`\$\{sans\.variable\} \$\{mono\.variable\} antialiased`\}>\{children\}        <\/ToastProvider>\n      <\/body>/,
  '<body className={`${sans.variable} ${mono.variable} antialiased`}>\n        <ToastProvider>{children}</ToastProvider>\n      </body>'
);

fs.writeFileSync(layoutFile, content);
console.log("Patched layout.tsx");
