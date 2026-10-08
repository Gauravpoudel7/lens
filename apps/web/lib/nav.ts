/** The path a new user follows: check a token, read the record, go Pro, then the account. */
export const NAV = [
  { href: "/check", label: "Check" },
  { href: "/", label: "Record" },
  { href: "/pro", label: "Pro" },
  { href: "/account", label: "Account" },
  { href: "/verify", label: "Verify" },
];

export function isCurrent(path: string, href: string): boolean {
  if (href === "/") return path === "/" || path.startsWith("/r/");
  return path === href || path.startsWith(`${href}/`);
}
