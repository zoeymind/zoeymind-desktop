import { copyFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const target = process.cwd()
copyFileSync(resolve(root, "LICENSE"), resolve(target, "LICENSE"))
copyFileSync(resolve(root, "NOTICE"), resolve(target, "NOTICE"))
