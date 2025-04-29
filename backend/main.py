from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import numpy as np
from typing import List, Optional # Import Optional

app = FastAPI()

# CORS Configuration
origins = [
    "http://localhost:3000", # Allow Next.js dev server
    # Add Vercel deployment URL later
    # "https://your-vercel-app-url.vercel.app",
]

# Define the request body model using Pydantic
class SimulationParams(BaseModel):
    initialPrice: float
    expectedReturn: float # mu
    volatility: float     # sigma
    timeHorizon: float    # T
    numSteps: int        # N - Changed from timeSteps
    numPaths: int         # M

# Define the response body model - ADDED STATS
class SimulationResult(BaseModel):
    time_points: List[float]
    # paths: List[List[float]] # Keep sample paths if needed, or remove
    sample_paths: List[List[float]] # Return a small sample of paths
    mean_path: List[float]
    percentile_5th_path: List[float]
    percentile_95th_path: List[float]
    mean_final_price: Optional[float] = None
    median_final_price: Optional[float] = None
    percentile_5th: Optional[float] = None
    percentile_95th: Optional[float] = None


@app.get("/")
def read_root():
    return {"message": "Monte Carlo Simulation API"}

@app.post("/simulate", response_model=SimulationResult)
def run_simulation(params: SimulationParams):
    S0 = params.initialPrice
    mu = params.expectedReturn
    sigma = params.volatility
    T = params.timeHorizon
    N = params.numSteps # Changed from params.timeSteps
    M = params.numPaths

    # Input validation (basic example)
    if not all([S0 > 0, T > 0, N > 0, M > 0, sigma >= 0]):
        raise HTTPException(status_code=400, detail="Invalid simulation parameters. Ensure values are positive and sigma >= 0.")


    dt = T / N
    paths = np.zeros((N + 1, M))
    paths[0] = S0

    # Generate random numbers (standard normal)
    Z = np.random.standard_normal((N, M))

    # Simulate paths using Geometric Brownian Motion
    for t in range(1, N + 1):
        drift = (mu - 0.5 * sigma**2) * dt
        diffusion = sigma * np.sqrt(dt) * Z[t-1]
        paths[t] = paths[t-1] * np.exp(drift + diffusion)

    # Calculate statistics on final prices
    final_prices = paths[-1]
    mean_final_price = float(np.mean(final_prices))
    median_final_price = float(np.median(final_prices))
    percentile_5th_final = float(np.percentile(final_prices, 5))
    percentile_95th_final = float(np.percentile(final_prices, 95))

    # Calculate statistics for each time step
    mean_path = np.mean(paths, axis=1).tolist()
    percentile_5th_path = np.percentile(paths, 5, axis=1).tolist()
    percentile_95th_path = np.percentile(paths, 95, axis=1).tolist()


    # Prepare time points for the x-axis of the chart
    time_points = np.linspace(0, T, N + 1).tolist()

    # Transpose paths for easier handling in frontend (each list is a path)
    paths_list = paths.T.tolist()

    return {
        "time_points": time_points,
        "sample_paths": paths_list, # Return ALL paths
        "mean_path": mean_path,
        "percentile_5th_path": percentile_5th_path,
        "percentile_95th_path": percentile_95th_path,
        "mean_final_price": mean_final_price,
        "median_final_price": median_final_price,
        "percentile_5th": percentile_5th_final,
        "percentile_95th": percentile_95th_final
    }

# Add CORS middleware to allow requests from the frontend development server
# Make sure to install python-multipart and uvicorn if you haven't:
# pip install fastapi uvicorn python-multipart numpy pydantic starlette requests sse-starlette
# pip install fastapi[all]
# pip install 'uvicorn[standard]'
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # Allows your Next.js dev server
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods
    allow_headers=["*"], # Allows all headers
)

# If running this file directly (for local development)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
