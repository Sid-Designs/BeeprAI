import { cn } from "@/lib/cn";
import { Select } from "@/components/shared/CustomSelect";

export function Label({ children, className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("mb-1.5 block text-sm font-medium text-[#5b7190]", className)} {...props}>
      {children}
    </label>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-[#d4e3f7] bg-white px-3.5 text-[#0c1a2e] placeholder:text-[#94a3b8]",
        "transition-[border-color,box-shadow] duration-200",
        "focus:border-[#0ea5e9] focus:outline-none focus:ring-[3px] focus:ring-[#0ea5e9]/15",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[120px] w-full resize-y rounded-xl border border-[#d4e3f7] bg-white px-3.5 py-3 text-[#0c1a2e] placeholder:text-[#94a3b8]",
        "transition-[border-color,box-shadow] duration-200",
        "focus:border-[#0ea5e9] focus:outline-none focus:ring-[3px] focus:ring-[#0ea5e9]/15",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
