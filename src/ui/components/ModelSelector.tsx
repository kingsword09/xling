import React from "react";
import { useI18n } from "@/ui/i18n";
import { cn } from "@/ui/lib/utils";

interface ModelSelectorProps {
  availableModels: string[];
  selectedModels: string[];
  onChange: (models: string[]) => void;
  disabled?: boolean;
  className?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  availableModels,
  selectedModels,
  onChange,
  disabled,
  className,
}) => {
  const { t } = useI18n();
  const toggleModel = (model: string) => {
    if (selectedModels.includes(model)) {
      onChange(selectedModels.filter((m) => m !== model));
    } else {
      onChange([...selectedModels, model]);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <label className="block text-sm font-bold uppercase text-foreground">
        {t("participants")} ({selectedModels.length})
      </label>
      <div className="max-h-48 overflow-y-auto neo-box-sm p-2 bg-neo-white">
        {availableModels.map((model) => (
          <label
            key={model}
            className={cn(
              "flex items-center p-2 cursor-pointer border-2 border-transparent hover:border-neo-black transition-all hover:bg-neo-yellow/20",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            <input
              type="checkbox"
              className="w-4 h-4 rounded-none border-2 border-neo-black text-neo-black focus:ring-0 checked:bg-neo-black"
              checked={selectedModels.includes(model)}
              onChange={() => !disabled && toggleModel(model)}
              disabled={disabled}
            />
            <span className="ml-2 text-sm font-bold text-foreground">
              {model}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};
