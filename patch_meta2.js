const fs = require('fs');
const path = require('path');

const productFile = path.join(__dirname, 'src/app/product/page.tsx');
let productContent = fs.readFileSync(productFile, 'utf8');
productContent = productContent.replace(
  /title: "Everything at the counter — built for real store operations"/g,
  'title: "Everything at the counter built for real store operations"'
);
fs.writeFileSync(productFile, productContent);

const aboutFile = path.join(__dirname, 'src/app/about/page.tsx');
let aboutContent = fs.readFileSync(aboutFile, 'utf8');
aboutContent = aboutContent.replace(
  /title: "Why we built StoreDesk — for convenience store operators"/g,
  'title: "Why we built StoreDesk for convenience store operators"'
);
fs.writeFileSync(aboutFile, aboutContent);

console.log("Patched metadata titles to remove dashes");
