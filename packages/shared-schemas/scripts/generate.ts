import { compileFromFile } from 'json-schema-to-typescript';
import * as fs from 'fs';
import * as path from 'path';

async function generate() {
  const schemasDir = path.join(__dirname, '../schemas');
  const srcDir = path.join(__dirname, '../src');

  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  const files = fs.readdirSync(schemasDir).filter(f => f.endsWith('.json'));
  let indexContent = '';

  for (const file of files) {
    const schemaPath = path.join(schemasDir, file);
    const ts = await compileFromFile(schemaPath);
    
    const baseName = file.replace('.json', '');
    const tsFileName = `${baseName}.ts`;
    fs.writeFileSync(path.join(srcDir, tsFileName), ts);
    
    indexContent += `export * from './${baseName}';\n`;
  }

  fs.writeFileSync(path.join(srcDir, 'index.ts'), indexContent);
  console.log('Types generated successfully.');
}

generate().catch(console.error);
