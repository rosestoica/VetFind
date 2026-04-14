/**
 * Generate a URL-friendly slug from a company name.
 *
 * "Clinică Veterinară Rex" → "clinica-veterinara-rex"
 *
 * Steps: strip diacritics → lowercase → collapse non-alphanumeric runs to "-" → trim hyphens.
 */
export function toCompanySlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip combining diacritics
    .replace(/đ/gi, 'd')
    .replace(/ț/gi, 't')
    .replace(/ș/gi, 's')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
