import React from "react";

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
  const toggleModel = (model: string) => {
    if (selectedModels.includes(model)) {
      onChange(selectedModels.filter((m) => m !== model));
    } else {
      onChange([...selectedModels, model]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Participants ({selectedModels.length})
      </label>
      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50">
        {availableModels.map((model) => (
          <label
            key={model}
            className={`flex items-center p-2 rounded cursor-pointer hover:bg-gray-100 transition-colors ${
              disabled ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <input
              type="checkbox"
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              checked={selectedModels.includes(model)}
              onChange={() => !disabled && toggleModel(model)}
              disabled={disabled}
            />
            <span className="ml-2 text-sm text-gray-700">{model}</span>
          </label>
        ))}
      </div>
    </div>
  );
};
