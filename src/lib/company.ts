/**
 * Single source of truth for company identity.
 *
 * Everything user-facing — legal pages, the About and Contact pages, the
 * footer — reads from here, so updating a detail happens in exactly one place.
 *
 * ⚠️  Two values below are placeholders you MUST replace before this is public:
 *      - `cmaLicence`  — your real CMA licence number
 *      - `phone`       — your real switchboard number
 *     They are deliberately left as obvious placeholders rather than
 *     realistic-looking invented values.
 */
export const COMPANY = {
  name: "PrimeStone Markets Ltd",
  shortName: "PrimeStone",
  foundedYear: 2019,

  regulator: "Capital Markets Authority (CMA) of Kenya",
  regulatorShort: "CMA",
  cmaLicence: "CMA/IS/XXXX", // TODO: replace with your real CMA licence number

  address: {
    line1: "Garden City Business Park",
    line2: "3rd Floor, Block A",
    street: "Thika Road",
    city: "Nairobi",
    country: "Kenya",
    postal: "P.O. Box 00100, Nairobi",
  },

  email: {
    support: "support@primestone.com",
    sales: "hello@primestone.com",
    compliance: "compliance@primestone.com",
    complaints: "complaints@primestone.com",
  },

  phone: "+254 20 000 0000", // TODO: replace with your real switchboard number
  supportHours: "Monday to Friday, 08:00–18:00 EAT",

  socials: {
    x: "https://x.com/primestone",
    linkedin: "https://linkedin.com/company/primestone",
    instagram: "https://instagram.com/primestone",
  },
} as const;

export function fullAddress() {
  const a = COMPANY.address;
  return `${a.line1}, ${a.line2}, ${a.street}, ${a.city}, ${a.country}`;
}
