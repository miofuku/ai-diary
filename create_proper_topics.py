#!/usr/bin/env python3
"""
Create proper topic structure with only person, project, and place nodes
Events and activities should be relationships, not separate nodes
"""

import json
import os

def create_proper_topics():
    """
    Create topics.json with only main entities: people, projects, places
    """
    
    # Load actual entries to see what content exists
    try:
        with open('data/entries.json', 'r', encoding='utf-8') as f:
            entries = json.load(f)
    except Exception as e:
        print(f"Error loading entries: {e}")
        return
    
    print(f"Analyzing {len(entries)} diary entries...")
    
    # Only extract MAIN entities: people, projects, and places
    # Events and activities should be relationships, not nodes
    main_entities = {
        # People
        "刘健": {"type": "person", "category": "people", "role": "项目合作伙伴"},
        "钟雪铭": {"type": "person", "category": "people", "role": "同事"},
        "Zoe": {"type": "person", "category": "people", "role": "同事"},
        "AJ": {"type": "person", "category": "people", "role": "同事"},
        "李湃": {"type": "person", "category": "people", "role": "同事"},
        "Razz": {"type": "person", "category": "people", "role": "同事"},
        "cat": {"type": "person", "category": "people", "role": "宠物"},
        "猫": {"type": "person", "category": "people", "role": "宠物"},
        "Yiju": {"type": "person", "category": "people", "role": "同事"},
        "代姐": {"type": "person", "category": "people", "role": "同事"},
        
        # Projects (main projects only)
        "AI口语项目": {"type": "project", "category": "projects", "importance": 5},
        "AI Fintech项目": {"type": "project", "category": "projects", "importance": 5},
        "比价项目": {"type": "project", "category": "projects", "importance": 4},
        "蓝领招聘平台": {"type": "project", "category": "projects", "importance": 4},
        "智能OA系统": {"type": "project", "category": "projects", "importance": 4},
        "AI日记项目": {"type": "project", "category": "projects", "importance": 4},
        
        # Places
        "菜地": {"type": "place", "category": "places", "importance": 3},
        "杭州": {"type": "place", "category": "places", "importance": 2},
        "办公室": {"type": "place", "category": "places", "importance": 3},
    }
    
    # Find which entities actually appear in the diary
    found_entities = {}
    all_content = " ".join([entry.get('content', '') for entry in entries]).lower()
    
    for entity_name, info in main_entities.items():
        if entity_name.lower() in all_content:
            found_entities[entity_name] = info
            print(f"✓ Found: {entity_name} ({info['type']})")
    
    # Create topics.json structure
    topics = []
    people = []
    relations = []
    
    entity_id = 1
    for entity_name, info in found_entities.items():
        entity_data = {
            "id": f"{info['type']}_{entity_name.replace(' ', '_')}_{entity_id:03d}",
            "name": entity_name,
            "type": info["type"],
            "category": info["category"],
            "importance": info.get("importance", 3),
            "sentiment": 0,
            "context": f"从日记中提取的{info['type']}: {entity_name}",
            "keywords": [entity_name.lower()]
        }
        
        if info["type"] == "person":
            entity_data["role"] = info.get("role", "提及的人物")
            people.append(entity_data)
        else:
            topics.append(entity_data)
        
        entity_id += 1
    
    # Create some basic relations between people and projects
    for person in people:
        for topic in topics:
            if topic["type"] == "project":
                # Create collaboration relationships
                relations.append({
                    "source": person["id"],
                    "target": topic["id"],
                    "type": "collaborates_with",
                    "strength": 4
                })
    
    # Save topics.json (this is the primary source for 日记主题)
    topics_data = {
        "topics": topics,
        "people": people,
        "relations": relations
    }
    
    with open('data/topics.json', 'w', encoding='utf-8') as f:
        json.dump(topics_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Created topics.json with:")
    print(f"   📁 {len(topics)} topics (projects + places)")
    print(f"   👥 {len(people)} people")
    print(f"   🔗 {len(relations)} relations")
    
    # Also update topic_graph.json for the graph visualization
    nodes = []
    edges = []
    
    # Add all entities as nodes
    for topic in topics:
        nodes.append({
            "id": topic["id"],
            "name": topic["name"],
            "type": topic["type"],
            "category": topic["category"],
            "importance": topic["importance"],
            "sentiment": topic["sentiment"],
            "context": topic["context"],
            "keywords": topic["keywords"]
        })
    
    for person in people:
        nodes.append({
            "id": person["id"],
            "name": person["name"],
            "type": "person",
            "category": "people",
            "role": person["role"],
            "importance": person["importance"]
        })
    
    # Add edges from relations
    for relation in relations:
        edges.append({
            "source": relation["source"],
            "target": relation["target"],
            "type": relation["type"],
            "strength": relation["strength"]
        })
    
    graph_data = {
        "directed": False,
        "multigraph": False,
        "graph": {},
        "nodes": nodes,
        "edges": edges
    }
    
    with open('data/topic_graph.json', 'w', encoding='utf-8') as f:
        json.dump(graph_data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Updated topic_graph.json with {len(nodes)} nodes and {len(edges)} edges")
    
    return topics_data

if __name__ == "__main__":
    print("=== Creating Proper Topic Structure ===")
    print("Only creating person, project, and place nodes")
    print("Events will be relationships, not separate nodes\n")
    
    result = create_proper_topics()
    
    if result:
        print("\n=== Topics (Projects + Places) ===")
        for topic in result["topics"]:
            print(f"- {topic['name']} ({topic['type']}, {topic['category']})")
        
        print("\n=== People ===")
        for person in result["people"]:
            print(f"- {person['name']} ({person['role']})")
        
        print(f"\n🎯 topics.json is now the primary source for 日记主题!")
        print("Refresh the web interface to see the updated topics.")
