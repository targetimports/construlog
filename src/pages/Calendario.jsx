import React from 'react';
import { useState } from 'react';
import CalendarMonth from '@/components/calendar/CalendarMonth';
import UpcomingEvents from '@/components/calendar/UpcomingEvents';

export default function Calendario() {
  const [monthDate, setMonthDate] = useState(new Date());
  const [filters, setFilters] = useState({ types: [] });

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2">
          <CalendarMonth
            monthDate={monthDate}
            onPrev={() => setMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            onNext={() => setMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            onToday={() => setMonthDate(new Date())}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>
        <div>
          <UpcomingEvents />
        </div>
      </div>
    </div>
  );
}