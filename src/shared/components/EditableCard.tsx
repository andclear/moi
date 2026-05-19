import { Pencil } from "lucide-react";

interface EditableCardProps {
  title: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

export function EditableCard({ title, value, placeholder, onChange }: EditableCardProps) {
  return (
    <label className="block rounded-[var(--animal-radius)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] p-4 text-[var(--animal-text-body)] shadow-[0_3px_0_0_var(--animal-shadow-input)]">
      <span className="flex items-center gap-2 font-display text-lg font-black">
        <Pencil aria-hidden="true" size={16} />
        {title}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-3 min-h-32 w-full resize-y border border-[rgba(36,49,65,0.22)] bg-[rgba(255,252,244,0.76)] p-3 font-mono text-sm leading-6 outline-none focus:border-[var(--echo-stamp)]"
      />
    </label>
  );
}
