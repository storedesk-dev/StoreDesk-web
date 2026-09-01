const fs = require('fs');
const path = require('path');

const productFile = path.join(__dirname, 'src/app/product/page.tsx');
let productContent = fs.readFileSync(productFile, 'utf8');
productContent = productContent.replace(
  /title: "StoreDesk Features — Price Book, Cost Analysis & Mobile Scanner"/g,
  'title: "Everything at the counter — built for real store operations"'
);
fs.writeFileSync(productFile, productContent);

const howItWorksFile = path.join(__dirname, 'src/app/how-it-works/page.tsx');
let howItWorksContent = fs.readFileSync(howItWorksFile, 'utf8');
howItWorksContent = howItWorksContent.replace(
  /title: "How StoreDesk Works — Architecture, Store Engine & Mobile Scanning"/g,
  'title: "How StoreDesk powers your store"'
).replace(
  /title: "How StoreDesk Works — Store Engine, Desktop & Mobile"/g,
  'title: "How StoreDesk powers your store"'
);
fs.writeFileSync(howItWorksFile, howItWorksContent);

const aboutFile = path.join(__dirname, 'src/app/about/page.tsx');
let aboutContent = fs.readFileSync(aboutFile, 'utf8');
aboutContent = aboutContent.replace(
  /title: "About StoreDesk — Built for C-Store Operations"/g,
  'title: "Why we built StoreDesk — for convenience store operators"'
).replace(
  /title: "About StoreDesk \| Convenience Store Software"/g,
  'title: "Why we built StoreDesk — for convenience store operators"'
);
fs.writeFileSync(aboutFile, aboutContent);

console.log("Patched metadata titles");
