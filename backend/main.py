from fastapi import FastAPI
from pydantic import BaseModel
import numpy as np
from typing import List, Optional # Import Optional
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# CORS Configuration
origins = [
    "http://localhost:3000", # Allow Next.js dev server
    # Add Vercel deployment URL later
    # "https://your-vercel-app-url.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allow all methods (GET, POST, etc.)
    allow_headers=["*"], # Allow all headers
)

# Define the request body model using Pydantic
class SimulationParams(BaseModel):
    initialPrice: float
    expectedReturn: float # mu
    volatility: float     # sigma
    timeHorizon: float    # T
    timeSteps: int        # N
    numPaths: int         # M

# Define the response body model - ADDED STATS
class SimulationResult(BaseModel):
    time_points: List[float]
    paths: List[List[float]]
    mean_final_price: Optional[float] = None
    median_final_price: Optional[float] = None
    percentile_5th: Optional[float] = None
    percentile_95th: Optional[float] = None

@app.get("/")
def read_root():
    return {"message": "Monte Carlo Simulation API"}

@app.post("/simulate", response_model=SimulationResult)
def run_simulation(params: SimulationParams):
    # Extract parameters
    S0 = params.initialPrice
    mu = params.expectedReturn
    sigma = params.volatility
    T = params.timeHorizon
    N = params.timeSteps
    M = params.numPaths

    # Calculate time step
    dt = T / N

    # Initialize array to store paths
    # Dimensions: (Number of time steps + 1) x Number of paths
    paths = np.zeros((N + 1, M))
    paths[0] = S0 # Set initial price for all paths

    # Generate random numbers (standard normal)
    # Dimensions: Number of time steps x Number of paths
    Z = np.random.standard_normal((N, M))

    # Simulate paths using the GBM formula
    # S(t+dt) = S(t) * exp((mu - 0.5 * sigma^2) * dt + sigma * sqrt(dt) * Z)
    for t in range(1, N + 1):
        drift = (mu - 0.5 * sigma**2) * dt
        diffusion = sigma * np.sqrt(dt) * Z[t-1]
        paths[t] = paths[t-1] * np.exp(drift + diffusion)

    # Calculate statistics on final prices
    final_prices = paths[-1]
    mean_final_price = float(np.mean(final_prices))
    median_final_price = float(np.median(final_prices))
    percentile_5th = float(np.percentile(final_prices, 5))
    percentile_95th = float(np.percentile(final_prices, 95))

    # Prepare time points for the x-axis of the chart
    time_points = np.linspace(0, T, N + 1).tolist()

    # Transpose paths for easier handling in frontend (each list is a path)
    paths_list = paths.T.tolist()

    # Limit the number of paths returned for performance if M is large
    # (Optional - can be adjusted based on performance needs)
    MAX_PATHS_TO_RETURN = 100 # Example limit
    if M > MAX_PATHS_TO_RETURN:
        indices = np.random.choice(M, MAX_PATHS_TO_RETURN, replace=False)
        paths_list_limited = [paths_list[i] for i in indices]
    else:
        paths_list_limited = paths_list

    return {
        "time_points": time_points,
        "paths": paths_list_limited, # Return limited paths
        "mean_final_price": mean_final_price,
        "median_final_price": median_final_price,
        "percentile_5th": percentile_5th,
        "percentile_95th": percentile_95th
    }

# If running this file directly (for local development)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
