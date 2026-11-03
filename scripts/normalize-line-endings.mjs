import { glob, readFile, writeFile } from 'node:fs/promises'

for await (const file of glob('./src/generated/*')) {
  const content = await readFile(file, 'utf8')
  console.log(`${file} -> LF`)
  await writeFile(file, content.replace(/\r\n?/g, '\n'))
}
