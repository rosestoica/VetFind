/**
 * Generate a URL-friendly slug from a company name.
 * Must produce the same output as the frontend `toCompanySlug`.
 *
 * "Clinică Veterinară Rex" → "clinica-veterinara-rex"
 */
export function toCompanySlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/ț/gi, 't')
    .replace(/ș/gi, 's')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
