from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Union, Annotated
import uvicorn
import tempfile
import os
import json
import time
from datetime import datetime
from pathlib import Path
from openai import OpenAI
# Temporarily disabled speech-to-text functionality
# from faster_whisper import WhisperModel
import os
from dotenv import load_dotenv
import strawberry
from strawberry.fastapi import GraphQLRouter
import networkx as nx
from typing import List, Optional

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

class TopicExtractRequest(BaseModel):
    content: str

# Temporarily disabled voice input functionality
# Load Whisper model - use base model to reduce CPU usage
# model = None  # Initialize as None, load only when needed

# Function to lazily load the model when required
# def get_whisper_model():
#     global model
#     if model is None:
#         print("Loading Whisper model (base)...")
#         model = WhisperModel("base", device="cpu", compute_type="int8")
#     return model

# Data path - create data directory if it doesn't exist
data_dir = Path('./data')
data_path = data_dir / 'entries.json'
topics_path = data_dir / 'topics.json'
graph_path = data_dir / 'topic_graph.json'

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
                    
        # Ensure topics file exists
        if not topics_path.exists():
            print(f"Creating new topics file at {topics_path.absolute()}")
            with open(topics_path, 'w') as f:
                json.dump({"topics": [], "people": [], "relations": []}, f)
        
        # Ensure graph file exists
        if not graph_path.exists():
            print(f"Creating new topic graph file at {graph_path.absolute()}")
            graph = nx.Graph()
            # Save as JSON
            graph_data = nx.node_link_data(graph)
            with open(graph_path, 'w') as f:
                json.dump(graph_data, f)
                
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

# Extract topics from text using OpenAI
def extract_topics(content: str) -> dict:
    """Extract topics, people, and relationships from diary text"""
    if not content or not content.strip():
        return {"topics": [], "people": [], "relations": []}
    
    try:
        print(f"Extracting topics from content ({len(content)} chars)")
        response = client.chat.completions.create(
            model="gpt-4o",  # Using GPT-4o for better entity recognition
            messages=[
                {
                    "role": "system", 
                    "content": """You are a diary topic extraction assistant. Analyze the provided diary entry to identify:

1. TOPICS: Important subjects, themes, activities, projects, or concepts mentioned
2. PEOPLE: Any people mentioned (real or fictional)
3. RELATIONS: Connections between topics and people

Extract these elements in a structured JSON format with the following schema:
{
  "topics": [
    {
      "id": "unique_string_id",
      "name": "Topic Name",
      "type": "category", 
      "category": "projects|places|activities",
      "importance": 1-5 scale,
      "sentiment": -2 to +2 scale,
      "context": "Brief context about this topic"
    }
  ],
  "people": [
    {
      "id": "unique_string_id",
      "name": "Person Name",
      "category": "people",
      "role": "relationship to author",
      "importance": 1-5 scale
    }
  ],
  "relations": [
    {
      "source": "topic_or_person_id",
      "target": "topic_or_person_id",
      "type": "relationship type",
      "strength": 1-5 scale
    }
  ]
}

For the "category" field, categorize each topic into one of these categories:
- "projects": Work projects, personal projects, ongoing activities with goals
- "places": Locations, venues, cities, countries, or any physical places
- "activities": One-time activities, events, experiences
- "people": All people should be in the people array with this category

IMPORTANT: 
1. If the text is in Chinese, extract topics in Chinese. Do not translate.
2. Keep the response concise and focused only on clearly mentioned entities.
3. Assign appropriate categories to help organize the topics.
4. Create meaningful relations only when there's clear connection in the text."""
                },
                {
                    "role": "user",
                    "content": f"Extract topics, people and relations from this diary entry: {content}"
                }
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        result = json.loads(response.choices[0].message.content)
        print(f"Topics extracted successfully: {len(result.get('topics', []))} topics, {len(result.get('people', []))} people")
        
        # Update the topic graph with new data
        update_topic_graph(result)
        
        return result
    except Exception as e:
        print(f"Error extracting topics: {e}")
        # If extraction fails, return empty results
        return {"topics": [], "people": [], "relations": []}

# Update topic graph with new topics
def update_topic_graph(topics_result):
    """
    Update the topic graph with new topics, people, and relations
    """
    # Ensure the topic graph file exists
    ensure_data_file()
    
    # Load existing topic graph
    with open(graph_path, "r", encoding="utf-8") as f:
        graph_data = json.load(f)
    
    existing_nodes = {node["id"]: node for node in graph_data.get("nodes", [])}
    existing_edges = []
    
    for edge in graph_data.get("edges", []):
        edge_key = f"{edge['source']}-{edge['target']}-{edge.get('type', '')}"
        existing_edges.append(edge_key)
    
    # Add or update topics
    for topic in topics_result.get("topics", []):
        if topic["id"] in existing_nodes:
            # Update existing topic
            existing_nodes[topic["id"]].update({
                "name": topic["name"],
                "type": "topic",
                "category": topic.get("category", "activities"),
                "topicType": topic.get("type", "concept"),
                "importance": topic.get("importance", 3),
                "sentiment": topic.get("sentiment", 0),
                "context": topic.get("context", "")
            })
        else:
            # Add new topic
            existing_nodes[topic["id"]] = {
                "id": topic["id"],
                "name": topic["name"],
                "type": "topic",
                "category": topic.get("category", "activities"),
                "topicType": topic.get("type", "concept"),
                "importance": topic.get("importance", 3),
                "sentiment": topic.get("sentiment", 0),
                "context": topic.get("context", "")
            }
    
    # Add or update people
    for person in topics_result.get("people", []):
        if person["id"] in existing_nodes:
            # Update existing person
            existing_nodes[person["id"]].update({
                "name": person["name"],
                "type": "person",
                "category": "people",
                "role": person.get("role", ""),
                "importance": person.get("importance", 3)
            })
        else:
            # Add new person
            existing_nodes[person["id"]] = {
                "id": person["id"],
                "name": person["name"],
                "type": "person",
                "category": "people",
                "role": person.get("role", ""),
                "importance": person.get("importance", 3)
            }
    
    # Add new relations
    new_edges = []
    for relation in topics_result.get("relations", []):
        edge_key = f"{relation['source']}-{relation['target']}-{relation.get('type', '')}"
        
        # Skip if this exact edge already exists
        if edge_key in existing_edges:
            continue
            
        # Add new edge
        new_edges.append({
            "source": relation["source"],
            "target": relation["target"],
            "type": relation.get("type", "related_to"),
            "strength": relation.get("strength", 3)
        })
    
    # Update the graph data
    graph_data["nodes"] = list(existing_nodes.values())
    graph_data["edges"] = graph_data.get("edges", []) + new_edges
    
    # Save the updated graph
    with open(graph_path, "w", encoding="utf-8") as f:
        json.dump(graph_data, f, ensure_ascii=False, indent=2)

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

# Temporarily disabled voice input functionality
# Update the transcribe endpoint to be more CPU-efficient
# @app.post("/transcribe")
# async def transcribe_audio(
#     audio: UploadFile = File(...),
#     language: str = Form(None)
# ):
#     # Save uploaded file temporarily
#     with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_file:
#         temp_file.write(await audio.read())
#         temp_path = temp_file.name
#     
#     try:
#         # Get or load the model
#         whisper_model = get_whisper_model()
#         
#         # Map language codes correctly - use only valid Whisper language codes
#         whisper_language = None
#         if language:
#             # Whisper only accepts 'zh' for Chinese (both simplified and traditional)
#             # No need to map to 'zh-cn' as that's not a valid Whisper language code
#             whisper_language = language
#         
#         print(f"Transcribing with language: {whisper_language}")
#         
#         # Use most efficient settings
#         segments, _ = whisper_model.transcribe(
#             temp_path, 
#             language=whisper_language,
#             beam_size=1,
#             best_of=1,
#             vad_filter=True,
#             vad_parameters=dict(min_silence_duration_ms=500),
#             word_timestamps=False
#         )
#         
#         # Collect transcribed text
#         result = " ".join([segment.text for segment in segments])
#         
#         return {"text": result}
#     finally:
#         # Clean up temp file
#         if os.path.exists(temp_path):
#             os.unlink(temp_path)
#         
#         # Force garbage collection to free memory
#         import gc
#         gc.collect()

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
            
        # Extract topics from the entry and update the topic graph
        topics_data = extract_topics(optimized_content)
        update_topic_graph(topics_data)
        
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
    
    # Extract topics from the updated entry and update the topic graph
    topics_data = extract_topics(final_content)
    update_topic_graph(topics_data)
    
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
        
        # Update the topic graph with the topics found
        if topic_threads and "topics" in topic_threads:
            # Convert topics to the format expected by update_topic_graph
            graph_data = {
                "topics": [],
                "people": [],
                "relations": []
            }
            
            for topic in topic_threads["topics"]:
                topic_id = topic["name"].lower().replace(" ", "_").replace("，", "").replace("。", "").replace("、", "")
                category = topic.get("category", "activities")
                
                if category == "people":
                    graph_data["people"].append({
                        "id": topic_id,
                        "name": topic["name"],
                        "category": "people",
                        "role": "",
                        "importance": 3
                    })
                else:
                    graph_data["topics"].append({
                        "id": topic_id,
                        "name": topic["name"],
                        "category": category,
                        "type": "concept",
                        "importance": 3,
                        "sentiment": 0,
                        "context": topic.get("summary", "")
                    })
                
                # Create relations between topics that mention each other
                for other_topic in topic_threads["topics"]:
                    if topic["name"] != other_topic["name"]:
                        other_id = other_topic["name"].lower().replace(" ", "_").replace("，", "").replace("。", "").replace("、", "")
                        # Check if one topic mentions the other
                        if any(topic["name"] in mention.get("excerpt", "") for mention in other_topic.get("mentions", [])):
                            graph_data["relations"].append({
                                "source": topic_id,
                                "target": other_id,
                                "type": "related_to",
                                "strength": 2
                            })
            
            # Update the graph
            update_topic_graph(graph_data)
        
        return topic_threads
    except Exception as e:
        print(f"Error analyzing topic threads: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Update the analyze_topic_threads function to be synchronous
def analyze_topic_threads(entries):
    """
    Analyze diary entries to identify recurring topics and their progression over time
    """
    if not entries:
        return {"topics": []}
    
    # Sort entries by date
    sorted_entries = sorted(entries, key=lambda e: e.get('createdAt', ''))
    
    # Prepare entries for analysis
    entry_texts = []
    for entry in sorted_entries:
        date = entry.get('createdAt', '').split('T')[0]  # Extract date part
        content = entry.get('content', '')
        if content and date:
            entry_texts.append({"date": date, "content": content})
    
    if not entry_texts:
        return {"topics": []}
    
    # Prepare the system prompt
    system_prompt = """
    You are an AI assistant specialized in analyzing diary entries to identify recurring topics and themes.
    
    Your task is to:
    1. Identify recurring topics, themes, people, or concepts mentioned across multiple diary entries
    2. For each topic, provide a brief summary of what it's about
    3. Describe how the topic progresses or changes over time
    4. List relevant diary entries where the topic is mentioned, with dates and brief excerpts
    5. Categorize each topic into one of these categories: projects, people, places, activities
    
    Format your response as a JSON object with the following structure:
    {
      "topics": [
        {
          "name": "Topic Name",
          "category": "projects|people|places|activities",
          "summary": "Brief description of what this topic is about",
          "progression": "Description of how this topic evolves over time",
          "mentions": [
            {
              "date": "YYYY-MM-DD",
              "excerpt": "Brief excerpt from the entry mentioning this topic"
            }
          ]
        }
      ]
    }
    
    IMPORTANT:
    - Respond in the SAME LANGUAGE as the diary entries (Chinese if entries are in Chinese)
    - Only include topics that appear in multiple entries or are significant
    - Focus on quality over quantity - identify the most meaningful recurring themes
    - For excerpts, include the most relevant sentences and highlight key phrases
    - Maintain the original language of the entries in all outputs
    """
    
    # Prepare the user prompt with the diary entries
    user_prompt = f"""
    Please analyze these diary entries to identify recurring topics and their progression over time:
    
    {json.dumps(entry_texts, ensure_ascii=False)}
    
    Return your analysis in the specified JSON format.
    """
    
    try:
        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )
        
        # Extract and parse the JSON response
        content = response.choices[0].message.content
        result = json.loads(content)
        
        return result
    except Exception as e:
        print(f"Error calling OpenAI API: {str(e)}")
        raise Exception(f"Failed to analyze entries with OpenAI: {str(e)}")

# Extract topics from text endpoint
@app.post("/api/extract-topics")
async def extract_topics_endpoint():
    """
    Extract topics from diary entries and update the topic graph
    """
    try:
        # Ensure the data files exist
        ensure_data_file()
        
        # Load diary entries
        entries = load_entries()
        if not entries:
            return {"status": "error", "message": "No diary entries found"}
        
        # Extract topics using OpenAI
        topics_result = await extract_topics(entries)
        
        # Update the topic graph
        update_topic_graph(topics_result)
        
        return {
            "status": "success", 
            "message": f"Successfully extracted topics from {len(entries)} entries",
            "topics_count": len(topics_result.get("topics", [])),
            "people_count": len(topics_result.get("people", [])),
            "relations_count": len(topics_result.get("relations", []))
        }
    except Exception as e:
        print(f"Error extracting topics: {str(e)}")
        return {"status": "error", "message": f"Failed to extract topics: {str(e)}"}

def load_entries():
    """
    Load diary entries from the data file
    """
    ensure_data_file()
    try:
        with open(data_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading entries: {str(e)}")
        return []

async def extract_topics(entries):
    """
    Extract topics from diary entries using OpenAI
    """
    if not entries:
        return {"topics": [], "people": [], "relations": []}
    
    # Sort entries by date
    sorted_entries = sorted(entries, key=lambda x: x.get("createdAt", ""))
    
    # Prepare the prompt for OpenAI
    system_prompt = """
    You are an expert at analyzing diary entries and extracting meaningful topics, people, and relationships.
    Your task is to analyze the provided diary entries and:
    
    1. Identify recurring topics, themes, and concepts
    2. Identify people mentioned in the entries
    3. Identify relationships between topics and people
    
    For each topic, provide:
    - A name (in the original language of the diary)
    - Type (concept, activity, event, location, project, etc.)
    - Importance (1-5 scale)
    - Sentiment (-2 to +2 scale, where negative is negative sentiment)
    - Context (brief description or relevant quotes)
    
    For each person:
    - Name (in the original language of the diary)
    - Role (if mentioned)
    - Importance (1-5 scale)
    
    For each relationship:
    - Source (topic or person ID)
    - Target (topic or person ID)
    - Type (describes, involves, related_to, etc.)
    - Strength (1-5 scale)
    
    Return the results in JSON format with three arrays: topics, people, and relations.
    """
    
    # Prepare the entries for the prompt
    entries_text = "\n\n".join([
        f"Date: {entry.get('createdAt', 'Unknown')}\n{entry.get('content', '')}" 
        for entry in sorted_entries[:20]  # Limit to 20 entries to avoid token limits
    ])
    
    user_prompt = f"""
    Please analyze these diary entries and extract topics, people, and relationships:
    
    {entries_text}
    
    Return only a valid JSON object with the following structure:
    {{
      "topics": [
        {{
          "id": "topic_1",
          "name": "Topic name",
          "type": "concept|activity|event|location|project",
          "importance": 1-5,
          "sentiment": -2 to +2,
          "context": "Brief description or quote"
        }}
      ],
      "people": [
        {{
          "id": "person_1",
          "name": "Person name",
          "role": "Role description",
          "importance": 1-5
        }}
      ],
      "relations": [
        {{
          "source": "topic_1|person_1",
          "target": "topic_2|person_2",
          "type": "describes|involves|related_to",
          "strength": 1-5
        }}
      ]
    }}
    """
    
    try:
        # Call OpenAI API
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )
        
        # Extract and parse the JSON response
        content = response.choices[0].message.content
        result = json.loads(content)
        
        return result
    except Exception as e:
        print(f"Error calling OpenAI API: {str(e)}")
        raise Exception(f"Failed to analyze entries with OpenAI: {str(e)}")

# GraphQL schema definition
@strawberry.type
class TopicNodeType:
    id: str
    name: str
    type: str
    category: str
    topic_type: Optional[str] = None
    importance: Optional[int] = None
    sentiment: Optional[float] = None
    context: Optional[str] = None

@strawberry.type
class PersonNodeType:
    id: str
    name: str
    type: str
    category: str
    role: Optional[str] = None
    importance: Optional[int] = None

@strawberry.type
class RelationEdgeType:
    source: str
    target: str
    type: str
    strength: Optional[int] = None

@strawberry.type
class TopicGraphType:
    topics: List[TopicNodeType]
    people: List[PersonNodeType]
    relations: List[RelationEdgeType]

@strawberry.type
class Query:
    @strawberry.field
    def topic_graph(self) -> TopicGraphType:
        ensure_data_file()
        
        try:
            # Load graph from file
            with open(graph_path, 'r') as f:
                graph_data = json.load(f)
            
            # Convert to GraphQL types
            topics = []
            people = []
            
            for node in graph_data.get('nodes', []):
                node_id = node.get('id', '')
                node_type = node.get('type', '')
                
                if node_type == 'topic':
                    topics.append(TopicNodeType(
                        id=node_id,
                        name=node.get('name', ''),
                        type=node_type,
                        category=node.get('category', 'activities'),
                        topic_type=node.get('topicType', 'general'),
                        importance=node.get('importance', 3),
                        sentiment=node.get('sentiment', 0),
                        context=node.get('context', '')
                    ))
                elif node_type == 'person':
                    people.append(PersonNodeType(
                        id=node_id,
                        name=node.get('name', ''),
                        type=node_type,
                        category='people',
                        role=node.get('role', ''),
                        importance=node.get('importance', 3)
                    ))
            
            relations = []
            for edge in graph_data.get('edges', []):
                relations.append(RelationEdgeType(
                    source=edge.get('source', ''),
                    target=edge.get('target', ''),
                    type=edge.get('type', 'related_to'),
                    strength=edge.get('strength', 3)
                ))
            
            return TopicGraphType(topics=topics, people=people, relations=relations)
        except Exception as e:
            print(f"Error fetching topic graph: {e}")
            return TopicGraphType(topics=[], people=[], relations=[])

# Create GraphQL schema
schema = strawberry.Schema(query=Query)

# Create GraphQL router
graphql_app = GraphQLRouter(schema)

# Add GraphQL endpoints to the app
app.include_router(graphql_app, prefix="/graphql")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3001) 