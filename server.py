from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Union, Annotated
import uvicorn
import tempfile
import os
import json
import time
from datetime import datetime, timedelta
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
import re
import threading
import schedule
import uuid
from difflib import SequenceMatcher
import asyncio

# Load environment variables
load_dotenv()

# Config flags
USE_AI_FOR_TOPICS = os.getenv("USE_AI_FOR_TOPICS", "true").lower() == "true"

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
client = None
try:
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        # Try different initialization methods
        try:
            client = OpenAI(api_key=api_key)
            print("OpenAI client initialized successfully")
        except TypeError as te:
            # If there's a TypeError, try with minimal parameters
            print(f"Trying alternative OpenAI initialization due to: {te}")
            import openai
            openai.api_key = api_key
            client = openai
            print("OpenAI client initialized with legacy method")
    else:
        print("Warning: OPENAI_API_KEY not found in environment variables")
except Exception as e:
    print(f"Warning: Failed to initialize OpenAI client: {e}")
    client = None

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

# Topic Configuration Models
class CustomTopic(BaseModel):
    name: str
    keywords: List[str]
    color: Optional[str] = None
    category: str = "custom"

class TopicConfigUpdate(BaseModel):
    visible_topics: Optional[List[str]] = None
    hidden_topics: Optional[List[str]] = None
    topic_priorities: Optional[Dict[str, int]] = None
    auto_detection_enabled: Optional[bool] = None
    auto_detection_frequency: Optional[str] = None
    min_mentions: Optional[int] = None
    categories_enabled: Optional[List[str]] = None

class TopicVisibilityUpdate(BaseModel):
    topic_id: str
    visible: bool

class TopicPriorityUpdate(BaseModel):
    topic_id: str
    priority: int

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
topic_config_path = data_dir / 'topic_config.json'
topic_suggestions_path = data_dir / 'topic_suggestions.json'

# Enhanced ensure_data_file function with debugging
def ensure_data_file():
    try:
        # Check if data directory exists, create if not
        if not data_dir.exists():
            print(f"Creating data directory at {data_dir.absolute()}")
            data_dir.mkdir(parents=True, exist_ok=True)
        
        # Check if entries file exists, create if not
        entries_exist = False
        graph_exists = False
        
        if not data_path.exists():
            print(f"Creating new entries file at {data_path.absolute()}")
            with open(data_path, 'w') as f:
                json.dump([], f)
        else:
            # Verify the entries file has content
            try:
                with open(data_path, 'r') as f:
                    entries = json.load(f)
                    entries_exist = len(entries) > 0
                print(f"Entries file exists at {data_path.absolute()}")
                print(f"Entries found: {len(entries)}")
            except (json.JSONDecodeError, KeyError):
                print(f"Entries file exists but is invalid. Resetting it.")
                with open(data_path, 'w') as f:
                    json.dump([], f)
        
        # Check if topics file exists, create if not
        if not topics_path.exists():
            print(f"Creating new topics file at {topics_path.absolute()}")
            with open(topics_path, 'w') as f:
                json.dump({"topics": [], "people": [], "relations": []}, f)
        
        # Check if graph file exists and has content
        if not graph_path.exists():
            print(f"Creating new topic graph file at {graph_path.absolute()}")
            graph = nx.Graph()
            # Save as JSON
            graph_data = nx.node_link_data(graph)
            with open(graph_path, 'w') as f:
                json.dump(graph_data, f)
        else:
            # Verify the graph file has content
            try:
                with open(graph_path, 'r') as f:
                    graph_data = json.load(f)
                    graph_exists = len(graph_data.get('nodes', [])) > 0
                print(f"Graph file exists at {graph_path.absolute()}")
                print(f"Graph nodes found: {len(graph_data.get('nodes', []))}")
            except (json.JSONDecodeError, KeyError):
                print(f"Graph file exists but is invalid. Resetting it.")
                graph = nx.Graph()
                graph_data = nx.node_link_data(graph)
                with open(graph_path, 'w') as f:
                    json.dump(graph_data, f)

        # Check if topic config file exists, create if not
        if not topic_config_path.exists():
            print(f"Creating new topic config file at {topic_config_path.absolute()}")
            default_config = {
                "visible_topics": [],
                "hidden_topics": [],
                "custom_topics": [],
                "topic_priorities": {},
                "auto_detection_settings": {
                    "enabled": True,
                    "frequency": "weekly",
                    "min_mentions": 3,
                    "categories_enabled": ["people", "projects", "activities", "places"]
                },
                "display_settings": {
                    "max_topics_shown": 15,
                    "sort_by": "priority",
                    "group_by_category": False
                }
            }
            with open(topic_config_path, 'w') as f:
                json.dump(default_config, f, ensure_ascii=False, indent=2)

        # Check if topic suggestions file exists, create if not
        if not topic_suggestions_path.exists():
            print(f"Creating new topic suggestions file at {topic_suggestions_path.absolute()}")
            default_suggestions = {
                "pending_review": [],
                "auto_approved": [],
                "rejected": [],
                "last_detection_run": None
            }
            with open(topic_suggestions_path, 'w') as f:
                json.dump(default_suggestions, f, ensure_ascii=False, indent=2)
        
        # If entries exist but no graph data, extract topics from existing entries
        if entries_exist and not graph_exists and USE_AI_FOR_TOPICS:
            print("Entries exist but no topic graph data found. Extracting topics from existing entries...")
            # Process in background to avoid blocking startup
            import threading
            threading.Thread(target=process_existing_entries).start()
                
    except Exception as e:
        print(f"Error ensuring data file: {e}")
        # Create an in-memory fallback if all else fails
        return []

def process_existing_entries():
    """Process all existing entries to extract topics and build the topic graph"""
    try:
        # Check if AI should be used for topic extraction
        if not USE_AI_FOR_TOPICS:
            print("AI topic extraction is disabled by configuration")
            return

        # Load all entries
        with open(data_path, 'r') as f:
            entries = json.load(f)

        if not entries:
            print("No entries to process")
            return

        print(f"Processing {len(entries)} existing entries for topic extraction...")

        # Combine all entry content for bulk processing
        combined_content = "\n\n".join([entry.get('content', '') for entry in entries])

        # Extract topics from combined content
        topics_result = extract_topics(combined_content)

        # Save extracted topics
        with open(topics_path, 'w') as f:
            json.dump(topics_result, f, ensure_ascii=False, indent=2)

        print(f"Topic extraction complete. Found {len(topics_result.get('topics', []))} topics and {len(topics_result.get('people', []))} people.")

    except Exception as e:
        print(f"Error processing existing entries: {e}")

# Topic Configuration Management Functions
def load_topic_config():
    """Load user topic configuration"""
    try:
        ensure_data_file()
        with open(topic_config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading topic config: {e}")
        # Return default config
        return {
            "visible_topics": [],
            "hidden_topics": [],
            "custom_topics": [],
            "topic_priorities": {},
            "auto_detection_settings": {
                "enabled": True,
                "frequency": "weekly",
                "min_mentions": 3,
                "categories_enabled": ["people", "projects", "activities", "places"]
            },
            "display_settings": {
                "max_topics_shown": 15,
                "sort_by": "priority",
                "group_by_category": False
            }
        }

def save_topic_config(config):
    """Save user topic configuration"""
    try:
        ensure_data_file()
        with open(topic_config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving topic config: {e}")
        return False

def load_topic_suggestions():
    """Load topic suggestions"""
    try:
        ensure_data_file()
        with open(topic_suggestions_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading topic suggestions: {e}")
        return {
            "pending_review": [],
            "auto_approved": [],
            "rejected": [],
            "last_detection_run": None
        }

def save_topic_suggestions(suggestions):
    """Save topic suggestions"""
    try:
        ensure_data_file()
        with open(topic_suggestions_path, 'w', encoding='utf-8') as f:
            json.dump(suggestions, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving topic suggestions: {e}")
        return False

def get_all_available_topics():
    """Get all topics from both graph and topics files"""
    all_topics = []

    # Load from graph file
    try:
        with open(graph_path, 'r', encoding='utf-8') as f:
            graph_data = json.load(f)
            for node in graph_data.get('nodes', []):
                if node.get('type') in ['topic', 'person']:
                    all_topics.append({
                        'id': node.get('id'),
                        'name': node.get('name'),
                        'type': node.get('type'),
                        'category': node.get('category', 'activities'),
                        'importance': node.get('importance', 3),
                        'sentiment': node.get('sentiment', 0),
                        'context': node.get('context', ''),
                        'keywords': node.get('keywords', [])
                    })
    except Exception as e:
        print(f"Error loading topics from graph: {e}")

    # Load from topics file
    try:
        with open(topics_path, 'r', encoding='utf-8') as f:
            topics_data = json.load(f)

            # Add topics
            for topic in topics_data.get('topics', []):
                # Check if already exists
                if not any(t['id'] == topic.get('id') for t in all_topics):
                    all_topics.append({
                        'id': topic.get('id'),
                        'name': topic.get('name'),
                        'type': 'topic',
                        'category': topic.get('category', 'activities'),
                        'importance': topic.get('importance', 3),
                        'sentiment': topic.get('sentiment', 0),
                        'context': topic.get('context', ''),
                        'keywords': topic.get('keywords', [])
                    })

            # Add people
            for person in topics_data.get('people', []):
                # Check if already exists
                if not any(t['id'] == person.get('id') for t in all_topics):
                    all_topics.append({
                        'id': person.get('id'),
                        'name': person.get('name'),
                        'type': 'person',
                        'category': 'people',
                        'importance': person.get('importance', 3),
                        'sentiment': 0,
                        'context': person.get('context', ''),
                        'keywords': person.get('keywords', [])
                    })
    except Exception as e:
        print(f"Error loading topics from topics file: {e}")

    return all_topics

def has_related_content(topic_id, topic_name):
    """Check if a topic has related content in diary entries"""
    try:
        # Load all entries
        with open(data_path, 'r', encoding='utf-8') as f:
            entries = json.load(f)

        if not entries:
            return False

        # Check if topic name appears in any entry content
        topic_name_lower = topic_name.lower()
        for entry in entries:
            content = entry.get('content', '').lower()
            if topic_name_lower in content:
                return True

        return False
    except Exception as e:
        print(f"Error checking related content for topic {topic_id}: {e}")
        return True  # Default to showing the topic if we can't check

# Intelligent Topic Detection Pipeline
class TopicDetectionPipeline:
    def __init__(self):
        self.detection_queue = []
        self.last_run = None
        self.is_running = False
        self.batch_size = 10
        self.min_queue_size = 3
        self.detection_lock = threading.Lock()

    def add_to_queue(self, entry_id, content, priority='normal'):
        """Add entry to detection queue"""
        with self.detection_lock:
            queue_item = {
                'entry_id': entry_id,
                'content': content,
                'priority': priority,
                'added_at': datetime.now().isoformat(),
                'processed': False
            }
            self.detection_queue.append(queue_item)
            print(f"Added entry {entry_id} to topic detection queue (queue size: {len(self.detection_queue)})")

    def should_run_detection(self):
        """Determine if detection should run based on queue size and timing"""
        config = load_topic_config()
        auto_settings = config.get('auto_detection_settings', {})

        if not auto_settings.get('enabled', True):
            return False

        # Check queue size
        unprocessed_count = len([item for item in self.detection_queue if not item.get('processed', False)])
        if unprocessed_count < self.min_queue_size:
            return False

        # Check timing based on frequency setting
        frequency = auto_settings.get('frequency', 'weekly')
        if self.last_run:
            last_run_time = datetime.fromisoformat(self.last_run)
            now = datetime.now()

            if frequency == 'daily' and (now - last_run_time).days < 1:
                return False
            elif frequency == 'weekly' and (now - last_run_time).days < 7:
                return False
            elif frequency == 'monthly' and (now - last_run_time).days < 30:
                return False

        return True

    async def run_batch_detection(self):
        """Run batch topic detection on queued entries"""
        if self.is_running:
            print("Topic detection already running, skipping...")
            return

        with self.detection_lock:
            if not self.should_run_detection():
                return

            self.is_running = True
            unprocessed_items = [item for item in self.detection_queue if not item.get('processed', False)]

            if not unprocessed_items:
                self.is_running = False
                return

        try:
            print(f"🔍 Starting batch topic detection for {len(unprocessed_items)} entries...")

            # Process in batches
            for i in range(0, len(unprocessed_items), self.batch_size):
                batch = unprocessed_items[i:i + self.batch_size]
                await self._process_batch(batch)

            # Update last run time
            self.last_run = datetime.now().isoformat()

            # Save detection run info to suggestions file
            suggestions = load_topic_suggestions()
            suggestions['last_detection_run'] = self.last_run
            save_topic_suggestions(suggestions)

            print(f"✅ Batch topic detection completed")

        except Exception as e:
            print(f"❌ Error in batch topic detection: {e}")
        finally:
            self.is_running = False

    async def _process_batch(self, batch):
        """Process a batch of entries for topic detection"""
        try:
            # Combine batch content
            combined_content = "\n\n".join([
                f"Entry {item['entry_id']}: {item['content']}"
                for item in batch
            ])

            # Extract topics using existing function
            topics_result = extract_topics(combined_content)

            # Generate topic suggestions instead of immediately updating graph
            await self._generate_topic_suggestions(topics_result, batch)

            # Mark items as processed
            with self.detection_lock:
                for item in batch:
                    item['processed'] = True

            print(f"📊 Processed batch of {len(batch)} entries")

        except Exception as e:
            print(f"❌ Error processing batch: {e}")

    async def _generate_topic_suggestions(self, topics_result, batch):
        """Generate topic suggestions for user review"""
        suggestions = load_topic_suggestions()
        config = load_topic_config()
        min_mentions = config.get('auto_detection_settings', {}).get('min_mentions', 3)

        # Process detected topics
        for topic in topics_result.get('topics', []):
            topic_name = topic.get('name', '')
            if not topic_name:
                continue

            # Check if topic already exists or is suggested
            existing_topics = get_all_available_topics()
            if any(t['name'].lower() == topic_name.lower() for t in existing_topics):
                continue

            # Check if already in suggestions
            pending = suggestions.get('pending_review', [])
            if any(s['name'].lower() == topic_name.lower() for s in pending):
                continue

            # Count mentions across all entries to determine if it meets threshold
            mention_count = self._count_topic_mentions(topic_name)
            if mention_count >= min_mentions:
                suggestion = {
                    'id': f"suggested_{uuid.uuid4().hex[:8]}",
                    'name': topic_name,
                    'type': topic.get('type', 'topic'),
                    'category': topic.get('category', 'activities'),
                    'confidence': self._calculate_confidence(topic, mention_count),
                    'mention_count': mention_count,
                    'first_detected': datetime.now().isoformat(),
                    'sample_entries': [item['entry_id'] for item in batch[:3]],
                    'keywords': topic.get('keywords', []),
                    'importance': topic.get('importance', 3)
                }

                suggestions.setdefault('pending_review', []).append(suggestion)
                print(f"💡 Generated suggestion for topic: {topic_name} (mentions: {mention_count})")

        # Process detected people
        for person in topics_result.get('people', []):
            person_name = person.get('name', '')
            if not person_name:
                continue

            # Similar logic for people
            existing_people = [t for t in get_all_available_topics() if t.get('type') == 'person']
            if any(p['name'].lower() == person_name.lower() for p in existing_people):
                continue

            pending = suggestions.get('pending_review', [])
            if any(s['name'].lower() == person_name.lower() for s in pending):
                continue

            mention_count = self._count_topic_mentions(person_name)
            if mention_count >= min_mentions:
                suggestion = {
                    'id': f"suggested_{uuid.uuid4().hex[:8]}",
                    'name': person_name,
                    'type': 'person',
                    'category': 'people',
                    'confidence': self._calculate_confidence(person, mention_count),
                    'mention_count': mention_count,
                    'first_detected': datetime.now().isoformat(),
                    'sample_entries': [item['entry_id'] for item in batch[:3]],
                    'role': person.get('role', '提及的人物'),
                    'importance': person.get('importance', 3)
                }

                suggestions.setdefault('pending_review', []).append(suggestion)
                print(f"👤 Generated suggestion for person: {person_name} (mentions: {mention_count})")

        save_topic_suggestions(suggestions)

    def _count_topic_mentions(self, topic_name):
        """Count how many times a topic is mentioned across all entries"""
        try:
            with open(data_path, 'r', encoding='utf-8') as f:
                entries = json.load(f)

            count = 0
            topic_lower = topic_name.lower()
            for entry in entries:
                content = entry.get('content', '').lower()
                if topic_lower in content:
                    count += 1

            return count
        except Exception as e:
            print(f"Error counting topic mentions: {e}")
            return 0

    def _calculate_confidence(self, topic_data, mention_count):
        """Calculate confidence score for a topic suggestion"""
        base_confidence = 0.5

        # Boost confidence based on mention frequency
        mention_boost = min(mention_count * 0.1, 0.3)

        # Boost confidence based on topic importance
        importance_boost = (topic_data.get('importance', 3) - 3) * 0.05

        # Boost confidence if topic has keywords
        keyword_boost = 0.1 if topic_data.get('keywords') else 0

        confidence = base_confidence + mention_boost + importance_boost + keyword_boost
        return min(confidence, 1.0)

# Global pipeline instance
topic_pipeline = TopicDetectionPipeline()

# Scheduled Task Runner
class ScheduledTaskRunner:
    def __init__(self):
        self.scheduler_thread = None
        self.running = False

    def start_scheduler(self):
        """Start the background scheduler"""
        if self.running:
            return

        self.running = True

        # Schedule topic detection based on user preferences
        schedule.every().hour.do(self._check_and_run_detection)

        # Start scheduler in background thread
        self.scheduler_thread = threading.Thread(target=self._run_scheduler, daemon=True)
        self.scheduler_thread.start()
        print("📅 Topic detection scheduler started")

    def stop_scheduler(self):
        """Stop the background scheduler"""
        self.running = False
        schedule.clear()
        print("📅 Topic detection scheduler stopped")

    def _run_scheduler(self):
        """Run the scheduler loop"""
        while self.running:
            try:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
            except Exception as e:
                print(f"Error in scheduler: {e}")
                time.sleep(60)

    def _check_and_run_detection(self):
        """Check if detection should run and trigger it"""
        try:
            if topic_pipeline.should_run_detection():
                print("🔄 Scheduled topic detection triggered")
                # Run in separate thread to avoid blocking scheduler
                threading.Thread(target=lambda: asyncio.run(topic_pipeline.run_batch_detection())).start()
        except Exception as e:
            print(f"Error in scheduled detection check: {e}")

# Global scheduler instance
task_scheduler = ScheduledTaskRunner()

def get_user_visible_topics():
    """Get topics that should be visible to the user based on their configuration"""
    config = load_topic_config()
    all_topics = get_all_available_topics()

    # Add custom topics
    custom_topics = config.get('custom_topics', [])
    for custom_topic in custom_topics:
        all_topics.append({
            'id': custom_topic.get('id'),
            'name': custom_topic.get('name'),
            'type': 'custom',
            'category': custom_topic.get('category', 'custom'),
            'importance': custom_topic.get('priority', 3),
            'sentiment': 0,
            'context': f"Custom topic: {custom_topic.get('name')}",
            'keywords': custom_topic.get('keywords', []),
            'color': custom_topic.get('color')
        })

    # Filter out topics without related content (except custom topics)
    topics_with_content = []
    for topic in all_topics:
        if topic.get('type') == 'custom':
            # Always include custom topics
            topics_with_content.append(topic)
        else:
            # Check if topic has related content
            if has_related_content(topic['id'], topic['name']):
                topics_with_content.append(topic)
            else:
                print(f"Filtering out topic '{topic['name']}' - no related content found")

    # Filter based on user preferences
    visible_topic_ids = set(config.get('visible_topics', []))
    hidden_topic_ids = set(config.get('hidden_topics', []))

    # If no explicit visible topics set, show all except hidden
    if not visible_topic_ids:
        visible_topics = [t for t in topics_with_content if t['id'] not in hidden_topic_ids]
    else:
        visible_topics = [t for t in topics_with_content if t['id'] in visible_topic_ids and t['id'] not in hidden_topic_ids]

    # Apply priorities
    topic_priorities = config.get('topic_priorities', {})
    for topic in visible_topics:
        if topic['id'] in topic_priorities:
            topic['user_priority'] = topic_priorities[topic['id']]
        else:
            topic['user_priority'] = topic.get('importance', 3)

    # Sort by priority and importance
    display_settings = config.get('display_settings', {})
    sort_by = display_settings.get('sort_by', 'priority')

    if sort_by == 'priority':
        visible_topics.sort(key=lambda x: (x.get('user_priority', 3), x.get('importance', 3)), reverse=True)
    elif sort_by == 'name':
        visible_topics.sort(key=lambda x: x.get('name', ''))
    elif sort_by == 'category':
        visible_topics.sort(key=lambda x: (x.get('category', ''), x.get('name', '')))

    # Limit number of topics shown
    max_topics = display_settings.get('max_topics_shown', 15)
    if max_topics > 0:
        visible_topics = visible_topics[:max_topics]

    return visible_topics

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
        
        # Check if AI should be used for topic extraction
        if not USE_AI_FOR_TOPICS:
            print("AI topic extraction is disabled by configuration")
            return {"topics": [], "people": [], "relations": []}

        # Check if OpenAI client is available
        if client is None:
            print("OpenAI client is not available")
            return {"topics": [], "people": [], "relations": []}

        # Handle both new and legacy OpenAI client
        if hasattr(client, 'chat'):
            # New OpenAI client
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": """You are an intelligent diary topic extraction assistant. Your goal is to create granular, specific topics that can be easily organized and deduplicated. Analyze the provided diary entry to identify:

1. TOPICS: Extract NOUNS ONLY - people, places, objects, projects, concepts, technologies
2. PEOPLE: Extract individual person names only (not groups or relationships)
3. RELATIONS: Actions, verbs, and activities that connect topics and people

CRITICAL RULE: TOPICS MUST BE NOUNS ONLY
- Topics should be things, not actions
- Actions/verbs become relations between topics
- Focus on entities: people, places, projects, objects, concepts, tools

TOPIC EXTRACTION PRINCIPLES:
- Extract only NOUNS: person, project, place, object, concept, technology, animal
- NO VERBS or ACTIONS as topics (these become relations)
- Make each topic as SMALL and SPECIFIC as possible
- Break down compound topics into atomic noun components
- Use consistent naming (e.g., always use full names, consistent terminology)

Examples of CORRECT topic extraction:
- "Liu Jian开发项目" → "Liu Jian" (person) + "项目" (project) + relation: "develops"
- "智能OA系统开发" → "OA系统" (object) + "智能化" (concept) + relation: "develops"
- "杭州旅行" → "杭州" (place) + relation: "visits"
- "学习Python" → "Python" (technology) + relation: "learns"

Extract these elements in a structured JSON format:
{
  "topics": [
    {
      "id": "unique_string_id",
      "name": "Specific Topic Name",
      "type": "concept|object|project|technology|place|animal",
      "category": "projects|places|objects|concepts|technologies|animals",
      "importance": 1-5,
      "sentiment": -2 to +2,
      "context": "Brief context",
      "keywords": ["keyword1", "keyword2"]
    }
  ],
  "people": [
    {
      "id": "unique_string_id",
      "name": "Full Person Name",
      "category": "people",
      "role": "relationship to author",
      "importance": 1-5,
      "aliases": ["nickname1", "nickname2"]
    }
  ],
  "relations": [
    {
      "source": "topic_or_person_id",
      "target": "topic_or_person_id",
      "type": "works_on|collaborates_with|located_in|uses|develops|learns|visits|owns|manages|creates",
      "strength": 1-5
    }
  ]
}

CATEGORIES (NOUNS ONLY):
- "projects": Work/personal projects, ongoing initiatives (NOUNS)
- "places": Specific locations, venues, cities, countries (NOUNS)
- "objects": Physical items, tools, systems, products (NOUNS)
- "concepts": Ideas, methodologies, abstract concepts (NOUNS)
- "technologies": Tools, software, programming languages, platforms (NOUNS)
- "animals": Pets, animals mentioned in diary (NOUNS)

IMPORTANT RULES:
1. TOPICS MUST BE NOUNS ONLY - no verbs, no actions, no activities
2. Actions/verbs become RELATIONS between topics and people
3. Extract topics in the original language (Chinese/English)
4. Person names should be individual entities, not groups
5. Break down complex topics into atomic noun components
6. Use consistent naming conventions
7. Add keywords to help with similarity detection
8. Create relations for actions that connect nouns (verbs like: develops, learns, visits, manages)"""
                },
                {
                    "role": "user",
                    "content": f"Extract topics, people and relations from this diary entry: {content}"
                }
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        else:
            # Legacy OpenAI client
            response = client.ChatCompletion.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": """You are an intelligent diary topic extraction assistant. Your goal is to create granular, specific topics that can be easily organized and deduplicated. Analyze the provided diary entry to identify:

1. TOPICS: Extract NOUNS ONLY - people, places, objects, projects, concepts, technologies
2. PEOPLE: Extract individual person names only (not groups or relationships)
3. RELATIONS: Actions, verbs, and activities that connect topics and people

CRITICAL RULE: TOPICS MUST BE NOUNS ONLY
- Topics should be things, not actions
- Actions/verbs become relations between topics
- Focus on entities: people, places, projects, objects, concepts, tools

TOPIC EXTRACTION PRINCIPLES:
- Extract only NOUNS: person, project, place, object, concept, technology, animal
- NO VERBS or ACTIONS as topics (these become relations)
- Make each topic as SMALL and SPECIFIC as possible
- Break down compound topics into atomic noun components
- Use consistent naming (e.g., always use full names, consistent terminology)

Examples of CORRECT topic extraction:
- "Liu Jian开发项目" → "Liu Jian" (person) + "项目" (project) + relation: "develops"
- "智能OA系统开发" → "OA系统" (object) + "智能化" (concept) + relation: "develops"
- "杭州旅行" → "杭州" (place) + relation: "visits"
- "学习Python" → "Python" (technology) + relation: "learns"

Extract these elements in a structured JSON format:
{
  "topics": [
    {
      "id": "unique_string_id",
      "name": "Specific Topic Name",
      "type": "concept|object|project|technology|place|animal",
      "category": "projects|places|objects|concepts|technologies|animals",
      "importance": 1-5,
      "sentiment": -2 to +2,
      "context": "Brief context",
      "keywords": ["keyword1", "keyword2"]
    }
  ],
  "people": [
    {
      "id": "unique_string_id",
      "name": "Full Person Name",
      "category": "people",
      "role": "relationship to author",
      "importance": 1-5,
      "aliases": ["nickname1", "nickname2"]
    }
  ],
  "relations": [
    {
      "source": "topic_or_person_id",
      "target": "topic_or_person_id",
      "type": "works_on|collaborates_with|located_in|uses|develops|learns|visits|owns|manages|creates",
      "strength": 1-5
    }
  ]
}

CATEGORIES (NOUNS ONLY):
- "projects": Work/personal projects, ongoing initiatives (NOUNS)
- "places": Specific locations, venues, cities, countries (NOUNS)
- "objects": Physical items, tools, systems, products (NOUNS)
- "concepts": Ideas, methodologies, abstract concepts (NOUNS)
- "technologies": Tools, software, programming languages, platforms (NOUNS)
- "animals": Pets, animals mentioned in diary (NOUNS)

IMPORTANT RULES:
1. TOPICS MUST BE NOUNS ONLY - no verbs, no actions, no activities
2. Actions/verbs become RELATIONS between topics and people
3. Extract topics in the original language (Chinese/English)
4. Person names should be individual entities, not groups
5. Break down complex topics into atomic noun components
6. Use consistent naming conventions
7. Add keywords to help with similarity detection
8. Create relations for actions that connect nouns (verbs like: develops, learns, visits, manages)"""
                    },
                    {
                        "role": "user",
                        "content": f"Extract topics, people and relations from this diary entry: {content}"
                    }
                ],
                temperature=0.3
            )

        # Handle response from both client types
        if hasattr(response, 'choices'):
            result = json.loads(response.choices[0].message.content)
        else:
            result = json.loads(response['choices'][0]['message']['content'])

        # Generate consistent IDs for topics and people
        existing_ids = set()

        # Process topics
        for topic in result.get('topics', []):
            if not topic.get('id') or topic['id'].startswith('t') or topic['id'].startswith('topic_'):
                # Generate new ID
                base_id = generate_topic_id(topic['name'], 'topic')
                topic['id'] = ensure_unique_id(base_id, existing_ids)
                existing_ids.add(topic['id'])
            else:
                existing_ids.add(topic['id'])

        # Process people
        for person in result.get('people', []):
            if not person.get('id') or person['id'].startswith('p') or person['id'].startswith('person_'):
                # Generate new ID
                base_id = generate_topic_id(person['name'], 'person')
                person['id'] = ensure_unique_id(base_id, existing_ids)
                existing_ids.add(person['id'])
            else:
                existing_ids.add(person['id'])

        print(f"Topics extracted successfully: {len(result.get('topics', []))} topics, {len(result.get('people', []))} people")

        # Update the topic graph with new data
        update_topic_graph(result)

        return result
    except Exception as e:
        print(f"Error extracting topics: {e}")
        # If extraction fails, return empty results
        return {"topics": [], "people": [], "relations": []}

# Intelligent ID generation functions
def generate_topic_id(name, topic_type="topic"):
    """
    Generate a consistent, descriptive ID for topics and people
    """
    import re
    import unicodedata
    import hashlib

    # Normalize the name
    normalized = unicodedata.normalize('NFKC', name.strip())

    # Remove special characters and convert to lowercase
    clean_name = re.sub(r'[^\w\u4e00-\u9fff\s]', '', normalized.lower())

    # Replace spaces with underscores and remove extra whitespace
    clean_name = re.sub(r'\s+', '_', clean_name.strip())

    # For Chinese text, use pinyin-like approach or keep Chinese characters
    # For now, we'll keep Chinese characters and use a hash for uniqueness
    if re.search(r'[\u4e00-\u9fff]', clean_name):
        # For Chinese names, create a shorter hash-based ID
        base_id = clean_name[:20]  # Keep first 20 chars
        hash_suffix = hashlib.md5(name.encode('utf-8')).hexdigest()[:6]
        topic_id = f"{base_id}_{hash_suffix}"
    else:
        # For English names, use the clean name directly
        topic_id = clean_name[:30]  # Limit length

    # Add type prefix for clarity
    if topic_type == "person":
        topic_id = f"person_{topic_id}"
    elif topic_type == "topic":
        topic_id = f"topic_{topic_id}"

    return topic_id

def ensure_unique_id(base_id, existing_ids):
    """
    Ensure the ID is unique by adding a counter if necessary
    """
    if base_id not in existing_ids:
        return base_id

    counter = 1
    while f"{base_id}_{counter}" in existing_ids:
        counter += 1

    return f"{base_id}_{counter}"

# Topic similarity detection and merging functions
def calculate_topic_similarity(topic1, topic2):
    """
    Enhanced similarity calculation for better duplicate detection
    Returns a score between 0 and 1
    """
    import re
    import unicodedata

    name1 = topic1.get("name", "").strip()
    name2 = topic2.get("name", "").strip()

    # Normalize unicode characters (important for Chinese text)
    name1_norm = unicodedata.normalize('NFKC', name1).lower()
    name2_norm = unicodedata.normalize('NFKC', name2).lower()

    # Exact match (case-insensitive, normalized)
    if name1_norm == name2_norm:
        return 1.0

    # Check for exact match ignoring punctuation and spaces
    name1_clean = re.sub(r'[^\w\u4e00-\u9fff]', '', name1_norm)
    name2_clean = re.sub(r'[^\w\u4e00-\u9fff]', '', name2_norm)

    if name1_clean == name2_clean:
        return 0.95

    # For people, be more strict about name matching
    if (topic1.get("type") == "person" and topic2.get("type") == "person") or \
       (topic1.get("category") == "people" and topic2.get("category") == "people"):
        # Check if names are subsets of each other (e.g., "刘健" vs "刘健老师")
        if name1_clean in name2_clean or name2_clean in name1_clean:
            return 0.9

        # Check aliases
        aliases1 = set([alias.lower().strip() for alias in topic1.get("aliases", [])])
        aliases2 = set([alias.lower().strip() for alias in topic2.get("aliases", [])])

        if name1_norm in aliases2 or name2_norm in aliases1:
            return 0.9

        if aliases1.intersection(aliases2):
            return 0.85

    # Enhanced keyword similarity
    keywords1 = set([kw.lower().strip() for kw in topic1.get("keywords", [])])
    keywords2 = set([kw.lower().strip() for kw in topic2.get("keywords", [])])

    if keywords1 and keywords2:
        keyword_overlap = len(keywords1.intersection(keywords2)) / len(keywords1.union(keywords2))
        if keyword_overlap > 0.7:
            return 0.8
        elif keyword_overlap > 0.5:
            return 0.6

    # Check if one name contains the other (for non-people)
    if topic1.get("type") != "person" and topic2.get("type") != "person":
        if name1_clean in name2_clean or name2_clean in name1_clean:
            # Calculate containment ratio
            shorter = min(len(name1_clean), len(name2_clean))
            longer = max(len(name1_clean), len(name2_clean))
            if shorter / longer > 0.7:  # At least 70% overlap
                return 0.75

    # Enhanced Chinese character similarity
    chars1 = set(re.findall(r'[\u4e00-\u9fff]', name1_norm))
    chars2 = set(re.findall(r'[\u4e00-\u9fff]', name2_norm))

    if chars1 and chars2 and len(chars1) >= 2 and len(chars2) >= 2:
        char_overlap = len(chars1.intersection(chars2)) / len(chars1.union(chars2))
        if char_overlap > 0.8:
            return 0.7
        elif char_overlap > 0.6:
            return 0.5

    # Enhanced English word similarity
    words1 = set(re.findall(r'[a-zA-Z]+', name1_norm))
    words2 = set(re.findall(r'[a-zA-Z]+', name2_norm))

    if words1 and words2:
        word_overlap = len(words1.intersection(words2)) / len(words1.union(words2))
        if word_overlap > 0.8:
            return 0.7
        elif word_overlap > 0.6:
            return 0.5

    # Context similarity (if available)
    context1 = topic1.get("context", "").lower().strip()
    context2 = topic2.get("context", "").lower().strip()

    if context1 and context2 and len(context1) > 10 and len(context2) > 10:
        # Simple word overlap in context
        words_ctx1 = set(re.findall(r'[\w\u4e00-\u9fff]+', context1))
        words_ctx2 = set(re.findall(r'[\w\u4e00-\u9fff]+', context2))

        if words_ctx1 and words_ctx2:
            ctx_overlap = len(words_ctx1.intersection(words_ctx2)) / len(words_ctx1.union(words_ctx2))
            if ctx_overlap > 0.5:
                return 0.4

    return 0.0

def merge_similar_topics(topics):
    """
    Merge similar topics and return deduplicated list with improved thresholds
    """
    if not topics:
        return topics

    merged_topics = []
    used_indices = set()

    for i, topic in enumerate(topics):
        if i in used_indices:
            continue

        # Find similar topics
        similar_topics = [topic]
        similar_indices = [i]

        for j, other_topic in enumerate(topics[i+1:], i+1):
            if j in used_indices:
                continue

            similarity = calculate_topic_similarity(topic, other_topic)

            # Use different thresholds based on topic type
            merge_threshold = 0.85  # Default threshold
            if topic.get("type") == "person" or topic.get("category") == "people":
                merge_threshold = 0.9  # Higher threshold for people (be more careful)
            elif topic.get("category") in ["technologies", "skills"]:
                merge_threshold = 0.8  # Slightly lower for tech/skills

            if similarity >= merge_threshold:
                similar_topics.append(other_topic)
                similar_indices.append(j)

        # Merge similar topics
        if len(similar_topics) > 1:
            merged_topic = merge_topic_group(similar_topics)
            merged_topics.append(merged_topic)
            used_indices.update(similar_indices)
        else:
            merged_topics.append(topic)
            used_indices.add(i)

    return merged_topics

# Topic cleanup and deduplication utility
def cleanup_existing_topics():
    """
    Clean up existing duplicate topics in the topic graph
    """
    try:
        # Load existing topic graph
        with open(graph_path, "r", encoding="utf-8") as f:
            graph_data = json.load(f)

        nodes = graph_data.get("nodes", [])
        edges = graph_data.get("edges", [])

        # Separate topics and people
        topics = [node for node in nodes if node.get("type") == "topic"]
        people = [node for node in nodes if node.get("type") == "person"]
        other_nodes = [node for node in nodes if node.get("type") not in ["topic", "person"]]

        print(f"Before cleanup: {len(topics)} topics, {len(people)} people")

        # Merge similar topics
        merged_topics = merge_similar_topics(topics)
        merged_people = merge_similar_topics(people)

        print(f"After cleanup: {len(merged_topics)} topics, {len(merged_people)} people")

        # Create mapping of old IDs to new IDs for edge updates
        id_mapping = {}

        # Map old topic IDs to merged topic IDs
        for merged_topic in merged_topics:
            for original_topic in topics:
                if calculate_topic_similarity(merged_topic, original_topic) >= 0.85:
                    id_mapping[original_topic["id"]] = merged_topic["id"]

        # Map old people IDs to merged people IDs
        for merged_person in merged_people:
            for original_person in people:
                if calculate_topic_similarity(merged_person, original_person) >= 0.9:
                    id_mapping[original_person["id"]] = merged_person["id"]

        # Update edges with new IDs
        updated_edges = []
        for edge in edges:
            source_id = id_mapping.get(edge["source"], edge["source"])
            target_id = id_mapping.get(edge["target"], edge["target"])

            # Only keep edge if both nodes still exist
            all_node_ids = {node["id"] for node in merged_topics + merged_people + other_nodes}
            if source_id in all_node_ids and target_id in all_node_ids:
                updated_edge = edge.copy()
                updated_edge["source"] = source_id
                updated_edge["target"] = target_id
                updated_edges.append(updated_edge)

        # Remove duplicate edges
        seen_edges = set()
        final_edges = []
        for edge in updated_edges:
            edge_key = f"{edge['source']}-{edge['target']}-{edge.get('type', '')}"
            if edge_key not in seen_edges:
                seen_edges.add(edge_key)
                final_edges.append(edge)

        # Update graph data
        graph_data["nodes"] = merged_topics + merged_people + other_nodes
        graph_data["edges"] = final_edges

        # Save cleaned up graph
        with open(graph_path, "w", encoding="utf-8") as f:
            json.dump(graph_data, f, ensure_ascii=False, indent=2)

        print(f"Topic cleanup complete. Removed {len(topics) - len(merged_topics)} duplicate topics and {len(people) - len(merged_people)} duplicate people")
        print(f"Updated {len(final_edges)} edges")

        return {
            "original_topics": len(topics),
            "merged_topics": len(merged_topics),
            "original_people": len(people),
            "merged_people": len(merged_people),
            "final_edges": len(final_edges)
        }

    except Exception as e:
        print(f"Error during topic cleanup: {e}")
        return {"error": str(e)}

def merge_topic_group(topic_group):
    """
    Merge a group of similar topics into one
    """
    if not topic_group:
        return None

    # Use the most specific/longest name
    best_name = max(topic_group, key=lambda t: len(t.get("name", "")))["name"]

    # Combine keywords
    all_keywords = set()
    for topic in topic_group:
        all_keywords.update(topic.get("keywords", []))

    # Average importance and sentiment
    importances = [t.get("importance", 3) for t in topic_group]
    sentiments = [t.get("sentiment", 0) for t in topic_group]

    avg_importance = sum(importances) / len(importances)
    avg_sentiment = sum(sentiments) / len(sentiments)

    # Combine contexts
    contexts = [t.get("context", "") for t in topic_group if t.get("context")]
    combined_context = "; ".join(contexts) if contexts else ""

    # Use the first topic as base and update with merged data
    merged_topic = topic_group[0].copy()
    merged_topic.update({
        "name": best_name,
        "keywords": list(all_keywords),
        "importance": round(avg_importance),
        "sentiment": round(avg_sentiment, 2),
        "context": combined_context[:200] + "..." if len(combined_context) > 200 else combined_context
    })

    return merged_topic

# Update topic graph with new topics
def update_topic_graph(topics_result):
    """
    Update the topic graph with new topics, people, and relations
    Includes intelligent deduplication and merging
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

    # Merge similar topics in the new data
    new_topics = merge_similar_topics(topics_result.get("topics", []))

    # Add or update topics
    for topic in new_topics:
        # Check if this topic is similar to any existing topic
        merged_with_existing = False

        for existing_id, existing_node in existing_nodes.items():
            if existing_node.get("type") == "topic":
                similarity = calculate_topic_similarity(topic, existing_node)
                if similarity > 0.7:
                    # Merge with existing topic
                    merged_topic = merge_topic_group([topic, existing_node])
                    existing_nodes[existing_id].update({
                        "name": merged_topic["name"],
                        "type": "topic",
                        "category": merged_topic.get("category", "activities"),
                        "topicType": merged_topic.get("type", "concept"),
                        "importance": merged_topic.get("importance", 3),
                        "sentiment": merged_topic.get("sentiment", 0),
                        "context": merged_topic.get("context", ""),
                        "keywords": merged_topic.get("keywords", [])
                    })
                    merged_with_existing = True
                    break

        if not merged_with_existing:
            # Add as new topic
            existing_nodes[topic["id"]] = {
                "id": topic["id"],
                "name": topic["name"],
                "type": "topic",
                "category": topic.get("category", "activities"),
                "topicType": topic.get("type", "concept"),
                "importance": topic.get("importance", 3),
                "sentiment": topic.get("sentiment", 0),
                "context": topic.get("context", ""),
                "keywords": topic.get("keywords", [])
            }

    # Add or update people (with alias checking)
    for person in topics_result.get("people", []):
        # Check for existing person with same name or alias
        merged_with_existing = False
        person_name = person["name"].lower().strip()

        for existing_id, existing_node in existing_nodes.items():
            if existing_node.get("type") == "person":
                existing_name = existing_node.get("name", "").lower().strip()
                existing_aliases = [alias.lower().strip() for alias in existing_node.get("aliases", [])]

                if (person_name == existing_name or
                    person_name in existing_aliases or
                    existing_name in person.get("aliases", [])):

                    # Merge aliases
                    all_aliases = set(existing_node.get("aliases", []))
                    all_aliases.update(person.get("aliases", []))
                    if existing_name != person_name:
                        all_aliases.add(existing_name)
                        all_aliases.add(person["name"])

                    existing_nodes[existing_id].update({
                        "name": person["name"],  # Use the new name as primary
                        "type": "person",
                        "category": "people",
                        "role": person.get("role", existing_node.get("role", "")),
                        "importance": max(person.get("importance", 3), existing_node.get("importance", 3)),
                        "aliases": list(all_aliases)
                    })
                    merged_with_existing = True
                    break

        if not merged_with_existing:
            # Add new person
            existing_nodes[person["id"]] = {
                "id": person["id"],
                "name": person["name"],
                "type": "person",
                "category": "people",
                "role": person.get("role", ""),
                "importance": person.get("importance", 3),
                "aliases": person.get("aliases", [])
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
            
        # Check if we should extract topics
        should_extract = USE_AI_FOR_TOPICS
        if should_extract:
            # Check if graph file already has content
            try:
                with open(graph_path, 'r') as f:
                    graph_data = json.load(f)
                    # If we already have nodes, we can still extract for new entries
                    if len(graph_data.get('nodes', [])) > 0:
                        should_extract = USE_AI_FOR_TOPICS
            except Exception:
                # If there's an error reading the graph file, we should extract
                should_extract = USE_AI_FOR_TOPICS
            
        # Add entry to topic detection pipeline instead of immediate extraction
        if should_extract:
            print("Adding entry to topic detection pipeline...")
            topic_pipeline.add_to_queue(new_entry['id'], optimized_content, priority='normal')

            # Trigger batch detection if conditions are met
            if topic_pipeline.should_run_detection():
                # Run detection in background thread to avoid blocking response
                threading.Thread(target=lambda: asyncio.run(topic_pipeline.run_batch_detection())).start()
        else:
            print("Skipping topic extraction (AI usage disabled)")
        
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
    
    # Check if we should extract topics
    should_extract = USE_AI_FOR_TOPICS
    if should_extract:
        # Check if graph file has content
        try:
            with open(graph_path, 'r') as f:
                graph_data = json.load(f)
                # If we already have nodes, we can still extract for updated entries
                if len(graph_data.get('nodes', [])) > 0:
                    should_extract = USE_AI_FOR_TOPICS
        except Exception:
            # If there's an error reading the graph file, we should extract
            should_extract = USE_AI_FOR_TOPICS
        
    # Add updated entry to topic detection pipeline
    if should_extract:
        print("Adding updated entry to topic detection pipeline...")
        topic_pipeline.add_to_queue(id, final_content, priority='high')

        # Trigger batch detection if conditions are met
        if topic_pipeline.should_run_detection():
            # Run detection in background thread to avoid blocking response
            threading.Thread(target=lambda: asyncio.run(topic_pipeline.run_batch_detection())).start()
    else:
        print("Skipping topic extraction (AI usage disabled)")
    
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
    
    # Check if AI should be used for topic extraction
    if not USE_AI_FOR_TOPICS:
        print("AI topic thread analysis is disabled by configuration")
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
        print(f"Error analyzing topic threads: {e}")
        return {"topics": []}

# Topic cleanup endpoint
@app.post("/api/cleanup-topics")
async def cleanup_topics_endpoint():
    """
    Clean up duplicate topics in the topic graph
    """
    try:
        result = cleanup_existing_topics()
        return {"success": True, "result": result}
    except Exception as e:
        print(f"Error in topic cleanup endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Extract topics from text endpoint
@app.post("/api/extract-topics")
async def extract_topics_endpoint():
    """
    Extract topics from diary entries and update the topic graph
    """
    try:
        # Check if AI should be used for topic extraction
        if not USE_AI_FOR_TOPICS:
            return {"status": "disabled", "message": "AI topic extraction is disabled by configuration"}
        
        # Ensure the data files exist
        ensure_data_file()
        
        # Load diary entries
        entries = load_entries()
        if not entries:
            return {"status": "error", "message": "No diary entries found"}
        
        # Extract topics using OpenAI
        topics_result = await extract_topics_from_entries(entries)
        
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

@app.post("/api/deduplicate-topics")
async def deduplicate_topics_endpoint():
    """
    Manually trigger topic deduplication and merging
    """
    try:
        # Load existing topic graph
        with open(graph_path, "r", encoding="utf-8") as f:
            graph_data = json.load(f)

        # Extract topics and people
        topics = [node for node in graph_data.get("nodes", []) if node.get("type") == "topic"]
        people = [node for node in graph_data.get("nodes", []) if node.get("type") == "person"]

        # Merge similar topics
        merged_topics = merge_similar_topics(topics)

        # Merge similar people (by name/aliases)
        merged_people = []
        used_people = set()

        for i, person in enumerate(people):
            if i in used_people:
                continue

            similar_people = [person]
            similar_indices = [i]
            person_name = person.get("name", "").lower().strip()
            person_aliases = [alias.lower().strip() for alias in person.get("aliases", [])]

            for j, other_person in enumerate(people[i+1:], i+1):
                if j in used_people:
                    continue

                other_name = other_person.get("name", "").lower().strip()
                other_aliases = [alias.lower().strip() for alias in other_person.get("aliases", [])]

                # Check if names or aliases match
                if (person_name == other_name or
                    person_name in other_aliases or
                    other_name in person_aliases or
                    any(alias in other_aliases for alias in person_aliases)):

                    similar_people.append(other_person)
                    similar_indices.append(j)

            # Merge similar people
            if len(similar_people) > 1:
                # Merge people
                all_aliases = set()
                all_names = set()
                max_importance = 0
                roles = []

                for p in similar_people:
                    all_names.add(p.get("name", ""))
                    all_aliases.update(p.get("aliases", []))
                    max_importance = max(max_importance, p.get("importance", 3))
                    if p.get("role"):
                        roles.append(p.get("role"))

                # Use the longest name as primary
                primary_name = max(all_names, key=len) if all_names else person["name"]
                all_aliases.discard(primary_name)  # Remove primary name from aliases

                merged_person = {
                    "id": person["id"],  # Keep original ID
                    "name": primary_name,
                    "type": "person",
                    "category": "people",
                    "role": "; ".join(set(roles)) if roles else person.get("role", ""),
                    "importance": max_importance,
                    "aliases": list(all_aliases)
                }
                merged_people.append(merged_person)
                used_people.update(similar_indices)
            else:
                merged_people.append(person)
                used_people.add(i)

        # Rebuild the graph with merged nodes
        all_merged_nodes = merged_topics + merged_people

        # Update the graph data
        graph_data["nodes"] = all_merged_nodes

        # Save the updated graph
        with open(graph_path, "w", encoding="utf-8") as f:
            json.dump(graph_data, f, ensure_ascii=False, indent=2)

        return {
            "status": "success",
            "message": f"Successfully deduplicated topics and people",
            "original_topics": len(topics),
            "merged_topics": len(merged_topics),
            "original_people": len(people),
            "merged_people": len(merged_people),
            "topics_merged": len(topics) - len(merged_topics),
            "people_merged": len(people) - len(merged_people)
        }

    except Exception as e:
        print(f"Error deduplicating topics: {str(e)}")
        return {"status": "error", "message": f"Failed to deduplicate topics: {str(e)}"}

@app.post("/api/rebuild-topics")
async def rebuild_topics_endpoint():
    """
    Rebuild all topics from scratch with improved extraction
    """
    try:
        # Clear existing topic graph
        graph_data = {"nodes": [], "edges": []}
        with open(graph_path, "w", encoding="utf-8") as f:
            json.dump(graph_data, f, ensure_ascii=False, indent=2)

        # Clear existing topics file
        topics_data = {"topics": [], "people": [], "relations": []}
        with open(topics_path, "w", encoding="utf-8") as f:
            json.dump(topics_data, f, ensure_ascii=False, indent=2)

        # Load all entries
        entries = load_entries()
        if not entries:
            return {"status": "error", "message": "No diary entries found"}

        # Extract topics using the improved prompt
        topics_result = await extract_topics_from_entries(entries)

        # Update the topic graph with intelligent merging
        update_topic_graph(topics_result)

        return {
            "status": "success",
            "message": f"Successfully rebuilt topics from {len(entries)} entries",
            "topics_count": len(topics_result.get("topics", [])),
            "people_count": len(topics_result.get("people", [])),
            "relations_count": len(topics_result.get("relations", []))
        }

    except Exception as e:
        print(f"Error rebuilding topics: {str(e)}")
        return {"status": "error", "message": f"Failed to rebuild topics: {str(e)}"}

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

async def extract_topics_from_entries(entries):
    """
    Extract topics from ALL diary entries using the improved granular system
    """
    if not entries:
        return {"topics": [], "people": [], "relations": []}

    # Check if AI should be used for topic extraction
    if not USE_AI_FOR_TOPICS:
        print("AI topic extraction is disabled by configuration")
        return {"topics": [], "people": [], "relations": []}

    print(f"🔄 Processing {len(entries)} entries with improved granular extraction...")

    # Process entries in batches to avoid token limits and get better granularity
    batch_size = 5  # Smaller batches for better granularity
    all_topics = []
    all_people = []
    all_relations = []

    for i in range(0, len(entries), batch_size):
        batch = entries[i:i+batch_size]
        batch_content = "\n\n".join([
            f"Entry {j+1}: {entry.get('content', '')}"
            for j, entry in enumerate(batch)
        ])

        print(f"📝 Processing batch {i//batch_size + 1}/{(len(entries) + batch_size - 1)//batch_size} ({len(batch)} entries)...")

        try:
            # Use our improved extract_topics function
            batch_result = extract_topics(batch_content)

            # Collect results
            all_topics.extend(batch_result.get('topics', []))
            all_people.extend(batch_result.get('people', []))
            all_relations.extend(batch_result.get('relations', []))

        except Exception as e:
            print(f"⚠️  Error processing batch {i//batch_size + 1}: {e}")
            continue

    print(f"📊 Raw extraction: {len(all_topics)} topics, {len(all_people)} people, {len(all_relations)} relations")

    # Apply deduplication using our improved algorithm
    print("🔄 Deduplicating topics and people...")
    final_topics = merge_similar_topics(all_topics)
    final_people = merge_similar_topics(all_people)

    # Remove duplicate relations
    seen_relations = set()
    unique_relations = []
    for relation in all_relations:
        relation_key = f"{relation.get('source')}-{relation.get('target')}-{relation.get('type')}"
        if relation_key not in seen_relations:
            seen_relations.add(relation_key)
            unique_relations.append(relation)

    print(f"✅ Final result: {len(final_topics)} topics, {len(final_people)} people, {len(unique_relations)} relations")

    return {
        "topics": final_topics,
        "people": final_people,
        "relations": unique_relations
    }

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
        """
        Loads the topic graph data from the stored files without using AI processing
        """
        ensure_data_file()
        
        try:
            topics = []
            people = []
            relations = []
            
            # Try to load from the graph file (network graph format)
            try:
                with open(graph_path, 'r') as f:
                    graph_data = json.load(f)
                    
                # Check if the graph has nodes
                if len(graph_data.get('nodes', [])) > 0:
                    print("Loading topics from graph file...")
                    
                    # Process nodes to remove duplicates and merge similar topics
                    processed_nodes = {}
                    
                    # First pass: gather all nodes by normalized name
                    for node in graph_data.get('nodes', []):
                        node_id = node.get('id', '')
                        node_name = node.get('name', '').strip()
                        node_type = node.get('type', '')
                        
                        # Skip empty nodes
                        if not node_name:
                            continue
                        
                        # Create a normalized version of the name for comparison
                        normalized_name = node_name.lower()
                        
                        # If we already have this node, see which one to keep
                        if normalized_name in processed_nodes:
                            existing = processed_nodes[normalized_name]
                            # Keep the one with more information
                            if len(node.get('context', '')) > len(existing.get('context', '')):
                                processed_nodes[normalized_name] = node
                            # If both have the same amount of info, keep the one with higher importance
                            elif len(node.get('context', '')) == len(existing.get('context', '')) and \
                                 node.get('importance', 0) > existing.get('importance', 0):
                                processed_nodes[normalized_name] = node
                        else:
                            processed_nodes[normalized_name] = node
                    
                    # Second pass: convert to GraphQL types
                    for node in processed_nodes.values():
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
                    
                    # Load relations from edges, updating any references to merged nodes
                    node_ids = {node.id for node in topics + people}
                    
                    for edge in graph_data.get('edges', []):
                        source = edge.get('source', '')
                        target = edge.get('target', '')
                        
                        # Only include relations where both source and target exist
                        if source in node_ids and target in node_ids:
                            relations.append(RelationEdgeType(
                                source=source,
                                target=target,
                                type=edge.get('type', 'related_to'),
                                strength=edge.get('strength', 3)
                            ))
                else:
                    # If graph is empty, try loading from topics file
                    raise FileNotFoundError("Graph file has no nodes")
            except Exception as graph_error:
                print(f"Could not load from graph file: {graph_error}")
                
                # Try to load from the topics file (direct extraction format)
                try:
                    print("Loading topics from topics file...")
                    with open(topics_path, 'r') as f:
                        topics_data = json.load(f)
                    
                    # Convert topics to GraphQL types
                    for topic in topics_data.get('topics', []):
                        topics.append(TopicNodeType(
                            id=topic.get('id', ''),
                            name=topic.get('name', ''),
                            type='topic',
                            category=topic.get('category', 'activities'),
                            topic_type=topic.get('type', 'concept'),
                            importance=topic.get('importance', 3),
                            sentiment=topic.get('sentiment', 0),
                            context=topic.get('context', '')
                        ))
                    
                    # Convert people to GraphQL types
                    for person in topics_data.get('people', []):
                        people.append(PersonNodeType(
                            id=person.get('id', ''),
                            name=person.get('name', ''),
                            type='person',
                            category='people',
                            role=person.get('role', ''),
                            importance=person.get('importance', 3)
                        ))
                    
                    # Convert relations to GraphQL types
                    for relation in topics_data.get('relations', []):
                        relations.append(RelationEdgeType(
                            source=relation.get('source', ''),
                            target=relation.get('target', ''),
                            type=relation.get('type', 'related_to'),
                            strength=relation.get('strength', 3)
                        ))
                except Exception as topics_error:
                    print(f"Could not load from topics file: {topics_error}")
                    # Both files failed, return empty data
                    return TopicGraphType(topics=[], people=[], relations=[])
            
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

# Add a new endpoint to toggle AI usage for topic extraction
@app.get("/api/toggle-ai-topics")
async def toggle_ai_topics(enable: Optional[bool] = None):
    """Toggle whether AI should be used for topic extraction"""
    global USE_AI_FOR_TOPICS
    
    if enable is not None:
        USE_AI_FOR_TOPICS = enable
        print(f"AI for topics has been {'enabled' if enable else 'disabled'}")
        return {"status": "success", "aiEnabled": USE_AI_FOR_TOPICS}
    
    # If no parameter provided, just return current status
    return {"status": "success", "aiEnabled": USE_AI_FOR_TOPICS}

@app.get("/api/ai-topics-status")
async def ai_topics_status():
    """Return the current status of AI for topic extraction"""
    return {"aiEnabled": USE_AI_FOR_TOPICS}

# Topic Configuration Endpoints

@app.get("/api/topic-config")
async def get_topic_config():
    """Get user topic configuration"""
    try:
        config = load_topic_config()
        return {"status": "success", "config": config}
    except Exception as e:
        print(f"Error getting topic config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/topic-config")
async def update_topic_config(config_update: TopicConfigUpdate):
    """Update user topic configuration"""
    try:
        current_config = load_topic_config()

        # Update only provided fields
        if config_update.visible_topics is not None:
            current_config["visible_topics"] = config_update.visible_topics
        if config_update.hidden_topics is not None:
            current_config["hidden_topics"] = config_update.hidden_topics
        if config_update.topic_priorities is not None:
            current_config["topic_priorities"].update(config_update.topic_priorities)
        if config_update.auto_detection_enabled is not None:
            current_config["auto_detection_settings"]["enabled"] = config_update.auto_detection_enabled
        if config_update.auto_detection_frequency is not None:
            current_config["auto_detection_settings"]["frequency"] = config_update.auto_detection_frequency
        if config_update.min_mentions is not None:
            current_config["auto_detection_settings"]["min_mentions"] = config_update.min_mentions
        if config_update.categories_enabled is not None:
            current_config["auto_detection_settings"]["categories_enabled"] = config_update.categories_enabled

        success = save_topic_config(current_config)
        if success:
            return {"status": "success", "config": current_config}
        else:
            raise HTTPException(status_code=500, detail="Failed to save configuration")
    except Exception as e:
        print(f"Error updating topic config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/topics/visible")
async def get_visible_topics():
    """Get topics that should be visible to the user"""
    try:
        visible_topics = get_user_visible_topics()
        return {"status": "success", "topics": visible_topics}
    except Exception as e:
        print(f"Error getting visible topics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/topics/all")
async def get_all_topics():
    """Get all available topics"""
    try:
        all_topics = get_all_available_topics()
        config = load_topic_config()

        # Add visibility and priority information
        visible_topic_ids = set(config.get('visible_topics', []))
        hidden_topic_ids = set(config.get('hidden_topics', []))
        topic_priorities = config.get('topic_priorities', {})

        for topic in all_topics:
            topic_id = topic['id']
            topic['is_visible'] = topic_id in visible_topic_ids or (not visible_topic_ids and topic_id not in hidden_topic_ids)
            topic['is_hidden'] = topic_id in hidden_topic_ids
            topic['user_priority'] = topic_priorities.get(topic_id, topic.get('importance', 3))

        return {"status": "success", "topics": all_topics}
    except Exception as e:
        print(f"Error getting all topics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/topics/visibility")
async def update_topic_visibility(visibility_update: TopicVisibilityUpdate):
    """Update visibility of a specific topic"""
    try:
        config = load_topic_config()
        topic_id = visibility_update.topic_id
        visible = visibility_update.visible

        visible_topics = set(config.get('visible_topics', []))
        hidden_topics = set(config.get('hidden_topics', []))

        if visible:
            # Make topic visible
            visible_topics.add(topic_id)
            hidden_topics.discard(topic_id)
        else:
            # Hide topic
            hidden_topics.add(topic_id)
            visible_topics.discard(topic_id)

        config['visible_topics'] = list(visible_topics)
        config['hidden_topics'] = list(hidden_topics)

        success = save_topic_config(config)
        if success:
            return {"status": "success", "message": f"Topic visibility updated"}
        else:
            raise HTTPException(status_code=500, detail="Failed to save configuration")
    except Exception as e:
        print(f"Error updating topic visibility: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/topics/priority")
async def update_topic_priority(priority_update: TopicPriorityUpdate):
    """Update priority of a specific topic"""
    try:
        config = load_topic_config()
        topic_id = priority_update.topic_id
        priority = priority_update.priority

        # Validate priority range
        if priority < 1 or priority > 5:
            raise HTTPException(status_code=400, detail="Priority must be between 1 and 5")

        config['topic_priorities'][topic_id] = priority

        success = save_topic_config(config)
        if success:
            return {"status": "success", "message": f"Topic priority updated to {priority}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to save configuration")
    except Exception as e:
        print(f"Error updating topic priority: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/topics/custom")
async def create_custom_topic(custom_topic: CustomTopic):
    """Create a new custom topic"""
    try:
        config = load_topic_config()

        # Generate unique ID for custom topic
        import uuid
        topic_id = f"custom_{uuid.uuid4().hex[:8]}"

        # Generate color if not provided
        if not custom_topic.color:
            import random
            colors = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#feca57", "#ff9ff3", "#54a0ff", "#5f27cd"]
            custom_topic.color = random.choice(colors)

        new_custom_topic = {
            "id": topic_id,
            "name": custom_topic.name,
            "keywords": custom_topic.keywords,
            "color": custom_topic.color,
            "category": custom_topic.category,
            "created_at": datetime.now().isoformat(),
            "priority": 3
        }

        config['custom_topics'].append(new_custom_topic)

        # Make it visible by default
        if topic_id not in config.get('visible_topics', []):
            config.setdefault('visible_topics', []).append(topic_id)

        success = save_topic_config(config)
        if success:
            return {"status": "success", "topic": new_custom_topic}
        else:
            raise HTTPException(status_code=500, detail="Failed to save custom topic")
    except Exception as e:
        print(f"Error creating custom topic: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/topics/custom/{topic_id}")
async def delete_custom_topic(topic_id: str):
    """Delete a custom topic"""
    try:
        config = load_topic_config()

        # Find and remove the custom topic
        custom_topics = config.get('custom_topics', [])
        original_count = len(custom_topics)
        config['custom_topics'] = [t for t in custom_topics if t.get('id') != topic_id]

        if len(config['custom_topics']) == original_count:
            raise HTTPException(status_code=404, detail="Custom topic not found")

        # Remove from visible/hidden lists
        if 'visible_topics' in config:
            config['visible_topics'] = [t for t in config['visible_topics'] if t != topic_id]
        if 'hidden_topics' in config:
            config['hidden_topics'] = [t for t in config['hidden_topics'] if t != topic_id]

        # Remove from priorities
        if topic_id in config.get('topic_priorities', {}):
            del config['topic_priorities'][topic_id]

        success = save_topic_config(config)
        if success:
            return {"status": "success", "message": "Custom topic deleted"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete custom topic")
    except Exception as e:
        print(f"Error deleting custom topic: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/topic-suggestions")
async def get_topic_suggestions():
    """Get pending topic suggestions for user review"""
    try:
        suggestions = load_topic_suggestions()
        return {"status": "success", "suggestions": suggestions}
    except Exception as e:
        print(f"Error getting topic suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/topic-suggestions/approve/{suggestion_id}")
async def approve_topic_suggestion(suggestion_id: str):
    """Approve a topic suggestion and add it to visible topics"""
    try:
        suggestions = load_topic_suggestions()
        config = load_topic_config()

        # Find the suggestion
        pending = suggestions.get('pending_review', [])
        suggestion = None
        for i, s in enumerate(pending):
            if s.get('id') == suggestion_id:
                suggestion = pending.pop(i)
                break

        if not suggestion:
            raise HTTPException(status_code=404, detail="Suggestion not found")

        # Move to approved
        suggestions.setdefault('auto_approved', []).append(suggestion)

        # Add to visible topics
        config.setdefault('visible_topics', []).append(suggestion_id)

        # Save both files
        save_topic_suggestions(suggestions)
        save_topic_config(config)

        return {"status": "success", "message": "Topic suggestion approved"}
    except Exception as e:
        print(f"Error approving topic suggestion: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/topic-suggestions/reject/{suggestion_id}")
async def reject_topic_suggestion(suggestion_id: str):
    """Reject a topic suggestion"""
    try:
        suggestions = load_topic_suggestions()

        # Find the suggestion
        pending = suggestions.get('pending_review', [])
        suggestion = None
        for i, s in enumerate(pending):
            if s.get('id') == suggestion_id:
                suggestion = pending.pop(i)
                break

        if not suggestion:
            raise HTTPException(status_code=404, detail="Suggestion not found")

        # Move to rejected
        suggestions.setdefault('rejected', []).append(suggestion)

        save_topic_suggestions(suggestions)

        return {"status": "success", "message": "Topic suggestion rejected"}
    except Exception as e:
        print(f"Error rejecting topic suggestion: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/topics/bulk-visibility")
async def update_bulk_topic_visibility(updates: List[TopicVisibilityUpdate]):
    """Update visibility for multiple topics at once"""
    try:
        config = load_topic_config()
        visible_topics = set(config.get('visible_topics', []))
        hidden_topics = set(config.get('hidden_topics', []))

        for update in updates:
            topic_id = update.topic_id
            visible = update.visible

            if visible:
                visible_topics.add(topic_id)
                hidden_topics.discard(topic_id)
            else:
                hidden_topics.add(topic_id)
                visible_topics.discard(topic_id)

        config['visible_topics'] = list(visible_topics)
        config['hidden_topics'] = list(hidden_topics)

        success = save_topic_config(config)
        if success:
            return {"status": "success", "message": f"Updated visibility for {len(updates)} topics"}
        else:
            raise HTTPException(status_code=500, detail="Failed to save configuration")
    except Exception as e:
        print(f"Error updating bulk topic visibility: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/topics/reset-config")
async def reset_topic_config():
    """Reset topic configuration to defaults"""
    try:
        default_config = {
            "visible_topics": [],
            "hidden_topics": [],
            "custom_topics": [],
            "topic_priorities": {},
            "auto_detection_settings": {
                "enabled": True,
                "frequency": "weekly",
                "min_mentions": 3,
                "categories_enabled": ["people", "projects", "activities", "places"]
            },
            "display_settings": {
                "max_topics_shown": 15,
                "sort_by": "priority",
                "group_by_category": False
            }
        }

        success = save_topic_config(default_config)
        if success:
            return {"status": "success", "message": "Topic configuration reset to defaults", "config": default_config}
        else:
            raise HTTPException(status_code=500, detail="Failed to reset configuration")
    except Exception as e:
        print(f"Error resetting topic config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Topic Detection Pipeline Endpoints

@app.get("/api/topic-pipeline/status")
async def get_pipeline_status():
    """Get current status of the topic detection pipeline"""
    try:
        with topic_pipeline.detection_lock:
            queue_size = len(topic_pipeline.detection_queue)
            unprocessed_count = len([item for item in topic_pipeline.detection_queue if not item.get('processed', False)])

        status = {
            "is_running": topic_pipeline.is_running,
            "queue_size": queue_size,
            "unprocessed_count": unprocessed_count,
            "last_run": topic_pipeline.last_run,
            "batch_size": topic_pipeline.batch_size,
            "min_queue_size": topic_pipeline.min_queue_size
        }

        return {"status": "success", "pipeline_status": status}
    except Exception as e:
        print(f"Error getting pipeline status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/topic-pipeline/run")
async def trigger_pipeline_run():
    """Manually trigger topic detection pipeline"""
    try:
        if topic_pipeline.is_running:
            return {"status": "info", "message": "Pipeline is already running"}

        with topic_pipeline.detection_lock:
            unprocessed_count = len([item for item in topic_pipeline.detection_queue if not item.get('processed', False)])

        if unprocessed_count == 0:
            return {"status": "info", "message": "No entries in queue to process"}

        # Run detection in background thread
        threading.Thread(target=lambda: asyncio.run(topic_pipeline.run_batch_detection())).start()

        return {"status": "success", "message": f"Pipeline started for {unprocessed_count} entries"}
    except Exception as e:
        print(f"Error triggering pipeline run: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/topic-pipeline/clear-queue")
async def clear_pipeline_queue():
    """Clear the topic detection queue"""
    try:
        with topic_pipeline.detection_lock:
            old_size = len(topic_pipeline.detection_queue)
            topic_pipeline.detection_queue = []

        return {"status": "success", "message": f"Cleared {old_size} items from queue"}
    except Exception as e:
        print(f"Error clearing pipeline queue: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/topic-pipeline/queue")
async def get_pipeline_queue():
    """Get current items in the topic detection queue"""
    try:
        with topic_pipeline.detection_lock:
            queue_items = [
                {
                    "entry_id": item["entry_id"],
                    "priority": item["priority"],
                    "added_at": item["added_at"],
                    "processed": item.get("processed", False),
                    "content_preview": item["content"][:100] + "..." if len(item["content"]) > 100 else item["content"]
                }
                for item in topic_pipeline.detection_queue
            ]

        return {"status": "success", "queue": queue_items}
    except Exception as e:
        print(f"Error getting pipeline queue: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/topic-pipeline/process-all-entries")
async def process_all_entries():
    """Add all existing entries to the topic detection pipeline"""
    try:
        # Load all entries
        with open(data_path, 'r', encoding='utf-8') as f:
            entries = json.load(f)

        if not entries:
            return {"status": "info", "message": "No entries found to process"}

        # Add all entries to queue
        added_count = 0
        for entry in entries:
            content = entry.get('content', '')
            if content.strip():
                topic_pipeline.add_to_queue(entry['id'], content, priority='bulk')
                added_count += 1

        return {"status": "success", "message": f"Added {added_count} entries to detection queue"}
    except Exception as e:
        print(f"Error processing all entries: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/topic-stats")
async def get_topic_stats():
    """Get usage statistics for all topics"""
    try:
        # Load all entries
        with open(data_path, 'r', encoding='utf-8') as f:
            entries = json.load(f)

        # Load all topics
        all_topics = get_all_available_topics()

        stats = {}

        for topic in all_topics:
            topic_name = topic['name'].lower()
            mention_count = 0
            last_mentioned = None
            entry_ids = []

            # Count mentions across all entries
            for entry in entries:
                content = entry.get('content', '').lower()
                if topic_name in content:
                    mention_count += 1
                    entry_ids.append(entry['id'])
                    entry_date = entry.get('createdAt', '')
                    if not last_mentioned or entry_date > last_mentioned:
                        last_mentioned = entry_date

            stats[topic['id']] = {
                'mention_count': mention_count,
                'last_mentioned': last_mentioned,
                'entry_ids': entry_ids[:5],  # Keep only first 5 for performance
                'category': topic.get('category', 'unknown'),
                'type': topic.get('type', 'topic')
            }

        return {"status": "success", "stats": stats}
    except Exception as e:
        print(f"Error getting topic stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/topic-analytics")
async def get_topic_analytics():
    """Get comprehensive topic analytics and insights"""
    try:
        # Load all entries and topics
        with open(data_path, 'r', encoding='utf-8') as f:
            entries = json.load(f)

        all_topics = get_all_available_topics()
        config = load_topic_config()

        # Calculate analytics
        analytics = {
            "overview": calculate_topic_overview(entries, all_topics),
            "trends": calculate_topic_trends(entries, all_topics),
            "insights": generate_topic_insights(entries, all_topics, config),
            "recommendations": generate_topic_recommendations(entries, all_topics, config),
            "activity_patterns": analyze_activity_patterns(entries, all_topics),
            "topic_relationships": analyze_topic_relationships(entries, all_topics)
        }

        return {"status": "success", "analytics": analytics}
    except Exception as e:
        print(f"Error getting topic analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def calculate_topic_overview(entries, topics):
    """Calculate overview statistics for topics"""
    total_topics = len(topics)
    active_topics = 0
    total_mentions = 0

    # Calculate mentions for each topic
    for topic in topics:
        topic_name = topic['name'].lower()
        mentions = sum(1 for entry in entries if topic_name in entry.get('content', '').lower())
        if mentions > 0:
            active_topics += 1
            total_mentions += mentions

    # Calculate time range
    if entries:
        dates = [entry.get('createdAt', '') for entry in entries if entry.get('createdAt')]
        dates.sort()
        time_range = {
            "start": dates[0] if dates else None,
            "end": dates[-1] if dates else None,
            "total_days": len(set(date[:10] for date in dates)) if dates else 0
        }
    else:
        time_range = {"start": None, "end": None, "total_days": 0}

    return {
        "total_topics": total_topics,
        "active_topics": active_topics,
        "inactive_topics": total_topics - active_topics,
        "total_mentions": total_mentions,
        "avg_mentions_per_topic": total_mentions / max(active_topics, 1),
        "time_range": time_range,
        "total_entries": len(entries)
    }

def calculate_topic_trends(entries, topics):
    """Calculate topic trends over time"""
    from datetime import datetime, timedelta
    import calendar

    # Group entries by month
    monthly_data = {}
    for entry in entries:
        created_at = entry.get('createdAt', '')
        if created_at:
            try:
                date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                month_key = f"{date.year}-{date.month:02d}"
                if month_key not in monthly_data:
                    monthly_data[month_key] = []
                monthly_data[month_key].append(entry)
            except:
                continue

    # Calculate trends for top topics
    topic_trends = []
    for topic in topics[:20]:  # Top 20 topics
        topic_name = topic['name'].lower()
        monthly_mentions = {}

        for month, month_entries in monthly_data.items():
            mentions = sum(1 for entry in month_entries if topic_name in entry.get('content', '').lower())
            monthly_mentions[month] = mentions

        if sum(monthly_mentions.values()) > 0:
            topic_trends.append({
                "topic_id": topic['id'],
                "topic_name": topic['name'],
                "category": topic.get('category', 'unknown'),
                "monthly_data": monthly_mentions,
                "total_mentions": sum(monthly_mentions.values()),
                "trend_direction": calculate_trend_direction(monthly_mentions)
            })

    # Sort by total mentions
    topic_trends.sort(key=lambda x: x['total_mentions'], reverse=True)

    return {
        "monthly_overview": {month: len(entries) for month, entries in monthly_data.items()},
        "topic_trends": topic_trends[:10],  # Top 10 trending topics
        "time_periods": list(monthly_data.keys())
    }

def calculate_trend_direction(monthly_data):
    """Calculate if a topic is trending up, down, or stable"""
    if not monthly_data:
        return "stable"

    months = sorted(monthly_data.keys())
    if len(months) < 2:
        return "stable"

    recent_months = months[-3:]  # Last 3 months
    earlier_months = months[:-3] if len(months) > 3 else months[:1]

    recent_avg = sum(monthly_data[month] for month in recent_months) / len(recent_months)
    earlier_avg = sum(monthly_data[month] for month in earlier_months) / len(earlier_months)

    if recent_avg > earlier_avg * 1.2:
        return "up"
    elif recent_avg < earlier_avg * 0.8:
        return "down"
    else:
        return "stable"

def generate_topic_insights(entries, topics, config):
    """Generate intelligent insights about topic usage"""
    insights = []

    # Most active topics
    topic_activity = []
    for topic in topics:
        topic_name = topic['name'].lower()
        mentions = sum(1 for entry in entries if topic_name in entry.get('content', '').lower())
        if mentions > 0:
            topic_activity.append((topic, mentions))

    topic_activity.sort(key=lambda x: x[1], reverse=True)

    if topic_activity:
        top_topic = topic_activity[0]
        insights.append({
            "type": "most_active",
            "title": "最活跃主题",
            "description": f"'{top_topic[0]['name']}' 是您最常提及的主题，共出现 {top_topic[1]} 次",
            "topic_id": top_topic[0]['id'],
            "value": top_topic[1]
        })

    # Category distribution
    category_counts = {}
    for topic, mentions in topic_activity:
        category = topic.get('category', 'unknown')
        category_counts[category] = category_counts.get(category, 0) + mentions

    if category_counts:
        top_category = max(category_counts.items(), key=lambda x: x[1])
        insights.append({
            "type": "category_focus",
            "title": "主要关注领域",
            "description": f"您最关注 '{top_category[0]}' 相关的主题，共提及 {top_category[1]} 次",
            "category": top_category[0],
            "value": top_category[1]
        })

    # Hidden topics with high activity
    hidden_topics = set(config.get('hidden_topics', []))
    active_hidden = [(topic, mentions) for topic, mentions in topic_activity
                     if topic['id'] in hidden_topics and mentions > 5]

    if active_hidden:
        insights.append({
            "type": "hidden_active",
            "title": "隐藏的活跃主题",
            "description": f"您隐藏了 {len(active_hidden)} 个活跃主题，可能需要重新考虑显示",
            "topics": [{"name": topic['name'], "mentions": mentions} for topic, mentions in active_hidden[:3]]
        })

    # Inactive visible topics
    visible_topics = set(config.get('visible_topics', []))
    if not visible_topics:  # If no explicit visible topics, all non-hidden are visible
        visible_topics = set(topic['id'] for topic in topics if topic['id'] not in hidden_topics)

    inactive_visible = [topic for topic in topics
                       if topic['id'] in visible_topics and
                       not any(topic['name'].lower() in entry.get('content', '').lower() for entry in entries)]

    if inactive_visible:
        insights.append({
            "type": "inactive_visible",
            "title": "未使用的显示主题",
            "description": f"有 {len(inactive_visible)} 个显示的主题从未被提及，建议隐藏",
            "count": len(inactive_visible)
        })

    return insights

def generate_topic_recommendations(entries, topics, config):
    """Generate recommendations for topic management"""
    recommendations = []

    # Recommend hiding inactive topics
    inactive_topics = []
    for topic in topics:
        topic_name = topic['name'].lower()
        mentions = sum(1 for entry in entries if topic_name in entry.get('content', '').lower())
        if mentions == 0:
            inactive_topics.append(topic)

    if len(inactive_topics) > 5:
        recommendations.append({
            "type": "hide_inactive",
            "priority": "medium",
            "title": "隐藏未使用的主题",
            "description": f"建议隐藏 {len(inactive_topics)} 个从未使用的主题以简化界面",
            "action": "bulk_hide",
            "topic_ids": [topic['id'] for topic in inactive_topics]
        })

    # Recommend creating custom topics for frequent phrases
    frequent_phrases = find_frequent_phrases(entries)
    existing_topic_names = set(topic['name'].lower() for topic in topics)

    new_topic_suggestions = []
    for phrase, count in frequent_phrases:
        if phrase not in existing_topic_names and count >= 5:
            new_topic_suggestions.append({"phrase": phrase, "count": count})

    if new_topic_suggestions:
        recommendations.append({
            "type": "create_topics",
            "priority": "low",
            "title": "创建新主题建议",
            "description": f"发现 {len(new_topic_suggestions)} 个频繁出现的词汇，可以创建为新主题",
            "suggestions": new_topic_suggestions[:5]
        })

    # Recommend adjusting priorities
    topic_activity = []
    for topic in topics:
        topic_name = topic['name'].lower()
        mentions = sum(1 for entry in entries if topic_name in entry.get('content', '').lower())
        current_priority = config.get('topic_priorities', {}).get(topic['id'], 3)
        if mentions > 10 and current_priority < 4:
            topic_activity.append((topic, mentions, current_priority))

    if topic_activity:
        recommendations.append({
            "type": "adjust_priorities",
            "priority": "low",
            "title": "调整主题优先级",
            "description": f"建议提高 {len(topic_activity)} 个高频主题的优先级",
            "topics": [{"id": topic['id'], "name": topic['name'], "mentions": mentions}
                      for topic, mentions, _ in topic_activity[:3]]
        })

    return recommendations

def find_frequent_phrases(entries):
    """Find frequently mentioned phrases that could become topics"""
    import re
    from collections import Counter

    # Extract all text
    all_text = " ".join(entry.get('content', '') for entry in entries).lower()

    # Find potential topic phrases (2-4 characters for Chinese, 3-15 chars for others)
    chinese_phrases = re.findall(r'[\u4e00-\u9fff]{2,4}', all_text)
    english_phrases = re.findall(r'\b[a-zA-Z]{3,15}\b', all_text)

    # Count frequencies
    phrase_counts = Counter(chinese_phrases + english_phrases)

    # Filter out common words and return top phrases
    common_words = {'的', '了', '是', '在', '有', '和', '我', '你', '他', '她', '它', 'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'}

    filtered_phrases = [(phrase, count) for phrase, count in phrase_counts.most_common(20)
                       if phrase not in common_words and len(phrase) > 1]

    return filtered_phrases

def analyze_activity_patterns(entries, topics):
    """Analyze when topics are most active"""
    from datetime import datetime
    import calendar

    patterns = {
        "hourly": {},
        "daily": {},
        "monthly": {}
    }

    for entry in entries:
        created_at = entry.get('createdAt', '')
        if created_at:
            try:
                date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                hour = date.hour
                day = calendar.day_name[date.weekday()]
                month = calendar.month_name[date.month]

                patterns["hourly"][hour] = patterns["hourly"].get(hour, 0) + 1
                patterns["daily"][day] = patterns["daily"].get(day, 0) + 1
                patterns["monthly"][month] = patterns["monthly"].get(month, 0) + 1
            except:
                continue

    return {
        "peak_hour": max(patterns["hourly"].items(), key=lambda x: x[1]) if patterns["hourly"] else None,
        "peak_day": max(patterns["daily"].items(), key=lambda x: x[1]) if patterns["daily"] else None,
        "peak_month": max(patterns["monthly"].items(), key=lambda x: x[1]) if patterns["monthly"] else None,
        "hourly_distribution": patterns["hourly"],
        "daily_distribution": patterns["daily"],
        "monthly_distribution": patterns["monthly"]
    }

def analyze_topic_relationships(entries, topics):
    """Analyze which topics frequently appear together"""
    topic_cooccurrence = {}

    for entry in entries:
        content = entry.get('content', '').lower()
        mentioned_topics = []

        for topic in topics:
            if topic['name'].lower() in content:
                mentioned_topics.append(topic['id'])

        # Record co-occurrences
        for i, topic1 in enumerate(mentioned_topics):
            for topic2 in mentioned_topics[i+1:]:
                pair = tuple(sorted([topic1, topic2]))
                topic_cooccurrence[pair] = topic_cooccurrence.get(pair, 0) + 1

    # Get top relationships
    top_relationships = sorted(topic_cooccurrence.items(), key=lambda x: x[1], reverse=True)[:10]

    relationships = []
    for (topic1_id, topic2_id), count in top_relationships:
        topic1_name = next((t['name'] for t in topics if t['id'] == topic1_id), topic1_id)
        topic2_name = next((t['name'] for t in topics if t['id'] == topic2_id), topic2_id)

        relationships.append({
            "topic1": {"id": topic1_id, "name": topic1_name},
            "topic2": {"id": topic2_id, "name": topic2_name},
            "cooccurrence_count": count
        })

    return relationships

# Add a new endpoint to find entries related to a specific topic
@app.get("/api/topic-entries/{topic_id}")
async def get_topic_entries(topic_id: str, concise: bool = False):
    """
    Get entries related to a specific topic
    If concise=True, return only the relevant text snippets instead of full content
    """
    try:
        # Ensure data directories exist
        ensure_data_file()
        
        # Load the topic graph data to get information about the topic
        topic_data = None
        
        # Try to load from graph_path
        graph_path = os.path.join(data_dir, "topic_graph.json")
        try:
            if os.path.exists(graph_path) and os.path.getsize(graph_path) > 0:
                with open(graph_path, "r") as f:
                    graph_data = json.load(f)
                    
                # Find the topic node
                for node in graph_data.get("nodes", []):
                    if node.get("id") == topic_id:
                        topic_data = node
                        break
        except Exception as e:
            print(f"Error loading graph data: {e}")
        
        # If topic not found in graph, try topics.json
        if not topic_data:
            topics_path = os.path.join(data_dir, "topics.json")
            try:
                if os.path.exists(topics_path) and os.path.getsize(topics_path) > 0:
                    with open(topics_path, "r") as f:
                        topics_data = json.load(f)
                        
                    # Find the topic
                    for topic in topics_data:
                        if topic.get("id") == topic_id:
                            topic_data = topic
                            break
            except Exception as e:
                print(f"Error loading topics data: {e}")
        
        if not topic_data:
            return {"status": "error", "message": f"Topic with ID {topic_id} not found"}
        
        topic_name = topic_data.get("name", "Unknown Topic")
        
        # Load all entries
        entries = load_entries()
        
        # Find entries that mention this topic
        related_entries = []
        
        for entry in entries:
            entry_content = entry.get("content", "")
            entry_date = entry.get("createdAt", "")
            
            # Skip entries without content or date
            if not entry_content or not entry_date:
                continue
            
            # Format the date as YYYY年MM月DD日
            try:
                date_obj = datetime.fromisoformat(entry_date.replace('Z', '+00:00'))
                formatted_date = f"{date_obj.year}年{date_obj.month}月{date_obj.day}日"
            except Exception:
                # Fallback to raw date
                formatted_date = entry_date
            
            # Check if topic is mentioned in the entry
            if topic_name.lower() in entry_content.lower():
                # Find a relevant excerpt containing the topic name
                topic_lower = topic_name.lower()
                content_lower = entry_content.lower()
                
                if concise:
                    # Extract a concise excerpt showing just the relevant text
                    # Find all occurrences of the topic in the content
                    positions = [m.start() for m in re.finditer(re.escape(topic_lower), content_lower)]
                    
                    if positions:
                        # Extract context around the first occurrence
                        pos = positions[0]
                        
                        # Determine the start and end of the excerpt
                        excerpt_start = max(0, pos - 30)
                        excerpt_end = min(len(entry_content), pos + len(topic_name) + 30)
                        
                        # Find sentence boundaries or stops to make the excerpt more natural
                        # Chinese stops: 。 ！ ？  English stops: . ! ?
                        stops = ['。', '！', '？', '.', '!', '?']
                        
                        # Check if there's a stop before the topic mention
                        text_before = entry_content[excerpt_start:pos]
                        
                        # Find the last stop before the topic
                        last_stop_index = -1
                        for stop in stops:
                            stop_index = text_before.rfind(stop)
                            if stop_index > last_stop_index:
                                last_stop_index = stop_index
                        
                        # If we found a stop, start from just after it
                        if last_stop_index >= 0:
                            excerpt_start = excerpt_start + last_stop_index + 1
                            # Skip whitespace after the stop
                            while excerpt_start < pos and entry_content[excerpt_start].isspace():
                                excerpt_start += 1
                        
                        # For the ending boundary, find the next stop after the topic
                        text_after = entry_content[pos + len(topic_name):excerpt_end]
                        
                        # Find the first stop after the topic
                        first_stop_index = len(text_after)
                        for stop in stops:
                            stop_index = text_after.find(stop)
                            if stop_index >= 0 and stop_index < first_stop_index:
                                first_stop_index = stop_index
                        
                        # If we found a stop, end at it (including the stop)
                        if first_stop_index < len(text_after):
                            excerpt_end = pos + len(topic_name) + first_stop_index + 1
                        
                        # Extract the context
                        excerpt = entry_content[excerpt_start:excerpt_end].strip()
                        
                        # Highlight the topic name
                        highlighted_excerpt = re.sub(
                            f"({re.escape(topic_name)})",
                            r"<span class='highlight'>\1</span>",
                            excerpt,
                            flags=re.IGNORECASE
                        )
                    else:
                        # Fallback - should rarely happen
                        excerpt = entry_content[:100] + "..." if len(entry_content) > 100 else entry_content
                        highlighted_excerpt = excerpt
                else:
                    # Use a larger excerpt for full display
                    if len(entry_content) > 500:
                        # Find a section containing the topic
                        topic_pos = content_lower.find(topic_lower)
                        if topic_pos != -1:
                            start_pos = max(0, topic_pos - 200)
                            end_pos = min(len(entry_content), topic_pos + 300)
                            excerpt = entry_content[start_pos:end_pos]
                        else:
                            excerpt = entry_content[:500] + "..."
                    else:
                        excerpt = entry_content
                    
                    # Highlight the topic name
                    highlighted_excerpt = re.sub(
                        f"({re.escape(topic_name)})",
                        r"<span class='highlight'>\1</span>",
                        excerpt,
                        flags=re.IGNORECASE
                    )
                
                related_entries.append({
                    'id': entry.get('id'),
                    'date': formatted_date,
                    'title': f"{topic_name} - {formatted_date}",
                    'excerpt': highlighted_excerpt
                })
        
        # Sort entries by date (newest first)
        related_entries.sort(key=lambda x: x['date'], reverse=True)
        
        return {
            "status": "success",
            "topic": topic_name,
            "entries": related_entries
        }
    except Exception as e:
        print(f"Error finding topic entries: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    # Start the topic detection scheduler
    task_scheduler.start_scheduler()

    try:
        uvicorn.run(app, host="0.0.0.0", port=3001)
    finally:
        # Stop scheduler on shutdown
        task_scheduler.stop_scheduler()