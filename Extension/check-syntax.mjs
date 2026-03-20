import fs from 'fs';
import { parse } from 'acorn';

const files = [
    './content-paste-redactor.js',
    './lib/patterns.js',
    './lib/redactor.js',
    './lib/ui-utils.js'
];

for (const file of files) {
    try {
        const code = fs.readFileSync(file, 'utf8');
        parse(code, { ecmaVersion: 2022, sourceType: 'module' });
        console.log("PASS: " + file);
    } catch (err) {
        console.error("FAIL: " + file + " - " + err.message);
    }
}
