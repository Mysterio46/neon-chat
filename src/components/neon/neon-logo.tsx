import logo from "@/assets/neon-logo.png";
import { cn } from "@/lib/utils";

export function NeonLogo({ className }: { className?: string }) {
  return <img src={logo} alt="" aria-hidden width={272} height={272} className={cn("size-7 object-contain", className)} />;
}
