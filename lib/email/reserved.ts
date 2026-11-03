// Domains set aside for examples and tests (RFC 2606 and 6761), such as the
// test accounts' orcanva-e2e-…@example.com. Mail to them can only bounce,
// and bounces hurt the sender's standing with mail providers.
const RESERVED_DOMAINS = new Set(["example.com", "example.net", "example.org"]);
const RESERVED_ENDINGS = [".example", ".invalid", ".localhost", ".test"];

export const isReservedAddress = (address: string): boolean => {
  const domain = address.slice(address.lastIndexOf("@") + 1).toLowerCase();
  return (
    domain === "localhost" ||
    RESERVED_DOMAINS.has(domain) ||
    RESERVED_ENDINGS.some(
      (ending) => domain.endsWith(ending) || domain === ending.slice(1)
    )
  );
};
