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
from openai import OpenAI
from faster_whisper import WhisperModel
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure FastAPI app
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure OpenAI client
client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    http_client=None  # Use the default HTTP client without custom parameters
)

# Data models
class Entry(BaseModel):
    id: int
    content: str
    type: str
    createdAt: str

class EntryCreate(BaseModel):
    content: str
    type: str = "text"
    targetDate: Optional[str] = None

class EntryUpdate(BaseModel):
    content: Optional[str] = None
    appendMode: Optional[bool] = False
    existingContent: Optional[str] = None
    newContent: Optional[str] = None

# Load Whisper model - use base model to reduce CPU usage
model = None  # Initialize as None, load only when needed

# Function to lazily load the model when required
def get_whisper_model():
    global model
    if model is None:
        print("Loading Whisper model (base)...")
        model = WhisperModel("base", device="cpu", compute_type="int8")
    return model

# Data path - create data directory if it doesn't exist
data_dir = Path('./data')
data_path = data_dir / 'entries.json'

# Enhanced ensure_data_file function with debugging
def ensure_data_file():
    try:
        # Make sure the directory exists
        data_dir.mkdir(exist_ok=True)
        
        # Check if file exists, create it if not
        if not data_path.exists():
            print(f"Creating new entries file at {data_path.absolute()}")
            with open(data_path, 'w') as f:
                f.write('[]')
        else:
            # Verify the file is valid JSON
            try:
                with open(data_path, 'r') as f:
                    json.load(f)
                print(f"Data file exists and contains valid JSON at {data_path.absolute()}")
            except json.JSONDecodeError:
                print(f"Data file exists but contains invalid JSON. Resetting it.")
                with open(data_path, 'w') as f:
                    f.write('[]')
    except Exception as e:
        print(f"Error ensuring data file: {e}")
        # Create an in-memory fallback if all else fails
        return []

# Optimize text format using OpenAI
def optimize_text(content: str) -> str:
    """Optimize text content using LLM to correct errors and improve readability"""
    if not content or not content.strip():
        return content
        
    try:
        print(f"Optimizing text content ({len(content)} chars)")
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system", 
                    "content": "You are a diary assistant. Correct any transcription errors and typos in the user's text without changing meaning. Fix grammar issues, improve flow, and preserve the content's emotion and style. Keep the corrections minimal. IMPORTANT: ALWAYS PRESERVE THE ORIGINAL LANGUAGE - DO NOT TRANSLATE CHINESE TEXT TO ENGLISH. If the text is in Chinese, keep it in Chinese."
                },
                {
                    "role": "user",
                    "content": f"Please optimize this diary entry, correcting any transcription errors while preserving its meaning and original language: {content}"
                }
            ],
            temperature=0.3,
            max_tokens=1000
        )
        
        optimized = response.choices[0].message.content
        print(f"Text optimized successfully")
        return optimized
    except Exception as e:
        print(f"Error optimizing text: {e}")
        # If optimization fails, return the original content
        return content

# Enhanced integrate_diary_content function with smart formatting
def integrate_diary_content(existing_content, new_content):
    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": """You are a diary integration assistant who specializes in seamless content placement and formatting.

Your task:
1. Analyze both the existing diary content and the new content to be added
2. Find meaningful connections and semantic relationships between the content pieces
3. Determine the OPTIMAL insertion point in the existing content where the new content fits best
4. Insert the new content at this point, maintaining narrative flow
5. Apply appropriate formatting to improve readability:
   - Use bullet points for lists, tasks, ideas, or multiple distinct points
   - Use numbered lists for sequential steps or prioritized items
   - Use paragraphs for narrative content, reflections, or connected thoughts
   - Add appropriate section headers (using markdown ##) if introducing new major topics
6. Make minimal edits to create smooth transitions between paragraphs

Guidelines:
- If the new content relates closely to a specific section, integrate it there
- If the new content continues a thought, append to that specific section
- If the new content introduces a new topic, add a paragraph break
- Preserve the writer's voice, style, and emotional tone
- Use transitional phrases when needed for smooth connections
- Never add timestamps or date markers
- Format lists as bullet points when the content resembles a list or collection of items
- Apply consistent indentation for hierarchical lists if needed
- IMPORTANT: PRESERVE THE ORIGINAL LANGUAGE. If content is in Chinese, keep it in Chinese - do not translate.
"""
                },
                {
                    "role": "user",
                    "content": f'Existing diary content: "{existing_content}"\nNew diary content to integrate: "{new_content}"'
                }
            ],
            temperature=0.3  # Lower temperature for more consistent results
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Content integration failed: {e}")
        # Fallback to simple concatenation
        return f"{existing_content}\n\n{new_content}"

# Update the transcribe endpoint to be more CPU-efficient
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
        # Get or load the model
        whisper_model = get_whisper_model()
        
        # Map language codes correctly - use only valid Whisper language codes
        whisper_language = None
        if language:
            # Whisper only accepts 'zh' for Chinese (both simplified and traditional)
            # No need to map to 'zh-cn' as that's not a valid Whisper language code
            whisper_language = language
        
        print(f"Transcribing with language: {whisper_language}")
        
        # Use most efficient settings
        segments, _ = whisper_model.transcribe(
            temp_path, 
            language=whisper_language,
            beam_size=1,
            best_of=1,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
            word_timestamps=False
        )
        
        # Collect transcribed text
        result = " ".join([segment.text for segment in segments])
        
        return {"text": result}
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.unlink(temp_path)
        
        # Force garbage collection to free memory
        import gc
        gc.collect()

# DIARY MANAGEMENT ENDPOINTS

# Create new entry with enhanced debugging
@app.post("/api/entries")
async def create_entry(entry: EntryCreate):
    print(f"Received request to create entry: {entry.dict()}")
    
    try:
        ensure_data_file()
        
        # Re-enable optimization
        optimized_content = optimize_text(entry.content)
        
        # Use provided date or current date
        created_at = entry.targetDate or datetime.now().isoformat()
        
        # Create entry object
        new_entry = {
            "id": int(time.time() * 1000),  # Timestamp as ID
            "content": optimized_content,
            "type": entry.type,
            "createdAt": created_at
        }
        
        print(f"New entry object created: {new_entry}")
        
        # Read existing entries
        try:
            with open(data_path, 'r') as f:
                entries = json.load(f)
            print(f"Loaded {len(entries)} existing entries")
        except Exception as e:
            print(f"Error loading entries: {e}")
            entries = []
        
        # Add new entry
        entries.append(new_entry)
        
        # Write back to file
        try:
            with open(data_path, 'w') as f:
                json.dump(entries, f, indent=2)
            print(f"Wrote {len(entries)} entries to file")
        except Exception as e:
            print(f"Error writing entries to file: {e}")
            raise
        
        return new_entry
    except Exception as e:
        print(f"Error creating entry: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Get all entries
@app.get("/api/entries")
async def get_entries():
    ensure_data_file()
    
    with open(data_path, 'r') as f:
        entries = json.load(f)
    
    print(f"Returning {len(entries)} entries")
    return entries

# Get entries by date
@app.get("/api/entries/{date}")
async def get_entries_by_date(date: str):
    ensure_data_file()
    
    try:
        # Handle timezone properly by removing the Z
        target_date = datetime.fromisoformat(date.replace('Z', '+00:00'))
        print(f"Looking for entries on date: {target_date.strftime('%Y-%m-%d')}")
    except ValueError:
        print(f"Invalid date format: {date}")
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    with open(data_path, 'r') as f:
        entries = json.load(f)
    
    filtered_entries = []
    for entry in entries:
        try:
            # Fix date parsing from entry.createdAt
            entry_date = datetime.fromisoformat(entry['createdAt'].replace('Z', '+00:00'))
            match = (
                entry_date.day == target_date.day and
                entry_date.month == target_date.month and
                entry_date.year == target_date.year
            )
            if match:
                filtered_entries.append(entry)
        except Exception as e:
            print(f"Error parsing date for entry {entry.get('id')}: {e}")
    
    print(f"Found {len(filtered_entries)} entries for date {target_date.strftime('%Y-%m-%d')}")
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
        final_content = integrate_diary_content(
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

# Add a new endpoint to identify topic threads across entries
@app.get("/api/topic-threads")
async def get_topic_threads():
    ensure_data_file()
    
    # Read all entries
    with open(data_path, 'r') as f:
        entries = json.load(f)
    
    try:
        # Extract topic threads using LLM
        topic_threads = analyze_topic_threads(entries)
        return topic_threads
    except Exception as e:
        print(f"Error analyzing topic threads: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Update the analyze_topic_threads function to be synchronous
def analyze_topic_threads(entries):
    if not entries:
        return {"topics": []}
    
    # Prepare content for analysis with full context
    entries_with_dates = [
        {
            "id": entry["id"],
            "date": entry["createdAt"],
            "content": entry["content"]  # Use full content for better analysis
        }
        for entry in entries
    ]
    
    # Sort by date
    entries_with_dates.sort(key=lambda x: x["date"])
    
    # Debug entries for troubleshooting
    print(f"Analyzing {len(entries_with_dates)} entries with OpenAI")
    
    try:
        # Convert to JSON with proper Chinese character handling
        entries_json = json.dumps(entries_with_dates, ensure_ascii=False)
        
        # Use OpenAI synchronously
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": """You are an AI that analyzes diary entries to identify recurring topics and their progression over time.
                    
                    Your task:
                    1. Identify ANY recurring topics/themes across these diary entries
                    2. For each topic, identify relevant entries that mention or relate to it
                    3. Analyze how the topic progresses or evolves across these entries
                    4. Return your analysis in a structured JSON format with the following exact structure:
                    {
                      "topics": [
                        {
                          "name": "Topic Name",
                          "summary": "Brief summary of what this topic is about",
                          "progression": "Description of how this topic evolves over time",
                          "mentions": [
                            {
                              "entryId": 123456789,
                              "date": "ISO date",
                              "excerpt": "Relevant excerpt from the entry"
                            }
                          ]
                        }
                      ]
                    }
                    
                    IMPORTANT: 
                    - The diary entries are mainly in Chinese (中文)
                    - CAREFULLY look for recurring topics 
                    - Even if topics only appear in 2 entries, include them as important connections
                    - Pay close attention to projects, tools, platforms, and activities mentioned repeatedly
                    - CRITICAL: RESPOND IN THE SAME LANGUAGE AS THE ENTRIES - If entries are in Chinese, all topic names, summaries, progressions, and excerpts MUST BE IN CHINESE
                    - DO NOT TRANSLATE ANYTHING TO ENGLISH - preserve the original language"""
                },
                {
                    "role": "user",
                    "content": f"Here are the diary entries in chronological order. Please identify ALL recurring topics and respond in the SAME LANGUAGE as the entries (mainly Chinese): {entries_json}"
                }
            ],
            temperature=0.1,  # Lower temperature for more deterministic results
            response_format={"type": "json_object"}
        )
        
        # Parse the response
        response_content = response.choices[0].message.content
        print(f"OpenAI topic analysis response preview: {response_content[:150]}...")
        
        # Parse JSON response preserving Chinese characters
        threads_data = json.loads(response_content)
        
        # Rest of your code to process the response remains the same
        # Add entry links and clean up the response
        for topic in threads_data.get("topics", []):
            # Remove duplicates from mentions
            seen_ids = set()
            unique_mentions = []
            
            for mention in topic.get("mentions", []):
                entry_id = mention.get("entryId")
                if entry_id and entry_id not in seen_ids:
                    seen_ids.add(entry_id)
                    unique_mentions.append(mention)
                    
                    # Find the full entry
                    full_entry = next((e for e in entries if e["id"] == entry_id), None)
                    if full_entry:
                        mention["fullContent"] = full_entry["content"]
                        mention["date"] = full_entry["createdAt"]
            
            topic["mentions"] = unique_mentions
        
        return threads_data
    except Exception as e:
        print(f"Error in topic analysis: {e}")
        print(f"Error details: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"topics": []}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3001) 