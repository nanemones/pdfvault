// Zero-backend Gumroad License Key verification for PDFVault Pro ($14.99 one-time).
// Works identically in browser extensions (chrome.storage.local) and standalone Web App (localStorage).

(function (globalScope) {
  const GUMROAD_PRODUCT_ID = "REPLACE_WITH_GUMROAD_PRODUCT_ID"
  const GUMROAD_CHECKOUT_URL = "https://nicolastic1642.gumroad.com/l/pdfvault-pro"
  const STORAGE_KEY = "pdfvault_pro_license"

  async function verifyGumroadLicense(licenseKey, fetchImpl = fetch) {
    const trimmed = (licenseKey || "").trim()
    if (!trimmed) {
      return { valid: false, error: "Please enter a license key." }
    }

    const body = new URLSearchParams({
      product_id: GUMROAD_PRODUCT_ID,
      license_key: trimmed,
      increment_uses_count: "false",
    })

    const response = await fetchImpl("https://api.gumroad.com/v2/licenses/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })

    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.success) {
      return {
        valid: false,
        error: data?.message || "Invalid license key. Please double-check and try again.",
      }
    }

    if (data.purchase?.refunded || data.purchase?.chargebacked) {
      return { valid: false, error: "This license key has been refunded." }
    }

    return {
      valid: true,
      licenseKey: trimmed,
      email: data.purchase?.email || "",
      verifiedAt: new Date().toISOString(),
    }
  }

  async function getSavedLicense() {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const stored = await chrome.storage.local.get(STORAGE_KEY)
      return stored?.[STORAGE_KEY] || null
    }
    try {
      const raw = globalScope.localStorage?.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  async function saveLicense(licenseInfo) {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: licenseInfo })
      return
    }
    try {
      globalScope.localStorage?.setItem(STORAGE_KEY, JSON.stringify(licenseInfo))
    } catch {}
  }

  async function clearLicense() {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.remove(STORAGE_KEY)
      return
    }
    try {
      globalScope.localStorage?.removeItem(STORAGE_KEY)
    } catch {}
  }

  const api = {
    GUMROAD_PRODUCT_ID,
    GUMROAD_CHECKOUT_URL,
    verifyGumroadLicense,
    getSavedLicense,
    saveLicense,
    clearLicense,
  }

  globalScope.PDFVaultLicense = api
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api
  }
})(typeof globalThis !== "undefined" ? globalThis : window)
