/**
 * No Cloudflare Worker (com nodejs_compat), `self` pode existir mas não há `DOMParser` global.
 * O `xml-core` (usado por xmldsigjs) cai em `getNodeDependency('DOMParser')` e exige `setNodeDependencies`.
 */
import * as xmldom from '@xmldom/xmldom'
import * as xpath from 'xpath'
import { setNodeDependencies } from 'xml-core'

let done = false

export function ensureXmlCoreNodeDependencies(): void {
  if (done) return
  done = true
  setNodeDependencies({
    DOMParser: xmldom.DOMParser,
    XMLSerializer: xmldom.XMLSerializer,
    DOMImplementation: xmldom.DOMImplementation,
    xpath: { select: xpath.select.bind(xpath) },
  })
}
