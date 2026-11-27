// Pure local PDF operations powered by pdf-lib (zero cloud uploads).

(function (globalScope) {
  function parsePageRanges(rangeStr, totalPages) {
    const raw = String(rangeStr || "").trim()
    if (!raw) {
      return Array.from({ length: totalPages }, (_, i) => i)
    }
    const indices = new Set()
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean)
    for (const part of parts) {
      const m = part.match(/^(\d+)\s*-\s*(\d+)$/)
      if (m) {
        let start = parseInt(m[1], 10)
        let end = parseInt(m[2], 10)
        if (start > end) [start, end] = [end, start]
        for (let p = start; p <= end; p++) {
          if (p >= 1 && p <= totalPages) indices.add(p - 1)
        }
      } else if (/^\d+$/.test(part)) {
        const p = parseInt(part, 10)
        if (p >= 1 && p <= totalPages) indices.add(p - 1)
      }
    }
    return Array.from(indices).sort((a, b) => a - b)
  }

  async function mergePdfs(PDFLib, byteArrays) {
    const out = await PDFLib.PDFDocument.create()
    for (const bytes of byteArrays) {
      const src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true })
      const copied = await out.copyPages(src, src.getPageIndices())
      for (const page of copied) out.addPage(page)
    }
    return await out.save()
  }

  async function extractPages(PDFLib, bytes, rangeStr) {
    const src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true })
    const total = src.getPageCount()
    const indices = parsePageRanges(rangeStr, total)
    if (indices.length === 0) {
      throw new Error(`No valid pages in "${rangeStr}" (document has ${total} pages).`)
    }
    const out = await PDFLib.PDFDocument.create()
    const copied = await out.copyPages(src, indices)
    for (const page of copied) out.addPage(page)
    return { bytes: await out.save(), extractedCount: indices.length, totalPages: total }
  }

  async function rotatePdf(PDFLib, bytes, angleDegrees = 90, rangeStr = "") {
    const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true })
    const total = doc.getPageCount()
    const indices = parsePageRanges(rangeStr, total)
    const pages = doc.getPages()
    for (const idx of indices) {
      const current = pages[idx].getRotation().angle || 0
      pages[idx].setRotation(PDFLib.degrees((current + angleDegrees) % 360))
    }
    return await doc.save()
  }

  async function watermarkPdf(PDFLib, bytes, text, options = {}) {
    const label = String(text || "").trim()
    if (!label) throw new Error("Please enter watermark text.")
    const opacity = Number(options.opacity ?? 0.22)
    const fontSize = Number(options.fontSize ?? 42)

    const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true })
    const font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold)
    const pages = doc.getPages()

    for (const page of pages) {
      const { width, height } = page.getSize()
      const textWidth = font.widthOfTextAtSize(label, fontSize)
      page.drawText(label, {
        x: Math.max(24, (width - textWidth * 0.7) / 2),
        y: height / 2,
        size: fontSize,
        font,
        color: PDFLib.rgb(0.82, 0.16, 0.26),
        opacity,
        rotate: PDFLib.degrees(35),
      })
    }
    return await doc.save()
  }

  async function imagesToPdf(PDFLib, imageItems) {
    // imageItems: Array<{ bytes: Uint8Array, mime: string }>
    if (!imageItems || imageItems.length === 0) {
      throw new Error("Please add at least one PNG or JPG image.")
    }
    const doc = await PDFLib.PDFDocument.create()
    for (const item of imageItems) {
      const isPng = (item.mime || "").toLowerCase().includes("png")
      const img = isPng
        ? await doc.embedPng(item.bytes)
        : await doc.embedJpg(item.bytes)
      const dims = img.scale(1)
      const page = doc.addPage([dims.width, dims.height])
      page.drawImage(img, { x: 0, y: 0, width: dims.width, height: dims.height })
    }
    return await doc.save()
  }

  const api = {
    parsePageRanges,
    mergePdfs,
    extractPages,
    rotatePdf,
    watermarkPdf,
    imagesToPdf,
  }

  globalScope.PDFVaultOps = api
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api
  }
})(typeof globalThis !== "undefined" ? globalThis : window)
