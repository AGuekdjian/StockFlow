await Promise.all(['../src/app.js', '../src/config/env.js'].map((path) => import(path)));
console.log('Backend modules loaded successfully.');
