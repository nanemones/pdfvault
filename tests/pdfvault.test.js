import { describe, expect, test } from "bun:test"
import * as PDFLib from "pdf-lib"
import ops from "../src/pdf-ops.js"
import license from "../src/license.js"

async function makeDummyPdf(pageCount) {
  const doc = await PDFLib.PDFDocument.create()
  for (let i = 0; i < pageCount; i++) {
    const p = doc.addPage([400, 600])
    p.drawText(`Page ${i + 1}`, { x: 50, y: 500, size: 18 })
  }
  return await doc.save()
}

describe("PDFVault Core Operations (Real pdf-lib)", () => {
  test("parsePageRanges handles ranges, duplicates, and bounds", () => {
    expect(ops.parsePageRanges("1-3, 5, 2, 99", 6)).toEqual([0, 1, 2, 4])
    expect(ops.parsePageRanges("4-2", 5)).toEqual([1, 2, 3])
  })

  test("mergePdfs merges multiple real PDFs accurately", async () => {
    const a = await makeDummyPdf(2)
    const b = await makeDummyPdf(3)
    const mergedBytes = await ops.mergePdfs(PDFLib, [a, b])
    const loaded = await PDFLib.PDFDocument.load(mergedBytes)
    expect(loaded.getPageCount()).toBe(5)
  })

  test("extractPages extracts exact page range", async () => {
    const docBytes = await makeDummyPdf(6)
    const res = await ops.extractPages(PDFLib, docBytes, "2-4, 6")
    expect(res.extractedCount).toBe(4)
    expect(res.totalPages).toBe(6)
    const loaded = await PDFLib.PDFDocument.load(res.bytes)
    expect(loaded.getPageCount()).toBe(4)
  })

  test("rotatePdf rotates all pages by 90 degrees", async () => {
    const docBytes = await makeDummyPdf(2)
    const rotated = await ops.rotatePdf(PDFLib, docBytes, 90)
    const loaded = await PDFLib.PDFDocument.load(rotated)
    expect(loaded.getPages()[0].getRotation().angle).toBe(90)
    expect(loaded.getPages()[1].getRotation().angle).toBe(90)
  })

  test("watermarkPdf stamps watermark without corrupting PDF", async () => {
    const docBytes = await makeDummyPdf(2)
    const stamped = await ops.watermarkPdf(PDFLib, docBytes, "CONFIDENTIAL")
    const loaded = await PDFLib.PDFDocument.load(stamped)
    expect(loaded.getPageCount()).toBe(2)
    expect(stamped.length).toBeGreaterThan(docBytes.length)
  })
})

describe("PDFVault License Verifier", () => {
  test("accepts valid Gumroad license and rejects refunded", async () => {
    const ok = await license.verifyGumroadLicense("KEY-1", async () => ({
      ok: true,
      json: async () => ({ success: true, purchase: { email: "buyer@test.com", refunded: false } }),
    }))
    const ref = await license.verifyGumroadLicense("KEY-2", async () => ({
      ok: true,
      json: async () => ({ success: true, purchase: { refunded: true } }),
    }))
    expect(ok.valid).toBe(true)
    expect(ref.valid).toBe(false)
  })
})
