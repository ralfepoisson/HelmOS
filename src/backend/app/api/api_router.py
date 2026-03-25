"""Top-level API router."""

from fastapi import APIRouter

from app.api.routers import admin, approvals, health, runs


api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(runs.router, prefix="/runs", tags=["runs"])
api_router.include_router(approvals.router, prefix="/approvals", tags=["approvals"])
