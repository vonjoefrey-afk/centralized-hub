import React from 'react';
import Card from './Card';

/**
 * ResponsiveTable Component
 * 
 * A responsive table component that automatically switches to card layout on mobile.
 * 
 * @param {Array} columns - Array of column definitions: { key, label, render?, className? }
 * @param {Array} data - Array of data objects
 * @param {function} onRowClick - Optional callback when row is clicked
 * @param {string} emptyMessage - Message to show when data is empty
 * @param {React.ReactNode} emptyState - Custom empty state component
 * @param {string} className - Additional CSS classes
 */
const ResponsiveTable = ({
  columns = [],
  data = [],
  onRowClick,
  emptyMessage = 'No data available',
  emptyState,
  className = '',
}) => {
  if (data.length === 0) {
    if (emptyState) {
      return emptyState;
    }
    return (
      <div className="text-center py-12 text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className={`hidden md:block overflow-x-auto ${className}`}>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.className || ''
                  }`}
                  scope="col"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
                className={onRowClick ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${
                      column.className || ''
                    }`}
                  >
                    {column.render
                      ? column.render(row[column.key], row, rowIndex)
                      : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className={`md:hidden space-y-4 ${className}`}>
        {data.map((row, rowIndex) => (
          <Card
            key={rowIndex}
            hover={!!onRowClick}
            onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
            className={onRowClick ? 'cursor-pointer' : ''}
          >
            <div className="space-y-3">
              {columns.map((column) => (
                <div key={column.key}>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                    {column.label}
                  </div>
                  <div className="text-sm text-gray-900">
                    {column.render
                      ? column.render(row[column.key], row, rowIndex)
                      : row[column.key]}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
};

export default ResponsiveTable;
