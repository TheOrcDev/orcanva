import { LogoMark } from "@/components/logo-mark";

// The same mark as the studio and sign-in headers
export const Logo = () => (
  <span className="flex items-center gap-2">
    <LogoMark className="size-5" />
    <span className="text-lg font-medium tracking-tight">Orcanva</span>
  </span>
);
