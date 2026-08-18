import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env"
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="Church Lyrics API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SongCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    artist: str = Field(default="Unknown artist", max_length=100)
    lyrics: str = Field(min_length=1)


class SongUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=100)
    artist: Optional[str] = Field(default=None, max_length=100)
    lyrics: Optional[str] = Field(default=None, min_length=1)


@app.get("/")
def root():
    return {"message": "Church Lyrics API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/songs")
def get_songs():
    response = (
        supabase.table("songs")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    return response.data


@app.get("/songs/{song_id}")
def get_song(song_id: str):
    response = (
        supabase.table("songs")
        .select("*")
        .eq("id", song_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Song not found")

    return response.data[0]


@app.post("/songs", status_code=201)
def create_song(song: SongCreate):
    response = (
        supabase.table("songs")
        .insert({
            "title": song.title,
            "artist": song.artist or "Unknown artist",
            "lyrics": song.lyrics,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=500, detail="Could not create song")

    return response.data[0]


@app.put("/songs/{song_id}")
def update_song(song_id: str, song: SongUpdate):
    existing = (
        supabase.table("songs")
        .select("id")
        .eq("id", song_id)
        .limit(1)
        .execute()
    )

    if not existing.data:
        raise HTTPException(status_code=404, detail="Song not found")

    changes = song.model_dump(exclude_unset=True)

    if "artist" in changes and not changes["artist"]:
        changes["artist"] = "Unknown artist"

    if not changes:
        raise HTTPException(status_code=400, detail="No changes supplied")

    response = (
        supabase.table("songs")
        .update(changes)
        .eq("id", song_id)
        .execute()
    )

    return response.data[0]


@app.delete("/songs/{song_id}")
def delete_song(song_id: str):
    existing = (
        supabase.table("songs")
        .select("id")
        .eq("id", song_id)
        .limit(1)
        .execute()
    )

    if not existing.data:
        raise HTTPException(status_code=404, detail="Song not found")

    supabase.table("songs").delete().eq("id", song_id).execute()

    return {"message": "Song deleted"}
