from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uvicorn
import tempfile
import os
import json
import time
from datetime import datetime
from pathlib import Path
import openai
from faster_whisper import WhisperModel
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure OpenAI
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI()

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data models
class Entry(BaseModel):
    id: int
    content: str
    type: str
    createdAt: str

class EntryCreate(BaseModel):
    content: str
    type: str
    targetDate: Optional[str] = None

class EntryUpdate(BaseModel):
    content: Optional[str] = None
    existingContent: Optional[str] = None
    newContent: Optional[str] = None
    appendMode: Optional[bool] = False

# Load Whisper model (adjust model size based on your hardware)
model = WhisperModel("small", device="cpu", compute_type="int8")

# Data path - create data directory if it doesn't exist
data_dir = Path('../data')
data_dir.mkdir(exist_ok=True)
data_path = data_dir / 'entries.json'

# Ensure data file exists
def ensure_data_file():
    if not data_path.exists():
        with open(data_path, 'w') as f:
            f.write('[]')

# Optimize text format using OpenAI
async def optimize_text(text):
    try:
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a text optimization assistant, responsible for optimizing the diary content to be more elegant, while keeping the original meaning and improving the expression."
                },
                {
                    "role": "user",
                    "content": text
                }
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Text optimization failed: {e}")
        return text  # Return original text if optimization fails

# Integrate diary content using LLM
async def integrate_diary_content(existing_content, new_content):
    try:
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": """You are a diary integration assistant. Your task is to integrate new diary content with existing content. 
                    If the new content is related to the existing content, integrate it seamlessly, enhancing the narrative and connecting the ideas.
                    If the new content is about a different topic, start a new paragraph. 
                    Enhance the writing style to be cohesive and engaging, while preserving the original meaning.
                    Never add timestamps or date markers."""
                },
                {
                    "role": "user",
                    "content": f'Existing diary content: "{existing_content}"\nNew diary content to integrate: "{new_content}"'
                }
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Content integration failed: {e}")
        # Fallback to simple concatenation
        return f"{existing_content}\n\n{new_content}"

# TRANSCRIPTION ENDPOINT
@app.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = Form(None)
):
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_file:
        temp_file.write(await audio.read())
        temp_path = temp_file.name
    
    try:
        # Transcribe with Whisper
        segments, info = model.transcribe(
            temp_path, 
            language=language if language else None,
            vad_filter=True,
            word_timestamps=False
        )
        
        # Collect transcribed text
        result = " ".join([segment.text for segment in segments])
        
        return {"text": result}
    finally:
        # Clean up temp file
        os.unlink(temp_path)

# DIARY MANAGEMENT ENDPOINTS

# Create new entry
@app.post("/api/entries")
async def create_entry(entry: EntryCreate):
    ensure_data_file()
    
    # Optimize text
    optimized_content = await optimize_text(entry.content)
    
    # Use provided date or current date
    created_at = entry.targetDate or datetime.now().isoformat()
    
    # Create entry object
    new_entry = {
        "id": int(time.time() * 1000),  # Timestamp as ID
        "content": optimized_content,
        "type": entry.type,
        "createdAt": created_at
    }
    
    # Read existing entries
    with open(data_path, 'r') as f:
        entries = json.load(f)
    
    # Add new entry
    entries.append(new_entry)
    
    # Write back to file
    with open(data_path, 'w') as f:
        json.dump(entries, f, indent=2)
    
    return new_entry

# Get all entries
@app.get("/api/entries")
async def get_entries():
    ensure_data_file()
    
    with open(data_path, 'r') as f:
        entries = json.load(f)
    
    return entries

# Get entries by date
@app.get("/api/entries/{date}")
async def get_entries_by_date(date: str):
    ensure_data_file()
    
    try:
        target_date = datetime.fromisoformat(date.replace('Z', '+00:00'))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    with open(data_path, 'r') as f:
        entries = json.load(f)
    
    filtered_entries = []
    for entry in entries:
        entry_date = datetime.fromisoformat(entry['createdAt'].replace('Z', '+00:00'))
        if (entry_date.day == target_date.day and 
            entry_date.month == target_date.month and 
            entry_date.year == target_date.year):
            filtered_entries.append(entry)
    
    return filtered_entries

# Update entry
@app.put("/api/entries/{id}")
async def update_entry(id: int, entry_update: EntryUpdate):
    ensure_data_file()
    
    # Read existing entries
    with open(data_path, 'r') as f:
        entries = json.load(f)
    
    # Find entry by ID
    entry_index = None
    for i, entry in enumerate(entries):
        if entry['id'] == id:
            entry_index = i
            break
    
    if entry_index is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    # Process content update
    if entry_update.appendMode and entry_update.existingContent and entry_update.newContent:
        # Intelligent content merging
        final_content = await integrate_diary_content(
            entry_update.existingContent, 
            entry_update.newContent
        )
    elif entry_update.content:
        # Direct content update (from manual editing)
        final_content = entry_update.content
    else:
        raise HTTPException(status_code=400, detail="Invalid update parameters")
    
    # Update the entry
    entries[entry_index]['content'] = final_content
    
    # Write back to file
    with open(data_path, 'w') as f:
        json.dump(entries, f, indent=2)
    
    return entries[entry_index]

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3001) 