import React from "react";
import { useI18n } from "@/ui/i18n";

interface ModelSelectorProps {
  availableModels: string[];
  selectedModels: string[];
  onChange: (models: string[]) => void;
  disabled?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  availableModels,
  selectedModels,
  onChange,
  disabled,
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
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-foreground">
        {t("participants")} ({selectedModels.length})
      </label>
      <div className="max-h-48 overflow-y-auto border border-white/40 rounded-xl p-2 bg-white/70 dark:bg-white/10 backdrop-blur">
        {availableModels.map((model) => (
          <label
            key={model}
            className={`flex items-center p-2 rounded-lg cursor-pointer hover:bg-primary/5 transition-colors ${
              disabled ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <input
              type="checkbox"
              className="w-4 h-4 text-primary rounded border-white/50 focus:ring-primary"
              checked={selectedModels.includes(model)}
              onChange={() => !disabled && toggleModel(model)}
              disabled={disabled}
            />
            <span className="ml-2 text-sm font-medium text-foreground">
              {model}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};
