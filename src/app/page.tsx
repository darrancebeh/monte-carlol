'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FiGithub, FiLinkedin, FiTwitter, FiMail, FiInfo } from 'react-icons/fi'; // Import icons
import Modal from 'react-modal'; // Import Modal

// --- Helper Functions for Statistics ---
const calculateMean = (arr: number[]): number | null => {
  if (!arr || arr.length === 0) return null;
  const sum = arr.reduce((a, b) => a + b, 0);
  return sum / arr.length;
};

const calculateMedian = (arr: number[]): number | null => {
  if (!arr || arr.length === 0) return null;
  const sortedArr = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sortedArr.length / 2);
  if (sortedArr.length % 2 === 0) {
    return (sortedArr[mid - 1] + sortedArr[mid]) / 2;
  } else {
    return sortedArr[mid];
  }
};

const calculatePercentile = (arr: number[], percentile: number): number | null => {
  if (!arr || arr.length === 0 || percentile < 0 || percentile > 100) return null;
  const sortedArr = [...arr].sort((a, b) => a - b);
  const index = (percentile / 100) * (sortedArr.length - 1);
  if (Number.isInteger(index)) {
    return sortedArr[index];
  } else {
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    const weight = index - lowerIndex;
    // Linear interpolation
    return sortedArr[lowerIndex] * (1 - weight) + sortedArr[upperIndex] * weight;
  }
}

// Define the structure for simulation parameters
interface SimulationParams {
  initialPrice: number;
  expectedReturn: number;
  volatility: number;
  timeHorizon: number;
  numSteps: number;
  numPaths: number;
}

// Define the structure for the simulation results from the API
interface SimulationResponse {
  time_points: number[];
  sample_paths: number[][];
  mean_path: number[];
  percentile_5th_path: number[];
  percentile_95th_path: number[];
  mean_final_price?: number; // Make optional if not always present
  median_final_price?: number; // Make optional if not always present
  percentile_5th?: number; // Make optional if not always present
  percentile_95th?: number; // Make optional if not always present
}

// Function to transform backend data into Recharts format
const transformDataForChart = (apiData: SimulationResponse) => {
  const { time_points, sample_paths, mean_path, percentile_5th_path, percentile_95th_path } = apiData;
  const chartData: { time: number; mean: number; p5: number; p95: number; [key: string]: number }[] = [];

  if (!time_points || !mean_path || !percentile_5th_path || !percentile_95th_path || time_points.length === 0) {
    return [];
  }

  const numSteps = time_points.length;
  const numSamplePaths = sample_paths?.length || 0; // Handle case where sample_paths might be missing

  for (let i = 0; i < numSteps; i++) {
    const dataPoint: { time: number; mean: number; p5: number; p95: number; [key: string]: number } = {
      time: time_points[i],
      mean: mean_path[i],
      p5: percentile_5th_path[i],
      p95: percentile_95th_path[i],
    };

    // Add sample paths if they exist
    if (sample_paths) {
        for (let j = 0; j < numSamplePaths; j++) {
            // Ensure the path and step exist before accessing
            if (sample_paths[j] && sample_paths[j][i] !== undefined) {
                dataPoint[`path_${j}`] = sample_paths[j][i];
            }
        }
    }
    chartData.push(dataPoint);
  }
  return chartData;
};

// Colors for chart lines
const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00C49F", "#FFBB28", "#FF8042", "#0088FE", "#A4DE6C", "#D0ED57"];

// --- Helper Components ---

// Chart Component using Recharts - Modified to accept chartData directly
const SimulationChart = ({ chartData, samplePaths }: { chartData: any[], samplePaths: number[][] }) => {
  // Basic check for empty data
  if (!chartData || chartData.length === 0) {
    // Show a message or a static empty chart structure if needed during initial load/reset
    return <div className="text-center text-gray-500 dark:text-gray-400 h-96 flex items-center justify-center">Ready to animate or no data.</div>;
  }

  const numSamplePaths = samplePaths.length;

  // Determine Y-axis domain dynamically based on *all* potential data, not just current frame
  // This prevents the Y-axis from jumping around during animation.
  // We need the full dataset range here. Let's assume the parent component
  // could provide min/max values, or we recalculate from samplePaths if needed.
  // For simplicity now, we'll keep 'auto', but this might need refinement.
  const yDomain = ['auto', 'auto'];

  return (
    <div className="w-full h-96 mb-6"> {/* Ensure container has height */}
      <ResponsiveContainer width="100%" height="100%">
        {/* Increase bottom margin */}
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 35 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" />
          <XAxis
             dataKey="time"
             type="number"
             domain={[chartData[0]?.time ?? 0, chartData[chartData.length - 1]?.time ?? 1]}
             tickFormatter={(tick) => tick.toFixed(2)}
             // Adjust label offset for better spacing
             label={{ value: 'Time (Years)', position: 'insideBottom', offset: -20, fill: '#9CA3AF' }}
             stroke="#9CA3AF"
             tick={{ fill: '#9CA3AF' }}
             allowDataOverflow={true}
           />
          <YAxis
            domain={yDomain} // Use calculated or auto domain
            label={{ value: 'Price', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF' }}
            tickFormatter={(tick) => tick.toFixed(0)}
            allowDataOverflow={true}
          />
          <Tooltip
             contentStyle={{ backgroundColor: '#374151', border: '1px solid #4B5563' }}
             labelStyle={{ color: '#E5E7EB' }}
             itemStyle={{ color: '#D1D5DB' }}
             formatter={(value: number) => value.toFixed(2)}
             isAnimationActive={false}
           />
          {/* Position legend clearly at the bottom */}
          <Legend verticalAlign="bottom" wrapperStyle={{ color: '#D1D5DB', paddingTop: '15px' }} />

          {/* Lines - Added isAnimationActive={false} */}
          <Line type="monotone" dataKey="mean" stroke="#34D399" strokeWidth={2} dot={false} name="Mean Path" isAnimationActive={false} />
          <Line type="monotone" dataKey="p5" stroke="#F87171" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="5th Percentile" isAnimationActive={false} />
          <Line type="monotone" dataKey="p95" stroke="#60A5FA" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="95th Percentile" isAnimationActive={false} />

          {/* Sample Paths - Added isAnimationActive={false} and legendType='none' */}
          {Array.from({ length: numSamplePaths }).map((_, index) => (
            <Line
              key={`path_${index}`}
              type="monotone"
              dataKey={`path_${index}`}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={0.5}
              opacity={0.5}
              dot={false}
              legendType="none" // Explicitly hide from legend
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Statistics Display Component - Modified to show current step stats
interface CurrentStats {
    mean: number | null;
    median: number | null;
    p5: number | null;
    p95: number | null;
}

const StatisticsDisplay = ({ currentStats, time }: { currentStats: CurrentStats, time: number | undefined }) => {
   // Helper to format numbers or show 'N/A'
   const formatStat = (value: number | undefined | null) =>
     value !== undefined && value !== null ? value.toFixed(2) : 'N/A';

   const formattedTime = time !== undefined ? time.toFixed(2) : 'N/A';

  return (
    <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded shadow-inner">
      <h3 className="text-lg font-semibold mb-3 text-gray-700 dark:text-gray-200">Price Statistics at Time: {formattedTime} Years</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-300">
        <p>Mean:</p> <p className="font-medium text-right">{formatStat(currentStats.mean)}</p>
        <p>Median:</p> <p className="font-medium text-right">{formatStat(currentStats.median)}</p>
        <p>5th Percentile:</p> <p className="font-medium text-right">{formatStat(currentStats.p5)}</p>
        <p>95th Percentile:</p> <p className="font-medium text-right">{formatStat(currentStats.p95)}</p>
      </div>
    </div>
  );
};

// --- Main Component ---
export default function Home() {
  const [initialPrice, setInitialPrice] = useState<string>('100');
  const [expectedReturn, setExpectedReturn] = useState<string>('5'); // Changed to percentage: 5%
  const [volatility, setVolatility] = useState<string>('20'); // Changed to percentage: 20%
  const [timeHorizon, setTimeHorizon] = useState<string>('1'); // 1 year
  const [numSteps, setNumSteps] = useState<string>('252'); // Trading days in a year
  const [numPaths, setNumPaths] = useState<string>('100'); // Number of simulations

  const [simulationData, setSimulationData] = useState<SimulationResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null); // New state for form errors
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false); // State for modal
  const currentYear = new Date().getFullYear(); // Get current year

  // --- Animation State ---
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationSpeed = 10; // Milliseconds per step (adjust for desired speed)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormError(null); // Clear form error on input change
    switch (name) {
      case 'initialPrice': setInitialPrice(value); break;
      case 'expectedReturn': setExpectedReturn(value); break;
      case 'volatility': setVolatility(value); break;
      case 'timeHorizon': setTimeHorizon(value); break;
      case 'numSteps': setNumSteps(value); break;
      case 'numPaths': setNumPaths(value); break;
      default: break;
    }
  };

  // --- Animation Control Functions ---
  const handlePlay = () => {
    if (!simulationData) return;
    // Reset if at the end
    if (currentStep >= (simulationData?.time_points?.length || 1) - 1) {
      setCurrentStep(0);
    }
    setIsAnimating(true);
  };

  const handlePause = () => {
    setIsAnimating(false);
  };

  const handleReset = () => {
    setIsAnimating(false);
    setCurrentStep(0);
  };

  // --- Animation Effect ---
  useEffect(() => {
    if (isAnimating && simulationData) {
      const totalSteps = simulationData.time_points.length;
      animationIntervalRef.current = setInterval(() => {
        setCurrentStep((prevStep) => {
          const nextStep = prevStep + 1;
          if (nextStep >= totalSteps -1) {
            setIsAnimating(false); // Stop at the end
            if (animationIntervalRef.current) {
              clearInterval(animationIntervalRef.current);
            }
            return totalSteps - 1;
          }
          return nextStep;
        });
      }, animationSpeed);
    } else {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    }

    // Cleanup interval on component unmount or when animation stops
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, [isAnimating, simulationData, animationSpeed]);

  // Reset animation when new data is loaded
  useEffect(() => {
    handleReset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulationData]);

  // --- Data Preparation for Chart (Memoized) ---
  const animatedChartData = useMemo(() => {
    if (!simulationData) return [];
    // Transform the full data first
    const fullChartData = transformDataForChart(simulationData);
    // Slice the data up to the current step
    return fullChartData.slice(0, currentStep + 1);
  }, [simulationData, currentStep]);

  // --- Calculate Statistics for the Current Animation Step (Memoized) ---
  const currentStepStats = useMemo(() => {
    if (!simulationData || !simulationData.sample_paths || simulationData.sample_paths.length === 0 || currentStep < 0) {
      return { mean: null, median: null, p5: null, p95: null };
    }

    // Get prices from all paths at the current step
    const pricesAtCurrentStep = simulationData.sample_paths
      .map(path => path[currentStep])
      .filter(price => price !== undefined && price !== null) as number[]; // Ensure we have valid numbers

    if (pricesAtCurrentStep.length === 0) {
        // Handle case where step might be out of bounds or data is sparse
        return { mean: null, median: null, p5: null, p95: null };
    }

    return {
      mean: calculateMean(pricesAtCurrentStep),
      median: calculateMedian(pricesAtCurrentStep),
      p5: calculatePercentile(pricesAtCurrentStep, 5),
      p95: calculatePercentile(pricesAtCurrentStep, 95),
    };
  }, [simulationData, currentStep]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setFormError(null); // Clear previous form errors
    setSimulationData(null); // Clear previous results
    handleReset(); // Reset animation on new simulation

    // --- Input Validation ---
    const parsedInitialPrice = parseFloat(initialPrice);
    // Parse percentage inputs
    let parsedExpectedReturn = parseFloat(expectedReturn);
    let parsedVolatility = parseFloat(volatility);
    const parsedTimeHorizon = parseFloat(timeHorizon);
    const parsedNumSteps = parseInt(numSteps, 10);
    const parsedNumPaths = parseInt(numPaths, 10);

    let validationError = null;

    if (isNaN(parsedInitialPrice) || parsedInitialPrice <= 0) {
      validationError = "Initial Price must be a positive number.";
    } else if (isNaN(parsedExpectedReturn)) {
       validationError = "Expected Return must be a number (%)."; // Updated error message
    } else if (isNaN(parsedVolatility) || parsedVolatility < 0) {
       // Volatility can be 0, but not negative
       validationError = "Volatility must be a non-negative number (%)."; // Updated error message
    } else if (isNaN(parsedTimeHorizon) || parsedTimeHorizon <= 0) {
       validationError = "Time Horizon must be a positive number.";
    } else if (isNaN(parsedNumSteps) || parsedNumSteps <= 0) {
       validationError = "Time Steps must be a positive integer.";
    } else if (isNaN(parsedNumPaths) || parsedNumPaths <= 0) {
       validationError = "Number of Paths must be a positive integer.";
    }

    if (validationError) {
        setFormError(validationError);
        setIsLoading(false);
        return; // Stop submission if validation fails
    }
    // --- End Input Validation ---

    // Convert percentages to decimals BEFORE sending to backend
    parsedExpectedReturn = parsedExpectedReturn / 100;
    parsedVolatility = parsedVolatility / 100;

    const params = {
      initialPrice: parsedInitialPrice,
      expectedReturn: parsedExpectedReturn, // Use converted value
      volatility: parsedVolatility,         // Use converted value
      timeHorizon: parsedTimeHorizon,
      numSteps: parsedNumSteps,
      numPaths: parsedNumPaths,
    };

    console.log("Running simulation with params (percentages converted to decimals):", params);

    // --- API Call ---
    try {
      const response = await fetch('http://localhost:8000/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Send the converted decimal values
        body: JSON.stringify({
            initialPrice: params.initialPrice,
            expectedReturn: params.expectedReturn,
            volatility: params.volatility,
            timeHorizon: params.timeHorizon,
            numSteps: params.numSteps,
            numPaths: params.numPaths,
        }),
      });

      if (!response.ok) {
        // Error message construction
        let errorMsg = `HTTP error! Status: ${response.status}`;
        try {
            const errorData = await response.json();
            // Use optional chaining and nullish coalescing for safer access
            // FastAPI validation errors are often in response.detail or response.detail[0].msg
            errorMsg = errorData?.detail?.[0]?.msg || errorData?.detail || errorMsg;
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
      setError(err instanceof Error ? err.message : "An unknown error occurred");

    } finally {
      setIsLoading(false);
    }
  };

  // Set app element for react-modal accessibility
  useEffect(() => {
    // Ensure this runs only on the client side
    if (typeof window !== 'undefined') {
        Modal.setAppElement('body'); // Or try '#__next' if 'body' doesn't work
    }
  }, []);


  return (
    // Ensure the main container is a flex column and takes at least the full screen height
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100">
      {/* Make the content container grow to push the footer down */}
      <div className="flex flex-col items-center flex-grow w-full p-6 md:p-12 lg:p-24">
        <div className="z-10 w-full max-w-6xl items-center justify-between font-mono text-sm lg:flex flex-col">

          {/* Main Header - Centered */}
          <div className="text-center mb-2 w-full"> {/* Changed to text-center */} 
             <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold inline">Monte Carlo Stock Price Simulation</h1> {/* Use inline */} 
             <span className="text-lg text-gray-500 ml-2 inline">by db</span> {/* Use inline and ml-2 for spacing */} 
          </div>

          {/* Sub-header for Modal Trigger - Centered */}
          <div className="w-full max-w-6xl mb-6 text-center"> {/* Changed to text-center */} 
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-sm text-blue-400 hover:text-blue-300 hover:underline transition-colors duration-200"
              aria-label="What is Monte Carlo Simulation?"
            >
              What is Monte Carlo?
            </button>
          </div>

          {/* --- Input Form --- */}
          <form onSubmit={handleSubmit} className="w-full max-w-lg mb-10 p-6 bg-gray-800 rounded-lg shadow-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label htmlFor="initialPrice" className="mb-1 text-sm font-medium text-gray-400">Initial Price (S₀)</label>
              <input type="number" id="initialPrice" name="initialPrice" value={initialPrice} onChange={handleInputChange} required className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100" step="any" />
            </div>
            {/* Expected Annual Return with % sign */}
            <div className="flex flex-col">
              <label htmlFor="expectedReturn" className="mb-1 text-sm font-medium text-gray-400">Expected Annual Return (μ %)</label>
              <div className="relative"> {/* Wrapper for positioning */}
                <input
                  type="number"
                  id="expectedReturn"
                  name="expectedReturn"
                  value={expectedReturn}
                  onChange={handleInputChange}
                  required
                  // Added padding-right to avoid overlap
                  className="w-full px-3 py-2 pr-6 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                  step="any"
                />
                {/* Positioned % sign */}
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 pointer-events-none">
                  %
                </span>
              </div>
            </div>
            {/* Annual Volatility with % sign */}
            <div className="flex flex-col">
              <label htmlFor="volatility" className="mb-1 text-sm font-medium text-gray-400">Annual Volatility (σ %)</label>
              <div className="relative"> {/* Wrapper for positioning */}
                <input
                  type="number"
                  id="volatility"
                  name="volatility"
                  value={volatility}
                  onChange={handleInputChange}
                  required
                  // Added padding-right to avoid overlap
                  className="w-full px-3 py-2 pr-6 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                  step="any"
                />
                {/* Positioned % sign */}
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 pointer-events-none">
                  %
                </span>
              </div>
            </div>
            {/* Time Horizon */}
            <div className="flex flex-col">
              <label htmlFor="timeHorizon" className="mb-1 text-sm font-medium text-gray-400">Time Horizon (T, years)</label>
              <input type="number" id="timeHorizon" name="timeHorizon" value={timeHorizon} onChange={handleInputChange} required className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100" step="any" />
            </div>
            {/* Number of Steps */}
            <div className="flex flex-col">
              <label htmlFor="numSteps" className="mb-1 text-sm font-medium text-gray-400">Number of Steps (e.g., 252)</label>
              <input type="number" id="numSteps" name="numSteps" value={numSteps} onChange={handleInputChange} required className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100" step="1" />
            </div>
            {/* Number of Paths */}
            <div className="flex flex-col">
              <label htmlFor="numPaths" className="mb-1 text-sm font-medium text-gray-400">Number of Paths (M)</label>
              <input type="number" id="numPaths" name="numPaths" value={numPaths} onChange={handleInputChange} required className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100" step="1" />
            </div>

            {/* Form Error Display */}
            {formError && (
              <div className="sm:col-span-2 text-red-500 text-sm mt-2">
                {formError}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="sm:col-span-2 w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Simulating...' : 'Run Simulation'}
            </button>
          </form>
        </div>

        {/* Results Display Section */}
        <div className="w-full max-w-6xl mt-10"> {/* Removed lg:col-span-2, adjusted width/max-width */} 
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 min-h-[400px] flex flex-col justify-center">
            <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Simulation Results</h2>
            {/* Loading State */}
            {isLoading && (
              <div className="flex justify-center items-center h-96">
                <p className="text-gray-500 dark:text-gray-400">Loading simulation results...</p>
              </div>
            )}
            {/* Initial State */}
            {!isLoading && !error && !simulationData && !formError && (
               <div className="flex justify-center items-center h-96 text-gray-500 dark:text-gray-400">
                  <p>Enter parameters and click "Run Simulation" to see the results.</p>
               </div>
            )}
            {/* Error State */}
             {!isLoading && error && (
               <div className="flex justify-center items-center h-96 text-red-500">
                  <p>Could not load simulation results: {error}</p>
               </div>
             )}
             {/* Success State - Chart and Stats */}
             {!isLoading && !error && simulationData && (
               <div>
                  {/* --- Animation Controls --- */}
                  <div className="flex justify-center items-center flex-wrap space-x-4 mb-4">
                      <button onClick={handlePlay} disabled={isAnimating} className="px-4 py-1 bg-green-600 hover:bg-green-700 rounded text-white disabled:opacity-50">Play</button>
                      <button onClick={handlePause} disabled={!isAnimating} className="px-4 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-white disabled:opacity-50">Pause</button>
                      <button onClick={handleReset} className="px-4 py-1 bg-red-600 hover:bg-red-700 rounded text-white">Reset</button>
                      {/* Display current step/time */}
                      <span className="text-sm text-gray-500 dark:text-gray-400 self-center mt-2 sm:mt-0">
                        Step: {currentStep} / {simulationData.time_points.length - 1}
                        ({simulationData.time_points[currentStep]?.toFixed(2)} Years)
                      </span>
                  </div>

                 {/* Pass animated data to the chart */}
                 <SimulationChart chartData={animatedChartData} samplePaths={simulationData.sample_paths || []} />
                 {/* Pass current step stats to the display */}
                 <StatisticsDisplay currentStats={currentStepStats} time={simulationData.time_points[currentStep]} />
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Footer */} 
      <footer
        className="w-full py-4 px-4 sm:px-8 bg-gray-900 bg-opacity-70 text-gray-400 text-sm border-t border-gray-700 backdrop-blur-sm mt-auto" // Added mt-auto
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex gap-5">
            <a
              href="https://github.com/darrancebeh"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub Profile"
              className="transition-colors duration-300 hover:text-gray-200"
            >
              <FiGithub className="w-5 h-5" />
            </a>
            <a
              href="https://linkedin.com/in/darrancebeh"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn Profile"
              className="transition-colors duration-300 hover:text-gray-200"
            >
              <FiLinkedin className="w-5 h-5" />
            </a>
            <a
              href="https://x.com/quant_in_my"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X Profile"
              className="transition-colors duration-300 hover:text-gray-200"
            >
              <FiTwitter className="w-5 h-5" />
            </a>
            <a
              href="mailto:darrancebeh@gmail.com"
              aria-label="Send Email"
              className="transition-colors duration-300 hover:text-gray-200"
            >
              <FiMail className="w-5 h-5" />
            </a>
          </div>

          <div className="text-center sm:text-right">
            <p>&copy; {currentYear} Darrance Beh Heng Shek. All Rights Reserved.</p>
            <p className="text-xs text-gray-500 mt-1">
              Built with Next.js, React, FastAPI, Pydantic, Recharts, and Tailwind CSS.
            </p>
          </div>
        </div>
      </footer>

      {/* --- Informational Modal --- */}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        contentLabel="What is Monte Carlo Simulation?"
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 p-6 sm:p-8 rounded-lg shadow-xl max-w-2xl w-11/12 border border-gray-700 text-gray-100 outline-none z-50" // Added z-index
        overlayClassName="fixed inset-0 bg-black bg-opacity-75 z-40 flex items-center justify-center" // Added z-index lower than modal
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl sm:text-2xl font-semibold flex items-center">
            <FiInfo className="mr-2" /> What is Monte Carlo Simulation?
          </h2>
          <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-200 text-2xl">&times;</button>
        </div>
        {/* Added max-h-[80vh] and overflow-y-auto for scrollable content */}
        <div className="prose prose-invert max-w-none text-gray-300 max-h-[70vh] sm:max-h-[80vh] overflow-y-auto pr-2"> 
          <p>Monte Carlo is an official administrative area of Monaco. However, in finance and mathematics, <strong>Monte Carlo simulation</strong> is a powerful computational technique used to model the probability of different outcomes in a process that cannot easily be predicted due to the intervention of random variables.</p>
          <p>Instead of calculating a single, deterministic outcome, it runs a large number of simulations (called "paths" or "trials") using random inputs drawn from probability distributions that represent the uncertainty in the system. By analyzing the distribution of results from these many simulations, we can understand the range of possible outcomes and their likelihood.</p>
          <h4 className="font-semibold mt-4 mb-2">How it works here:</h4>
          <ol className="list-decimal list-inside space-y-1">
            <li><strong>Inputs:</strong> You provide parameters like the starting stock price, expected growth rate (return), expected fluctuation (volatility), and the time period.</li>
            <li><strong>Randomness:</strong> The simulation uses random numbers to model the unpredictable day-to-day (or step-to-step) movements of the stock price, based on the principles of Geometric Brownian Motion (a common model for stock prices).</li>
            <li><strong>Multiple Paths:</strong> It generates many possible future price paths (the faint colored lines you see on the chart). Each path represents one possible future scenario based on the random fluctuations.</li>
            <li><strong>Analysis:</strong> By looking at all these simulated paths, we calculate statistics:
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                    <li><strong>Mean Path (Green Line):</strong> The average price across all simulations at each point in time.</li>
                    <li><strong>Percentile Bands (Dashed Lines):</strong> The 5th and 95th percentile paths show the range within which 90% of the simulated outcomes fall. This gives an idea of the potential upside and downside risk.</li>
                </ul>
            </li>
            <li><strong>Visualization:</strong> The chart displays these paths and statistics. The animation shows how these paths evolve over the simulated time horizon, and the statistics update to reflect the distribution of prices at each specific point in time shown below the chart.</li>
          </ol>
          <p className="mt-4">This allows you to visualize not just one possible future, but a whole spectrum of possibilities, providing a richer understanding of potential investment risks and rewards.</p>
        </div>
      </Modal>
    </main>
  );
}
