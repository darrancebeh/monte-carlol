'use client';

import Image from "next/image";
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

// Update the interface to include statistics
interface SimulationResponse {
  time_points: number[];
  paths: number[][];
  mean_final_price?: number; // Make optional as they might not always be present initially
  median_final_price?: number;
  percentile_5th?: number;
  percentile_95th?: number;
}

// Define the structure for the chart data
interface ChartDataPoint {
  time: number;
  [key: string]: number;
}

// Function to transform backend data into Recharts format
const transformDataForChart = (apiData: SimulationResponse): ChartDataPoint[] => {
  const { time_points, paths } = apiData;
  const chartData: ChartDataPoint[] = [];

  if (!time_points || !paths || time_points.length === 0 || paths.length === 0) {
    return [];
  }

  const numSteps = time_points.length;
  const numPaths = paths.length;

  for (let i = 0; i < numSteps; i++) {
    const dataPoint: ChartDataPoint = { time: time_points[i] };
    for (let j = 0; j < numPaths; j++) {
      dataPoint[`path_${j}`] = paths[j][i];
    }
    chartData.push(dataPoint);
  }
  return chartData;
};

// Colors for chart lines
const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00C49F", "#FFBB28", "#FF8042", "#0088FE", "#A4DE6C", "#D0ED57"];

// Actual chart component using Recharts
const SimulationChart = ({ apiData }: { apiData: SimulationResponse | null }) => {
  if (!apiData || !apiData.paths || apiData.paths.length === 0) {
    return (
      <div className="w-full h-96 bg-gray-200 dark:bg-gray-800 rounded flex items-center justify-center text-gray-500">
        No simulation data to display.
      </div>
    );
  }

  const chartData = transformDataForChart(apiData);
  const numPaths = apiData.paths.length;
  const initialPrice = apiData.paths[0]?.[0];

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart
        data={chartData}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 20,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="time"
          type="number"
          domain={['dataMin', 'dataMax']}
          label={{ value: 'Time (Years)', position: 'insideBottom', offset: -15 }}
          tickFormatter={(tick) => tick.toFixed(2)}
        />
        <YAxis
          label={{ value: 'Stock Price ($)', angle: -90, position: 'insideLeft' }}
          domain={['auto', 'auto']}
          tickFormatter={(tick) => tick.toFixed(2)}
        />
        <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} labelFormatter={(label: number) => `Year: ${label.toFixed(2)}`} />
        <Legend />
        {initialPrice !== undefined && (
          <ReferenceLine y={initialPrice} label={{ value: `Start: $${initialPrice.toFixed(2)}`, position: 'insideTopRight' }} stroke="red" strokeDasharray="3 3" />
        )}
        {Array.from({ length: numPaths }).map((_, index) => (
          <Line
            key={`path_${index}`}
            type="monotone"
            dataKey={`path_${index}`}
            stroke={COLORS[index % COLORS.length]}
            dot={false}
            activeDot={{ r: 4 }}
            name={`Path ${index + 1}`}
            strokeWidth={numPaths > 50 ? 1 : 1.5}
            opacity={numPaths > 10 ? 0.7 : 1}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

// Helper to format currency
const formatCurrency = (value: number | undefined): string => {
  if (value === undefined || value === null) return "N/A";
  return `$${value.toFixed(2)}`;
};

// Component to display statistics
const StatisticsDisplay = ({ stats }: { stats: SimulationResponse | null }) => {
  if (!stats || stats.mean_final_price === undefined) {
    return null; // Don't render if no stats are available
  }

  return (
    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
      <h3 className="text-xl font-semibold mb-4">Final Price Statistics</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-600 dark:text-gray-400">Mean Final Price:</p>
          <p className="font-medium text-lg">{formatCurrency(stats.mean_final_price)}</p>
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-400">Median Final Price:</p>
          <p className="font-medium text-lg">{formatCurrency(stats.median_final_price)}</p>
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-400">5th Percentile:</p>
          <p className="font-medium text-lg">{formatCurrency(stats.percentile_5th)}</p>
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-400">95th Percentile:</p>
          <p className="font-medium text-lg">{formatCurrency(stats.percentile_95th)}</p>
        </div>
      </div>
    </div>
  );
};


export default function Home() {
  // State declarations
  const [initialPrice, setInitialPrice] = useState("100");
  const [expectedReturn, setExpectedReturn] = useState("0.05");
  const [volatility, setVolatility] = useState("0.2");
  const [timeHorizon, setTimeHorizon] = useState("1"); // In years
  const [timeSteps, setTimeSteps] = useState("252"); // Trading days in a year
  const [numPaths, setNumPaths] = useState("100"); // Increased default paths slightly
  const [simulationData, setSimulationData] = useState<SimulationResponse | null>(null); // Updated state type
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const handleRunSimulation = async () => {
    // Parameter parsing and validation
    setLoading(true);
    setError(null);
    setSimulationData(null); // Clear previous results

    const params = {
      initialPrice: parseFloat(initialPrice),
      expectedReturn: parseFloat(expectedReturn),
      volatility: parseFloat(volatility),
      timeHorizon: parseFloat(timeHorizon),
      timeSteps: parseInt(timeSteps),
      numPaths: parseInt(numPaths),
    };

    if (Object.values(params).some(isNaN) || params.timeSteps <= 0 || params.numPaths <= 0 || params.timeHorizon <= 0 || params.volatility < 0) {
        setError("Please ensure all inputs are valid positive numbers (Volatility >= 0).");
        setLoading(false);
        return;
    }

    console.log("Running simulation with params:", params);

    try {
      // API Call
      const response = await fetch('http://localhost:8000/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        // Error message construction
        let errorMsg = `HTTP error! Status: ${response.status}`;
        try {
            const errorData = await response.json();
            // Use optional chaining and nullish coalescing for safer access
            errorMsg = errorData?.detail ?? errorMsg;
        } catch (e) {
            // Ignore if response body is not JSON or empty
        }
        throw new Error(errorMsg);
      }

      // Process results
      const results: SimulationResponse = await response.json();
      console.log("Received simulation results:", results);
      setSimulationData(results);

    } catch (err) {
      console.error("Simulation API call failed:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred during simulation.");
    } finally {
      setLoading(false);
    }
  };

  // JSX Return statement
  return (
    <div className="container mx-auto min-h-screen p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-2">Monte Carlo Stock Price Simulation</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">Using Geometric Brownian Motion (GBM)</p>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Input Section */}
        <section className="md:col-span-1 bg-white dark:bg-gray-900 p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-6">Simulation Parameters</h2>
          {/* Input fields */}
          <div className="space-y-4">
            <div>
              <label htmlFor="initialPrice" className="block text-sm font-medium mb-1">Initial Stock Price ($)</label>
              <input type="number" id="initialPrice" value={initialPrice} onChange={(e) => setInitialPrice(e.target.value)} className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700" />
            </div>
            <div>
              <label htmlFor="expectedReturn" className="block text-sm font-medium mb-1">Expected Annual Return (e.g., 0.05 for 5%)</label>
              <input type="number" id="expectedReturn" step="0.01" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700" />
            </div>
            <div>
              <label htmlFor="volatility" className="block text-sm font-medium mb-1">Annual Volatility (e.g., 0.2 for 20%)</label>
              <input type="number" id="volatility" step="0.01" value={volatility} onChange={(e) => setVolatility(e.target.value)} className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700" />
            </div>
            <div>
              <label htmlFor="timeHorizon" className="block text-sm font-medium mb-1">Time Horizon (Years)</label>
              <input type="number" id="timeHorizon" value={timeHorizon} onChange={(e) => setTimeHorizon(e.target.value)} className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700" />
            </div>
            <div>
              <label htmlFor="timeSteps" className="block text-sm font-medium mb-1">Time Steps (per Year)</label>
              <input type="number" id="timeSteps" value={timeSteps} onChange={(e) => setTimeSteps(e.target.value)} className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700" />
            </div>
            <div>
              <label htmlFor="numPaths" className="block text-sm font-medium mb-1">Number of Simulation Paths</label>
              <input type="number" id="numPaths" value={numPaths} onChange={(e) => setNumPaths(e.target.value)} className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700" />
            </div>
          </div>
          {/* Button */}
          <button
            onClick={handleRunSimulation}
            disabled={loading}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out flex items-center justify-center"
          >
            {loading && (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            )}
            {loading ? 'Running Simulation...' : 'Run Simulation'}
          </button>
           {error && <p className="text-red-500 mt-4 text-sm">Error: {error}</p>}
        </section>

        {/* Output Section */}
        <section className="md:col-span-2 bg-white dark:bg-gray-900 p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-6">Simulation Results</h2>
          {/* Loading State */}
          {loading && (
             <div className="flex justify-center items-center h-96">
                <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
             </div>
          )}
          {/* Initial State */}
          {!loading && !error && !simulationData && (
             <div className="flex justify-center items-center h-96 text-gray-500">
                <p>Enter parameters and click "Run Simulation" to see the results.</p>
             </div>
          )}
          {/* Error State */}
           {!loading && error && (
             <div className="flex justify-center items-center h-96 text-red-500">
                <p>Could not load simulation results. Please try again.</p>
             </div>
           )}
           {/* Success State - Chart and Stats */}
           {!loading && !error && simulationData && (
             <div>
               <SimulationChart apiData={simulationData} />
               {/* Add the StatisticsDisplay component here */}
               <StatisticsDisplay stats={simulationData} />
             </div>
           )}
           {/* TODO: Add statistical results display here */}
        </section>
      </main>

      <footer className="text-center mt-12 text-sm text-gray-500">
        <p>Monte Carlo Simulation Tool - {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
