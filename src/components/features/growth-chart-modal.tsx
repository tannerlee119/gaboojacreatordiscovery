'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TrendingUp, TrendingDown, Calendar, Users, AlertCircle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TooltipItem,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface GrowthDataPoint {
  timestamp: string;
  followerCount: number;
  analysisId: string;
  growthFromPrevious: number;
  daysSincePrevious: number;
}

interface CreatorGrowthData {
  username: string;
  platform: string;
  displayName: string;
  totalGrowth: {
    percentage: number;
    absolute: number;
    timespan: string;
  };
  dataPoints: GrowthDataPoint[];
}

interface GrowthChartModalProps {
  creator: {
    username: string;
    platform: string;
    displayName?: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function GrowthChartModal({ creator, isOpen, onClose }: GrowthChartModalProps) {
  const [growthData, setGrowthData] = useState<CreatorGrowthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGrowthData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/growth-data?username=${encodeURIComponent(creator.username)}&platform=${creator.platform}`
      );
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch growth data');
      }
      
      setGrowthData(result.data);
    } catch (err) {
      console.error('Error fetching growth data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load growth data');
    } finally {
      setLoading(false);
    }
  }, [creator.username, creator.platform]);

  useEffect(() => {
    if (isOpen && creator.username && creator.platform) {
      fetchGrowthData();
    }
  }, [isOpen, creator.username, creator.platform, fetchGrowthData]);

  // Helper function to format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M`;
    } else if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  // Prepare chart data
  const chartData = growthData ? {
    labels: growthData.dataPoints.map(point => 
      format(new Date(point.timestamp), 'MMM d, yyyy')
    ),
    datasets: [
      {
        label: 'Followers',
        data: growthData.dataPoints.map(point => point.followerCount),
        borderColor: 'rgb(59, 130, 246)', // blue-500
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        fill: true,
        tension: 0.4, // Smooth curves
      },
    ],
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Hide legend since we only have one dataset
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(59, 130, 246, 0.8)',
        borderWidth: 1,
        callbacks: {
          title: (tooltipItems: TooltipItem<'line'>[]) => {
            if (tooltipItems.length > 0 && growthData) {
              const point = growthData.dataPoints[tooltipItems[0].dataIndex];
              return format(new Date(point.timestamp), 'MMM d, yyyy');
            }
            return '';
          },
          label: (tooltipItem: TooltipItem<'line'>) => {
            if (!growthData) return '';
            
            const point = growthData.dataPoints[tooltipItem.dataIndex];
            const lines = [
              `Followers: ${formatNumber(point.followerCount)}`,
            ];
            
            if (point.growthFromPrevious !== 0) {
              const growthText = point.growthFromPrevious > 0 ? '+' : '';
              const growthColor = point.growthFromPrevious > 0 ? '🟢' : '🔴';
              lines.push(`Growth: ${growthColor} ${growthText}${point.growthFromPrevious.toFixed(1)}%`);
            }
            
            if (point.daysSincePrevious > 0) {
              lines.push(`${point.daysSincePrevious} days since previous`);
            }
            
            return lines;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Analysis Date',
          font: {
            size: 12,
            weight: 'bold' as const,
          },
        },
        ticks: {
          maxRotation: 45,
          font: {
            size: 11,
          },
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Followers',
          font: {
            size: 12,
            weight: 'bold' as const,
          },
        },
        ticks: {
          callback: (value: string | number) => formatNumber(Number(value)),
          font: {
            size: 11,
          },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto [&>button]:focus:outline-none [&>button]:focus:ring-0 [&>button]:focus:bg-transparent [&>button]:data-[state=open]:bg-transparent">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl font-bold">
            Growth Analysis
          </DialogTitle>
          
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span className="font-medium">
              {creator.displayName || creator.username}
            </span>
            <span>•</span>
            <span className="capitalize">{creator.platform}</span>
            <span>•</span>
            <span>@{creator.username}</span>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-muted-foreground">Loading growth data...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Unable to load growth data
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    {error}
                  </div>
                </div>
              </div>
            </div>
          )}

          {growthData && (
            <>
              {/* Growth Summary */}
              <div className="rounded-lg border border-border bg-gradient-to-r from-[#0f0f0f] to-[#151515] p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      {growthData.totalGrowth.percentage >= 0 ? (
                        <TrendingUp className="h-6 w-6 text-green-600" />
                      ) : (
                        <TrendingDown className="h-6 w-6 text-red-600" />
                      )}
                    </div>
                    <div className={`text-2xl font-bold ${
                      growthData.totalGrowth.percentage >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {growthData.totalGrowth.percentage >= 0 ? '+' : ''}
                      {growthData.totalGrowth.percentage.toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Total Growth</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      {growthData.totalGrowth.absolute >= 0 ? '+' : ''}
                      {formatNumber(growthData.totalGrowth.absolute)}
                    </div>
                    <div className="text-sm text-muted-foreground">Followers</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Calendar className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="text-2xl font-bold text-purple-600">
                      {growthData.dataPoints.length}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Analyses {growthData.totalGrowth.timespan}
                    </div>
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div className="bg-card rounded-lg border border-border p-4">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    Follower Growth Over Time
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Tracking follower count across {growthData.dataPoints.length} analyses
                  </p>
                </div>
                
                <div style={{ height: '400px' }}>
                  {chartData && (
                    <Line data={chartData} options={chartOptions} />
                  )}
                </div>
              </div>

              {/* Data Points List */}
              <div className="bg-card rounded-lg border border-border">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold text-foreground">
                    Analysis History
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Chronological list of all analyses
                  </p>
                </div>
                
                <div className="max-h-64 overflow-y-auto">
                  {growthData.dataPoints.map((point, index) => (
                    <div
                      key={point.analysisId}
                      className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">
                          {format(new Date(point.timestamp), 'MMM d, yyyy h:mm a')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(point.timestamp), { addSuffix: true })}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {formatNumber(point.followerCount)} followers
                        </div>
                        {index > 0 && (
                          <div className={`text-xs ${
                            point.growthFromPrevious >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {point.growthFromPrevious >= 0 ? '+' : ''}
                            {point.growthFromPrevious.toFixed(1)}%
                            {point.daysSincePrevious > 0 && (
                            <span className="text-muted-foreground ml-2">
                                ({point.daysSincePrevious}d)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}