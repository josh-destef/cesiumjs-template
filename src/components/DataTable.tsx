/**
 * DataTable.tsx
 *
 * The same data as the globe, as an ordinary HTML table.
 *
 * WHY THIS EXISTS — please read this before deleting it.
 *
 * A 3D globe is one of the least accessible things you can put on a web page.
 * It is a single <canvas> element: a screen reader sees one blank box, and
 * there is nothing inside it to navigate. Someone who cannot see the map, or
 * cannot use a mouse to fly around it, gets nothing from the globe alone.
 *
 * A table fixes that completely, and cheaply. Every feature becomes a row.
 * Rows are navigable, sortable, readable, and searchable with Ctrl+F. Clicking
 * a row selects that feature on the globe, so keyboard and mouse users are
 * driving the same app rather than two separate ones.
 *
 * This is what "CreateAccess" means in practice. If you build a new project
 * from this template, keep the equivalent of this file.
 */

import { useMemo, useState } from "react";
import type { ParkFeature } from "../layers/ExampleGeoJsonLayer";

interface DataTableProps {
  features: ParkFeature[];
  /** The currently selected park, so we can mark its row. */
  selectedFeatureId: string | null;
  /** Called when a row is chosen, by click or by keyboard. */
  onSelectFeature: (id: string) => void;
}

/** The columns we can sort by. */
type SortKey = "name" | "state" | "established" | "areaAcres" | "visitors2023";

/** Column definitions, so the header and the body cannot drift apart. */
const COLUMNS: Array<{
  key: SortKey;
  label: string;
  /** Numeric columns are right-aligned and sort descending first. */
  numeric: boolean;
}> = [
  { key: "name", label: "Park", numeric: false },
  { key: "state", label: "State", numeric: false },
  { key: "established", label: "Established", numeric: true },
  { key: "areaAcres", label: "Area (acres)", numeric: true },
  { key: "visitors2023", label: "Visitors (2023)", numeric: true },
];

export function DataTable({
  features,
  selectedFeatureId,
  onSelectFeature,
}: DataTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [ascending, setAscending] = useState(true);

  /**
   * Sorting happens inside useMemo so we only redo the work when something
   * that affects the result actually changes. With 51 rows this is not a
   * performance concern — it is here because the moment you swap in a bigger
   * dataset, it will be.
   */
  const sortedFeatures = useMemo(() => {
    // Copy first: .sort() rearranges the array in place, and mutating props is
    // a reliable way to create bugs that only show up sometimes.
    const copy = [...features];

    copy.sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];

      // localeCompare sorts text the way a person expects. Plain < and > would
      // put every capital letter before every lowercase one.
      const result =
        typeof left === "string" && typeof right === "string"
          ? left.localeCompare(right)
          : Number(left) - Number(right);

      return ascending ? result : -result;
    });

    return copy;
  }, [features, sortKey, ascending]);

  /** Clicking a header sorts by it; clicking the same one again reverses it. */
  function handleSort(key: SortKey, numeric: boolean): void {
    if (key === sortKey) {
      setAscending((previous) => !previous);
    } else {
      setSortKey(key);
      // Biggest-first is the more useful default for numbers, A-Z for text.
      setAscending(!numeric);
    }
  }

  return (
    <section className="data-table" aria-labelledby="data-table-title">
      <h2 id="data-table-title">National parks — table view</h2>

      <p className="data-table__intro">
        The same {features.length} parks shown on the globe. Choose a row to
        select that park on the map. Use the column headers to sort.
      </p>

      {/*
        The wrapper scrolls horizontally on narrow screens. tabindex="0" on a
        scrollable region is a real requirement: without it, a keyboard user
        cannot scroll the table sideways at all.
      */}
      <div
        className="data-table__scroll"
        tabIndex={0}
        role="group"
        aria-labelledby="data-table-title"
      >
        <table>
          <caption className="visually-hidden">
            National parks of the contiguous United States, with state, year
            established, area in acres, and 2023 visitor numbers.
          </caption>

          <thead>
            <tr>
              {COLUMNS.map((column) => {
                const isSorted = sortKey === column.key;

                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={column.numeric ? "numeric" : undefined}
                    // aria-sort tells a screen reader which column is sorted
                    // and in which direction. It is the whole reason a sortable
                    // table is usable without sight.
                    aria-sort={
                      isSorted
                        ? ascending
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    {/*
                      A button inside the header, rather than a click handler on
                      the <th> itself. Only the button is focusable, and it
                      announces itself as something you can activate.
                    */}
                    <button
                      type="button"
                      className="data-table__sort"
                      onClick={() => handleSort(column.key, column.numeric)}
                    >
                      {column.label}
                      <span className="data-table__arrow" aria-hidden="true">
                        {isSorted ? (ascending ? " ▲" : " ▼") : ""}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {sortedFeatures.map((feature) => {
              const isSelected = feature.id === selectedFeatureId;

              return (
                <tr
                  key={feature.id}
                  className={isSelected ? "is-selected" : undefined}
                  // aria-selected communicates the highlight to people who
                  // cannot see the background colour that shows it visually.
                  aria-selected={isSelected}
                >
                  {/*
                    The first cell is a <th scope="row">, which makes it the
                    row's name. A screen reader reading the "Visitors" cell will
                    then say "Yosemite, Visitors 2023, 3,897,070" rather than
                    just reading a number with no context.
                  */}
                  <th scope="row">
                    <button
                      type="button"
                      className="data-table__select"
                      onClick={() => onSelectFeature(feature.id)}
                    >
                      {feature.name}
                    </button>
                  </th>

                  <td>{feature.state}</td>
                  <td className="numeric">{feature.established}</td>
                  <td className="numeric">
                    {feature.areaAcres.toLocaleString()}
                  </td>
                  <td className="numeric">
                    {feature.visitors2023.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
