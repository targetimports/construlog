import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export default function SortableTable({
  columns,
  data,
  sortBy,
  sortOrder,
  onSort,
  renderRow,
  emptyMessage = 'Nenhum resultado encontrado'
}) {
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className="px-6 py-3 text-left"
              >
                <button
                  onClick={() => onSort?.(col.key)}
                  className="flex items-center gap-2 font-semibold text-gray-700 hover:text-gray-900 group"
                >
                  {col.label}
                  {col.sortable !== false && (
                    <span className="text-gray-400 group-hover:text-gray-600">
                      {sortBy === col.key ? (
                        sortOrder === 'asc' ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      ) : (
                        <div className="w-4 h-4 flex flex-col items-center justify-center">
                          <div className="text-xs">⋮</div>
                        </div>
                      )}
                    </span>
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => renderRow(row, idx))
          )}
        </tbody>
      </table>
    </div>
  );
}