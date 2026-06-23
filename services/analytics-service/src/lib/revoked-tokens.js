export const revokedEmails = new Set();

export function addRevoked(email) {
  revokedEmails.add(email);
  setTimeout(() => revokedEmails.delete(email), 2 * 60 * 60 * 1000);
}
