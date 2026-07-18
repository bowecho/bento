import type { CategoryKey, Plans } from "@/lib/planner-types";

export type PlanDragSource = {
  foodId: string;
  date: string;
  category: CategoryKey;
};

export type PlanDropDestination = {
  date: string;
  category: CategoryKey;
  index: number;
};

export function adjustedDropIndex(
  existingIndex: number,
  requestedIndex: number,
  destinationLengthAfterRemoval: number,
) {
  const indexAfterRemoval = existingIndex >= 0 && existingIndex < requestedIndex
    ? requestedIndex - 1
    : requestedIndex;
  return Math.min(Math.max(0, indexAfterRemoval), destinationLengthAfterRemoval);
}

export function movePlannedFood(
  plans: Plans,
  source: PlanDragSource,
  destination: PlanDropDestination,
) {
  const emptyDay = () => ({ breakfast: [], snack: [], lunch: [] });
  const sourceDay = plans[source.date] ?? emptyDay();
  const sourceItems = sourceDay[source.category];
  if (!sourceItems.includes(source.foodId)) return plans;

  const sameMeal = source.date === destination.date
    && source.category === destination.category;
  const destinationDay = plans[destination.date] ?? emptyDay();
  const destinationItems = sameMeal
    ? sourceItems
    : destinationDay[destination.category];
  const existingDestinationIndex = destinationItems.indexOf(source.foodId);
  const nextDestination = destinationItems.filter((id) => id !== source.foodId);
  const targetIndex = adjustedDropIndex(
    existingDestinationIndex,
    destination.index,
    nextDestination.length,
  );
  nextDestination.splice(targetIndex, 0, source.foodId);

  if (sameMeal) {
    return {
      ...plans,
      [source.date]: { ...sourceDay, [source.category]: nextDestination },
    };
  }

  const nextSource = sourceItems.filter((id) => id !== source.foodId);
  if (source.date === destination.date) {
    return {
      ...plans,
      [source.date]: {
        ...sourceDay,
        [source.category]: nextSource,
        [destination.category]: nextDestination,
      },
    };
  }

  return {
    ...plans,
    [source.date]: { ...sourceDay, [source.category]: nextSource },
    [destination.date]: {
      ...destinationDay,
      [destination.category]: nextDestination,
    },
  };
}
