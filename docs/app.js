// Main workbench controller for PDFVault (works both as Firefox/Chrome Extension and Standalone Web App).

(() => {
  const state = {
    isPro: false,
    mergeFiles: [],
    splitFile: null,
    rotateFile: null,
    wmFile: null,
    imgFiles: [],
  }

  const els = {
    planBadge: document.getElementById("plan-badge"),
    topUpgrade: document.getElementById("top-upgrade"),
    toast: document.getElementById("toast"),
    tabs: Array.from(document.querySelectorAll(".tab")),
    panels: {
      merge: document.getElementById("panel-merge"),
      split: document.getElementById("panel-split"),
      rotate: document.getElementById("panel-rotate"),
      watermark: document.getElementById("panel-watermark"),
      images: document.getElementById("panel-images"),
    },
    mergeInput: document.getElementById("merge-input"),
    mergeList: document.getElementById("merge-list"),
    btnMergeRun: document.getElementById("btn-merge-run"),
    btnMergeClear: document.getElementById("btn-merge-clear"),
    splitInput: document.getElementById("split-input"),
    splitFileLabel: document.getElementById("split-file-label"),
    splitRange: document.getElementById("split-range"),
    btnSplitRun: document.getElementById("btn-split-run"),
    rotateInput: document.getElementById("rotate-input"),
    rotateFileLabel: document.getElementById("rotate-file-label"),
    rotateAngle: document.getElementById("rotate-angle"),
    btnRotateRun: document.getElementById("btn-rotate-run"),
    wmInput: document.getElementById("wm-input"),
    wmFileLabel: document.getElementById("wm-file-label"),
    wmText: document.getElementById("wm-text"),
    btnWmRun: document.getElementById("btn-wm-run"),
    imgInput: document.getElementById("img-input"),
    imgList: document.getElementById("img-list"),
    btnImgRun: document.getElementById("btn-img-run"),
    proBox: document.getElementById("pro-box"),
    proActiveBox: document.getElementById("pro-active-box"),
    licenseInput: document.getElementById("license-input"),
    btnActivate: document.getElementById("btn-activate"),
    btnDeactivate: document.getElementById("btn-deactivate"),
    licenseMsg: document.getElementById("license-msg"),
  }

  let toastTimer = null
  function showToast(msg, isError = false) {
    els.toast.textContent = msg
    els.toast.classList.toggle("error", isError)
    els.toast.classList.remove("hidden")
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => els.toast.classList.add("hidden"), 3500)
  }

  function downloadPdf(bytes, filename) {
    const blob = new Blob([bytes], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  }

  function updateProUI() {
    if (state.isPro) {
      els.planBadge.textContent = "PRO"
      els.planBadge.className = "badge badge-pro"
      els.topUpgrade.classList.add("hidden")
      els.proBox.classList.add("hidden")
      els.proActiveBox.classList.remove("hidden")
    } else {
      els.planBadge.textContent = "FREE"
      els.planBadge.className = "badge badge-free"
      els.topUpgrade.classList.remove("hidden")
      els.proBox.classList.remove("hidden")
      els.proActiveBox.classList.add("hidden")
    }
  }

  function requirePro(label) {
    if (state.isPro) return true
    showToast(`${label} is a PDFVault Pro feature ($14.99 one-time).`, true)
    els.licenseInput.focus()
    return false
  }

  // Tab switching
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab
      els.tabs.forEach((t) => t.classList.toggle("active", t === tab))
      Object.entries(els.panels).forEach(([k, p]) => p.classList.toggle("hidden", k !== target))
    })
  })

  // Merge UI
  function renderMergeList() {
    while (els.mergeList.firstChild) els.mergeList.removeChild(els.mergeList.firstChild)
    state.mergeFiles.forEach((file, idx) => {
      const li = document.createElement("li")
      li.className = "file-item"

      const name = document.createElement("span")
      name.textContent = `${idx + 1}. ${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`
      li.appendChild(name)

      const actions = document.createElement("div")
      actions.className = "file-actions"

      const up = document.createElement("button")
      up.className = "mini-btn"
      up.type = "button"
      up.textContent = "↑"
      up.addEventListener("click", () => {
        if (idx === 0) return
        ;[state.mergeFiles[idx - 1], state.mergeFiles[idx]] = [state.mergeFiles[idx], state.mergeFiles[idx - 1]]
        renderMergeList()
      })

      const down = document.createElement("button")
      down.className = "mini-btn"
      down.type = "button"
      down.textContent = "↓"
      down.addEventListener("click", () => {
        if (idx === state.mergeFiles.length - 1) return
        ;[state.mergeFiles[idx + 1], state.mergeFiles[idx]] = [state.mergeFiles[idx], state.mergeFiles[idx + 1]]
        renderMergeList()
      })

      const del = document.createElement("button")
      del.className = "mini-btn"
      del.type = "button"
      del.textContent = "✕"
      del.addEventListener("click", () => {
        state.mergeFiles.splice(idx, 1)
        renderMergeList()
      })

      actions.append(up, down, del)
      li.appendChild(actions)
      els.mergeList.appendChild(li)
    })
  }

  els.mergeInput.addEventListener("change", () => {
    const added = Array.from(els.mergeInput.files || [])
    state.mergeFiles.push(...added)
    els.mergeInput.value = ""
    renderMergeList()
  })

  els.btnMergeClear.addEventListener("click", () => {
    state.mergeFiles = []
    renderMergeList()
  })

  els.btnMergeRun.addEventListener("click", async () => {
    if (state.mergeFiles.length < 2) {
      showToast("Please add at least 2 PDF files to merge.", true)
      return
    }
    if (state.mergeFiles.length > 2 && !requirePro("Merging 3+ PDFs")) return
    try {
      const buffers = await Promise.all(state.mergeFiles.map((f) => f.arrayBuffer()))
      const bytes = await PDFVaultOps.mergePdfs(window.PDFLib, buffers)
      downloadPdf(bytes, "pdfvault-merged.pdf")
      showToast(`Merged ${state.mergeFiles.length} PDFs offline!`)
    } catch (err) {
      showToast(`Merge failed: ${err.message}`, true)
    }
  })

  // Split UI
  els.splitInput.addEventListener("change", () => {
    state.splitFile = els.splitInput.files?.[0] || null
    els.splitFileLabel.textContent = state.splitFile ? state.splitFile.name : "Click to choose 1 PDF file"
  })

  els.btnSplitRun.addEventListener("click", async () => {
    if (!state.splitFile) {
      showToast("Please choose a PDF file first.", true)
      return
    }
    const range = els.splitRange.value.trim()
    const isSinglePage = /^\d+$/.test(range)
    if (!isSinglePage && !requirePro("Multi-page range extraction")) return
    try {
      const buf = await state.splitFile.arrayBuffer()
      const res = await PDFVaultOps.extractPages(window.PDFLib, buf, range)
      downloadPdf(res.bytes, `extracted-${state.splitFile.name}`)
      showToast(`Extracted ${res.extractedCount} of ${res.totalPages} pages!`)
    } catch (err) {
      showToast(err.message, true)
    }
  })

  // Rotate UI
  els.rotateInput.addEventListener("change", () => {
    state.rotateFile = els.rotateInput.files?.[0] || null
    els.rotateFileLabel.textContent = state.rotateFile ? state.rotateFile.name : "Click to choose 1 PDF file"
  })

  els.btnRotateRun.addEventListener("click", async () => {
    if (!state.rotateFile) {
      showToast("Please choose a PDF file first.", true)
      return
    }
    try {
      const angle = Number(els.rotateAngle.value) || 90
      const buf = await state.rotateFile.arrayBuffer()
      const bytes = await PDFVaultOps.rotatePdf(window.PDFLib, buf, angle)
      downloadPdf(bytes, `rotated-${state.rotateFile.name}`)
      showToast(`Rotated PDF by ${angle}° offline!`)
    } catch (err) {
      showToast(err.message, true)
    }
  })

  // Watermark UI (Pro)
  els.wmInput.addEventListener("change", () => {
    state.wmFile = els.wmInput.files?.[0] || null
    els.wmFileLabel.textContent = state.wmFile ? state.wmFile.name : "Click to choose 1 PDF file"
  })

  els.btnWmRun.addEventListener("click", async () => {
    if (!requirePro("PDF Watermarking")) return
    if (!state.wmFile) {
      showToast("Please choose a PDF file first.", true)
      return
    }
    try {
      const buf = await state.wmFile.arrayBuffer()
      const bytes = await PDFVaultOps.watermarkPdf(window.PDFLib, buf, els.wmText.value)
      downloadPdf(bytes, `watermarked-${state.wmFile.name}`)
      showToast("Stamped watermark offline!")
    } catch (err) {
      showToast(err.message, true)
    }
  })

  // Images -> PDF UI (Pro)
  els.imgInput.addEventListener("change", () => {
    state.imgFiles = Array.from(els.imgInput.files || [])
    while (els.imgList.firstChild) els.imgList.removeChild(els.imgList.firstChild)
    state.imgFiles.forEach((f, i) => {
      const li = document.createElement("li")
      li.className = "file-item"
      li.textContent = `${i + 1}. ${f.name}`
      els.imgList.appendChild(li)
    })
  })

  els.btnImgRun.addEventListener("click", async () => {
    if (!requirePro("Images to PDF")) return
    if (state.imgFiles.length === 0) {
      showToast("Please choose at least 1 PNG or JPG image.", true)
      return
    }
    try {
      const items = await Promise.all(
        state.imgFiles.map(async (f) => ({
          bytes: new Uint8Array(await f.arrayBuffer()),
          mime: f.type || (f.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg"),
        }))
      )
      const bytes = await PDFVaultOps.imagesToPdf(window.PDFLib, items)
      downloadPdf(bytes, "pdfvault-images.pdf")
      showToast(`Converted ${items.length} image(s) to PDF offline!`)
    } catch (err) {
      showToast(err.message, true)
    }
  })

  // License activation
  els.btnActivate.addEventListener("click", async () => {
    const key = els.licenseInput.value.trim()
    els.licenseMsg.classList.add("hidden")
    els.btnActivate.disabled = true
    els.btnActivate.textContent = "..."
    try {
      const res = await PDFVaultLicense.verifyGumroadLicense(key)
      if (!res.valid) {
        els.licenseMsg.textContent = res.error
        els.licenseMsg.classList.remove("hidden")
      } else {
        await PDFVaultLicense.saveLicense(res)
        state.isPro = true
        updateProUI()
        showToast("PDFVault Pro activated! All unlimited offline tools unlocked.")
      }
    } catch {
      els.licenseMsg.textContent = "Network error verifying license."
      els.licenseMsg.classList.remove("hidden")
    } finally {
      els.btnActivate.disabled = false
      els.btnActivate.textContent = "Activate"
    }
  })

  els.btnDeactivate.addEventListener("click", async () => {
    await PDFVaultLicense.clearLicense()
    state.isPro = false
    updateProUI()
    showToast("Pro license removed.")
  })

  ;(async () => {
    if (PDFVaultLicense?.GUMROAD_CHECKOUT_URL) {
      els.topUpgrade.href = PDFVaultLicense.GUMROAD_CHECKOUT_URL
    }
    const saved = await PDFVaultLicense.getSavedLicense()
    state.isPro = Boolean(saved?.valid)
    updateProUI()
  })()
})()
