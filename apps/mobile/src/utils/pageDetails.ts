/** Checks the optional contact details of a company page. Returns a plain-words problem, or '' when everything is fine. */
export const pageDetailsProblem = (d: { foundedYear?: string | number | null; website?: string | null; email?: string | null; phone?: string | null }): string => {
  const year = d.foundedYear === '' || d.foundedYear == null ? null : Number(d.foundedYear);
  if (year !== null && (!Number.isInteger(year) || year < 1800 || year > new Date().getFullYear())) {
    return `The founding year must be between 1800 and ${new Date().getFullYear()}.`;
  }
  const website = (d.website || '').trim();
  if (website && !/^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(website)) return 'The website must start with http:// or https://.';
  const email = (d.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s]{2,}$/.test(email)) return 'Enter a valid contact email address.';
  const phone = (d.phone || '').trim();
  if (phone && phone.replace(/\D/g, '').length < 7) return 'Enter a valid phone number.';
  return '';
};
