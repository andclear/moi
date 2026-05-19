import { Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  parseCharacterProfileYaml,
  serializeCharacterProfileYaml,
  type CharacterYamlObject,
  type CharacterYamlValue,
} from "@/features/characterProfile/characterProfileYaml";
import { Button } from "@/shared/components/ui/button";

interface CharacterProfileModalProps {
  open: boolean;
  yaml: string;
  onClose: () => void;
  onSave: (yaml: string) => Promise<void>;
}

function cloneWithUpdate(
  value: CharacterYamlObject,
  path: string[],
  updater: (current: CharacterYamlValue) => CharacterYamlValue,
): CharacterYamlObject {
  if (path.length === 0) {
    return value;
  }

  const [key, ...rest] = path;
  const current = value[key];
  if (rest.length === 0) {
    return { ...value, [key]: updater(current ?? "") };
  }

  if (!current || typeof current === "string" || Array.isArray(current)) {
    return value;
  }

  return {
    ...value,
    [key]: cloneWithUpdate(current, rest, updater),
  };
}

function shouldUseTextarea(key: string, value: string) {
  return (
    value.length > 40 ||
    ["气味", "核心驱动力", "恐惧与弱点", "创伤与转折点", "说话风格", "习惯性小动作", "其他", "经历"].includes(
      key,
    )
  );
}

interface FieldEditorProps {
  label: string;
  value: CharacterYamlValue;
  path: string[];
  depth?: number;
  onChange: (path: string[], nextValue: CharacterYamlValue) => void;
}

function FieldEditor({ label, value, path, depth = 0, onChange }: FieldEditorProps) {
  if (Array.isArray(value)) {
    return (
      <section className="rounded-[var(--animal-radius)] border-2 border-[var(--animal-border)] bg-[rgba(255,255,255,0.42)] p-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-display text-base font-black text-[var(--animal-text)]">{label}</h4>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onChange(path, [...value, ""])}
          >
            <Plus aria-hidden="true" size={15} />
            添加
          </Button>
        </div>
        <div className="mt-3 grid gap-3">
          {value.length === 0 ? (
            <p className="text-sm font-bold text-[var(--animal-text-muted)]">暂无条目。</p>
          ) : null}
          {value.map((item, index) => (
            <div
              key={`${path.join(".")}-${index}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2"
            >
              <textarea
                value={item}
                onChange={(event) => {
                  const nextItems = [...value];
                  nextItems[index] = event.target.value;
                  onChange(path, nextItems);
                }}
                className="min-h-20 resize-y"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                danger
                aria-label={`删除${label}条目`}
                onClick={() => onChange(path, value.filter((_, itemIndex) => itemIndex !== index))}
              >
                <Trash2 aria-hidden="true" size={16} />
              </Button>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (typeof value === "string") {
    return (
      <label className={shouldUseTextarea(label, value) ? "grid gap-2 md:col-span-2" : "grid gap-2"}>
        <span className="text-sm font-black text-[var(--animal-text)]">{label}</span>
        {shouldUseTextarea(label, value) ? (
          <textarea
            value={value}
            onChange={(event) => onChange(path, event.target.value)}
            className="min-h-28 resize-y"
          />
        ) : (
          <input value={value} onChange={(event) => onChange(path, event.target.value)} />
        )}
      </label>
    );
  }

  return (
    <section
      className={
        depth === 0
          ? "rounded-[var(--animal-radius)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] p-5 shadow-[0_3px_0_0_var(--animal-shadow-input)]"
          : "rounded-[var(--animal-radius)] border border-[var(--animal-border)] bg-[rgba(255,255,255,0.34)] p-4 md:col-span-2"
      }
    >
      <h3
        className={
          depth === 0
            ? "font-display text-xl font-black text-[var(--animal-text)]"
            : "font-display text-base font-black text-[var(--animal-text)]"
        }
      >
        {label}
      </h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {Object.entries(value).map(([childKey, childValue]) => (
          <FieldEditor
            key={[...path, childKey].join(".")}
            label={childKey}
            value={childValue}
            path={[...path, childKey]}
            depth={depth + 1}
            onChange={onChange}
          />
        ))}
      </div>
    </section>
  );
}

export function CharacterProfileModal({
  open,
  yaml,
  onClose,
  onSave,
}: CharacterProfileModalProps) {
  const [formValue, setFormValue] = useState<CharacterYamlObject>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    try {
      const parsed = parseCharacterProfileYaml(yaml);
      setFormValue(parsed);
      setErrorMessage(Object.keys(parsed).length === 0 ? "角色信息为空，请重新生成。" : null);
    } catch (error) {
      setFormValue({});
      setErrorMessage(error instanceof Error ? error.message : "角色信息解析失败。");
    }
  }, [open, yaml]);

  async function handleSave() {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onSave(serializeCharacterProfileYaml(formValue));
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "角色信息保存失败。");
    } finally {
      setIsSaving(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(61,52,40,0.42)] px-4 py-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="character-profile-title"
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[var(--animal-radius)] border-2 border-[var(--animal-border)] bg-[var(--animal-bg)] text-[var(--animal-text-body)] shadow-[0_18px_50px_rgba(61,52,40,0.28)]"
      >
        <header className="flex items-start justify-between gap-4 border-b-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--animal-primary)]">
              Character Profile
            </p>
            <h2
              id="character-profile-title"
              className="mt-1 font-display text-2xl font-black text-[var(--animal-text)]"
            >
              角色信息
            </h2>
            <p className="mt-2 text-sm font-bold leading-6 text-[var(--animal-text-muted)]">
              可以直接编辑任意字段。长文本字段会使用文本区域，方便整理完整设定。
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="关闭角色信息" onClick={onClose}>
            <X aria-hidden="true" size={19} />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {errorMessage ? (
          <p className="mb-4 rounded-[var(--animal-radius)] border-2 border-[var(--animal-error)] bg-[rgba(224,90,90,0.1)] p-3 text-sm font-bold leading-6 text-[var(--animal-error-active)]">
            {errorMessage}
          </p>
        ) : null}
        <div className="grid gap-4">
          {Object.entries(formValue).map(([key, value]) => (
            <FieldEditor
              key={key}
              label={key}
              value={value}
              path={[key]}
              onChange={(path, nextValue) =>
                setFormValue((current) => cloneWithUpdate(current, path, () => nextValue))
              }
            />
          ))}
        </div>
        </div>

        <footer className="flex flex-wrap justify-end gap-3 border-t-2 border-[var(--animal-border)] bg-[var(--animal-bg-content)] px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            type="button"
            loading={isSaving}
            className="min-w-44 border-[var(--animal-primary-active)] bg-[var(--animal-primary)] text-white shadow-[0_5px_0_0_var(--animal-primary-active)] hover:shadow-[0_6px_0_0_var(--animal-primary-active)]"
            onClick={() => void handleSave()}
          >
            <Save aria-hidden="true" size={17} />
            保存角色信息
          </Button>
        </footer>
      </section>
    </div>
  );
}
