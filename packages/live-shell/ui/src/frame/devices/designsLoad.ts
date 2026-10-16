// The catalogue's designs, as the shell loads them on first need (designs.ts requestDesign imports this module dynamically): the
// catalogue's own loader (inhabitants/catalogue/panels/index.ts loadDesign — a reference device at once, every
// `<family>__<face>.tsx` module on demand) and the designs' own layout sheet, which the gallery's page loads beside them.
import '../../inhabitants/catalogue/panels/panels.css'
export {loadDesign, DESIGNED_IDS} from '../../inhabitants/catalogue/panels'
