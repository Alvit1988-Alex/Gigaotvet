from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AIInstructionsIn(BaseModel):
    text: str = Field(..., min_length=1)


class AIInstructionsOut(BaseModel):
    id: int | None = None
    text: str
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
