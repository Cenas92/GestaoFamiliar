import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { MealPlanEntry, Recipe } from '../../types/domain';
import {
  addDaysToDateString,
  formatDatePt,
  formatWeekdayShortPt,
  getWeekStartMonday,
  todayDateString,
} from '../../utils/units';
import { PlannerView } from './PlannerView';

const RECIPE: Recipe = {
  id: 'rec-1',
  title: 'Massa à Bolonhesa',
  prepMinutes: 10,
  cookMinutes: 20,
  baseServings: 4,
  category: 'pasta_rice',
  tags: [],
  containsAllergens: [],
  favoriteMemberIds: [],
  kidFriendly: true,
  notes: '',
  photoAttachmentId: null,
  docAttachmentId: null,
  timesCooked: 0,
  lastCookedAt: null,
  ingredients: [],
  steps: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  lastModifiedBy: 'dev-1',
};

describe('PlannerView compact empty days', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps today and planned days expanded while collapsing empty days into compact rows', () => {
    const today = todayDateString();
    const weekStart = getWeekStartMonday(today);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDaysToDateString(weekStart, i));
    const plannedDay = weekDays.find((d) => d !== today) ?? weekDays[0];
    const emptyDay = weekDays.find((d) => d !== today && d !== plannedDay) ?? weekDays[1];

    const mealPlan: MealPlanEntry[] = [
      {
        id: 'mp-1',
        date: plannedDay,
        slot: 'dinner',
        recipeId: 'rec-1',
        plannedServings: 4,
        customLabel: '',
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null,
        lastModifiedBy: 'dev-1',
      },
    ];

    render(
      <PlannerView
        mealPlan={mealPlan}
        recipes={[RECIPE]}
        stockLots={[]}
        catalogItems={[]}
        locations={[]}
        members={[]}
        shoppingItems={[]}
        expiryWarningDays={5}
        deviceId="dev-1"
      />,
    );

    // Planned day is expanded and shows the planned meal
    expect(screen.getByText('Massa à Bolonhesa')).toBeInTheDocument();
    // Today badge is visible (today is expanded by default)
    expect(screen.getByText('Hoje')).toBeInTheDocument();

    // Empty non-today day starts collapsed as a single-line compact row with a Planear action
    const emptyDayTitle = `${formatWeekdayShortPt(emptyDay)}, ${formatDatePt(emptyDay)}`;
    const emptyDayHeader = screen
      .getAllByRole('button', { name: new RegExp(emptyDayTitle) })
      .find((b) => b.hasAttribute('aria-expanded'));
    expect(emptyDayHeader).toBeDefined();
    expect(emptyDayHeader).toHaveAttribute('aria-expanded', 'false');

    // Expanding the empty day reveals its slots
    fireEvent.click(emptyDayHeader!);
    expect(screen.getByRole('button', { name: `Recolher ${emptyDayTitle}` })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('opens planning modal with meal slot switcher directly from a collapsed empty day', () => {
    const today = todayDateString();
    const weekStart = getWeekStartMonday(today);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDaysToDateString(weekStart, i));
    const emptyDay = weekDays.find((d) => d !== today) ?? weekDays[0];
    const emptyDayLabel = `${formatWeekdayShortPt(emptyDay)}, ${formatDatePt(emptyDay)}`;

    render(
      <PlannerView
        mealPlan={[]}
        recipes={[RECIPE]}
        stockLots={[]}
        catalogItems={[]}
        locations={[]}
        members={[]}
        shoppingItems={[]}
        expiryWarningDays={5}
        deviceId="dev-1"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: `Planear ${emptyDayLabel}` }));
    expect(
      screen.getByRole('dialog', { name: `Planear refeição (${formatDatePt(emptyDay)})` }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Almoço' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jantar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lanche' })).toBeInTheDocument();
  });
});
