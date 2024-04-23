import path, { posix } from 'path'
import { globSync } from 'glob'
import { normalizePath } from './utils.js'

export type Violation = { file: string; name: string; line: number }

export class Resource {
  public extViolations: Violation[] = []
  public nameViolations: Violation[] = []
  public numFiles = 0
  public duration = 0
  protected readonly rscPath: string
  protected static ignore = ['.txt', '.md', '.empty']

  constructor(
    public readonly name: string,
    protected readonly workingDir: string,
    basePath: string,
    public readonly extensions: string[],
    protected readonly prefix: string[],
    protected readonly ignoreFiles: string[]
  ) {
    const dataPath = posix.resolve(basePath, '..', '..', '_work', 'data')
    this.rscPath = posix.join(dataPath, name.toLowerCase(), '**/*')
  }

  public validate(): void {
    const start = performance.now()
    const resourceFiles = globSync(this.rscPath, { nocase: true })
    this.numFiles = resourceFiles.length

    for (const file of resourceFiles) {
      if (this.ignoreFiles.includes(normalizePath(file).toUpperCase())) continue

      const rel = normalizePath(path.relative(this.workingDir, file))
      const ext = posix.extname(file)
      const baseName = posix.basename(file, ext)

      // Check for valid file extension
      const allowedExtensions = this.extensions.concat(Resource.ignore)
      const extL = ext.toLowerCase()
      if (extL && !allowedExtensions.includes(extL)) {
        this.extViolations.push({ file: rel, name: ext, line: 0 })
        continue
      }

      // Check for valid file name, exluding animations (they have generated names)
      if (this.name.toLowerCase() !== 'anims') {
        const baseNameU = baseName.toUpperCase()
        if (!Resource.ignore.includes(extL) && !this.prefix.some((p) => baseNameU.includes(p))) {
          this.nameViolations.push({ file: rel, name: baseName, line: 0 })
        }
      }
    }
    this.duration = performance.now() - start
  }

  public static from(workingDir: string, basePath: string, prefix: string[], ignoreList: string[]): Resource[] {
    workingDir = normalizePath(workingDir)
    basePath = normalizePath(basePath)
    ignoreList = ignoreList.map((i) => normalizePath(i).toUpperCase())

    const resources = {
      Anims: ['.man', '.mdh', '.mdl', '.mdm', '.mmb', '.msb'],
      Meshes: ['.mrm', '.msh'],
      Presets: ['.zen'],
      Sound: ['.wav', '.mp3', '.ogg'],
      Textures: ['.tex', '.fnt'],
      Worlds: ['.zen'],
    }

    const output: Resource[] = []
    for (const [rsc, ext] of Object.entries(resources)) {
      const r = new Resource(rsc, workingDir, basePath, ext, prefix, ignoreList)
      r.validate()
      if (r.numFiles > 0) output.push(r)
    }
    return output
  }
}
