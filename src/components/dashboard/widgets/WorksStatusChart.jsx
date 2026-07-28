import React from 'react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Skeleton } from '@/components/ui/skeleton';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function WorksStatusChart({ config }) {
  const { data: obras, isLoading } = useQuery({
    queryKey: ['obras-status-chart'],
    queryFn: () => base44.entities.Obra.list(),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const statusCount = {};
  (obras || []).forEach(obra => {
    statusCount[obra.status] = (statusCount[obra.status] || 0) + 1;
  });

  const data = Object.entries(statusCount).map(([status, count]) => ({
    name: status.replace(/_/g, ' ').toUpperCase(),
    value: count,
  }));

  return (
    <div className="p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Obras por Status</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} fill="#8884d8" dataKey="value">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}