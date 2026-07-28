import React from 'react';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

/**
 * Error boundary individual por card
 * Impede que um card quebrado derrube toda página
 */
export default class DashboardCardErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[DashboardCard Error]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="bg-amber-50 border border-amber-200">
          <div className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-900">Dados indisponíveis</p>
              <p className="text-xs text-amber-700 mt-1">Não foi possível carregar este widget</p>
            </div>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}