import { LogoMark } from "@/components/logo-mark";

// The same mark as the studio and sign-in headers
export const Logo = () => (
  <span className="flex items-center gap-2">
    <LogoMark className="size-5" />
    <span className="font-heading text-lg font-semibold">Orcanva</span>
  </span>
);
