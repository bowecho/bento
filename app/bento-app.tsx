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
  LayoutGrid,
  ListFilter,
  Moon,
  Palette,
  Plus,
  Search,
  Sun,
  Tags,
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
  createCategoryAction,
  createFoodAction,
  deleteCategoryAction,
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
  type FoodCategory,
  type Plans,
} from "@/lib/planner-types";
type PlannerView = "week" | "month";
type FoodDetails = Pick<Food, "name" | "categoryId">;

const COLOR_THEMES = [
  { id: "ink", name: "Ink", description: "Black & white", swatches: ["#111111", "#707070", "#f4f4f4"] },
  { id: "cobalt", name: "Cobalt", description: "Clear blue", swatches: ["#225ea8", "#74a9cf", "#eaf3fb"] },
  { id: "ruby", name: "Ruby", description: "Confident red", swatches: ["#b72e3d", "#df7782", "#faecee"] },
  { id: "evergreen", name: "Evergreen", description: "Deep green", swatches: ["#27704a", "#75aa8d", "#e8f3ed"] },
  { id: "saffron", name: "Saffron", description: "Golden yellow", swatches: ["#a66a08", "#dbad55", "#faf2df"] },
  { id: "amethyst", name: "Amethyst", description: "Rich purple", swatches: ["#7045a0", "#aa88c9", "#f1ebf7"] },
  { id: "lagoon", name: "Lagoon", description: "Fresh teal", swatches: ["#18777a", "#69afb0", "#e7f4f3"] },
  { id: "tangerine", name: "Tangerine", description: "Warm orange", swatches: ["#bd5b1d", "#e39768", "#fbefe7"] },
  { id: "rosewood", name: "Rosewood", description: "Dusty pink", swatches: ["#a94468", "#d0829e", "#f8eaf0"] },
  { id: "iris", name: "Iris", description: "Blue violet", swatches: ["#514fb0", "#8d8bd3", "#ececf9"] },
  { id: "moss", name: "Moss", description: "Earthy olive", swatches: ["#65752d", "#a2ad6d", "#f0f2e5"] },
  { id: "espresso", name: "Espresso", description: "Warm brown", swatches: ["#74513b", "#ad8970", "#f3ece7"] },
] as const;

type ColorTheme = (typeof COLOR_THEMES)[number]["id"];
type DisplayMode = "light" | "dark";

function isColorTheme(value: string | undefined): value is ColorTheme {
  return COLOR_THEMES.some((theme) => theme.id === value);
}

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

function ThemePicker({
  selected,
  mode,
  onSelect,
  onModeSelect,
  onClose,
}: {
  selected: ColorTheme;
  mode: DisplayMode;
  onSelect: (theme: ColorTheme) => void;
  onModeSelect: (mode: DisplayMode) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Choose a theme" eyebrow="Make Bento yours" onClose={onClose} size="wide">
      <div className="theme-picker-intro">
        <p className="theme-picker-copy">Choose an appearance and a color direction.</p>
        <div className="theme-mode-control" role="group" aria-label="Appearance mode">
          <button type="button" className={mode === "light" ? "active" : ""} onClick={() => onModeSelect("light")} aria-pressed={mode === "light"}>
            <Sun size={14} aria-hidden="true" /> Light
          </button>
          <button type="button" className={mode === "dark" ? "active" : ""} onClick={() => onModeSelect("dark")} aria-pressed={mode === "dark"}>
            <Moon size={14} aria-hidden="true" /> Dark
          </button>
        </div>
      </div>
      <div className="theme-grid" role="radiogroup" aria-label="Bento color themes">
        {COLOR_THEMES.map((theme) => {
          const active = selected === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              className={`theme-option ${active ? "active" : ""}`}
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(theme.id)}
              style={{
                "--swatch-one": theme.swatches[0],
                "--swatch-two": theme.swatches[1],
                "--swatch-three": theme.swatches[2],
              } as React.CSSProperties}
            >
              <span className="theme-swatch" aria-hidden="true"><i /><i /><i /></span>
              <span className="theme-option-copy"><strong>{theme.name}</strong><small>{theme.description}</small></span>
              <span className="theme-check" aria-hidden="true">{active && <Check size={14} />}</span>
            </button>
          );
        })}
      </div>
      <div className="modal-actions"><button className="button primary" onClick={onClose}>Done</button></div>
    </Modal>
  );
}

function FoodForm({
  food,
  categories,
  onSave,
  onClose,
  onDelete,
}: {
  food?: Food;
  categories: FoodCategory[];
  onSave: (details: FoodDetails) => Promise<void>;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(food?.name ?? "");
  const [categoryId, setCategoryId] = useState(food?.categoryId ?? categories[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    setSaving(true);
    try {
      await onSave({
        name: cleanName,
        categoryId,
      });
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
        <label className="field-label" htmlFor="food-category">Category</label>
        <select
          id="food-category"
          className="select-input"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          required
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
        <div className="modal-actions">
          {onDelete && (
            <button type="button" className="button text-danger" onClick={onDelete}>
              <Trash2 size={15} /> Remove
            </button>
          )}
          <span className="modal-action-spacer" />
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button className="button primary" disabled={saving || !name.trim() || !categoryId}>
            {saving ? "Saving…" : food ? "Save changes" : "Add food"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FoodCard({
  food,
  categoryName,
  onEdit,
}: {
  food: Food;
  categoryName: string;
  onEdit: () => void;
}) {
  function startDrag(event: DragEvent<HTMLDivElement>) {
    event.dataTransfer.setData("application/x-bento-food", food.id);
    event.dataTransfer.effectAllowed = "copy";
  }

  return (
    <div
      className="food-card"
      draggable
      onDragStart={startDrag}
      data-testid={`food-${food.id}`}
      aria-label={`Drag ${food.name} to a meal`}
    >
      <div className="food-card-main">
        <GripVertical className="drag-handle" size={15} aria-hidden="true" />
        <div className="food-card-content">
          <div className="food-card-topline">
            <strong>{food.name}</strong>
          </div>
          <div className="food-card-meta">
            <span className="food-category-badge">
              {categoryName}
            </span>
          </div>
        </div>
      </div>
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
  onAdd,
  onRemove,
}: {
  date: Date;
  category: Category;
  foodIds: string[];
  foodsById: Map<string, Food>;
  onAdd: (foodId: string) => void;
  onRemove: (foodId: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
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
      role="group"
      aria-label={label}
      data-testid={`meal-${dateKey(date)}-${CATEGORY_KEY[category]}`}
    >
      <div className="meal-zone-heading">
        <div>
          <span>{category}</span>
        </div>
      </div>
      {foodIds.length === 0 ? (
        <div className="empty-meal" aria-hidden="true" />
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
  onAdd,
  onRemove,
}: {
  days: Date[];
  plans: Plans;
  foodsById: Map<string, Food>;
  onAdd: (date: Date, category: Category, foodId: string) => void;
  onRemove: (date: Date, category: Category, foodId: string) => void;
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
              </header>
              {CATEGORIES.map((category) => (
                <MealZone
                  key={category}
                  date={date}
                  category={category}
                  foodIds={plan[CATEGORY_KEY[category]]}
                  foodsById={foodsById}
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

function CategoryManager({
  categories,
  foods,
  onAdd,
  onRemove,
  onClose,
}: {
  categories: FoodCategory[];
  foods: Food[];
  onAdd: (name: string) => Promise<void>;
  onRemove: (category: FoodCategory) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onAdd(name.trim());
      setName("");
    } catch {
      // The parent displays the database error in Bento's toast.
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Manage categories" eyebrow="Food library" onClose={onClose}>
      <form className="category-add-form" onSubmit={submit}>
        <label className="field-label" htmlFor="new-category">New category</label>
        <div>
          <input
            id="new-category"
            className="text-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Treats"
            maxLength={40}
          />
          <button className="button primary" disabled={saving || !name.trim()}>
            <Plus size={15} /> {saving ? "Adding…" : "Add"}
          </button>
        </div>
      </form>

      <div className="category-manager-list">
        {categories.map((category) => {
          const count = foods.filter((food) => food.categoryId === category.id).length;
          return (
            <div key={category.id}>
              <span><strong>{category.name}</strong><small>{count} {count === 1 ? "food" : "foods"}</small></span>
              <button
                type="button"
                className="category-remove"
                onClick={() => onRemove(category)}
                disabled={categories.length <= 1}
                aria-label={`Remove ${category.name} category`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

function DeleteCategoryDialog({
  category,
  categories,
  foodCount,
  onDelete,
  onCancel,
}: {
  category: FoodCategory;
  categories: FoodCategory[];
  foodCount: number;
  onDelete: (replacementCategoryId?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const replacements = categories.filter((item) => item.id !== category.id);
  const [replacementCategoryId, setReplacementCategoryId] = useState(replacements[0]?.id ?? "");
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await onDelete(foodCount > 0 ? replacementCategoryId : undefined);
    } catch {
      // The parent displays the database error in Bento's toast.
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal title={`Remove ${category.name}?`} eyebrow="Food categories" onClose={onCancel}>
      {foodCount > 0 ? (
        <>
          <p className="delete-copy">Choose where to move the {foodCount} {foodCount === 1 ? "food" : "foods"} in this category.</p>
          <label className="field-label" htmlFor="replacement-category">Move foods to</label>
          <select
            id="replacement-category"
            className="select-input"
            value={replacementCategoryId}
            onChange={(event) => setReplacementCategoryId(event.target.value)}
          >
            {replacements.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </>
      ) : (
        <p className="delete-copy">This category is empty and can be removed safely.</p>
      )}
      <div className="modal-actions">
        <button className="button secondary" onClick={onCancel} disabled={deleting}>Keep category</button>
        <button
          className="button danger"
          onClick={() => void confirmDelete()}
          disabled={deleting || (foodCount > 0 && !replacementCategoryId)}
        >
          <Trash2 size={15} /> {deleting ? "Removing…" : "Remove category"}
        </button>
      </div>
    </Modal>
  );
}

function BulkImport({
  categories,
  onImport,
  onClose,
}: {
  categories: FoodCategory[];
  onImport: (text: string, categoryId: string) => Promise<number>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
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
    if (!text.trim() || !categoryId) return;
    setImporting(true);
    try {
      await onImport(text, categoryId);
      onClose();
    } catch {
      // The parent displays the database error in Bento's toast.
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal title="Import foods" eyebrow="Bulk add" onClose={onClose} size="wide">
      <form className="form-stack" onSubmit={submit}>
        <div className="import-help">
          <Tags size={17} />
          <p>One food per line. Every food in this import will use the category you choose below.</p>
        </div>
        <div className="code-example">
          <span>Blueberries</span>
          <span>Turkey sandwich meat</span>
          <span>Whole-grain crackers</span>
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
          placeholder={"Blueberries\nTurkey sandwich meat\nWhole-grain crackers"}
          rows={8}
        />
        <label className="field-label" htmlFor="bulk-category">Category for these foods</label>
        <select
          id="bulk-category"
          className="select-input"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          required
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button className="button primary" disabled={importing || !text.trim() || !categoryId}>
            {importing ? "Importing…" : "Import foods"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function BentoApp({
  initialCategories,
  initialFoods,
  initialPlans,
}: {
  initialCategories: FoodCategory[];
  initialFoods: Food[];
  initialPlans: Plans;
}) {
  const [categories, setCategories] = useState<FoodCategory[]>(initialCategories);
  const [foods, setFoods] = useState<Food[]>(initialFoods);
  const [plans, setPlans] = useState<Plans>(initialPlans);
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<PlannerView>("week");
  const [search, setSearch] = useState("");
  const [activeFoodCategory, setActiveFoodCategory] = useState<string | "all">("all");
  const [foodModal, setFoodModal] = useState<"new" | Food>();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [categoryDeleteCandidate, setCategoryDeleteCandidate] = useState<FoodCategory>();
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  });
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    if (typeof document === "undefined") return "ink";
    const current = document.documentElement.dataset.palette;
    return isColorTheme(current) ? current : "ink";
  });
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
  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const weekFoodIds = useMemo(() => {
    const ids = new Set<string>();
    for (const key of weekKeys) {
      const plan = plans[key];
      if (!plan) continue;
      for (const meal of Object.values(plan)) {
        for (const id of meal) ids.add(id);
      }
    }
    return ids;
  }, [plans, weekKeys]);

  const visibleFoods = useMemo(() => {
    const query = search.trim().toLowerCase();
    return foods
      .filter((food) => activeFoodCategory === "all" || food.categoryId === activeFoodCategory)
      .filter((food) => !query || food.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeFoodCategory, foods, search]);

  const groupedVisibleFoods = useMemo(() => categories.flatMap((category) => {
    const categoryFoods = visibleFoods.filter((food) => food.categoryId === category.id);
    return categoryFoods.length > 0 ? [{ ...category, foods: categoryFoods }] : [];
  }), [categories, visibleFoods]);

  const shoppingItems = useMemo(() => {
    return foods
      .filter((food) => weekFoodIds.has(food.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [foods, weekFoodIds]);

  function notify(message: string) {
    setToast(message);
  }

  async function addCategory(name: string) {
    try {
      const storedCategories = await createCategoryAction({ name });
      setCategories(storedCategories);
      notify(`${name} added.`);
    } catch (error) {
      notify(errorMessage(error));
      throw error;
    }
  }

  async function removeCategory(
    category: FoodCategory,
    replacementCategoryId?: string,
  ) {
    try {
      const result = await deleteCategoryAction({
        id: category.id,
        replacementCategoryId,
      });
      setCategories(result.categories);
      setFoods(result.foods);
      if (activeFoodCategory === category.id) setActiveFoodCategory("all");
      setCategoryDeleteCandidate(undefined);
      notify(`${category.name} removed.`);
    } catch (error) {
      notify(errorMessage(error));
      throw error;
    }
  }

  async function saveFood(details: FoodDetails) {
    const duplicate = foods.find((food) => food.name.toLowerCase() === details.name.toLowerCase() && food.id !== (typeof foodModal === "object" ? foodModal.id : undefined));
    if (duplicate) {
      notify(`${duplicate.name} is already in your library.`);
      return;
    }
    try {
      if (typeof foodModal === "object") {
        const storedFoods = await updateFoodAction(foodModal.id, details);
        setFoods(storedFoods);
        notify(`${details.name} updated.`);
      } else {
        const storedFoods = await createFoodAction(details);
        setFoods(storedFoods);
        notify(`${details.name} added to your library.`);
      }
      setFoodModal(undefined);
    } catch (error) {
      notify(errorMessage(error));
    }
  }

  async function removeFood(food: Food) {
    try {
      const storedFoods = await deleteFoodAction(food.id);
      setFoods(storedFoods);
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
      setDeleteCandidate(undefined);
      notify(`${food.name} removed.`);
    } catch (error) {
      notify(errorMessage(error));
    }
  }

  function addToMeal(date: Date, category: Category, foodId: string) {
    const food = foodsById.get(foodId);
    if (!food) return;
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

  async function importFoods(text: string, categoryId: string) {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const parsed = lines
      .map((line) => line.replace(/^"|"$/g, "").trim())
      .filter(Boolean);
    const existingNames = new Set(foods.map((food) => food.name.toLowerCase()));
    const added = new Set(parsed.filter((name) => !existingNames.has(name.toLowerCase())).map((name) => name.toLowerCase())).size;
    try {
      const storedFoods = await importFoodsAction({ names: parsed, categoryId });
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
    const text = [`Bento shopping list — ${range}`, "", ...shoppingItems.map((food) => `• ${food.name}`)].join("\n");
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

  function selectDisplayMode(nextMode: DisplayMode) {
    document.documentElement.dataset.theme = nextMode;
    setDisplayMode(nextMode);
    try {
      window.localStorage.setItem("bento-theme", nextMode);
    } catch {
      // The appearance selection still works when browser storage is unavailable.
    }
  }

  function selectColorTheme(nextTheme: ColorTheme) {
    document.documentElement.dataset.palette = nextTheme;
    setColorTheme(nextTheme);
    try {
      window.localStorage.setItem("bento-color-theme", nextTheme);
    } catch {
      // Theme selection still works when browser storage is unavailable.
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <strong>Bento</strong>
            <span>Little meals, lots of love</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="theme-toggle palette-toggle" onClick={() => setThemePickerOpen(true)} aria-label="Choose theme and appearance" title="Choose theme and appearance">
            <Palette size={18} aria-hidden="true" />
          </button>
          <button className="button secondary shopping-button" onClick={() => setShoppingOpen(true)}>
            <ClipboardList size={17} />
            <span>Shopping list</span>
            {shoppingItems.length > 0 && <b>{shoppingItems.length}</b>}
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="food-library">
          <div className="library-heading">
            <div>
              <p className="eyebrow">Pack the week</p>
              <h1>Food library</h1>
            </div>
            <div className="library-heading-actions">
              <button className="square-manage" onClick={() => setCategoryManagerOpen(true)} aria-label="Manage food categories" title="Manage categories">
                <Tags size={17} />
              </button>
              <button className="square-add" onClick={() => setFoodModal("new")} aria-label="Add a food">
                <Plus size={19} />
              </button>
            </div>
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

          <div className="food-category-filter" role="group" aria-label="Filter food categories">
            <button
              type="button"
              className={activeFoodCategory === "all" ? "active" : ""}
              aria-pressed={activeFoodCategory === "all"}
              onClick={() => setActiveFoodCategory("all")}
            >
              All <span>{foods.length}</span>
            </button>
            {categories.map((category) => {
              const count = foods.filter((food) => food.categoryId === category.id).length;
              return (
                <button
                  key={category.id}
                  type="button"
                  className={activeFoodCategory === category.id ? "active" : ""}
                  aria-pressed={activeFoodCategory === category.id}
                  onClick={() => setActiveFoodCategory(category.id)}
                >
                  {category.name} <span>{count}</span>
                </button>
              );
            })}
          </div>

          <div className="food-list" data-testid="food-list">
            {groupedVisibleFoods.map((group) => (
              <section className="food-category-group" key={group.id} data-category={group.id}>
                <div className="food-category-heading">
                  <h2>{group.name}</h2>
                  <span>{group.foods.length}</span>
                </div>
                <div className="food-category-items">
                  {group.foods.map((food) => (
                    <FoodCard
                      key={food.id}
                      food={food}
                      categoryName={categoriesById.get(food.categoryId)?.name ?? "Uncategorized"}
                      onEdit={() => setFoodModal(food)}
                    />
                  ))}
                </div>
              </section>
            ))}
            {visibleFoods.length === 0 && (
              <div className="library-empty">
                <ListFilter size={22} />
                <strong>{foods.length === 0 ? "Your bento box is empty" : "No foods found"}</strong>
                <span>{foods.length === 0 ? "Add a first favorite and start packing." : "Try another search or category."}</span>
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

          {view === "week" ? (
            <WeekPlanner
              days={weekDays}
              plans={plans}
              foodsById={foodsById}
              onAdd={addToMeal}
              onRemove={removeFromMeal}
            />
          ) : (
            <MonthPlanner cursor={cursor} plans={plans} foodsById={foodsById} onSelectDate={selectMonthDate} />
          )}

        </main>
      </div>

      {themePickerOpen && (
        <ThemePicker
          selected={colorTheme}
          mode={displayMode}
          onSelect={selectColorTheme}
          onModeSelect={selectDisplayMode}
          onClose={() => setThemePickerOpen(false)}
        />
      )}

      {categoryManagerOpen && (
        <CategoryManager
          categories={categories}
          foods={foods}
          onAdd={addCategory}
          onRemove={(category) => {
            setCategoryManagerOpen(false);
            setCategoryDeleteCandidate(category);
          }}
          onClose={() => setCategoryManagerOpen(false)}
        />
      )}

      {categoryDeleteCandidate && (
        <DeleteCategoryDialog
          category={categoryDeleteCandidate}
          categories={categories}
          foodCount={foods.filter((food) => food.categoryId === categoryDeleteCandidate.id).length}
          onDelete={(replacementCategoryId) => removeCategory(categoryDeleteCandidate, replacementCategoryId)}
          onCancel={() => {
            setCategoryDeleteCandidate(undefined);
            setCategoryManagerOpen(true);
          }}
        />
      )}

      {foodModal && (
        <FoodForm
          food={typeof foodModal === "object" ? foodModal : undefined}
          categories={categories}
          onSave={saveFood}
          onClose={() => setFoodModal(undefined)}
          onDelete={typeof foodModal === "object" ? () => { setDeleteCandidate(foodModal); setFoodModal(undefined); } : undefined}
        />
      )}

      {bulkOpen && <BulkImport categories={categories} onImport={importFoods} onClose={() => setBulkOpen(false)} />}

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
              {shoppingItems.map((food) => (
                <div key={food.id}>
                  <span><i />{food.name}</span>
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
