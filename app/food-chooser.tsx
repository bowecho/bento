"use client";

import { Check, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { FOOD_CATEGORY_LABELS } from "@/lib/food-categories";
import type { Food } from "@/lib/planner-types";

type FoodChooserProps = {
  label: string;
  help: string;
  foods: Food[];
  selectedIds: string[];
  excludedId?: string;
  onChange: (ids: string[]) => void;
};

export function FoodChooser({
  label,
  help,
  foods,
  selectedIds,
  excludedId,
  onChange,
}: FoodChooserProps) {
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const availableFoods = useMemo(
    () => foods.filter(({ id }) => id !== excludedId),
    [excludedId, foods],
  );
  const visibleFoods = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return availableFoods
      .filter(({ name }) => !normalizedQuery || name.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        if (selected.has(a.id) !== selected.has(b.id)) return selected.has(a.id) ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [availableFoods, query, selected]);
  const selectedFoods = availableFoods
    .filter(({ id }) => selected.has(id))
    .sort((a, b) => a.name.localeCompare(b.name));

  function toggle(foodId: string) {
    onChange(
      selected.has(foodId)
        ? selectedIds.filter((id) => id !== foodId)
        : [...selectedIds, foodId],
    );
  }

  return (
    <fieldset className="food-chooser">
      <legend>{label} <span>Optional</span></legend>
      <p>{help}</p>

      {selectedFoods.length > 0 && (
        <div className="food-chooser-selected" aria-label={`Selected for ${label}`}>
          {selectedFoods.map((food) => (
            <button
              key={food.id}
              type="button"
              onClick={() => toggle(food.id)}
              aria-label={`Remove ${food.name} from ${label}`}
            >
              {food.name}<X size={12} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      <div className="food-chooser-search">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a food"
          aria-label={`Search foods for ${label}`}
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label={`Clear ${label} search`}>
            <X size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="food-chooser-options">
        {visibleFoods.map((food) => {
          const isSelected = selected.has(food.id);
          return (
            <button
              key={food.id}
              type="button"
              className={isSelected ? "selected" : ""}
              aria-pressed={isSelected}
              onClick={() => toggle(food.id)}
            >
              <span className="food-chooser-check" aria-hidden="true">
                {isSelected && <Check size={12} />}
              </span>
              <span>{food.name}</span>
              <small>{FOOD_CATEGORY_LABELS[food.category]}</small>
            </button>
          );
        })}
        {visibleFoods.length === 0 && <em>No matching foods</em>}
      </div>
    </fieldset>
  );
}
