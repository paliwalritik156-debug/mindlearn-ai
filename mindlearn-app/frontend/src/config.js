// Site settings. Set these in a .env file (see .env.example) — nothing here is a secret.
const e = import.meta.env || {}
export const SITE = {
  name: "MindLearn AI",
  url: e.VITE_SITE_URL || "",
  contactEmail: e.VITE_CONTACT_EMAIL || "",
  plausibleDomain: e.VITE_PLAUSIBLE_DOMAIN || "",
  errorEndpoint: e.VITE_ERROR_ENDPOINT || "",
}
