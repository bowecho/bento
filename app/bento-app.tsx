"use client";

import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  Edit3,
  GripVertical,
  Info,
  LayoutGrid,
  ListFilter,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addPlanItemAction,
  addPlanItemsAction,
  createFoodAction,
  deleteFoodAction,
  importFoodsAction,
  removePlanItemAction,
  updateFoodAction,
} from "./actions";
import {
  CATEGORIES,
  type Category,
  type CategoryKey,
  type DayPlan,
  type Food,
  type Plans,
} from "@/lib/planner-types";
type PlannerView = "week" | "month";

const CATEGORY_KEY: Record<Category, CategoryKey> = {
  Breakfast: "breakfast",
  Snack: "snack",
  Lunch: "lunch",
};

const CATEGORY_COLOR: Record<Category, string> = {
  Breakfast: "sun",
  Snack: "berry",
  Lunch: "leaf",
};

function emptyDay(): DayPlan {
  return { breakfast: [], snack: [], lunch: [] };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Bento couldn’t save that change. Please try again.";
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  next.setDate(next.getDate() - (day === 0 ? 6 : day - 1));
  next.setHours(12, 0, 0, 0);
  return next;
}

function getWeek(date: Date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function getMonthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function niceWeekRange(days: Date[]) {
  const start = days[0];
  const end = days[6];
  if (start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString("en-US", { month: "long" })} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function Modal({
  title,
  eyebrow,
  children,
  onClose,
  size = "normal",
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  size?: "normal" | "wide";
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal-card ${size === "wide" ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 id="modal-title">{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function FoodForm({
  food,
  onSave,
  onClose,
  onDelete,
}: {
  food?: Food;
  onSave: (name: string, categories: Category[]) => Promise<void>;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(food?.name ?? "");
  const [categories, setCategories] = useState<Category[]>(food?.categories ?? ["Breakfast"]);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  function toggle(category: Category) {
    setCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || categories.length === 0) return;
    setSaving(true);
    try {
      await onSave(cleanName, categories);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={food ? "Edit food" : "Add a food"}
      eyebrow="Food library"
      onClose={onClose}
    >
      <form onSubmit={submit} className="form-stack">
        <label className="field-label" htmlFor="food-name">Food name</label>
        <input
          ref={inputRef}
          id="food-name"
          className="text-input text-input-large"
          placeholder="e.g. Blueberries"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
        />
        <fieldset>
          <legend className="field-label">Works for</legend>
          <div className="category-choice-grid">
            {CATEGORIES.map((category) => {
              const active = categories.includes(category);
              return (
                <label key={category} className={`category-choice ${active ? "active" : ""}`}>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggle(category)}
                  />
                  <span className={`category-dot ${CATEGORY_COLOR[category]}`} />
                  <span>{category}</span>
                  {active && <Check size={16} />}
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="modal-actions">
          {onDelete && (
            <button type="button" className="button text-danger" onClick={onDelete}>
              <Trash2 size={15} /> Remove
            </button>
          )}
          <span className="modal-action-spacer" />
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button className="button primary" disabled={saving || !name.trim() || categories.length === 0}>
            {saving ? "Saving…" : food ? "Save changes" : "Add food"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FoodCard({
  food,
  usage,
  selected,
  onSelect,
  onEdit,
}: {
  food: Food;
  usage: number;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  function startDrag(event: DragEvent<HTMLDivElement>) {
    event.dataTransfer.setData("application/x-bento-food", food.id);
    event.dataTransfer.effectAllowed = "copy";
  }

  return (
    <div
      className={`food-card ${selected ? "selected" : ""}`}
      draggable
      onDragStart={startDrag}
      data-testid={`food-${food.id}`}
    >
      <button
        className="food-card-main"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${food.name}. ${selected ? "Selected" : "Select to add on touch devices"}`}
      >
        <GripVertical className="drag-handle" size={15} aria-hidden="true" />
        <div className="food-card-content">
          <div className="food-card-topline">
            <strong>{food.name}</strong>
            {usage > 0 && <span className="usage-badge">{usage}× this week</span>}
          </div>
          <div className="food-categories" aria-label="Categories">
            {food.categories.map((category) => (
              <span key={category} className={`mini-dot ${CATEGORY_COLOR[category]}`} title={category} />
            ))}
            <span className="category-names">{food.categories.join(" · ")}</span>
          </div>
        </div>
      </button>
      <button
        className="food-edit"
        aria-label={`Edit ${food.name}`}
        onClick={onEdit}
      >
        <Edit3 size={14} />
      </button>
    </div>
  );
}

function MealZone({
  date,
  category,
  foodIds,
  foodsById,
  selectedFood,
  onAdd,
  onRemove,
}: {
  date: Date;
  category: Category;
  foodIds: string[];
  foodsById: Map<string, Food>;
  selectedFood?: Food;
  onAdd: (foodId: string) => void;
  onRemove: (foodId: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const canTapAdd = selectedFood?.categories.includes(category);
  const selectedFoodName = selectedFood?.name ?? "selected food";
  const label = `${category} for ${date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`;

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const foodId = event.dataTransfer.getData("application/x-bento-food");
    if (foodId) onAdd(foodId);
  }

  return (
    <div
      className={`meal-zone ${CATEGORY_COLOR[category]} ${dragOver ? "drag-over" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={drop}
      data-testid={`meal-${dateKey(date)}-${CATEGORY_KEY[category]}`}
    >
      <div className="meal-zone-heading">
        <div>
          <span className={`category-dot ${CATEGORY_COLOR[category]}`} />
          <span>{category}</span>
        </div>
        <button
          className="meal-add"
          aria-label={canTapAdd ? `Add ${selectedFoodName} to ${label}` : `Select a ${category.toLowerCase()} food first`}
          title={canTapAdd ? `Add ${selectedFoodName}` : `Select a ${category.toLowerCase()} food first`}
          onClick={() => selectedFood && onAdd(selectedFood.id)}
          disabled={!canTapAdd}
        >
          <Plus size={14} />
        </button>
      </div>
      {foodIds.length === 0 ? (
        <button
          className="empty-meal"
          onClick={() => selectedFood && onAdd(selectedFood.id)}
          disabled={!canTapAdd}
        >
          {canTapAdd ? `Add ${selectedFoodName}` : "Drop food here"}
        </button>
      ) : (
        <div className="meal-items">
          {foodIds.map((foodId) => {
            const food = foodsById.get(foodId);
            if (!food) return null;
            return (
              <span className="meal-chip" key={foodId}>
                {food.name}
                <button aria-label={`Remove ${food.name} from ${label}`} onClick={() => onRemove(foodId)}>
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WeekPlanner({
  days,
  plans,
  foodsById,
  selectedFood,
  onAdd,
  onRemove,
  onGenerateDay,
}: {
  days: Date[];
  plans: Plans;
  foodsById: Map<string, Food>;
  selectedFood?: Food;
  onAdd: (date: Date, category: Category, foodId: string) => void;
  onRemove: (date: Date, category: Category, foodId: string) => void;
  onGenerateDay: (date: Date) => void;
}) {
  const today = dateKey(new Date());

  return (
    <div className="week-scroll">
      <div className="week-grid" data-testid="week-grid">
        {days.map((date) => {
          const key = dateKey(date);
          const plan = plans[key] ?? emptyDay();
          const isToday = key === today;
          return (
            <article key={key} className={`day-card ${isToday ? "today" : ""}`}>
              <header className="day-heading">
                <div>
                  <span className="day-name">{date.toLocaleDateString("en-US", { weekday: "short" })}</span>
                  <span className="day-number">{date.getDate()}</span>
                </div>
                <button
                  className="day-sparkle"
                  onClick={() => onGenerateDay(date)}
                  aria-label={`Generate menu for ${date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
                  title="Generate this day"
                >
                  <Sparkles size={14} />
                </button>
              </header>
              {CATEGORIES.map((category) => (
                <MealZone
                  key={category}
                  date={date}
                  category={category}
                  foodIds={plan[CATEGORY_KEY[category]]}
                  foodsById={foodsById}
                  selectedFood={selectedFood}
                  onAdd={(foodId) => onAdd(date, category, foodId)}
                  onRemove={(foodId) => onRemove(date, category, foodId)}
                />
              ))}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function MonthPlanner({
  cursor,
  plans,
  foodsById,
  onSelectDate,
}: {
  cursor: Date;
  plans: Plans;
  foodsById: Map<string, Food>;
  onSelectDate: (date: Date) => void;
}) {
  const days = getMonthGrid(cursor);
  const today = dateKey(new Date());

  return (
    <div className="month-card" data-testid="month-grid">
      <div className="month-weekdays" aria-hidden="true">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="month-grid">
        {days.map((date) => {
          const key = dateKey(date);
          const plan = plans[key] ?? emptyDay();
          const outside = date.getMonth() !== cursor.getMonth();
          const mealFoods = CATEGORIES.map((category) => ({
            category,
            names: plan[CATEGORY_KEY[category]].map((id) => foodsById.get(id)?.name).filter(Boolean) as string[],
          }));
          const total = mealFoods.reduce((sum, meal) => sum + meal.names.length, 0);
          return (
            <button
              key={key}
              className={`month-day ${outside ? "outside" : ""} ${key === today ? "today" : ""}`}
              onClick={() => onSelectDate(date)}
              aria-label={`${date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}, ${total} planned foods`}
            >
              <span className="month-date-number">{date.getDate()}</span>
              <div className="month-meals">
                {mealFoods.map(({ category, names }) =>
                  names.length > 0 ? (
                    <span key={category} className={`month-meal-line ${CATEGORY_COLOR[category]}`}>
                      <i />
                      <span>{names.slice(0, 2).join(", ")}{names.length > 2 ? ` +${names.length - 2}` : ""}</span>
                    </span>
                  ) : null,
                )}
              </div>
              {total === 0 && <span className="month-empty">Plan day</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BulkImport({ onImport, onClose }: { onImport: (text: string) => Promise<number>; onClose: () => void }) {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);

  function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setImporting(true);
    try {
      await onImport(text);
      onClose();
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal title="Import foods" eyebrow="Bulk add" onClose={onClose} size="wide">
      <form className="form-stack" onSubmit={submit}>
        <div className="import-help">
          <Info size={17} />
          <p>One food per line. Add categories after a comma or pipe. If omitted, the food will work for all three meals.</p>
        </div>
        <div className="code-example">
          <span>Blueberries | Breakfast, Snack, Lunch</span>
          <span>Greek yogurt | Breakfast, Snack</span>
          <span>Cucumber | Snack, Lunch</span>
        </div>
        <label className="upload-field">
          <Upload size={17} />
          <span>Choose a .csv or .txt file</span>
          <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={readFile} />
        </label>
        <label className="field-label" htmlFor="bulk-foods">Or paste a list</label>
        <textarea
          id="bulk-foods"
          className="text-area"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Blueberries | Breakfast, Snack, Lunch"
          rows={8}
        />
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button className="button primary" disabled={importing || !text.trim()}>
            {importing ? "Importing…" : "Import foods"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function BentoApp({
  initialFoods,
  initialPlans,
}: {
  initialFoods: Food[];
  initialPlans: Plans;
}) {
  const [foods, setFoods] = useState<Food[]>(initialFoods);
  const [plans, setPlans] = useState<Plans>(initialPlans);
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<PlannerView>("week");
  const [filter, setFilter] = useState<"All" | Category>("All");
  const [search, setSearch] = useState("");
  const [selectedFoodId, setSelectedFoodId] = useState<string>();
  const [foodModal, setFoodModal] = useState<"new" | Food>();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<Food>();
  const [toast, setToast] = useState<string>();

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(undefined), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const weekDays = useMemo(() => getWeek(cursor), [cursor]);
  const weekKeys = useMemo(() => new Set(weekDays.map(dateKey)), [weekDays]);
  const foodsById = useMemo(() => new Map(foods.map((food) => [food.id, food])), [foods]);
  const selectedFood = selectedFoodId ? foodsById.get(selectedFoodId) : undefined;

  const weeklyUsage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const key of weekKeys) {
      const plan = plans[key];
      if (!plan) continue;
      for (const meal of Object.values(plan)) {
        for (const id of meal) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  }, [plans, weekKeys]);

  const visibleFoods = useMemo(() => {
    const query = search.trim().toLowerCase();
    return foods
      .filter((food) => filter === "All" || food.categories.includes(filter))
      .filter((food) => !query || food.name.toLowerCase().includes(query))
      .sort((a, b) => (weeklyUsage.get(a.id) ?? 0) - (weeklyUsage.get(b.id) ?? 0) || a.name.localeCompare(b.name));
  }, [foods, filter, search, weeklyUsage]);

  const variety = useMemo(() => {
    const counts = [...weeklyUsage.values()];
    const total = counts.reduce((sum, count) => sum + count, 0);
    const unique = counts.length;
    const expectedUnique = Math.max(1, Math.min(foods.length, total));
    const coverage = unique / expectedUnique;
    const average = unique === 0 ? 0 : total / unique;
    const variance = unique === 0 ? 0 : counts.reduce((sum, count) => sum + (count - average) ** 2, 0) / unique;
    const imbalance = average === 0 ? 0 : Math.min(1, Math.sqrt(variance) / average);
    const score = total === 0 ? 100 : Math.max(35, Math.round(100 - (1 - coverage) * 60 - imbalance * 30));
    const overuseThreshold = Math.max(3, Math.ceil((total / expectedUnique) * 1.75));
    const repeatedFoods = [...weeklyUsage.entries()].filter(([, count]) => count >= overuseThreshold).length;
    return { total, unique, score, repeatedFoods };
  }, [weeklyUsage, foods.length]);

  const shoppingItems = useMemo(() => {
    return [...weeklyUsage.entries()]
      .map(([id, count]) => ({ food: foodsById.get(id), count }))
      .filter((item): item is { food: Food; count: number } => Boolean(item.food))
      .sort((a, b) => a.food.name.localeCompare(b.food.name));
  }, [weeklyUsage, foodsById]);

  function notify(message: string) {
    setToast(message);
  }

  async function saveFood(name: string, categories: Category[]) {
    const duplicate = foods.find((food) => food.name.toLowerCase() === name.toLowerCase() && food.id !== (typeof foodModal === "object" ? foodModal.id : undefined));
    if (duplicate) {
      notify(`${duplicate.name} is already in your library.`);
      return;
    }
    try {
      if (typeof foodModal === "object") {
        const updated = await updateFoodAction(foodModal.id, { name, categories });
        setFoods((current) => current.map((food) => food.id === updated.id ? updated : food));
        notify(`${name} updated.`);
      } else {
        const created = await createFoodAction({ name, categories });
        setFoods((current) => [...current, created]);
        notify(`${name} added to your library.`);
      }
      setFoodModal(undefined);
    } catch (error) {
      notify(errorMessage(error));
    }
  }

  async function removeFood(food: Food) {
    try {
      await deleteFoodAction(food.id);
      setFoods((current) => current.filter((item) => item.id !== food.id));
      setPlans((current) => {
        const next: Plans = {};
        for (const [key, plan] of Object.entries(current)) {
          next[key] = {
            breakfast: plan.breakfast.filter((id) => id !== food.id),
            snack: plan.snack.filter((id) => id !== food.id),
            lunch: plan.lunch.filter((id) => id !== food.id),
          };
        }
        return next;
      });
      if (selectedFoodId === food.id) setSelectedFoodId(undefined);
      setDeleteCandidate(undefined);
      notify(`${food.name} removed.`);
    } catch (error) {
      notify(errorMessage(error));
    }
  }

  function addToMeal(date: Date, category: Category, foodId: string) {
    const food = foodsById.get(foodId);
    if (!food) return;
    if (!food.categories.includes(category)) {
      notify(`${food.name} isn’t marked for ${category.toLowerCase()}. Edit it to add that category.`);
      return;
    }
    const key = dateKey(date);
    const mealKey = CATEGORY_KEY[category];
    setPlans((current) => {
      const day = current[key] ?? emptyDay();
      if (day[mealKey].includes(foodId)) return current;
      return { ...current, [key]: { ...day, [mealKey]: [...day[mealKey], foodId] } };
    });
    void addPlanItemAction({ date: key, category: mealKey, foodId }).catch((error) => {
      setPlans((current) => {
        const day = current[key];
        if (!day) return current;
        return { ...current, [key]: { ...day, [mealKey]: day[mealKey].filter((id) => id !== foodId) } };
      });
      notify(errorMessage(error));
    });
  }

  function removeFromMeal(date: Date, category: Category, foodId: string) {
    const key = dateKey(date);
    const mealKey = CATEGORY_KEY[category];
    setPlans((current) => {
      const day = current[key];
      if (!day) return current;
      return { ...current, [key]: { ...day, [mealKey]: day[mealKey].filter((id) => id !== foodId) } };
    });
    void removePlanItemAction({ date: key, category: mealKey, foodId }).catch((error) => {
      setPlans((current) => {
        const day = current[key] ?? emptyDay();
        if (day[mealKey].includes(foodId)) return current;
        return { ...current, [key]: { ...day, [mealKey]: [...day[mealKey], foodId] } };
      });
      notify(errorMessage(error));
    });
  }

  function usageInRange(foodId: string, beforeDate: Date, rangeDays: number, sourcePlans: Plans) {
    let count = 0;
    for (let offset = 0; offset < rangeDays; offset++) {
      const plan = sourcePlans[dateKey(addDays(beforeDate, -offset))];
      if (!plan) continue;
      for (const meal of Object.values(plan)) count += meal.filter((id) => id === foodId).length;
    }
    return count;
  }

  function generatedDay(date: Date, sourcePlans: Plans) {
    const key = dateKey(date);
    const existing = sourcePlans[key] ?? emptyDay();
    const targets: Record<CategoryKey, number> = { breakfast: 2, snack: 2, lunch: 3 };
    const nextDay: DayPlan = {
      breakfast: [...existing.breakfast],
      snack: [...existing.snack],
      lunch: [...existing.lunch],
    };
    const usedToday = new Set(Object.values(existing).flat());

    for (const category of CATEGORIES) {
      const mealKey = CATEGORY_KEY[category];
      const need = Math.max(0, targets[mealKey] - nextDay[mealKey].length);
      if (need === 0) continue;
      const ranked = foods
        .filter((food) => food.categories.includes(category) && !nextDay[mealKey].includes(food.id))
        .map((food) => ({
          food,
          score:
            usageInRange(food.id, date, 28, sourcePlans) * 12 +
            (usedToday.has(food.id) ? 28 : 0) +
            Math.random() * 4,
        }))
        .sort((a, b) => a.score - b.score)
        .slice(0, need);
      for (const { food } of ranked) {
        nextDay[mealKey].push(food.id);
        usedToday.add(food.id);
      }
    }
    return nextDay;
  }

  function generateDay(date: Date) {
    if (foods.length === 0) {
      notify("Add a few foods before generating a menu.");
      return;
    }
    const key = dateKey(date);
    const previousDay = plans[key] ?? emptyDay();
    const nextDay = generatedDay(date, plans);
    setPlans((current) => ({ ...current, [key]: nextDay }));
    const items = (Object.keys(nextDay) as CategoryKey[]).flatMap((category) =>
      nextDay[category].map((foodId) => ({ date: key, category, foodId })),
    );
    void addPlanItemsAction(items).catch((error) => {
      setPlans((current) => ({ ...current, [key]: previousDay }));
      notify(errorMessage(error));
    });
    notify(`Filled open spots for ${date.toLocaleDateString("en-US", { weekday: "long" })}.`);
  }

  function generateWeek() {
    if (foods.length === 0) {
      notify("Add a few foods before generating a week.");
      return;
    }
    const previousPlans = plans;
    let nextPlans = { ...plans };
    for (const date of weekDays) {
      nextPlans = { ...nextPlans, [dateKey(date)]: generatedDay(date, nextPlans) };
    }
    setPlans(nextPlans);
    const items = weekDays.flatMap((date) => {
      const key = dateKey(date);
      const day = nextPlans[key];
      return (Object.keys(day) as CategoryKey[]).flatMap((category) =>
        day[category].map((foodId) => ({ date: key, category, foodId })),
      );
    });
    void addPlanItemsAction(items).catch((error) => {
      setPlans(previousPlans);
      notify(errorMessage(error));
    });
    notify("Your week is filled with a low-repeat mix.");
  }

  async function importFoods(text: string) {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const parsed = lines.flatMap((line) => {
      const delimiter = line.includes("|") ? "|" : line.includes(",") ? "," : null;
      const pieces = delimiter ? line.split(delimiter).map((piece) => piece.trim()).filter(Boolean) : [line];
      const name = pieces.shift()?.replace(/^"|"$/g, "").trim();
      if (!name) return [];
      const categoryText = pieces.join(",").toLowerCase();
      const categories = CATEGORIES.filter((category) => categoryText.includes(category.toLowerCase()));
      return [{ name, categories: categories.length > 0 ? [...categories] : [...CATEGORIES] }];
    });
    const existingNames = new Set(foods.map((food) => food.name.toLowerCase()));
    const added = new Set(parsed.filter((food) => !existingNames.has(food.name.toLowerCase())).map((food) => food.name.toLowerCase())).size;
    try {
      const storedFoods = await importFoodsAction(parsed);
      setFoods(storedFoods);
      notify(`${added} ${added === 1 ? "food" : "foods"} imported.`);
      return added;
    } catch (error) {
      notify(errorMessage(error));
      throw error;
    }
  }

  function moveCursor(amount: number) {
    if (view === "week") setCursor((date) => addDays(date, amount * 7));
    else setCursor((date) => new Date(date.getFullYear(), date.getMonth() + amount, 1, 12));
  }

  function selectMonthDate(date: Date) {
    setCursor(date);
    setView("week");
  }

  async function copyShoppingList() {
    const range = niceWeekRange(weekDays);
    const text = [`Bento shopping list — ${range}`, "", ...shoppingItems.map(({ food, count }) => `• ${food.name}${count > 1 ? ` (${count} meals)` : ""}`)].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      notify("Shopping list copied.");
    } catch {
      notify("Copy wasn’t available in this browser.");
    }
  }

  const cursorLabel = view === "week"
    ? niceWeekRange(weekDays)
    : cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <strong>Bento</strong>
            <span>Plan a happier week</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="button secondary shopping-button" onClick={() => setShoppingOpen(true)}>
            <ClipboardList size={17} />
            <span>Shopping list</span>
            {shoppingItems.length > 0 && <b>{shoppingItems.length}</b>}
          </button>
          <button className="button primary" onClick={generateWeek} data-testid="generate-week">
            <Sparkles size={17} />
            Generate week
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="food-library">
          <div className="library-heading">
            <div>
              <p className="eyebrow">Your building blocks</p>
              <h1>Food library</h1>
            </div>
            <button className="square-add" onClick={() => setFoodModal("new")} aria-label="Add a food">
              <Plus size={19} />
            </button>
          </div>

          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="Search foods"
              placeholder="Search foods"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button>}
          </div>

          <div className="filter-row" role="group" aria-label="Filter food categories">
            {(["All", ...CATEGORIES] as const).map((item) => (
              <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>
                {item}
              </button>
            ))}
          </div>

          <div className="touch-tip">
            <GripVertical size={14} />
            <span>Drag a food, or select it and use <Plus size={12} /> on a meal.</span>
          </div>

          <div className="food-list" data-testid="food-list">
            {visibleFoods.map((food) => (
              <FoodCard
                key={food.id}
                food={food}
                usage={weeklyUsage.get(food.id) ?? 0}
                selected={selectedFoodId === food.id}
                onSelect={() => setSelectedFoodId((current) => current === food.id ? undefined : food.id)}
                onEdit={() => setFoodModal(food)}
              />
            ))}
            {visibleFoods.length === 0 && (
              <div className="library-empty">
                <ListFilter size={22} />
                <strong>No foods found</strong>
                <span>Try another filter or add something new.</span>
              </div>
            )}
          </div>

          <button className="import-button" onClick={() => setBulkOpen(true)}>
            <Upload size={16} />
            Import a list
          </button>
        </aside>

        <main className="planner">
          <section className="planner-toolbar">
            <div className="date-navigation">
              <button className="icon-button" onClick={() => moveCursor(-1)} aria-label={`Previous ${view}`}><ChevronLeft size={19} /></button>
              <button className="today-button" onClick={() => setCursor(new Date())}>Today</button>
              <button className="icon-button" onClick={() => moveCursor(1)} aria-label={`Next ${view}`}><ChevronRight size={19} /></button>
              <h2>{cursorLabel}</h2>
            </div>
            <div className="view-switcher" role="group" aria-label="Calendar view">
              <button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>
                <LayoutGrid size={15} /> Week
              </button>
              <button className={view === "month" ? "active" : ""} onClick={() => setView("month")}>
                <CalendarDays size={15} /> Month
              </button>
            </div>
          </section>

          <section className="variety-card" aria-label="Variety guidance">
            <div className="variety-score" style={{ "--score": `${variety.score * 3.6}deg` } as React.CSSProperties}>
              <div><strong>{variety.score}</strong><span>variety</span></div>
            </div>
            <div className="variety-copy">
              <p className="eyebrow"><Sparkles size={13} /> Gentle guidance</p>
              <h3>{variety.total === 0 ? "A fresh week is ready" : variety.repeatedFoods === 0 ? "Lovely mix so far" : "A little room for variety"}</h3>
              <p>
                {variety.total === 0
                  ? "Add foods by dragging them into meals, or let Bento fill the open spots."
                  : variety.repeatedFoods === 0
                    ? `${variety.total} meal picks spread across ${variety.unique} ${variety.unique === 1 ? "food" : "foods"}, with usage kept nicely balanced.`
                    : `${variety.repeatedFoods} ${variety.repeatedFoods === 1 ? "food appears" : "foods appear"} much more often than the rest. You can keep them, or swap in something lower in the library.`}
              </p>
            </div>
            <div className="variety-legend">
              <span><i className="sun" /> Breakfast</span>
              <span><i className="berry" /> Snack</span>
              <span><i className="leaf" /> Lunch</span>
            </div>
          </section>

          {selectedFood && (
            <div className="selection-banner">
              <span><Check size={15} /> <strong>{selectedFood.name}</strong> selected</span>
              <span>Use the + in an eligible meal to add it.</span>
              <button onClick={() => setSelectedFoodId(undefined)}>Done</button>
            </div>
          )}

          {view === "week" ? (
            <WeekPlanner
              days={weekDays}
              plans={plans}
              foodsById={foodsById}
              selectedFood={selectedFood}
              onAdd={addToMeal}
              onRemove={removeFromMeal}
              onGenerateDay={generateDay}
            />
          ) : (
            <MonthPlanner cursor={cursor} plans={plans} foodsById={foodsById} onSelectDate={selectMonthDate} />
          )}

          <p className="planner-footnote">
            Bento’s suggestions prioritize variety based on recent use. Nutrition guidance will become possible when foods include details beyond their names.
          </p>
        </main>
      </div>

      {foodModal && (
        <FoodForm
          food={typeof foodModal === "object" ? foodModal : undefined}
          onSave={saveFood}
          onClose={() => setFoodModal(undefined)}
          onDelete={typeof foodModal === "object" ? () => { setDeleteCandidate(foodModal); setFoodModal(undefined); } : undefined}
        />
      )}

      {bulkOpen && <BulkImport onImport={importFoods} onClose={() => setBulkOpen(false)} />}

      {shoppingOpen && (
        <Modal title="Shopping list" eyebrow={niceWeekRange(weekDays)} onClose={() => setShoppingOpen(false)}>
          {shoppingItems.length === 0 ? (
            <div className="shopping-empty">
              <ClipboardList size={28} />
              <strong>Your list will build itself</strong>
              <p>Plan a few meals and every food used this week will appear here.</p>
            </div>
          ) : (
            <div className="shopping-list">
              {shoppingItems.map(({ food, count }) => (
                <div key={food.id}>
                  <span><i />{food.name}</span>
                  <b>{count} {count === 1 ? "meal" : "meals"}</b>
                </div>
              ))}
            </div>
          )}
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setShoppingOpen(false)}>Close</button>
            <button className="button primary" onClick={copyShoppingList} disabled={shoppingItems.length === 0}>
              <Copy size={16} /> Copy list
            </button>
          </div>
        </Modal>
      )}

      {deleteCandidate && (
        <Modal title={`Remove ${deleteCandidate.name}?`} eyebrow="Food library" onClose={() => setDeleteCandidate(undefined)}>
          <p className="delete-copy">This also removes it from every planned meal. This action can’t be undone.</p>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setDeleteCandidate(undefined)}>Keep food</button>
            <button className="button danger" onClick={() => removeFood(deleteCandidate)}><Trash2 size={16} /> Remove</button>
          </div>
        </Modal>
      )}

      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  );
}
